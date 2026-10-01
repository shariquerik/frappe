// The browser page. `?id=<candidate>&mode=time|check`.
//   time   load the compiler, compile once (cold), then WARM_RUNS more; or time htm's first render.
//   check  compile, run the output as desk v2 runs a stored script (a blob-URL module), mount
//          it, open the dialog, type, save; record the HTML, Vue warnings, errors and CSP violations.
// The result is left on window.__result for run-browser.mjs.
import { SOURCE_OF, RENDER_SOURCE_OF, compile, median, makePage, timeRender, WARM_RUNS } from "/candidates.mjs";

const params = new URLSearchParams(location.search);
const id = params.get("id");
const mode = params.get("mode");
const violations = [];
document.addEventListener("securitypolicyviolation", (e) =>
  violations.push(`${e.effectiveDirective} blocked ${e.blockedURI || "(inline)"}`));

const LOADERS = {
  "jsx/esbuild-wasm": async () => {
    const esbuild = await import("/node_modules/esbuild-wasm/esm/browser.min.js");
    await esbuild.initialize({ wasmURL: "/node_modules/esbuild-wasm/esbuild.wasm" });
    return { esbuild };
  },
  "jsx/sucrase": async () => ({ sucrase: await import("/out/browser/sucrase.js") }),
  "jsx/babel-standalone": async () => {
    await import("/node_modules/@babel/standalone/babel.min.js"); // UMD: sets globalThis.Babel
    return { Babel: globalThis.Babel };
  },
  "vue-jsx/babel": async () => ({ vueJsx: (await import("/out/browser/babel-vue-jsx-lean.js")).compile }),
  "template/compiler-dom": async () => ({
    compilerDom: await import("/node_modules/@vue/compiler-dom/dist/compiler-dom.esm-browser.prod.js"),
    vue: await import("vue"),
  }),
  "sfc/compiler-sfc": async () => ({ sfc: await import("/out/browser/compiler-sfc.js") }),
  "sfc/compiler-sfc-nomap": async () => ({ sfc: await import("/out/browser/compiler-sfc.js") }),
};

/** As frontend/src/recordPage/evaluateClientScript.ts does it. */
async function runScript(code) {
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

const sourceOf = async (path) => (await fetch(`/${path}`)).text();
const tidy = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").trim();

async function renderCheck(code) {
  const vue = await import("vue");
  const mod = await runScript(code);
  let component;
  const page = makePage(vue.reactive, (item) => (component = item.component));
  if (mod.handlers) mod.handlers.onRefresh(page, mod.default); // the SFC shape
  else mod.default.onRefresh(page);

  const warnings = [];
  const errors = [];
  const el = document.createElement("div");
  document.body.append(el);
  const app = vue.createApp({ render: () => vue.h(component, { page }) });
  app.config.warnHandler = (msg) => warnings.push(msg);
  app.config.errorHandler = (err) => errors.push(String(err));
  app.mount(el);
  const closed = tidy(el.innerHTML);
  el.querySelector("button").click();
  await vue.nextTick();
  const opened = tidy(el.innerHTML);
  const textarea = el.querySelector("textarea");
  textarea.value = "hello";
  textarea.dispatchEvent(new Event("input"));
  el.querySelector("section footer button").click();
  await vue.nextTick();
  return { closed, opened, saved: page.doc.last_note, closedAfterSave: !el.querySelector("section"), warnings, errors };
}

async function main() {
  const now = () => performance.now();
  if (RENDER_SOURCE_OF[id]) {
    const source = await sourceOf(RENDER_SOURCE_OF[id]);
    if (mode === "check") return renderCheck(source);
    const vue = await import("vue");
    return timeRender(await runScript(source), vue.reactive, now);
  }

  const source = await sourceOf(SOURCE_OF[id]);
  let t = now();
  const lib = await LOADERS[id]();
  const loadMs = now() - t;
  t = now();
  const code = await compile(id, lib, source);
  const firstMs = now() - t;
  if (mode === "check") {
    // The template candidate is run as written: the full vue build compiles it at mount.
    return { sha256: await sha256(code), ...(await renderCheck(id.startsWith("template/") ? source : code)) };
  }
  const warm = [];
  for (let i = 0; i < WARM_RUNS; i++) {
    t = now();
    await compile(id, lib, source);
    warm.push(now() - t);
  }
  return { loadMs, firstMs, warmMs: median(warm), sha256: await sha256(code) };
}

main().then(
  (result) => (window.__result = { ...result, violations }),
  (error) => (window.__result = { error: String(error?.message ?? error), stack: String(error?.stack ?? "").split("\n").slice(0, 6).join("\n"), violations }),
);
