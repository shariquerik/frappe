// A stand-in for the compile module's work on one stored script, run the way
// the server would run it: one fresh `node` process per compile.
// Usage: node pipeline.mjs <variant>
//   js            the JS sample, no stripping (today's chosen path)
//   <tool name>   the TS sample, stripped by that tool first (see tools.mjs)
import { readFileSync } from "node:fs";
import { tools, fromFrontend } from "./tools.mjs";

const variant = process.argv[2];
const isJs = variant === "js";
let code = readFileSync(new URL(`./scripts/contacts.${isJs ? "js" : "ts"}`, import.meta.url), "utf8");
if (!isJs) code = (await tools[variant].load())(code);

const { parse } = fromFrontend("@babel/parser");
const { compile } = fromFrontend("@vue/compiler-dom");
const ast = parse(code, { sourceType: "module" });
let compiled = 0;
const walk = (node) => {
  if (!node || typeof node.type !== "string") return;
  if (node.type === "ObjectProperty" && node.key.name === "template") {
    compile(node.value.quasis[0].value.cooked, { mode: "module", prefixIdentifiers: true, hoistStatic: true });
    compiled++;
  }
  for (const key in node) {
    const value = node[key];
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object" && key !== "loc") walk(value);
  }
};
walk(ast.program);
if (compiled !== 1) throw new Error(`expected one template, found ${compiled}`);
