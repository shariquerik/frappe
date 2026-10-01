// Runs time-node.mjs RUNS times per candidate, each in a fresh process, and reports medians.
// Output is stable if every run of a candidate produced byte-identical code.
// Run: node run-node.mjs   (writes out/node.json and out/node/<candidate>.js)
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { SOURCE_OF, RENDER_SOURCE_OF, median } from "./candidates.mjs";

const RUNS = 7;
const here = new URL(".", import.meta.url).pathname;
mkdirSync(`${here}out/node`, { recursive: true });

const runsOf = (id) =>
  Array.from({ length: RUNS }, () =>
    JSON.parse(execFileSync("node", [`${here}time-node.mjs`, id], {
      cwd: here,
      encoding: "utf8",
      // vue's Node entry picks its production build on this, as the browser page does.
      env: { ...process.env, NODE_ENV: "production" },
    })));
const med = (runs, key, digits) => +median(runs.map((r) => r[key])).toFixed(digits);

const compiles = {};
for (const id of Object.keys(SOURCE_OF)) {
  const runs = runsOf(id);
  writeFileSync(`${here}out/node/${id.replace("/", "--")}.js`, runs[0].code);
  compiles[id] = {
    loadMs: med(runs, "loadMs", 1),
    firstMs: med(runs, "firstMs", 2),
    warmMs: med(runs, "warmMs", 3),
    outBytes: runs[0].outBytes,
    stable: new Set(runs.map((r) => r.sha256)).size === 1,
    sha256: runs[0].sha256,
  };
}

const renders = {};
for (const id of Object.keys(RENDER_SOURCE_OF)) {
  const runs = runsOf(id);
  renders[id] = { firstRenderMs: med(runs, "firstMs", 3), warmRenderMs: med(runs, "warmMs", 4) };
}

writeFileSync(`${here}out/node.json`, JSON.stringify({ node: process.version, runs: RUNS, compiles, renders }, null, 2));
console.table(compiles);
console.table(renders);
