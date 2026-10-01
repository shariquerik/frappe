// Which TypeScript syntax each tool accepts. For every snippet and tool:
//   "ok"      stripped, output runs as plain JS (checked with @babel/parser),
//             and the marker `after` stays on the same line and column
//   "lines"   stripped, same line, column moved
//   "moved"   stripped, but the marker changed line
//   "error"   the tool refused the snippet (message kept)
// Usage: node syntax.mjs > out/syntax.json
import { tools, fromFrontend } from "./tools.mjs";

const { parse } = fromFrontend("@babel/parser");

const SNIPPETS = {
  "annotations, interface, type alias": "interface A { x: number }\ntype B = A | null;\nlet a: A = { x: 1 };\nfunction f(p: B, q?: string): void {}\nafter();",
  "generics on calls and arrows": "const r = ref<string>('');\nconst id = <T,>(x: T): T => x;\nafter();",
  "as, satisfies, non-null !": "const v = (x as any)!.y satisfies number;\nafter();",
  "import type / export type": "import type { A } from 'a';\nimport { b, type C } from 'b';\nexport type { A };\nafter();",
  "declare const / declare module": "declare const g: number;\ndeclare module 'm' { const x: number }\nafter();",
  "class: implements, abstract, modifiers": "abstract class K implements I {\n  private readonly a: number = 1;\n  declare b: string;\n  c!: number;\n  abstract m(): void;\n}\nafter();",
  "class parameter properties": "class P {\n  constructor(private x: number) {}\n}\nafter();",
  enum: "enum E { A, B }\nafter();",
  "const enum": "const enum E { A, B }\nafter();",
  "namespace with code": "namespace N { export const a = 1 }\nafter();",
  "namespace types only": "namespace N { export type T = number }\nafter();",
  "import x = require()": "import fs = require('fs');\nafter();",
  "export =": "const z = 1;\nexport = z;\nafter();",
  "angle-bracket assertion <T>x": "const w = <number>someValue;\nafter();",
  "legacy decorator": "@dec class D {}\nafter();",
  "function overloads": "function o(a: string): void;\nfunction o(a: any) {}\nafter();",
  "this parameter": "function t(this: Window, a: number) {}\nafter();",
  "arrow return type across lines": "const h = (a: number)\n  : number => a;\nafter();",
};

function where(text) {
  const i = text.indexOf("after()");
  if (i < 0) return null;
  const before = text.slice(0, i).split("\n");
  return `${before.length}:${before.at(-1).length}`;
}

const loaded = {};
const only = process.env.TOOLS?.split(",");
for (const [name, tool] of Object.entries(tools))
  if (!only || only.includes(name)) loaded[name] = await tool.load();

const result = {};
for (const [label, source] of Object.entries(SNIPPETS)) {
  result[label] = {};
  for (const [name, strip] of Object.entries(loaded)) {
    let cell;
    try {
      const out = strip(source);
      parse(out, { sourceType: "module" }); // must be plain JS now
      const [a, b] = [where(source), where(out)];
      if (a === b) cell = "ok";
      else if (b && a.split(":")[0] === b.split(":")[0]) cell = "lines";
      else cell = "moved";
    } catch (error) {
      cell = `error: ${String(error.message ?? error).split("\n")[0].slice(0, 90)}`;
    }
    result[label][name] = cell;
  }
}
console.log(JSON.stringify(result, null, 2));
