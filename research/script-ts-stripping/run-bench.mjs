// Runs bench-one.mjs for every tool in fresh processes and keeps the medians.
// Usage: node run-bench.mjs [runs] > out/node.json
import { execFileSync } from "node:child_process";
import { tools, versions } from "./tools.mjs";

const runs = Number(process.argv[2] ?? 7);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (n) => Math.round(n * 1000) / 1000;

const result = {};
for (const name of Object.keys(tools)) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const out = execFileSync(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", "bench-one.mjs", name],
      { cwd: new URL(".", import.meta.url), encoding: "utf8" },
    );
    samples.push(JSON.parse(out));
  }
  const last = samples.at(-1);
  result[name] = {
    where: tools[name].where,
    loadMs: round(median(samples.map((s) => s.loadMs))),
    firstStripMs: round(median(samples.map((s) => s.firstMs))),
    warmStripMs: round(median(samples.map((s) => s.warmMedianMs))),
    linesKept: last.lines,
    columnsKept: last.columns,
    inputLines: last.inputLines,
    outputLines: last.outputLines,
    templateKeyLine: last.templateLines,
    moved: last.moved.slice(0, 3),
  };
}
console.log(JSON.stringify({ runs, versions: versions(), platform: `${process.platform}-${process.arch}`, tools: result }, null, 2));
