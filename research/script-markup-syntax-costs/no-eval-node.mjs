// Which compile steps evaluate strings as code. Node's --disallow-code-generation-from-strings
// makes eval and new Function throw, as a CSP without 'unsafe-eval' does in the browser.
// Run: node --disallow-code-generation-from-strings no-eval-node.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const jsx = read("scripts/jsx.jsx");
const sfcSource = read("scripts/sfc.vue");
const template = read("scripts/template.js").match(/template: `([\s\S]*?)`,\n/)[1];

const sfc = require("@vue/compiler-sfc");
const compilerDom = require("@vue/compiler-dom");

const cases = {
  "esbuild (native)": async () => (await import("esbuild")).transform(jsx, { loader: "jsx", jsx: "automatic", jsxImportSource: "vue" }),
  sucrase: () => require("sucrase").transform(jsx, { transforms: ["jsx"], jsxRuntime: "automatic", jsxImportSource: "vue" }),
  "@babel/standalone": () => require("@babel/standalone").transform(jsx, { plugins: [["transform-react-jsx", { runtime: "automatic", importSource: "vue" }]] }),
  // Through the self-contained bundle from sizes.mjs: under this flag Node's CommonJS export
  // scanner (itself WebAssembly) cannot run, so the plugin's ESM import of @vue/shared fails to link.
  "@babel/core + @vue/babel-plugin-jsx": async () => (await import("./out/browser/babel-vue-jsx.js")).compile(jsx),
  "compiler-dom compile (code string only)": () => compilerDom.compile(template, { hoistStatic: true }),
  "compiler-dom compile + new Function (what vue's full build does)": () =>
    new Function("Vue", compilerDom.compile(template, { hoistStatic: true }).code),
  "compiler-sfc parse + compileScript (default options)": () =>
    sfc.compileScript(sfc.parse(sfcSource, { filename: "contacts.vue" }).descriptor, { id: "contacts", inlineTemplate: true }),
  "compiler-sfc, sourceMap: false": () =>
    sfc.compileScript(sfc.parse(sfcSource, { filename: "contacts.vue", sourceMap: false }).descriptor,
      { id: "contacts", inlineTemplate: true, sourceMap: false }),
};

for (const [name, run] of Object.entries(cases)) {
  try {
    await run();
    console.log(`ok      ${name}`);
  } catch (e) {
    const frame = e.stack.split("\n").find((l) => l.includes("node_modules")) ?? "";
    console.log(`THROWS  ${name}: ${e.message}\n        at ${frame.trim()}`);
  }
}
process.exit(0);
