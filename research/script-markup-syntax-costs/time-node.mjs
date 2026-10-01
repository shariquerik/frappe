// One cold Node process: load one compiler, compile the script once (cold), then WARM_RUNS more.
// For htm/runtime and h/runtime, time the first render instead (htm parses on first call).
// Run: node time-node.mjs <candidate-id>   (prints one JSON line; run-node.mjs drives it)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";
import { SOURCE_OF, RENDER_SOURCE_OF, compile, median, timeRender, WARM_RUNS } from "./candidates.mjs";

const id = process.argv[2];
const now = () => performance.now();

if (RENDER_SOURCE_OF[id]) {
  // Bundle only to swap frappe-ui for the stubs; vue and htm stay real imports.
  const outfile = new URL(`./out/node/${id.replace("/", "--")}.bundle.mjs`, import.meta.url).pathname;
  await build({
    entryPoints: [new URL(RENDER_SOURCE_OF[id], import.meta.url).pathname],
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "error",
    external: ["vue", "htm"], alias: { "frappe-ui": "./stubs/frappe-ui.js" },
  });
  const { reactive } = await import("vue");
  const mod = await import(outfile);
  console.log(JSON.stringify({ id, ...timeRender(mod, reactive, now) }));
  process.exit(0);
}

const source = readFileSync(new URL(SOURCE_OF[id], import.meta.url), "utf8");

async function load() {
  switch (id) {
    case "jsx/esbuild":
      return { esbuild: await import("esbuild") };
    case "jsx/esbuild-wasm":
      return { esbuild: await import("esbuild-wasm") };
    case "jsx/sucrase":
      return { sucrase: await import("sucrase") };
    case "jsx/babel-standalone":
      return { Babel: (await import("@babel/standalone")).default };
    case "vue-jsx/babel": {
      const { transformSync } = await import("@babel/core");
      const vueJsx = (await import("@vue/babel-plugin-jsx")).default;
      return { vueJsx: (code) => transformSync(code, { babelrc: false, configFile: false, plugins: [vueJsx] }).code };
    }
    case "template/compiler-dom":
      return { compilerDom: await import("@vue/compiler-dom"), vue: await import("vue") };
    case "sfc/compiler-sfc":
    case "sfc/compiler-sfc-nomap":
      return { sfc: await import("@vue/compiler-sfc") };
  }
}

let t = now();
const lib = await load();
const loadMs = now() - t;

t = now();
const code = await compile(id, lib, source);
const firstMs = now() - t;

const warm = [];
for (let i = 0; i < WARM_RUNS; i++) {
  t = now();
  await compile(id, lib, source);
  warm.push(now() - t);
}

console.log(JSON.stringify({
  id,
  loadMs,
  firstMs,
  warmMs: median(warm),
  outBytes: code.length,
  sha256: createHash("sha256").update(code).digest("hex"),
  code,
}));
lib.esbuild?.stop?.();
