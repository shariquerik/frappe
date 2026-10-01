// The compile step of each candidate, shared by the Node runner and the browser page so both
// time the same calls with the same options. `lib` carries the loaded compiler(s).

export const SOURCE_OF = {
  "jsx/esbuild": "scripts/jsx.jsx",
  "jsx/esbuild-wasm": "scripts/jsx.jsx",
  "jsx/sucrase": "scripts/jsx.jsx",
  "jsx/babel-standalone": "scripts/jsx.jsx",
  "vue-jsx/babel": "scripts/jsx.jsx",
  "template/compiler-dom": "scripts/template.js",
  "sfc/compiler-sfc": "scripts/sfc.vue",
  "sfc/compiler-sfc-nomap": "scripts/sfc.vue",
};

// Automatic runtime: `<div>` becomes `jsx("div", …)` imported from `vue/jsx-runtime`.
const ESBUILD = { loader: "jsx", jsx: "automatic", jsxImportSource: "vue" };
const SUCRASE = { transforms: ["jsx"], jsxRuntime: "automatic", jsxImportSource: "vue", production: true };
const BABEL_AUTOMATIC = {
  babelrc: false,
  configFile: false,
  plugins: [["transform-react-jsx", { runtime: "automatic", importSource: "vue" }]],
};

/** The `template:` string out of the template script, as Vue would receive it at mount. */
export const templateOf = (source) => source.match(/template: `([\s\S]*?)`,\n/)[1];

/** Compile `source` with candidate `id`; returns the output code. */
export async function compile(id, lib, source) {
  switch (id) {
    case "jsx/esbuild":
    case "jsx/esbuild-wasm":
      return (await lib.esbuild.transform(source, ESBUILD)).code;
    case "jsx/sucrase":
      return lib.sucrase.transform(source, SUCRASE).code;
    case "jsx/babel-standalone":
      return lib.Babel.transform(source, BABEL_AUTOMATIC).code;
    case "vue-jsx/babel":
      return lib.vueJsx(source);
    case "template/compiler-dom": {
      // What Vue's full build does in `compileToFunction` (vue/src/index.ts), without its cache.
      const { code } = lib.compilerDom.compile(templateOf(source), { hoistStatic: true, onWarn() {} });
      new Function("Vue", code)(lib.vue);
      return code;
    }
    case "sfc/compiler-sfc":
    case "sfc/compiler-sfc-nomap": {
      // What the Vue SFC Playground does: one module with the template inlined into setup.
      // `-nomap` turns source maps off: the browser build's inlined source-map-js sorts
      // mappings with `new Function`.
      const sourceMap = id === "sfc/compiler-sfc";
      const { descriptor, errors } = lib.sfc.parse(source, { filename: "contacts.vue", sourceMap });
      if (errors.length) throw errors[0];
      return lib.sfc.compileScript(descriptor, { id: "contacts", inlineTemplate: true, sourceMap }).content;
    }
  }
  throw new Error(`unknown candidate ${id}`);
}

/** Median of a list of numbers. */
export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export const WARM_RUNS = 50;

// htm has no compile step: it parses each tagged template on its first call and caches the
// result by the template's strings array. Its cost is the first render, timed against h().
export const RENDER_SOURCE_OF = { "htm/runtime": "scripts/htm.js", "h/runtime": "scripts/h.js" };

/** A stand-in for the record page: a doc and the one panel verb the scripts call. */
export const makePage = (reactive, onAdd) => ({
  doc: reactive({
    status: "Won",
    contacts: [
      { name: "c1", full_name: "Ada Lovelace", email: "ada@example.com" },
      { name: "c2", full_name: "Alan Turing", email: "alan@example.com" },
    ],
  }),
  panelSections: { add: onAdd },
});

/** Time the component's render function: the first call, then the median of WARM_RUNS more. */
export function timeRender(mod, reactive, now) {
  let component;
  const page = makePage(reactive, (item) => (component = item.component));
  mod.default.onRefresh(page);
  const render = component.setup({ page }, { emit() {}, slots: {}, attrs: {}, expose() {} });
  let t = now();
  render();
  const firstMs = now() - t;
  const warm = [];
  for (let i = 0; i < WARM_RUNS; i++) {
    t = now();
    render();
    warm.push(now() - t);
  }
  return { firstMs, warmMs: median(warm) };
}
