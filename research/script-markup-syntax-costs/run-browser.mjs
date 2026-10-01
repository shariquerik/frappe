// Drives bench.html / check.html in headless Chrome (playwright-core, the installed Chrome).
// Timing: RUNS fresh pages per candidate, no CSP, production vue; medians reported.
// Check: one page per candidate per CSP level, development vue, to see warnings and violations.
// Run: node run-browser.mjs   (writes out/browser.json)
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { serve } from "./serve.mjs";
import { SOURCE_OF, RENDER_SOURCE_OF, median } from "./candidates.mjs";

const RUNS = 7;
const CSP_LEVELS = ["none", "strict", "strict-wasm"];
// Native esbuild has no browser build; esbuild-wasm is its browser form.
const ids = [...Object.keys(SOURCE_OF).filter((id) => id !== "jsx/esbuild"), ...Object.keys(RENDER_SOURCE_OF)];

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function visit(path) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const console_ = [];
  page.on("console", (m) => m.type() !== "log" && console_.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
  await page.goto(`${origin}${path}`);
  const result = await page.waitForFunction(() => window.__result, null, { timeout: 60000 }).then((h) => h.jsonValue());
  await context.close();
  return { ...result, console: console_ };
}

const timing = {};
for (const id of ids) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await visit(`/bench.html?id=${id}&mode=time&csp=none`));
  const failed = runs.find((r) => r.error);
  const med = (key, d) => (runs[0][key] === undefined ? undefined : +median(runs.map((r) => r[key])).toFixed(d));
  timing[id] = failed ? { error: failed.error } : {
    loadMs: med("loadMs", 1),
    firstMs: med("firstMs", 2),
    warmMs: med("warmMs", 3),
    stable: runs[0].sha256 ? new Set(runs.map((r) => r.sha256)).size === 1 : undefined,
    sha256: runs[0].sha256,
  };
}

const checks = {};
for (const id of ids) {
  checks[id] = {};
  for (const csp of CSP_LEVELS) checks[id][csp] = await visit(`/check.html?id=${id}&mode=check&csp=${csp}`);
}

writeFileSync(new URL("./out/browser.json", import.meta.url), JSON.stringify({
  browser: `Chrome ${browser.version()}`, runs: RUNS, timing, checks,
}, null, 2));
console.table(timing);
for (const [id, byCsp] of Object.entries(checks)) {
  for (const [csp, r] of Object.entries(byCsp)) {
    console.log(id.padEnd(22), csp.padEnd(12), r.error ? `ERROR ${r.error}` :
      `saved=${r.saved} closedAfterSave=${r.closedAfterSave} warnings=${r.warnings.length} errors=${r.errors.length}`,
      r.violations.length ? `violations=${[...new Set(r.violations)].join("; ")}` : "");
  }
}
await browser.close();
server.close();
