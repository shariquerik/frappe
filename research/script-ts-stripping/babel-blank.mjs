// Sketch, not a finished stripper: blank TypeScript-only syntax to spaces
// using the @babel/parser AST the compile module already builds. It shows
// the cost of the "no new dependency" route. It covers common erasable
// syntax only; ts-blank-space (about 800 lines) shows what a complete
// version must also handle (ASI hazards, arrow return types across lines,
// `this` parameters, overloads).
import { fromFrontend } from "./tools.mjs";

const { parse } = fromFrontend("@babel/parser");

class Unsupported extends Error {}

const REFUSE = {
  TSEnumDeclaration: "enum",
  TSParameterProperty: "parameter property",
  TSImportEqualsDeclaration: "import alias (import x = ...)",
  TSExportAssignment: "export =",
  Decorator: "decorator",
};

export function babelBlank(code) {
  const ast = parse(code, { sourceType: "module", plugins: ["typescript"] });
  const out = code.split("");
  const blank = (start, end) => {
    for (let i = start; i < end; i++) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  const blankListItem = (node, list) => {
    const next = list[list.indexOf(node) + 1];
    blank(node.start, next ? next.start : node.end);
  };

  const visit = (node, parent) => {
    if (!node || typeof node.type !== "string") return;
    if (node.declare) return blank(outer(node, parent).start, outer(node, parent).end);
    if (REFUSE[node.type] && !node.declare) throw new Unsupported(REFUSE[node.type]);
    switch (node.type) {
      case "TSModuleDeclaration":
        throw new Unsupported("namespace with runtime code");
      case "TSInterfaceDeclaration":
      case "TSTypeAliasDeclaration":
      case "TSDeclareFunction":
      case "TSDeclareMethod":
        return blank(outer(node, parent).start, outer(node, parent).end);
      case "ImportDeclaration":
      case "ExportNamedDeclaration":
        if (node.importKind === "type" || node.exportKind === "type") return blank(node.start, node.end);
        for (const s of node.specifiers ?? [])
          if (s.importKind === "type" || s.exportKind === "type") blankListItem(s, node.specifiers);
        break;
      case "TSTypeAnnotation":
      case "TSTypeParameterDeclaration":
      case "TSTypeParameterInstantiation":
        return blank(node.start, node.end);
      case "TSAsExpression":
      case "TSSatisfiesExpression":
        blank(node.expression.end, node.end);
        return visit(node.expression, node);
      case "TSNonNullExpression":
        blank(node.end - 1, node.end);
        return visit(node.expression, node);
      case "TSTypeAssertion":
        blank(node.start, node.expression.start);
        return visit(node.expression, node);
      case "ClassDeclaration":
      case "ClassExpression":
        if (node.implements?.length) blank(node.superClass?.end ?? node.id?.end ?? node.start, node.body.start);
        if (node.abstract) blank(node.start, node.start + "abstract".length);
        break;
    }
    if (node.optional && node.type === "Identifier" && code[node.start + node.name.length] === "?")
      blank(node.start + node.name.length, node.start + node.name.length + 1);
    if (node.accessibility || node.readonly || node.override || node.definite)
      throw new Unsupported("class member modifiers (sketch does not handle them)");
    for (const key in node) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach((child) => visit(child, node));
      else if (value && typeof value === "object") visit(value, node);
    }
  };
  const outer = (node, parent) => (parent?.type === "ExportNamedDeclaration" ? parent : node);

  visit(ast.program, null);
  return out.join("");
}

export { Unsupported };
