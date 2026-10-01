# Could the template compile path strip TypeScript types later?

Research for [frappe/frappe#43721](https://github.com/frappe/frappe/issues/43721). This
records a fact for the `template:` strings spec. It does not propose adding TypeScript to
scripts; the planning effort ruled that out of scope.

## The path being asked about

- One compile module in `frontend/plugin/` (Node) parses a script with `@babel/parser`,
  finds each unquoted `template:` key, compiles the string with `@vue/compiler-dom`, and
  keeps every line number, so a stored script needs no source map. The Vue helpers'
  `import` goes at the start of line 1.
- For a stored `Client Script` (text in the `script` field, written in the browser) the
  Python server runs that module through `node` and caches the output in Redis.
- For app `.js` and `.ts` files a vite 8 plugin runs the same module. Vite already strips
  types from app `.ts` files with Oxc.
- The browser runs a stored script as a blob-URL ES module with no other transform
  (`frontend/src/recordPage/evaluateClientScript.ts:6-20`).

## Answer

Yes, the path can strip types later without changing its shape: strip first, then run the
existing JavaScript path on the result. Two ways keep every line and column, so the
"no source map" rule still holds:

1. **Node's own stripper**, `module.stripTypeScriptTypes()`. No new dependency, 0 bytes.
   It adds about 28 ms to each cold `node` run (Node loads its SWC WebAssembly on the
   first call) and 0.07 ms per strip after that. It refuses `enum`, `namespace` with
   code, parameter properties, `import x = require()`, `export =` and `<T>x` casts.
2. **Blank the types using the `@babel/parser` tree the module already builds** (parse
   with the `typescript` plugin, then overwrite each type range with spaces). No new
   dependency, about 2 ms per cold run in a sketch. It is new code to own: the sketch
   here is about 100 lines and covers common syntax only; `ts-blank-space`, which does
   the same job on TypeScript's parser, is about 800 lines.

Sucrase keeps lines but not columns, adds 16 ms, and its README advises against
production use. The rest either move lines (Oxc, esbuild, `tsc`), so the server would need
source maps, or add 45 to 160 ms and 7 to 24 MB (amaro, Babel, ts-blank-space).

A stored script would need a way to say it is TypeScript, most simply a new field on
`Client Script`. Stripping every script without a flag is not safe: `f < T > (y)` is two
comparisons in JavaScript and a generic call in TypeScript (measured below).

## Measurements

Mac (Apple silicon, macOS 26), Node 24.9.0. Sample: `scripts/contacts.ts`, the
`template:` sample from the markup-syntax research turned into TypeScript (interface, type
alias, annotations, generics, `as`, `satisfies`, `!`, `import type`), 51 lines.

### Cost per compile, one fresh `node` per compile

`cold.py` starts `node pipeline.mjs <tool>` from Python, as the server would: load the
tool, strip, parse with `@babel/parser`, compile the template with `@vue/compiler-dom`.
Median of 30 runs, interleaved. The baseline is the same work on the JavaScript sample
with no stripping (48.8 ms).

| Tool | Median ms | Added ms |
|---|---|---|
| none (JavaScript sample) | 48.8 | 0 |
| `@babel/parser` blanking (sketch) | 51.0 | 2.1 |
| Oxc via `rolldown/utils` | 52.8 | 4.0 |
| sucrase | 64.6 | 15.8 |
| esbuild (Node API) | 73.3 | 24.5 |
| Node `module.stripTypeScriptTypes` | 76.6 | 27.8 |
| amaro (npm) | 93.6 | 44.8 |
| Babel `plugin-transform-typescript` | 126.3 | 77.5 |
| `typescript` `transpileModule` | 147.6 | 98.8 |
| ts-blank-space | 206.7 | 157.9 |

Source: `out/cold.json`. The Redis cache means this cost is paid at save and on a cache
miss, not on every page load. Earlier tickets measured esbuild's binary called straight
from Python at 5.6 ms a compile; that would be a second process beside `node`.

### Cost inside one process, and whether positions survive

`run-bench.mjs` runs `bench-one.mjs` 7 times per tool in fresh processes (medians). "Load"
is importing the tool. "First" is the first strip. "Warm" is the median of 300 more.
"Lines" and "columns" compare 17 marker tokens (statements, the `template:` key, tags
inside the template) between input and output.

| Tool | Load ms | First ms | Warm ms | Lines kept | Columns kept | Output lines |
|---|---|---|---|---|---|---|
| Node `stripTypeScriptTypes` | 0 | 28.1 | 0.073 | yes | yes | 51 |
| amaro (npm) | 39.5 | 7.4 | 0.054 | yes | yes | 51 |
| ts-blank-space | 155.0 | 5.0 | 0.065 | yes | yes | 51 |
| `@babel/parser` blanking (sketch) | 5.5 * | 6.8 * | 0.112 | yes | yes | 51 |
| sucrase | 14.7 | 4.2 | 0.047 | yes | no (`!` removed) | 51 |
| Babel, `retainLines: true` | 55.6 | 26.9 | 0.517 | yes here, "best effort" | no | 50 |
| Oxc via `rolldown/utils` | 5.0 | 0.23 | 0.024 | no (`template:` 27 to 28) | no | 53 |
| esbuild | 3.6 | 22.2 | 0.206 | no (27 to 17) | no | 40 |
| `typescript` `transpileModule` | 78.6 | 21.1 | 0.417 | no (27 to 18) | no | 41 |

\* Includes loading and warming `@babel/parser`, which the compile module pays anyway; the
cold table's 2.1 ms is the real added cost. Source: `out/node.json`.

For every tool the stripped output parsed as plain JavaScript and the template compiled
(`bench-one.mjs`, `templatePath`). For the four tools that keep columns, the `template:`
key stayed on line 27 and line 1 stayed line 1, so the helper `import` placement is not
affected.

### New bytes on disk

`sizes.sh` installs each tool alone into an empty folder (darwin-arm64 binaries; Linux
binaries are a similar size).

| Tool | Already installed? | Added if made a direct dependency |
|---|---|---|
| Node `stripTypeScriptTypes` | Inside the `node` binary | 0 |
| `@babel/parser` blanking | Yes, `@babel/parser` 7.29.8 (the spec already makes it direct) | 0, plus our own code |
| Oxc via `rolldown/utils` | Yes, vite 8 depends on rolldown 1.1.5 (`@rolldown/binding-*` is 16 MB) | 0 |
| sucrase | Yes, but only through tailwindcss 3 | 3.0 MB, 17 packages |
| `typescript` | Yes, 5.9.3, only through `@typescript-eslint/parser` (dev) | about 23 MB |
| esbuild | Only in the repo-root `node_modules` (Desk v1 build), not in `frontend/` | 10.5 MB, 2 packages |
| amaro (npm) | No | 7.4 MB, 1 package |
| ts-blank-space | No | 24.2 MB, 2 packages (pulls `typescript`) |
| Babel `plugin-transform-typescript` | No (`@babel/core` absent) | 17.5 MB, 48 packages |
| oxc-transform (npm) | No; same engine as the rolldown copy | 6.7 MB, 2 packages |

Source: `out/sizes.tsv`, `du -sh` of `frontend/node_modules`.

### Which syntax each tool handles

`syntax.mjs` runs 18 snippets through every tool. "ok" means stripped, the output parses as
plain JavaScript, and the next statement kept its line and column. "lines" means same line,
moved column. "moved" means the next statement changed line. "ERR" means the tool refused
it, or the output was not plain JavaScript.

| Snippet | Node | amaro | ts-blank-space | Babel blanking sketch | sucrase | Babel | Oxc | esbuild | tsc |
|---|---|---|---|---|---|---|---|---|---|
| annotations, interface, type alias | ok | ok | ok | ok | ok | ok | moved | moved | moved |
| generics on calls and arrows | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `as`, `satisfies`, `!` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `import type`, `export type` | ok | ok | ok | ok | ok | ok | moved | moved | moved |
| `declare const`, `declare module` | ok | ok | ok | ok | ok | ok | moved | moved | moved |
| class `implements`, `abstract`, `private`, `readonly`, `declare`, `x!:` | ok | ok | ok | ERR (sketch gap) | ok | ok | moved | moved | moved |
| function overloads | ok | ok | ok | ok | ok | ok | moved | ok | moved |
| `this` parameter | ok | ok | ok | ERR (sketch gap) | ok | ok | ok | moved | ok |
| arrow return type on its own line | ok | ok | ok | ERR (sketch gap) | ok | ok | moved | moved | moved |
| namespace with types only | ok | ok | ok | ERR (sketch gap) | ok | ok | moved | moved | moved |
| class parameter properties | ERR | ERR | ERR | ERR | ok | ok | moved | moved | moved |
| `enum` | ERR | ERR | ERR | ERR | ok | ok | moved | moved | moved |
| `const enum` | ERR | ERR | ERR | ERR | ok | ok | moved | moved | moved |
| `namespace` with code | ERR | ERR | ERR | ERR | ok | ok | moved | moved | moved |
| `import x = require()` | ERR | ERR | ERR | ERR | ok † | ERR | ok † | ok † | moved † |
| `export =` | ERR | ERR | ERR | ERR | ok † | ERR | ok † | moved † | moved † |
| `<T>x` cast | ERR | ERR | ERR | ok | ok | ok | ok | ok | ok |
| legacy decorator `@dec class` | ERR ‡ | ERR ‡ | ERR ‡ | ERR | ERR ‡ | ERR | ERR ‡ | ERR ‡ | ERR ‡ |

† The output uses `require` or `module.exports`, which a browser ES module cannot run, so
these do not work in the stored path with any tool.
‡ The tool leaves `@dec` in place; the output is not plain JavaScript.
Babel needed `allowDeclareFields: true` for `declare` class fields. Source:
`out/syntax.json`, `out/syntax-table.txt`.

The four whitespace tools (Node, amaro, ts-blank-space, the sketch) refuse the same
group: syntax that has runtime behaviour. TypeScript 5.8 added `--erasableSyntaxOnly`,
which makes `tsc` and an editor report exactly that group as errors, so an editor can warn
an author before save.

## Node's stripper in more detail

- **What it is.** `module.stripTypeScriptTypes(code)` calls Amaro, a wrapper around
  `@swc/wasm-typescript`, bundled inside Node
  (`lib/internal/modules/typescript.js`, `require('internal/deps/amaro/dist/index')`).
  The default mode "removes type annotations while maintaining whitespace and line
  positions" and "type annotations are replaced with spaces to preserve line and column
  positions in the output." ([Node module docs](https://nodejs.org/api/module.html#modulestriptypescripttypescode-options),
  [Amaro](https://github.com/nodejs/amaro))
- **Status.** Added in v22.13.0 and v23.2.0. Stability 1.2, release candidate, in the
  Node 26.10 docs. v26.0.0 removed the `transform` mode, so only stripping is left. Type
  stripping as a whole became stable in v24.12.0 and v25.2.0
  ([Node TypeScript docs](https://nodejs.org/api/typescript.html)). On Node 24.9 each call
  prints an `ExperimentalWarning` to stderr; the server would run `node` with
  `--disable-warning=ExperimentalWarning` or ignore stderr. Frappe requires Node 24 or
  later (`package.json:19-21`), so the function exists on every supported bench.
- **Refused syntax.** Node's list is enum declarations, namespaces with runtime code,
  parameter properties, import aliases, and decorators. Measured here: also `export =`
  and `<T>x` casts (error text: "The angle-bracket syntax for type assertions, `<T>expr`,
  is not supported in type strip mode"). Each refusal throws
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` with the line, which the compile module can report
  the same way as a template error.
- **Cost.** The 28 ms is a one-time load per process (`lazyLoad` of Amaro on first call).
  It is the biggest part of the added cost because the server starts one `node` per compile.
- **Version drift.** Node 24.9 ships Amaro 1.1.2 (`process.versions.amaro`); npm has
  1.2.1. The output can change with the Node version, so `process.versions.amaro` would
  join the compile cache key. A Node built without Amaro reports
  `process.features.typescript === false`; the server could check that once.

## The `@babel/parser` blanking route in more detail

`babel-blank.mjs` parses with `plugins: ["typescript"]` and overwrites each type-only range
with spaces, keeping newlines. It reuses the parse the compile module already does, so the
cost is the walk (0.11 ms warm). The sketch fails on cases a full version must handle:
class modifiers, `this` parameters, a return type on its own line (blanking leaves a line
break before `=>`, which is a syntax error), type-only namespaces, and automatic semicolon
cases where a blanked statement makes the next line join the previous one. ts-blank-space
handles these in about 800 lines and is the reference for what is needed
([ts-blank-space](https://github.com/bloomberg/ts-blank-space),
[its unsupported list](https://github.com/bloomberg/ts-blank-space/blob/main/docs/unsupported_syntax.md)).

## Why the reprinting tools do not fit the stored path

Oxc (already present through vite), esbuild and `tsc` print new code. Measured on the
sample, the `template:` key moved from line 27 to 28 (Oxc), 17 (esbuild) or 18 (`tsc`).
The spec's stored path has no source map and relies on line numbers for stack traces, the
Error Log row and the `//# sourceURL` line. Using these tools would bring source maps back.
Babel's `retainLines` kept lines on the sample, but its docs say "it is only a
best-effort, and is not guaranteed in all cases with all plugins"
([Babel options](https://babeljs.io/docs/options#retainlines)). Sucrase kept lines on the
sample and every snippet, but moved a column on the sample, and its README says "think carefully before using Sucrase in
production" ([sucrase](https://github.com/alangpierce/sucrase#what-sucrase-is-not)).

## The app-file path (vite)

App `.ts` files already lose their types in vite's Oxc step. Vite runs user plugins
without `enforce` after its core plugins
([vite plugin ordering](https://vite.dev/guide/api-plugin.html#plugin-ordering)).
Measured with vite 8.1.5 (`vite-order.mjs`, `out/vite-order.json`): a plugin with no
`enforce` sees `contacts.ts` with types already gone; an `enforce: "pre"` plugin sees the
types. So the app path needs nothing new for types unless the template plugin runs `pre`;
then the compile module must parse `.ts` files with the `typescript` parser plugin.

One difference would remain between the paths: Oxc accepts `enum`, parameter properties
and `namespace` in app files, while Node's stripper refuses them in stored scripts.

## What a stored script would need

- **A language marker.** `Client Script` has `script` (a Code field with options `JS`) and
  `view` (`List`, `Form`, `Record`) among its fields
  (`frappe/custom/doctype/client_script/client_script.json`). The Code field's options set
  the editor language for every record, so a per-record choice needs a new field, for
  example a Select of JavaScript and TypeScript.
- **Why not strip everything.** On the JavaScript sample Node's stripper returns the same
  bytes. But `const x = f < T > (y);` came back as `const x = f       (y);`. In JavaScript
  that line compares `f < T` with `y`; in TypeScript it is a call, so the meaning changes.
  Rare, but a flag avoids it.
- **The rest.** The language goes into the compile cache key with the Amaro version. The
  `//# sourceURL` could end in `.ts`. The editor needs a TypeScript mode;
  `@codemirror/lang-javascript` is already a dependency and has a `typescript` option.
  Type checking is a separate question; none of these tools check types.

Not measured: TypeScript inside template expressions (for example `{{ (x as Foo).y }}`).
`@vue/compiler-dom` would need its `expressionPlugins` option for that, and its output
would then hold types that need stripping after the template compile.

## Files

| File | What it does |
|---|---|
| `scripts/contacts.ts`, `scripts/contacts.js` | The TypeScript sample and the JavaScript baseline |
| `tools.mjs` | One adapter per stripper; resolves tools from `frontend/node_modules` where present |
| `bench-one.mjs`, `run-bench.mjs` | In-process load, first and warm times, line and column check |
| `pipeline.mjs`, `cold.py` | One cold `node` compile per run, started from Python |
| `syntax.mjs`, `summary.py` | The syntax table |
| `babel-blank.mjs` | The `@babel/parser` blanking sketch |
| `sizes.sh`, `count-packages.mjs` | Bytes and packages per tool |
| `vite-order.mjs` | Whether a vite plugin sees `.ts` before or after stripping |
| `out/` | Raw results |

To rerun: `npm install` in this folder (only the tools not already in `frontend/`), then
`node run-bench.mjs > out/node.json`, `python3 cold.py > out/cold.json`,
`node syntax.mjs > out/syntax.json`, `sh sizes.sh /tmp/sizes > out/sizes.tsv`,
`node vite-order.mjs`. Set `FRAPPE_APP` if the frappe app is not at
`/Users/shariq/crm-bench/apps/frappe`.
