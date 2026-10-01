// Bytes each candidate adds to the browser: the minified bundle, gzipped at level 5 (the
// `gzip_comp_level` of bench's production nginx template) and at level 9.
// Run: node sizes.mjs  (writes out/sizes.json and the browser bundles under out/browser/)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const nm = (p) => new URL(`./node_modules/${p}`, import.meta.url).pathname;
const out = (p) => new URL(`./out/browser/${p}`, import.meta.url).pathname;
mkdirSync(out(""), { recursive: true });

/** Minify one entry for the browser into a single ES module, every import inlined. */
async function bundle(name, contents, options = {}) {
  await build({
    stdin: { contents, resolveDir: new URL(".", import.meta.url).pathname, loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    outfile: out(`${name}.js`),
    define: { "process.env.NODE_ENV": '"production"', "process.env.BABEL_TYPES_8_BREAKING": "false" },
    logLevel: "error",
    // @babel/core reads process.env and process.cwd() when it resolves options.
    banner: { js: 'globalThis.process ??= { env: {}, cwd: () => "/" };' },
    ...options,
  });
  return out(`${name}.js`);
}

const measure = (path) => {
  const bytes = readFileSync(path);
  return {
    min: bytes.length,
    gzip5: gzipSync(bytes, { level: 5 }).length,
    gzip9: gzipSync(bytes, { level: 9 }).length,
  };
};

const rows = {};
const add = (label, path, note = "") => (rows[label] = { ...measure(path), note });

// Shipped minified files, measured as published.
add("vue runtime-only (what desk v2 loads)", nm("vue/dist/vue.runtime.esm-browser.prod.js"));
add("vue full build (runtime + compiler)", nm("vue/dist/vue.esm-browser.prod.js"));
add("@vue/compiler-dom alone", nm("@vue/compiler-dom/dist/compiler-dom.esm-browser.prod.js"),
  "inlines its own copy of @vue/shared");
add("htm", nm("htm/dist/htm.module.js"));
add("htm/mini", nm("htm/mini/index.module.js"), "no template cache");
add("@babel/standalone", nm("@babel/standalone/babel.min.js"), "UMD; all Babel plugins and presets");
add("esbuild-wasm JS API", nm("esbuild-wasm/esm/browser.min.js"));
add("esbuild-wasm binary (esbuild.wasm)", nm("esbuild-wasm/esbuild.wasm"));

// The jsx runtime is a few lines on top of `vue`, which the page already has.
add("vue/jsx-runtime", nm("vue/jsx-runtime/index.mjs"), "as published, unminified; imports h and Fragment from vue");

// Packages with no browser build: bundled here, minified.
add("sucrase (jsx transform only)",
  await bundle("sucrase", `export { transform } from "sucrase";`),
  "bundled from the npm package; esbuild cannot drop the unused TS/Flow/imports transforms");
add("@vue/compiler-sfc",
  nm("@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js") &&
    (await bundle("compiler-sfc", `export * from "@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js";`)),
  "the shipped esm-browser build, minified here; it is not minified as published");
add("@babel/core + @vue/babel-plugin-jsx",
  await bundle("babel-vue-jsx",
    `import { transform } from "@babel/core"; import vueJsx from "@vue/babel-plugin-jsx";
     export const compile = (code) => transform(code, { babelrc: false, configFile: false, plugins: [vueJsx] }).code;`,
    { alias: { fs: "./stubs/empty.js", path: "path-browserify", url: "./stubs/empty.js", os: "./stubs/empty.js", module: "./stubs/empty.js", util: "./stubs/empty.js", assert: "./stubs/assert.cjs", process: "./stubs/empty.js" } }),
  "bundled with esbuild; Node built-ins stubbed; includes @vue/babel-plugin-resolve-type, which pulls in @vue/compiler-sfc");

// The same, with the TypeScript prop-type resolver (and so @vue/compiler-sfc) stubbed out.
// The plugin imports it unconditionally but only calls it when `resolveType` is set.
add("@babel/core + @vue/babel-plugin-jsx, no type resolver",
  await bundle("babel-vue-jsx-lean",
    `import { transform } from "@babel/core"; import vueJsx from "@vue/babel-plugin-jsx";
     export const compile = (code) => transform(code, { babelrc: false, configFile: false, plugins: [vueJsx] }).code;`,
    { alias: { "@vue/babel-plugin-resolve-type": "./stubs/empty.js", fs: "./stubs/empty.js", path: "path-browserify", url: "./stubs/empty.js", os: "./stubs/empty.js", module: "./stubs/empty.js", util: "./stubs/empty.js", assert: "./stubs/assert.cjs", process: "./stubs/empty.js" } }),
  "as above, with @vue/babel-plugin-resolve-type aliased to an empty module");

writeFileSync(new URL("./out/sizes.json", import.meta.url), JSON.stringify(rows, null, 2));
console.table(rows);
