// Runs one tool in a fresh process: load time, first strip, warm strip,
// whether line and column of key tokens survive, and whether the stripped
// output still goes through the template path (@babel/parser in plain JS mode,
// then @vue/compiler-dom on the template string).
// Usage: node bench-one.mjs <tool> [script.ts]
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { tools, fromFrontend } from "./tools.mjs";

const name = process.argv[2];
const file = process.argv[3] ?? new URL("./scripts/contacts.ts", import.meta.url);
const source = readFileSync(file, "utf8");

const MARKERS = [
  "const Contacts", "setup(", "const open", "const note", "const contacts",
  "const theme", "const save", "last_note", "open.value = false", "return { open",
  "template:", "<Badge", "v-for", "</Dialog>", "export default", "onRefresh(",
  "page.panelSections",
];

function position(text, marker) {
  const index = text.indexOf(marker);
  if (index < 0) return null;
  const before = text.slice(0, index).split("\n");
  return { line: before.length, column: before.at(-1).length };
}

function compare(input, output) {
  let lines = true;
  let columns = true;
  const moved = [];
  for (const marker of MARKERS) {
    const a = position(input, marker);
    const b = position(output, marker);
    if (!b || a.line !== b.line) lines = false;
    if (!b || a.line !== b.line || a.column !== b.column) {
      columns = false;
      moved.push({ marker, from: a, to: b });
    }
  }
  return { lines, columns, moved };
}

function templatePath(js) {
  const { parse } = fromFrontend("@babel/parser");
  const { compile } = fromFrontend("@vue/compiler-dom");
  const ast = parse(js, { sourceType: "module" });
  const found = [];
  const walk = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ObjectProperty" && node.key.type === "Identifier" && node.key.name === "template") {
      const quasi = node.value.quasis?.[0]?.value.cooked;
      compile(quasi, { mode: "module", prefixIdentifiers: true, hoistStatic: true });
      found.push(node.loc.start.line);
    }
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && key !== "loc") walk(value);
    }
  };
  walk(ast.program);
  return found;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

let t = performance.now();
const strip = await tools[name].load();
const loadMs = performance.now() - t;

t = performance.now();
const output = strip(source);
const firstMs = performance.now() - t;

const warm = [];
for (let i = 0; i < 300; i++) {
  t = performance.now();
  strip(source);
  warm.push(performance.now() - t);
}

let templateLines;
try {
  templateLines = templatePath(output);
} catch (error) {
  templateLines = `failed: ${error.message.split("\n")[0]}`;
}

console.log(
  JSON.stringify({
    tool: name,
    loadMs,
    firstMs,
    warmMedianMs: median(warm),
    inputBytes: Buffer.byteLength(source),
    outputBytes: Buffer.byteLength(output),
    inputLines: source.split("\n").length,
    outputLines: output.split("\n").length,
    templateLines,
    ...compare(source, output),
    output: process.env.SHOW_OUTPUT ? output : undefined,
  }),
);
