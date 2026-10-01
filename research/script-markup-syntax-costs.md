# What each candidate markup syntax costs in a stored script

Research for frappe/frappe#43693, a child of the map frappe/frappe#43692 (components in
Desk v2 scripts without `h()`). Measured on 2026-10-01 against desk-v2 at `5bfba8c98d`,
on an Apple M4, Node 24.9.0 and headless Chrome 154.

One typical Record-page script was written in each syntax (`script-markup-syntax-costs/scripts/`):
a panel section with a frappe-ui `Badge`, a button that opens a `Dialog` with a textarea
and a Save action, a list of contacts, and an if/else. Each version was compiled, then run
the way desk v2 runs a stored script today (a blob-URL ES module), mounted, and driven:
open the dialog, type, save. Every candidate saved the note and closed the dialog, and
rendered the same HTML as the `h()` version. The only difference: the template and SFC
versions do not write a `value=""` attribute on the textarea, because `v-model` sets the
DOM property instead.

## The answer

Bytes are the minified bundle, gzipped at level 5 (the `gzip_comp_level` in bench's
production nginx template). 1 kB = 1,000 bytes. For scale, desk v2 already loads Vue's
runtime-only build, which is 41.7 kB.

Times are medians over 7 cold runs (a fresh Node process or a fresh Chrome page each).
"First" is the first compile in that process or page; "warm" is the median of the next 50.

| Candidate | Bytes added to a cold load (gzip) | Load only when a script needs it? | Compile time in the browser, first / warm | Compile time in Node, first / warm | Needs `unsafe-eval`? | Same output for the same input? |
| --- | --- | --- | --- | --- | --- | --- |
| JSX, automatic runtime, via **sucrase** | 48.5 kB, plus 0.2 kB for `vue/jsx-runtime` | Yes | 3.0 / 0.1 ms (5.9 ms to load) | 4.2 / 0.16 ms | No | Yes |
| JSX, automatic runtime, via **esbuild-wasm** | 3,883 kB (15.1 kB of JS and 3,868 kB of `.wasm`), plus 0.2 kB | Yes | 112 / 2.1 ms (32 ms to load and start) | 139 / 3.3 ms | No, but it needs `'wasm-unsafe-eval'` | Yes, and byte-identical to native esbuild |
| JSX, automatic runtime, via **esbuild** (native binary) | Not available in the browser | n/a | n/a | 6.9 / 0.29 ms | n/a | Yes |
| JSX, automatic runtime, via **@babel/standalone** | 668.6 kB, plus 0.2 kB | Yes | 9.9 / 0.8 ms (82 ms to load) | 12.2 / 1.1 ms | No | Yes |
| JSX, **@vue/babel-plugin-jsx** with `@babel/core` | 317.3 kB; 536.8 kB if the plugin's TypeScript prop resolver is bundled too, as it is when imported plainly | Yes | 25.5 / 0.8 ms (33 ms to load) | 25.8 / 0.95 ms | No | Yes |
| **htm** tagged templates bound to `h` | 0.65 kB (`htm/mini`: 0.48 kB) | Yes: only scripts that import it load it | No compile step. First render 0.6 ms, against 0.3 ms for the same tree in `h()` | First render 0.63 ms, against 0.46 ms for `h()` | No | Nothing is produced to cache. htm parses each template on first use and keeps the result in memory for the life of the page |
| Vue **`template:` strings** | 21.3 kB if desk v2 switches `vue` to the full build; 29.1 kB if `@vue/compiler-dom` is loaded on its own and registered | Only the second way | 3.7 / 0.1 ms | 7.4 / 0.17 ms | **Yes** | Yes for one compiler build; different builds of the same version give different output |
| Vue **SFC text**, `@vue/compiler-sfc` | 250.8 kB | Yes | 13.2 / 0.6 ms; 10.2 / 0.3 ms with source maps off | 16.0 / 0.68 ms | The compiler's browser build: **yes**, unless source maps are off. The compiled output: no | Yes for one compiler build; different builds give different output |

**Desk v2 sends no Content-Security-Policy today.** The `/apps` and `/desk` documents on
the dev site have no CSP header and no CSP `<meta>` tag. In frappe's Python code, only web
forms set a CSP (`frame-ancestors`), and bench's production nginx template adds none. Details
are in [Content Security Policy](#3-content-security-policy).

## 1. Bytes on a cold load, and loading only when needed

Measured by `sizes.mjs` (results in `out/sizes.json`). Packages that ship a minified
browser build were measured as published. Packages with no browser build (sucrase,
`@babel/core` with the Vue plugin) were bundled by esbuild into one minified ES module,
and `@vue/compiler-sfc`'s unminified `esm-browser` build was minified the same way.

| What | Minified | gzip 5 | gzip 9 |
| --- | ---: | ---: | ---: |
| `vue` runtime-only build (desk v2 loads this today) | 109.7 kB | 41.7 kB | 41.4 kB |
| `vue` full build (runtime plus template compiler) | 171.5 kB | 63.0 kB | 62.4 kB |
| `@vue/compiler-dom` on its own | 82.7 kB | 29.1 kB | 28.9 kB |
| `vue/jsx-runtime` (unminified as published; imports `h` from `vue`) | 0.3 kB | 0.2 kB | 0.2 kB |
| sucrase | 206.1 kB | 48.5 kB | 47.3 kB |
| esbuild-wasm JS API | 52.9 kB | 15.1 kB | 15.0 kB |
| esbuild-wasm binary, `esbuild.wasm` | 13,979 kB | 3,868 kB | 3,726 kB |
| @babel/standalone (every Babel plugin and preset) | 3,141 kB | 668.6 kB | 655.9 kB |
| `@babel/core` + `@vue/babel-plugin-jsx`, prop resolver stubbed out | 1,232 kB | 317.3 kB | 312.1 kB |
| `@babel/core` + `@vue/babel-plugin-jsx`, as imported | 1,940 kB | 536.8 kB | 527.8 kB |
| htm | 1.2 kB | 0.65 kB | 0.65 kB |
| htm/mini | 0.9 kB | 0.48 kB | 0.48 kB |
| `@vue/compiler-sfc` | 801.3 kB | 250.8 kB | 247.5 kB |

Notes on the rows:

- **The Vue JSX plugin's 220 kB difference.** `@vue/babel-plugin-jsx` 2.0.1 imports
  `@vue/babel-plugin-resolve-type` at the top of its entry file, and that package depends on
  `@vue/compiler-sfc`. The plugin only calls it when the `resolveType` option is set
  (`node_modules/@vue/babel-plugin-jsx/dist/index.mjs:597-603`). A bundle that aliases it
  to an empty module compiles the script to the same bytes as the plugin in Node.
- **Template strings, two ways.** Vue's full build is the runtime build plus
  `registerRuntimeCompiler(compileToFunction)` (`vue/dist/vue.cjs.prod.js:28-61`; source
  `packages/vue/src/index.ts` in vuejs/core). The runtime build exports
  `registerRuntimeCompiler` too. So desk v2 can either switch `vue` to the full build
  (+21.3 kB on every cold load, measured as 63.0 minus 41.7) or load
  `@vue/compiler-dom` later and register it (29.1 kB, a little more because that build
  carries its own copy of `@vue/shared`). Vue compiles a `template:` synchronously when the
  component first mounts, so with the second way the compiler must finish loading before
  any script with a template mounts.
- **Loading only when needed.** Every compiler above can be fetched with a dynamic
  `import()` the first time a script needs it. The page needs some way to know that before
  it runs the script, for example a flag stored with the script; that is a design choice,
  not measured here. htm needs no such step: it reaches the page through the import map, so
  only a script that imports it loads it.
- The load times in the table were measured against a local server, so they do not
  include network transfer.

## 2. Compile time

Measured by `run-node.mjs` (driving `time-node.mjs`, results in `out/node.json`) and
`run-browser.mjs` (driving `bench.html` and `bench.mjs`, results in `out/browser.json`).
Both call the same compile functions with the same options, from `candidates.mjs`.

| Candidate | Node: load | Node: first | Node: warm | Chrome: load | Chrome: first | Chrome: warm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| esbuild (native) | 0.1 ms | 6.9 ms | 0.29 ms | n/a | n/a | n/a |
| esbuild-wasm | 4.3 ms | 139.5 ms | 3.3 ms | 31.9 ms | 112.4 ms | 2.1 ms |
| sucrase | 16.5 ms | 4.2 ms | 0.16 ms | 5.9 ms | 3.0 ms | 0.1 ms |
| @babel/standalone | 110.5 ms | 12.2 ms | 1.1 ms | 81.9 ms | 9.9 ms | 0.8 ms |
| @vue/babel-plugin-jsx | 123.7 ms | 25.8 ms | 0.95 ms | 32.9 ms | 25.5 ms | 0.8 ms |
| template, `@vue/compiler-dom` + `new Function` | 31.7 ms | 7.4 ms | 0.17 ms | 10.5 ms | 3.7 ms | 0.1 ms |
| SFC, `@vue/compiler-sfc` | 53.3 ms | 16.0 ms | 0.68 ms | 15.3 ms | 13.2 ms | 0.6 ms |
| SFC, source maps off | 55.0 ms | 12.7 ms | 0.42 ms | 15.6 ms | 10.2 ms | 0.3 ms |

htm has no compile step. Its cost is the first render, which parses the templates. Timed
by calling the component's render function directly, against the same component in `h()`:

| | Node: first render | Node: later renders | Chrome: first render | Chrome: later renders |
| --- | ---: | ---: | ---: | ---: |
| htm | 0.63 ms | 0.008 ms | 0.6 ms | under 0.1 ms |
| `h()` | 0.46 ms | 0.006 ms | 0.3 ms | under 0.1 ms |

So htm adds about 0.2 to 0.3 ms to the first render of this script, and nothing measurable
after that. The templates inside the dialog's slots are parsed when the dialog first
opens, which this timing does not include.

How to read these numbers:

- "Load" is importing the compiler (for esbuild-wasm in Chrome, also starting its worker).
  For native esbuild in Node, the first compile includes starting the esbuild process.
- The machine was shared with other work. Across three Node runs the first-compile
  numbers moved by up to about 4 times (native esbuild 6.9 to 15.9 ms, the Vue plugin
  25.8 to 102.9 ms). The tables show the last run. Read them as orders of magnitude.
- Chrome's `performance.now()` is rounded to 0.1 ms on a page that is not cross-origin
  isolated, so warm values below that read as 0 or 0.1.
- Node numbers matter only if the compile runs at save time on the server. Frappe's request
  path is Python, so that would mean calling a Node process from Python on save.

## 3. Content Security Policy

### What desk v2 sends today

None. Checked on the dev site `crm.localhost:8099`, signed in as Administrator, with
`curl -D -`: the `/apps` document (desk v2's shell, served by
`frappe/website/page_renderers/shell_page.py`) and `/desk` return no
`Content-Security-Policy` header, and the shell document has no CSP `<meta>` tag.

In the code:

- The only CSP frappe's Python code sets is `frame-ancestors` on web forms
  (`frappe/website/page_renderers/web_form.py:22`).
- Bench's production nginx template adds `X-Frame-Options`, `Strict-Transport-Security`,
  `X-Content-Type-Options`, `X-XSS-Protection` and `Referrer-Policy`, and no CSP
  (`bench/config/templates/nginx.conf:53-57` in the installed bench package).

If a CSP were added later, desk v2 already needs three allowances that have nothing to do
with markup syntax:

- `blob:` in `script-src`, because stored scripts run as blob-URL modules
  (`frontend/src/recordPage/evaluateClientScript.ts:9-20`);
- a hash or nonce for the inline `<script type="importmap">` in the shell document;
- `'unsafe-eval'`, because form-layout conditions written as `eval:` expressions are run
  with `new Function` (`frontend/src/recordPage/formLayoutSource/chooseLayout.ts:37`).

So a syntax that needs `'unsafe-eval'` would not be the first thing in desk v2 that needs
it, but it would be a second one.

### What each candidate needs, measured

Each candidate was compiled, run and driven in Chrome under three policies, served by
`serve.mjs`:

- **none**: no header;
- **strict**: `script-src 'self' blob: 'sha256-…'` (the hash allows the inline import map);
- **strict-wasm**: strict plus `'wasm-unsafe-eval'`.

The same compile calls were also run in Node with `--disallow-code-generation-from-strings`,
which makes `eval` and `new Function` throw (`no-eval-node.mjs`).

| Candidate | none | strict | strict-wasm | Node, no string evaluation |
| --- | --- | --- | --- | --- |
| sucrase | works | works | works | works |
| esbuild-wasm | works | fails: compiling the WebAssembly module is blocked | works | native esbuild works |
| @babel/standalone | works | works | works | works |
| @vue/babel-plugin-jsx | works | works | works | works |
| htm | works | works | works | n/a (no compile) |
| template strings | works | fails: `eval` blocked | fails: `eval` blocked | compiling to a code string works; turning it into a function with `new Function` throws |
| SFC, default options | works | fails: `eval` blocked | fails: `eval` blocked | works |
| SFC, `sourceMap: false` | works | works | works | works |

Why the three failures happen:

- **Template strings.** Vue turns the compiled template into a render function with
  `new Function("Vue", code)` (`vue/dist/vue.cjs.prod.js:56-57`). The compiler can instead
  emit an ES module (`mode: "module"`), which needs no eval and could run as a blob
  module. But then the template text has to be cut out of the script and compiled before
  the script runs, which is a load-time transform, much like the SFC path.
- **SFC.** The failure is in the compiler, not its output. The `esm-browser` build of
  `@vue/compiler-sfc` 3.5.41 inlines a copy of `source-map-js` whose sort calls
  `new Function` every time (`compiler-sfc.esm-browser.js:23150-23170`). The separate
  `source-map-js` 1.2.2 package that the Node build uses first tests whether eval is
  allowed and falls back if not (`source-map-js/lib/quick-sort.js:108-137`), which is why
  Node passes. With `sourceMap: false` the browser compile passes, but then there is no
  source map to point runtime errors at the author's line, which the map lists as an open
  question.
- **esbuild-wasm.** Compiling any WebAssembly module needs `'wasm-unsafe-eval'` (CSP
  Level 3). That keyword allows WebAssembly only, not `eval` or `new Function`.

## 4. Stable output, and what the cache key must contain

Every candidate gave byte-identical output in all 7 fresh Node processes and in all 7
Chrome page loads. So each can be cached by a hash of the source, as long as the key also
names the exact compiler build. That second part matters for the two Vue compilers:

| Candidate | Same bytes in Node and in the browser? |
| --- | --- |
| esbuild | Yes: native esbuild, esbuild-wasm in Node and esbuild-wasm in Chrome all give `c223d63d…` |
| sucrase | Yes (`a0560796…`) |
| @babel/standalone | Yes (`198fd101…`) |
| @vue/babel-plugin-jsx | Yes (`8773b321…`) |
| template, `@vue/compiler-dom` | No. The four published builds of 3.5.41 give three outputs (`builds-differ.mjs`): the CommonJS builds give `2beab2bb…`, or `ac41efe2…` when `NODE_ENV=production` (they load `@vue/compiler-core`'s dev or prod build from that variable), and the `esm-browser` prod build gives `4c43962f…`, without line breaks or patch-flag comments |
| SFC, `@vue/compiler-sfc` | No. The browser build matches Node with `NODE_ENV` unset (`fafd524a…`); Node with `NODE_ENV=production` gives `321e7ee2…` |

So a cache key is: the hash of the source, the compiler's package name and exact version,
which build of it ran (and, in Node, `NODE_ENV`), and the options. For the SFC compiler the
`filename` and `id` passed to it also appear in the output (`__name: 'contacts'` comes from
the filename, and scoped-style attributes come from the id), so they belong in the key too.

htm produces nothing to store. It caches each parsed template in a `Map` keyed by the
template's strings array (`htm/src/index.mjs:17-27`), so the parse happens once per page.

## Other things found while measuring

- **The import name for automatic-runtime JSX.** Compiled JSX imports
  `jsx` from `vue/jsx-runtime`. Desk v2's import map publishes `vue`, and an import-map key
  without a trailing slash matches only that exact name, so `vue/jsx-runtime` would not
  resolve. The `import_map` hook only accepts frappe's four bare names or names that start
  with `<app>/` (`frappe/shell/manifest.py:29` and `178-210`). Two ways round it: add
  `vue/jsx-runtime` to the framework names, or compile with `jsxImportSource: "frappe"`
  so the output imports `frappe/jsx-runtime`, which the current rule already allows as a
  frappe file. The Vue JSX plugin's output imports only from `vue` (`createVNode` and
  friends), so it needs no new name.
- **htm needs a published name too.** `htm` is not an allowed name, so it would be
  published as something like `frappe/html`, exporting `htm.bind(h)`.
- **`onUpdate:open` in JSX.** esbuild and the Vue JSX plugin accept `onUpdate:open={…}`.
  sucrase rejects it, and Babel's React JSX transform rejects it unless
  `throwIfNamespace: false` is set. The JSX script uses `{...{ "onUpdate:open": … }}` so
  that one text works with all four. The Vue plugin also offers `v-model:open`, which was
  not tested.
- **An SFC cannot be today's script shape.** An SFC's default export is its component, but
  desk v2 expects a stored script's default export to be the handlers object
  (`handlersOf` in `evaluateClientScript.ts`). The SFC version here exports `handlers` by
  name and passes the component in, so the host would have to change for this candidate.
- **Slots in JSX and htm.** The script passes the dialog's slots as one object child
  (`{{ default: …, actions: … }}`), which Vue's `h` treats as slots, and none of the
  candidates raised a Vue warning in the development build.

## Method and files

All files are under `research/script-markup-syntax-costs/` on this branch. Install with
`npm install` in that folder (it pins `vue` and the Vue compilers to 3.5.41, the version
desk v2's `frontend/` uses).

| File | What it does |
| --- | --- |
| `scripts/h.js`, `jsx.jsx`, `htm.js`, `template.js`, `sfc.vue` | The same script in each syntax (40 to 47 lines) |
| `stubs/frappe-ui.js` | Small stand-ins for `Badge`, `Button` and `Dialog`, so the output can be rendered and compared without frappe-ui |
| `candidates.mjs` | The compile call and options for each candidate, shared by Node and the browser |
| `sizes.mjs` | Builds the browser bundles and measures minified and gzip sizes (`out/sizes.json`) |
| `time-node.mjs`, `run-node.mjs` | Node timing and output hashes, 7 fresh processes per candidate (`out/node.json`) |
| `bench.html`, `check.html`, `bench.mjs`, `serve.mjs`, `run-browser.mjs` | Chrome timing, 7 fresh pages per candidate; then each candidate run, mounted and driven under the three CSP levels with Vue's development build (`out/browser.json`) |
| `no-eval-node.mjs` | Each compile with string evaluation disabled in Node |
| `builds-differ.mjs` | The template compiled by each of `@vue/compiler-dom`'s four builds |

Versions: vue, `@vue/compiler-dom` and `@vue/compiler-sfc` 3.5.41; esbuild and
esbuild-wasm 0.28.2; sucrase 3.35.1; `@babel/standalone` 7.29.9; `@babel/core` 7.29.7;
`@vue/babel-plugin-jsx` 2.0.1; htm 3.1.1; playwright-core 1.63.0 driving the installed
Chrome 154.

## Sources

Measured facts come from the scripts above. The rest rests on these:

- Desk v2 code at `5bfba8c98d`: `frontend/src/recordPage/evaluateClientScript.ts`,
  `frontend/plugin/importMap.js`, `frappe/hooks.py:20-27` (the import map names),
  `frappe/shell/manifest.py` (the name rules), `frontend/COMPATIBILITY.md` (the
  `import_map` hook), `frappe/website/page_renderers/shell_page.py`,
  `frappe/website/page_renderers/web_form.py:22`,
  `frontend/src/recordPage/formLayoutSource/chooseLayout.ts:37`.
- Bench's nginx template: `bench/config/templates/nginx.conf` in the installed bench
  package (gzip level at line 143, security headers at lines 53-57).
- Vue 3.5.41 source as published: `vue/dist/vue.cjs.prod.js:28-61` (runtime template
  compile with `new Function`), `vue/jsx-runtime/index.mjs`,
  `@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js:23150-23170`. Upstream:
  [vuejs/core `packages/vue/src/index.ts`](https://github.com/vuejs/core/blob/main/packages/vue/src/index.ts).
- `source-map-js` 1.2.2, `lib/quick-sort.js:108-137`.
- `@vue/babel-plugin-jsx` 2.0.1, `dist/index.mjs:597-603` and its `package.json`
  dependencies; upstream [vuejs/babel-plugin-jsx](https://github.com/vuejs/babel-plugin-jsx).
- htm 3.1.1, `src/index.mjs:17-27`; upstream [developit/htm](https://github.com/developit/htm).
- esbuild JSX options: [esbuild.github.io/api/#jsx](https://esbuild.github.io/api/#jsx);
  esbuild-wasm: [esbuild.github.io/getting-started/#wasm](https://esbuild.github.io/getting-started/#wasm).
- Babel's automatic runtime and `throwIfNamespace`:
  [babeljs.io/docs/babel-plugin-transform-react-jsx](https://babeljs.io/docs/babel-plugin-transform-react-jsx).
- `'wasm-unsafe-eval'`: [CSP Level 3](https://www.w3.org/TR/CSP3/#grammardef-wasm-unsafe-eval).
- Import map key matching (a key without a trailing slash matches one specifier):
  [HTML standard, import maps](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps).
