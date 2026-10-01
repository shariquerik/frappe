// Does the same compiler version give the same output from each of its published builds?
// A cache key must name whatever makes the output differ.
// Run: node builds-differ.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { templateOf } from "./candidates.mjs";

const require = createRequire(import.meta.url);
const nm = (p) => new URL(`./node_modules/${p}`, import.meta.url).pathname;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const template = templateOf(readFileSync(new URL("scripts/template.js", import.meta.url), "utf8"));
const options = { hoistStatic: true, onWarn() {} };

const builds = {
  "compiler-dom cjs (dev)": require(nm("@vue/compiler-dom/dist/compiler-dom.cjs.js")),
  "compiler-dom cjs (prod)": require(nm("@vue/compiler-dom/dist/compiler-dom.cjs.prod.js")),
  "compiler-dom esm-browser (dev)": await import(nm("@vue/compiler-dom/dist/compiler-dom.esm-browser.js")),
  "compiler-dom esm-browser (prod)": await import(nm("@vue/compiler-dom/dist/compiler-dom.esm-browser.prod.js")),
};
const outputs = {};
for (const [name, compilerDom] of Object.entries(builds)) {
  outputs[name] = compilerDom.compile(template, options).code;
  console.log(hash(outputs[name]), outputs[name].length, name);
}

// Show the first line where the two production builds differ.
const a = outputs["compiler-dom cjs (prod)"].split("\n");
const b = outputs["compiler-dom esm-browser (prod)"].split("\n");
const i = a.findIndex((line, n) => line !== b[n]);
if (i >= 0) console.log(`first difference, line ${i + 1}:\n  cjs:     ${a[i]}\n  browser: ${b[i]}`);
