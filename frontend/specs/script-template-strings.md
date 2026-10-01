# Spec: `template:` strings in Desk v2 scripts

Status: draft, for the owner to accept on the spec ticket,
[write the spec for `template:` strings](https://github.com/frappe/frappe/issues/43718).

This spec collects the decisions of the closed tickets on the map
[Desk v2: components in scripts without h()](https://github.com/frappe/frappe/issues/43692).
It makes no new decision. Section 12 lists the points the first draft found open, and
the ticket that ruled each one. No point is open now.

Code references are at desk-v2 `005b121651`. The map was chartered at `31a8407561`.
Where code moved since then, this spec cites the current place. The lines cited from
the last three tickets are the same at `59bd673cbf`.

## Sources

Each ticket is cited below by its short name.

| Short name | Ticket |
| --- | --- |
| syntax costs | [Research: what each candidate markup syntax costs in a stored script](https://github.com/frappe/frappe/issues/43693) |
| JSX flavours | [Research: what an author loses with each flavour of Vue JSX](https://github.com/frappe/frappe/issues/43694) |
| server compile | [Research: can the server compile a stored script's markup on save](https://github.com/frappe/frappe/issues/43695) |
| prototype | [Prototype: one real component written with h(), JSX, htm and a template string](https://github.com/frappe/frappe/issues/43696) |
| which syntax | [Grilling: which markup syntax Desk v2 scripts get](https://github.com/frappe/frappe/issues/43697) |
| stored path | [Grilling: where a stored script's markup becomes JavaScript, and what is stored](https://github.com/frappe/frappe/issues/43698) |
| app-file path | [Grilling: how an app file carries the chosen syntax through the vite build](https://github.com/frappe/frappe/issues/43699) |
| names | [Grilling: which names a template can use without a components list](https://github.com/frappe/frappe/issues/43714) |
| editor | [Grilling: what the Client Script editor shows for a template: string](https://github.com/frappe/frappe/issues/43715) |
| docs | [Grilling: how SCRIPTING.md and its examples show template: beside h()](https://github.com/frappe/frappe/issues/43717) |
| strip TypeScript types | [Research: could the template compile path strip TypeScript types later](https://github.com/frappe/frappe/issues/43721) |
| compiler home | [Grilling: where the template compile module and its names file live, given that the running desk never imports the build](https://github.com/frappe/frappe/issues/43720) |
| open points | [Grilling: the error names, fetch error field, cache write, permission check and docs text the spec leaves open](https://github.com/frappe/frappe/issues/43722) |

## 1. What changes

- A component in a Desk v2 script can write its markup as a Vue `template:` string.
  This holds in a stored `Client Script` with `view = Record` and in an app file.
  ([which syntax](https://github.com/frappe/frappe/issues/43697))
- `h()` stays valid. ([which syntax](https://github.com/frappe/frappe/issues/43697))
- The browser never compiles a template. The server compiles stored scripts. The vite
  build compiles app files. Both call one compile module.
  ([stored path](https://github.com/frappe/frappe/issues/43698),
  [app-file path](https://github.com/frappe/frappe/issues/43699))
- A bad template stops a form save or the build, at the author's line.
- A compile never runs author code. The server needs no new permission check.
  ([open points](https://github.com/frappe/frappe/issues/43722))
- JSX and `htm` were ruled out. The owner accepts a markup syntax only with `v-for` and
  `v-model`, and no JSX flavour has `v-for` or `v-if`.
  ([prototype](https://github.com/frappe/frappe/issues/43696),
  [JSX flavours](https://github.com/frappe/frappe/issues/43694))

## 2. The example: one module, two tiers

This is the module that [docs](https://github.com/frappe/frappe/issues/43717) wrote for
the new `SCRIPTING.md` section. It is valid without change as a `Client Script` row with
`view = Record` and `dt = CRM Deal`, and as the app file
`<app>/<module>/doctype/crm_deal/frontend/record.js`.

```js
import { Badge } from 'frappe-ui'

const DealStage = {
  components: { Badge },
  props: { page: Object },
  template: `
    <div class="flex items-center gap-2">
      <Badge :label="page.doc.status" :theme="page.doc.status === 'Won' ? 'green' : 'gray'" />
      <span v-if="page.doc.probability" class="text-sm text-ink-gray-5">
        {{ __('{0}% likely', [page.doc.probability]) }}
      </span>
    </div>
  `,
}

export default {
  onRefresh(page) {
    page.header.add({ name: 'deal_stage', zone: 'left', component: DealStage }, { after: 'record' })
  },
}
```

Why each part holds in both tiers:

| Part | Why it is valid in both tiers | Source |
| --- | --- | --- |
| `import { Badge } from 'frappe-ui'` | The import map in `frappe/hooks.py:21-27` already has `frappe-ui` for stored scripts. The build resolves it for app files. No new name. | [names](https://github.com/frappe/frappe/issues/43714) |
| `components: { Badge }` | No frappe-ui component is global, so each one is listed. | [names](https://github.com/frappe/frappe/issues/43714) |
| `__(...)` with no import | `__` and `__n` become global values for templates. | [names](https://github.com/frappe/frappe/issues/43714) |
| A backtick string with no `${}` | The compile module can find and compile it in both tiers. | [which syntax](https://github.com/frappe/frappe/issues/43697) |
| `props: { page: Object }` | A header component receives `{ ...item.props, page }`. The `component` row of the header item table, `frontend/SCRIPTING.md:328-329`, says so. The comment above `StageBadge` at `SCRIPTING.md:464` says it again, and it stays. | existing doc, [open points](https://github.com/frappe/frappe/issues/43722) |
| Palette classes only | All five classes are in `frontend/palette.txt`, so the text looks the same in both tiers. | [docs](https://github.com/frappe/frappe/issues/43717) |
| `export default { onRefresh }` | Both tiers take a handlers object. The check is in `frontend/src/recordPage/evaluateClientScript.ts:27-31`. | [which syntax](https://github.com/frappe/frappe/issues/43697) |

## 3. Costs

| Measure | Value | Source |
| --- | --- | --- |
| Bytes added to a cold load | 0 kB. The page compiles nothing. `__` and `__n` as globals add 0 kB, because the shell already loads the translate code. The editor parts load on demand. | [stored path](https://github.com/frappe/frappe/issues/43698), [names](https://github.com/frappe/frappe/issues/43714), [editor](https://github.com/frappe/frappe/issues/43715) |
| Bytes added to the editor | 33.5 kB gzip over today's 162.0 kB editor file: 26.9 kB for `@codemirror/lang-vue` with `lang-html`, 0.4 kB for completion lists, 6.2 kB for `@codemirror/lint`, which JSON fields already load. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Compile time, server cache miss | One `node` call for all scripts of one doctype: about 40 to 60 ms. Of that, 34 to 56 ms is the `node` start and 7.4 ms is a first compile. | [stored path](https://github.com/frappe/frappe/issues/43698), from [server compile](https://github.com/frappe/frappe/issues/43695) and [syntax costs](https://github.com/frappe/frappe/issues/43693) |
| Compile time, server cache hit | One hash and one Redis read for each script. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Compile time, per script | `@vue/compiler-dom` in Node: 7.4 ms first, 0.17 ms warm. The shared-module prototype: 13 ms first call, 0.4 ms later calls, for one script with two templates. | [syntax costs](https://github.com/frappe/frappe/issues/43693), [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Compile time, vite build | 12 to 14 ms inside the plugin for the whole build. `bench build` went from 3.65 s to 3.79 s, median of 3, with run-to-run noise of about 0.3 s. Vite 8.1.5, 3,073 modules, 243 app `.js` and `.ts` files. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Cache key | The source hash, the compiler name, the exact version read from `vue/package.json`, the build, which is the Node build with `NODE_ENV=production` fixed, the compile options, and the version of the compile script. The names file and the fixed `hoistStatic: false` are compile options, so they are in the key. `vue` pins `@vue/compiler-dom` at the same version, 3.5.41 today. | [stored path](https://github.com/frappe/frappe/issues/43698), [names](https://github.com/frappe/frappe/issues/43714), [open points](https://github.com/frappe/frappe/issues/43722) |
| Cache write | The compile at save and the compile at fetch write the same key. A failed compile is cached too, with its error text, so a broken script costs one `node` call, not one on each page load. | [open points](https://github.com/frappe/frappe/issues/43722) |
| `unsafe-eval` needed | No. No template compiles in the browser. Desk v2 sends no Content-Security-Policy today. | [stored path](https://github.com/frappe/frappe/issues/43698), [syntax costs](https://github.com/frappe/frappe/issues/43693) |
| Error shown: form save | The save is blocked. One dialog lists every error with script line, column, compiler text and the three lines around it. The Code field marks each error at its line. | [stored path](https://github.com/frappe/frappe/issues/43698), [editor](https://github.com/frappe/frappe/issues/43715) |
| Error shown: while typing | None. Only the save checks. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Error shown: build | `bench build` stops with file, line, column and compiler message. `yarn dev` shows the same error in the vite error screen. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Error shown: fixture, Package Import, patch, restore | The record is kept. The first fetch compiles it. On failure the script is skipped, an Error Log row is written, and users who can write Client Scripts see a toast. | [stored path](https://github.com/frappe/frappe/issues/43698), [names](https://github.com/frappe/frappe/issues/43714) |
| New permission check | None. The compile never runs author code, so it is safe in a reader's request. Section 6 gives the two guards. | [open points](https://github.com/frappe/frappe/issues/43722) |
| New dependency | None. The parser and the compiler come from `vue/compiler-sfc`. | [open points](https://github.com/frappe/frappe/issues/43722) |

For comparison, compiling in the browser would add 21.3 kB to every cold load with the
full Vue build, or 29.1 kB on demand, and would need `unsafe-eval`.
([syntax costs](https://github.com/frappe/frappe/issues/43693))

## 4. Rules for authors

| Rule | What it says | Source |
| --- | --- | --- |
| Standard Vue only | Standard Vue template rules and directives. There is no Frappe-only template syntax. | [which syntax](https://github.com/frappe/frappe/issues/43697) |
| The literal string | Every object key written `template:` with no quotes is a template. Its value must be a string literal, or a backtick string with no `${}` parts. A variable, a `${}` part or a shorthand `{ template }` is a compile error at the author's line. | [which syntax](https://github.com/frappe/frappe/issues/43697), [stored path](https://github.com/frappe/frappe/issues/43698) |
| Plain data | A quoted `"template":` key is plain data, for example `args: { "template": name }`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Components | A template can use a component only if its own `components:` lists it. Import each frappe-ui component and list it. No entry is needed for the component's own `name`, `RouterLink`, `RouterView` or Vue's built-ins such as `Transition`. | [names](https://github.com/frappe/frappe/issues/43714) |
| Values | Props, the keys of the object `setup()` returns, `data()`, `computed:`, `methods:`, `inject:`, Vue's `$` names, and the globals `__` and `__n`. A `setup()` return named `__` wins over the global. | [names](https://github.com/frappe/frappe/issues/43714) |
| Unknown names | An unknown component or value name is a compile error with line and column. If `components:` or a value list is a variable or a spread, that component is not checked. | [names](https://github.com/frappe/frappe/issues/43714) |
| Name clashes | Only `RouterLink` and `RouterView` are global, and nobody else can add one. If a script lists its own `RouterLink`, the local one wins, as in standard Vue. | [names](https://github.com/frappe/frappe/issues/43714) |
| Script values | A template reads script values through props or what `setup()` returns, with `{{ }}` or a `:` binding. A top-level `ref` lets a handler and a component share a value. | [which syntax](https://github.com/frappe/frappe/issues/43697) |
| Styles | A stored script can rely on frappe-ui components, `style` attributes and the palette classes. The build scans an app file, so any class works there. | [docs](https://github.com/frappe/frappe/issues/43717) |
| `h()` | Stays valid. Use a render function when code builds the markup, for example tags that differ by row. | [docs](https://github.com/frappe/frappe/issues/43717) |
| SFC text | An app file can import a `.vue` file, as today. SFC text in a stored script is out of scope for this map. A later effort can add it. | [which syntax](https://github.com/frappe/frappe/issues/43697) |

## 5. The shared compile module

One module turns templates into render functions. The server runs it through `node` for
stored scripts. A vite plugin calls it for app files. So both tiers find the same keys,
give the same output and give the same errors. A separate vite plugin with its own rules
was rejected because the two tiers could drift apart.
([app-file path](https://github.com/frappe/frappe/issues/43699))

Where it lives, from [compiler home](https://github.com/frappe/frappe/issues/43720):

| Topic | Ruling |
| --- | --- |
| Folder | `frontend/templateCompiler/`, a new folder beside the layers. It holds the compile module and the names file. The build keeps its rule that the running desk never imports it. |
| Why there | Node looks for packages upward from the file. From this folder it finds `frontend/node_modules` first, so it gets Vue 3.5.41, the page's version. From `ui/` it would find the root copy, Vue 3.3.9. |
| What it may use | Its own files and the npm packages in `frontend/node_modules` only. Nothing from a layer or from the build. |
| Who uses it | Three new edges. The build imports it for app files. The framework server runs it with `node`, from `client_script.py` only. `main.ts` imports only its names file. The folder change is a move, not an edge, because no code exists there yet. |
| Checks | No new CI check. The JS layer check cannot see a Python `node` call, so `ARCHITECTURE.md` names the one caller and review checks it. The check works per folder, so it cannot limit `main.ts` to the names file either. |
| Docs | The same PR updates `ARCHITECTURE.md`, `frontend/architecture/layers.json` and the `Client Script` entry of `frontend/CONTEXT.md`. Appendix C holds the text. |

What it does, in order:

1. A plain text search for `template:`. A file without it passes through unchanged,
   with no parse. On the server the search runs before the `node` call
   ([stored path](https://github.com/frappe/frappe/issues/43698)). In the vite plugin it
   keeps the build cost at 12 to 14 ms, and parsing every file costs 91 to 102 ms
   ([app-file path](https://github.com/frappe/frappe/issues/43699)). Whether the module
   repeats the search is a build detail.
2. `babelParse` from `vue/compiler-sfc` reads the file and finds every unquoted
   `template:` key. It checks the value against the literal-string rule.
   ([stored path](https://github.com/frappe/frappe/issues/43698),
   [open points](https://github.com/frappe/frappe/issues/43722))
3. It checks each component tag and value name against the lists in section 4.
   ([names](https://github.com/frappe/frappe/issues/43714))
4. It compiles each template with `compileTemplate` from `vue/compiler-sfc`, which runs
   `@vue/compiler-dom`. Both come from `frontend/node_modules`, at the same version as the
   page's Vue runtime, 3.5.41 today. The root `node_modules` holds Vue 3.3.9 for Desk v1
   and must not be used. The option `hoistStatic` is fixed at `false`.
   ([stored path](https://github.com/frappe/frappe/issues/43698),
   [open points](https://github.com/frappe/frappe/issues/43722))
5. The output keeps every line number. Each render function takes as many lines as its
   template string. The `import` of Vue helpers goes at the start of line 1, before the
   author's first line. ([stored path](https://github.com/frappe/frappe/issues/43698))
6. Each error carries line, column and compiler text. The line is the template's start
   in the file plus the compiler's position inside the template.
   ([stored path](https://github.com/frappe/frappe/issues/43698))

Other points:

- **Dependencies.** No new direct dependency. `vue` 3.5.41 pins `@vue/compiler-sfc` and
  `@vue/compiler-dom` at exactly 3.5.41, and exports `vue/compiler-sfc`. `@babel/parser`
  does not become a direct dependency in `frontend/package.base.json`. This reverses the
  first draft. ([open points](https://github.com/frappe/frappe/issues/43722))
- **Names file.** One JSON file in `frontend/templateCompiler/` holds the names a template
  can use with no `components:` entry. The compile module reads it, and it joins the
  cache key. `main.ts` imports it and passes the component names into `ui/`, so the
  editor and the compile module cannot disagree. Section 8 gives the path into `ui/`.
  ([editor](https://github.com/frappe/frappe/issues/43715),
  [compiler home](https://github.com/frappe/frappe/issues/43720),
  [open points](https://github.com/frappe/frappe/issues/43722))
- **No author code runs.** With `hoistStatic: true`, `@vue/compiler-dom` runs constant
  expressions through `new Function` during the compile, at `evaluateConstant` in
  `compiler-dom.cjs.prod.js:607`. A test compiled `{{ this["process"]["pid"] }}` beside
  20 static `<p>` rows. With `true` the output held the real process id. With `false` it
  did not. A test in the module pins `hoistStatic: false` with that template.
  ([open points](https://github.com/frappe/frappe/issues/43722))
- **Export name.** The build PR adds the module's exported function name to the
  template compiler table in `ARCHITECTURE.md`, as the concept check requires.
  ([compiler home](https://github.com/frappe/frappe/issues/43720))
- **Parity.** In the prototype, the server path and the vite path gave identical output
  for the same 43-line example: 2,943 bytes each, in build and in dev.
  ([app-file path](https://github.com/frappe/frappe/issues/43699))

## 6. Stored scripts

| Topic | Ruling | Source |
| --- | --- | --- |
| Which scripts | Record-view scripts whose text contains `template:`. Every other script, including every `h()` script, goes to the page unchanged and never needs `node`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Who compiles, and when | The server, with `node` and the compile module. It compiles at save, to check, and at fetch on a cache miss. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| How `node` is called | The server sends the source to `node` on stdin, as JSON. It does not use argv, because argv has a size limit and other processes can see it. `node` runs with `--disallow-code-generation-from-strings`, so a future option or Vue change that calls `new Function` fails the compile and runs nothing. | [open points](https://github.com/frappe/frappe/issues/43722) |
| Where the compiler comes from | `frontend/node_modules`, which `bench build` installs. `build_shell` in `frappe/bundler.py:125-168` runs `yarn install` at line 144. No frappe_docker or Frappe Cloud image deletes it. frappe_docker does not build Desk v2 yet, so this was read from its scripts, not tested. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| What is stored | The source only. No new fields on `Client Script`. The compiled text lives in the Redis cache. A stored output column was rejected: a Vue update makes it old, a fetch would write to the database, and fixtures would carry compiled text. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Cache key | See section 3. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Cache write | The compile at save writes its output to the Redis cache, under the same key as the fetch. The key holds no doctype, record or user, so the entry is correct for that text even if the save rolls back. A failed compile is cached too, under its own key, with the error text. | [open points](https://github.com/frappe/frappe/issues/43722) |
| What invalidates it | A source change, a Vue update, a change to the compile script or its options, or a cache clear. The next fetch compiles again. The `client_script_changed` realtime event, sent on save by `notify_record_pages` in `client_script.py:75-80`, already makes open pages fetch again. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Save from the form | Blocked on any compile error, with the dialog in section 3. A missing `node` gives a clear message, not a traceback. This follows Website Theme, which runs `node` and throws on its output in `frappe/website/doctype/website_theme/website_theme.py:112-121`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Error shape | `TemplateCompileError`, a subclass of `ValidationError`. The list of errors travels on the v2 error entry under the key `code_errors`. Each entry is `{ field, line, column, message }`. The name says "code", not "template", because the lint marks work on any Code field. | [editor](https://github.com/frappe/frappe/issues/43715), [open points](https://github.com/frappe/frappe/issues/43722) |
| Fixtures | Fixtures import with `data_import=True`, so `validate` runs during `bench migrate`. The compile error is logged and the record is kept. | [server compile](https://github.com/frappe/frappe/issues/43695), [stored path](https://github.com/frappe/frappe/issues/43698) |
| Package Import | `validate` does not run, but `before_validate` does. The error is logged and the record is kept. | [server compile](https://github.com/frappe/frappe/issues/43695), [stored path](https://github.com/frappe/frappe/issues/43698) |
| Patches and restores | Patches that use `frappe.db.sql`, `set_value` or `bulk_update` skip `validate`. A restore runs no document code. | [server compile](https://github.com/frappe/frappe/issues/43695) |
| Fallback | The first fetch compiles any record that skipped the save. If that fails, or `node` or the compiler is missing, the fetch sends a row with `error` and `script: ""`. The `error` text is the first compile error with its line and column. The row does not carry the `code_errors` list. The page treats it as a script that failed to load. | [stored path](https://github.com/frappe/frappe/issues/43698), [open points](https://github.com/frappe/frappe/issues/43722) |
| Failed script on the page | The current path in `reportFailure`, `frontend/src/recordPage/clientScripts.ts:203-218`: a console error, an Error Log row, the script skipped, and one toast to users who can write Client Scripts. The other scripts still run. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Line numbers | No source map. Because line numbers are kept, a stack trace, the Error Log row and the `//# sourceURL` line point at the author's line. `named` in `evaluateClientScript.ts:23-25` adds that line. An error inside a template points at the template's first line. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Permission check | No new check. The compile at save runs inside the save of a `Client Script`, which needs write permission. Only System Manager and Administrator have it. The compile at fetch runs inside `get_client_scripts`, after the read check on the target doctype at `client_script.py:87`, and returns output only for that doctype's scripts. | [open points](https://github.com/frappe/frappe/issues/43722) |
| No author code runs | A reader's fetch can compile a row from a fixture, a patch or a restore, which the save check never saw. The names check does not catch `this["process"]`. Two guards make the compile safe: `hoistStatic: false`, fixed and tested in the module (section 5), and the `node` flag above. The vite plugin needs only the first guard, because app files are code the site owner installed. | [open points](https://github.com/frappe/frappe/issues/43722) |
| How it runs | Unchanged: a blob-URL module through the import map, in `evaluateClientScript.ts:9-20`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| "One bench, one build" | No conflict. That ruling keeps the import map for stored scripts because no build can pre-compile a script written after the build. This compile does not use the vite build. The new needs are `node` at request time and the compiler in `frontend/node_modules`. | [stored path](https://github.com/frappe/frappe/issues/43698), [one bench, one build](https://github.com/frappe/frappe/issues/43085) |

Code at `005b121651` that this path changes:

- `get_client_scripts`, `frappe/custom/doctype/client_script/client_script.py:83-102`,
  sends `name` and `script` only and has no cache.
- `validate`, `client_script.py:45-46`, only calls `warn_on_unknown_classes` at `:52-69`,
  which never blocks.
- `ClientScriptRow` in `frontend/src/recordPage/clientScriptTypes.ts` has `name` and
  `script` only. It gains `error?: string`.

## 7. App files

| Topic | Ruling | Source |
| --- | --- | --- |
| How | A vite plugin calls the shared compile module. It joins the plugin list in `frontend/vite.config.js:25-39`. The full Vue build at run time was rejected: about 21 kB more, `unsafe-eval`, and errors only at run time. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Which files | Every `.js` and `.ts` file the build reads outside `node_modules`: app source, `frontend/src` and `ui/src`. A component in a helper file that `record.js` imports must work too. `.vue` files keep their own `<template>` block. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Which keys | The stored-script rule, unchanged. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Build error | A template error stops `bench build` with file, line, column and compiler message, as a JavaScript syntax error does today. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Source maps | The plugin returns a source map, so dev tools show the author's `template:` text at the right column. The compiled code does not change, so the tiers still match. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| File names | No new names. The contribution globs in `frappe/shell/manifest.py:49-67` stay. A `.vue` file stays an import from a `.js` contribution. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| One copy of Vue | A build with CRM has one `@vue/runtime-core`. `@vitejs/plugin-vue` 6.0.8 adds `resolve.dedupe: ["vue"]`. A second copy is possible only if a file imports an `@vue/*` subpackage directly, and no bundled CRM file does. | [app-file path](https://github.com/frappe/frappe/issues/43699) |

Facts:

- Today an app file's `template:` gets Vue's runtime-only build. In dev, Vue warns. In
  production the component mounts as an empty `<!---->`.
  ([app-file path](https://github.com/frappe/frappe/issues/43699))
- The Desk v2 build had 0 unquoted `template:` keys at `31a8407561`. The 19 on disk are
  in Desk v1 code. ([app-file path](https://github.com/frappe/frappe/issues/43699)) At
  `005b121651` a search of `frontend/src`, `ui/src` and `frontend/plugin` outside `.vue`
  files finds none either. `ui/src/components/ActivityTimeline/utils.ts:56` has
  `template: string`, a typed parameter, not an object key.

## 8. The editor

| Topic | Ruling | Source |
| --- | --- | --- |
| Which fields | Every Code field with JS options, 23 in frappe, `Client Script.script` among them. No schema change and no Desk v1 change. The HTML part applies only under an unquoted `template:` key. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Colors | `@codemirror/lang-vue` 0.1.3, nested into `javascript()` with `parseMixed`. Tags and attributes parse as HTML. `{{ }}` and directive values parse as JavaScript. `lang-vue` is not installed today. Its peers, `lang-html` ^6 and `lang-javascript` ^6.1.2, match what is installed. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Completion | Inside templates only. Tag names come from the script's own `components:` keys, read from the editor's syntax tree, plus the fixed names from the names file. Attributes offer Vue's `v-` words. JavaScript completion stays off: `autocompletion: false` at `ui/src/components/Fields/CodeEditorField.vue:164`. | [editor](https://github.com/frappe/frappe/issues/43715) |
| How the names reach `ui/` | `ui/` never reads the names file. `main.ts` imports it and passes the component names with `app.provide` through a new `TemplateNamesKey`, exported from `ui/src/components/Fields/`. Its value is a list of component names. This follows `UploadLimitsKey` in `frontend/src/main.ts:70-77`. With no value, the Code field completes Vue's built-in components only. The `v-` words are Vue's own list, which the server check does not read, so they stay in `ui/` code. | [compiler home](https://github.com/frappe/frappe/issues/43720) |
| Check while typing | None. A browser check would add 29.0 kB and could disagree with the server. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Save error | For `TemplateCompileError` the record page shows the dialog in place of today's toast. It passes the `code_errors` entries to the Code field with that field name. | [editor](https://github.com/frappe/frappe/issues/43715), [open points](https://github.com/frappe/frappe/issues/43722) |
| Lint marks | A gutter icon, an underline at the column, and the text on hover. The cursor moves to the first error. Marks move with edits and clear on the next save. They work for any Code field. Only the template compile sends them for now. | [editor](https://github.com/frappe/frappe/issues/43715), [open points](https://github.com/frappe/frappe/issues/43722) |

Code at `005b121651` that this changes:

- The Code field takes no extensions or diagnostics from its caller. Its props are at
  `CodeEditorField.vue:134-149`. Lint loads for JSON fields only, at `:188-205`.
- A save error becomes plain text. `rethrowSaveError` in
  `frontend/src/pages/Record.vue:838-845` strips the tags, and `runSave` at `:867-873`
  shows a toast. The [editor](https://github.com/frappe/frappe/issues/43715) ticket cited
  `Record.vue:766-813`; the code moved but works the same way.
- `ApiError` in `ui/src/api/envelope.ts:16-31` keeps only `type`, `message`, `title`,
  `exception`, `indicator` and `status`. It gains the optional field `codeErrors`, with
  the same entries as `code_errors`.

The [editor](https://github.com/frappe/frappe/issues/43715) ticket filled in four
defaults without asking the owner. The owner accepted all four on
[open points](https://github.com/frappe/frappe/issues/43722): a JSON names file, the class `TemplateCompileError`, one
new key for the entries, and lint marks on any Code field.

## 9. Documentation changes

`frontend/SCRIPTING.md` gets five edits. The accepted text is in appendix A. The
[docs](https://github.com/frappe/frappe/issues/43717) ticket cited lines at
`31a8407561`. Lines after 104 have moved down by 10 since.

| Edit | Lines now | Lines in the ticket |
| --- | --- | --- |
| New section "Writing a component", after "Where a script runs" and before "The frame: `page.frame`" at line 157 | new | new |
| `StageBadge` in the header section, rewritten with `template:`. The comment above it stays. | 465-468 | 455-458 |
| The paragraph after the header example, which suggests `h()` or a string | 476-481 | 466-471 |
| `Note` in the panel section, rewritten with `template:` | 594-597 | 584-587 |
| The body example's first lines: an app file with relative `.vue` imports and `onRefresh` | 284-297, first lines 285-290 | 274-287 |

The `StageBadge` range starts with the comment line
`// A component in each zone. Each receives { ...item.props, page }.` The comment stays,
on the line above the new `StageBadge`, so the replacement covers lines 465-468 only.
([open points](https://github.com/frappe/frappe/issues/43722))

`SCRIPTING.md` has no `h()` calls today, so no `h()` example stays beside a template one.
The ticket's "13 lines" were `onRefresh(page) {` lines.
([docs](https://github.com/frappe/frappe/issues/43717))

`frontend/COMPATIBILITY.md` gets a new section, "Writing a component with a `template:`
string". The accepted text is in appendix B. It comes from
[app-file path](https://github.com/frappe/frappe/issues/43699), with its "Rules" line
replaced by the text from [names](https://github.com/frappe/frappe/issues/43714), as that
ticket directs. The `SCRIPTING.md` section links to its anchor,
`#writing-a-component-with-a-template-string`. The new section goes right after
"What a script says to a reader: `frappe/i18n`", before "What an app declares:
`desk.package.json`" at line 485. The last bullet of the `frappe/i18n` section, at
lines 482-483, gets new text, because `__` and `__n` are now global inside a template.
([open points](https://github.com/frappe/frappe/issues/43722))

`frontend/ARCHITECTURE.md`, `frontend/architecture/layers.json` and the `Client Script`
entry of `frontend/CONTEXT.md` change in the same PR that adds
`frontend/templateCompiler/`. The accepted text is in appendix C. ([compiler home](https://github.com/frappe/frappe/issues/43720))

## 10. What does not change

- `h()` stays valid. Every `h()` script runs as today and never reaches `node`.
- Desk v1 and CRM v1 keep their syntax: `Client Script` with `view = Form` or `List`,
  and CRM's `CRM Form Script`. Desk v1 editors do not change.
- No new import map name. `vue`, `frappe-ui` and `frappe/i18n` are already there. A
  template no longer needs `frappe/i18n` for `__`.
  ([names](https://github.com/frappe/frappe/issues/43714))
- Loading `frappe-ui` on first use costs 37.8 kB gzip today, about 24 kB of it new to
  the shell. That cost exists today and does not change.
  ([names](https://github.com/frappe/frappe/issues/43714))
- No new file names and no change to the contribution globs.
- No new fields on `Client Script`.
- A stored script still runs as a blob-URL module through the import map.
- No new direct dependency in `frontend/package.base.json`.
- No new permission check, and no new CI check.
  ([open points](https://github.com/frappe/frappe/issues/43722),
  [compiler home](https://github.com/frappe/frappe/issues/43720))

## 11. Out of scope

- **TypeScript in scripts.** Owner ruling on the map. The map asks whether the chosen
  compiler could strip types later. It can: strip first, then run the JavaScript path.
  Node's own `module.stripTypeScriptTypes` adds 0 bytes, keeps every line and column, and
  adds about 28 ms to a fresh `node` run. It refuses `enum`, a `namespace` with code and
  parameter properties. A stored script would need a new field to say it is TypeScript.
  App files need nothing new, because vite strips types before the plugin runs.
  ([strip TypeScript types](https://github.com/frappe/frappe/issues/43721))
- **SFC text in stored scripts.** One SFC holds one component, so it needs a new record
  type or a new export shape, a second compile path and a second cache key.
  ([which syntax](https://github.com/frappe/frappe/issues/43697))
- **Desk v1 and CRM v1.**
- **A Content-Security-Policy.** Desk v2 sends none today, and this spec adds none.

## 12. Points the first draft left open

The first draft found ten points that no ticket had decided. Three tickets ruled them.
No point is open now.

| Point | Ruling | Where in this spec |
| --- | --- | --- |
| 1. Stripping types later | It can be done later: strip first, then run the JavaScript path. TypeScript stays out of scope. ([strip TypeScript types](https://github.com/frappe/frappe/issues/43721)) | Section 11 |
| 2. Where the names file lives | In `frontend/templateCompiler/`. `main.ts` passes the names into `ui/` through `TemplateNamesKey`. ([compiler home](https://github.com/frappe/frappe/issues/43720)) | Sections 5 and 8 |
| 3. The `ARCHITECTURE.md` text | A new folder beside the layers, three new edges, and the doc text. ([compiler home](https://github.com/frappe/frappe/issues/43720)) | Section 5, appendix C |
| 4. `COMPATIBILITY.md` on `__`, and where the new section goes | New text for the bullet. The section goes after the `frappe/i18n` section. ([open points](https://github.com/frappe/frappe/issues/43722)) | Section 9, appendix B |
| 5. The editor defaults | Accepted, and the entries travel under `code_errors`, read as `ApiError.codeErrors`. ([open points](https://github.com/frappe/frappe/issues/43722)) | Sections 6 and 8 |
| 6. The fetch error field | `error?: string` on `ClientScriptRow`, with `script: ""`. ([open points](https://github.com/frappe/frappe/issues/43722)) | Section 6 |
| 7. Save and cache | Save writes the cache. A failed compile is cached too. ([open points](https://github.com/frappe/frappe/issues/43722)) | Sections 3 and 6 |
| 8. The compiler as a dependency | No new direct dependency. Both parser and compiler come from `vue/compiler-sfc`. ([open points](https://github.com/frappe/frappe/issues/43722)) | Section 5 |
| 9. The `StageBadge` comment | It stays. ([open points](https://github.com/frappe/frappe/issues/43722)) | Sections 2 and 9 |
| 10. The permission check | No new check, because the compile never runs author code. Two guards make that true. ([open points](https://github.com/frappe/frappe/issues/43722)) | Sections 5 and 6 |

Two smaller points are left to the build PR by ruling, not left open:

- The exported function name of the compile module goes into the `ARCHITECTURE.md`
  table when the code exists. ([compiler home](https://github.com/frappe/frappe/issues/43720))
- Whether the compile module repeats the plain text search for `template:`. Section 5
  calls it a build detail. ([app-file path](https://github.com/frappe/frappe/issues/43699))

## 13. Build work, in order

This order is a plan for the builder. No ticket ruled it.

1. The folder `frontend/templateCompiler/` with the compile module and the names file.
   It imports `babelParse` and `compileTemplate` from `vue/compiler-sfc`, with
   `hoistStatic: false`. In the same PR: the `layers.json` entry, the `ARCHITECTURE.md`
   text and the `CONTEXT.md` sentence from appendix C. Tests: the literal-string rule,
   the names check, kept line numbers, error positions, and the `process.pid` template
   that pins `hoistStatic: false`.
2. The vite plugin in `frontend/vite.config.js`, with source maps. A parity test: the
   same text gives the same output through the plugin and through `node`.
3. In `frontend/src/main.ts`: `__` and `__n` on `app.config.globalProperties`, after
   `createApp` at line 63, and `app.provide(TemplateNamesKey, ...)` with the component
   names from the names file.
4. The server compile, called from `client_script.py` only: the `node` call with the
   source as JSON on stdin and `--disallow-code-generation-from-strings`, the Redis cache
   and its key, the cache write at save and for failed compiles, the save check in
   `validate`, logging for fixtures and Package Import, and compile on fetch in
   `get_client_scripts` with the `error` row.
5. The page loader: a row with `error` and `script: ""` goes to `reportFailure`.
6. The structured error: `TemplateCompileError` with `code_errors`, `ApiError.codeErrors`,
   the dialog in `Record.vue`, and the diagnostics input and lint marks on the Code field.
7. The editor: `@codemirror/lang-vue` nested under `template:`, completion inside
   templates, and `TemplateNamesKey` exported from `ui/src/components/Fields/`.
8. The docs: appendix A into `SCRIPTING.md` and appendix B into `COMPATIBILITY.md`.

## Appendix A: text for `frontend/SCRIPTING.md`

Accepted by the owner on [docs](https://github.com/frappe/frappe/issues/43717#issuecomment-5928819348).

**A1. New section, after "Where a script runs".**

~~~markdown
## Writing a component

Every list takes a Vue component. Write its markup as a `template:` string. The module
below is valid without change in both places a script lives: a `Client Script` row with
`view = Record` and `dt = CRM Deal`, or an app file,
`<app>/<module>/doctype/crm_deal/frontend/record.js`.

```js
import { Badge } from 'frappe-ui'

const DealStage = {
  components: { Badge },
  props: { page: Object },
  template: `
    <div class="flex items-center gap-2">
      <Badge :label="page.doc.status" :theme="page.doc.status === 'Won' ? 'green' : 'gray'" />
      <span v-if="page.doc.probability" class="text-sm text-ink-gray-5">
        {{ __('{0}% likely', [page.doc.probability]) }}
      </span>
    </div>
  `,
}

export default {
  onRefresh(page) {
    page.header.add({ name: 'deal_stage', zone: 'left', component: DealStage }, { after: 'record' })
  },
}
```

- **Components.** A template can use a component only if `components:` lists it. Import
  each frappe-ui component and list it. `RouterLink`, `RouterView` and Vue's built-in
  components, such as `Transition`, need no entry.
- **Values.** A template reads its props, what `setup()` returns, and the global
  functions `__` and `__n`. The full list of names is in
  [`COMPATIBILITY.md`](./COMPATIBILITY.md#writing-a-component-with-a-template-string).
- **The string.** `template:` takes a quoted or backtick string written in place, with no
  `${}` parts. Standard Vue template rules apply.
- **Styles.** A stored script can rely on frappe-ui components, `style` attributes and
  the classes in [the palette](./COMPATIBILITY.md#the-palette-the-classes-a-stored-script-can-rely-on).
  The build scans an app file, so any class works there.
- **Errors.** A bad template or an unknown name stops the save. A dialog gives the line,
  column and message, and the editor marks each error at its line. In an app file, the
  same error stops `bench build`.
- **`h()`.** `h()` stays valid. Use a render function when code builds the markup, for
  example tags that differ by row.

In the sections below, a name such as `PipelineChart` stands for any component written
this way.
~~~

**A2. `StageBadge`, header section.** Replaces the object at lines 465-468.

```js
const StageBadge = {
  props: { page: Object, size: String },
  template: `<span :class="size === 'sm' ? 'text-sm' : 'text-base'">Stage: {{ page.doc.status }}</span>`,
}
```

**A3. `Note`, panel section.** Replaces lines 594-597.

```js
const Note = {
  props: { page: Object, text: String },
  template: `<p class="p-3 text-sm">{{ text }}: {{ page.doc.status }}</p>`,
}
```

**A4. The paragraph at lines 476-481** becomes:

```markdown
A stored script imports by bare name from the import map: `vue`, `vue-router`,
`frappe-ui`, `@framework/ui` and `frappe/i18n`. An app adds names of its own,
`<app>/<alias>`, with the `import_map` hook; see
[`COMPATIBILITY.md`](./COMPATIBILITY.md#what-an-app-publishes-the-import_map-hook). An
app file can also import a `.vue` file. The item is the same.
```

**A5. The body example.** Lines 285-290 become the lines below. The four `page.body`
calls stay. The path uses the `custom` form from line 839, because Lead belongs to
another app.

```js
// App file: myapp/myapp/custom/lead/record.js
import Summary from './Summary.vue'
import Assistant from './Assistant.vue'

export default {
  onRefresh(page) {
```

## Appendix B: text for `frontend/COMPATIBILITY.md`

**B1. The `__` bullet.** The last bullet of "What a script says to a reader:
`frappe/i18n`", at lines 482-483, becomes the text below. Accepted by the owner on
[open points](https://github.com/frappe/frappe/issues/43722#issuecomment-5929525476).

```markdown
- **There is no `window.__`.** A script imports `__` from `frappe/i18n`, in a published
  file and a stored script alike. Inside a `template:` string, `__` and `__n` are global
  and need no import.
```

**B2. New section.** It goes right after the `frappe/i18n` section, before "What an app
declares: `desk.package.json`". From
[app-file path](https://github.com/frappe/frappe/issues/43699#issuecomment-5928374957),
with the "Rules" line replaced by the text from
[names](https://github.com/frappe/frappe/issues/43714#issuecomment-5928529328). Both
accepted by the owner. The placement is from
[open points](https://github.com/frappe/frappe/issues/43722#issuecomment-5929525476).

```markdown
## Writing a component with a `template:` string

A component in a contributed file can carry its markup as a `template:` string, the same
way a stored script does. The build compiles it; the page never compiles a template.

	const Tag = {
		props: ["label"],
		template: `<span class="badge">{{ label }}</span>`,
	};

- **Where.** Every `.js` and `.ts` file the build reads outside `node_modules`, not only
  the contributed file itself. A `.vue` file keeps its own `<template>` block.
- **Which keys.** Every object key written `template:` with no quotes is a template. Its
  value is a string or a backtick string with no `${}` parts. Anything else fails the build.
  To keep a `template` key as plain data, quote it: `{ "template": name }`.
- **Rules.** Standard Vue template rules.
- **Names.** A template can use only these names:
  - components in its own `components:`, its own `name`, `RouterLink`, `RouterView`
    and Vue's built-in components such as `Transition`;
  - values from props, from the object `setup()` returns, and from `data()`,
    `computed:`, `methods:` and `inject:`;
  - the `$` names Vue gives every component, and the global functions `__` and `__n`.

  No frappe-ui component is global. Import each one and list it in `components:`:

	import { Badge, Button } from "frappe-ui";
	const Status = {
		components: { Badge, Button },
		template: `<Badge :label="__('Open')" />`,
	};

- **Unknown names.** A name that is in none of these places stops `bench build` with
  the file, line and column. If one of these lists is not an object written in place,
  for example a variable or a spread, the build cannot read it. Then it does not check
  that component.
- **Errors.** A bad template stops `bench build` and names the file, line, column and the
  compiler's message. `yarn dev` shows the same error.
- **Same text, same result.** The build and a stored script use one compiler, so a
  component written here runs unchanged in a stored script.
- `h()` stays valid.
```

## Appendix C: text for `ARCHITECTURE.md`, `layers.json` and `CONTEXT.md`

Accepted by the owner on
[compiler home](https://github.com/frappe/frappe/issues/43720#issuecomment-5929382677).
Line numbers are the same at `005b121651` and `59bd673cbf`. The build PR adds the
compile module's exported function name to the table in C4.

**C1. `frontend/ARCHITECTURE.md:57`.** "Two things sit outside the nine layers:" becomes "Three things sit outside the nine layers:". Add this bullet after the build bullet:

> - **The template compiler sits beside them.** It turns each `template:` string in a script into a render function. It is `frontend/templateCompiler/`: the compile module and the names file. The build imports it for app files. The framework server runs it with `node` for stored scripts, from `client_script.py` only. `main.ts` imports only its names file. It uses its own files and the npm packages in `frontend/node_modules`, and nothing from a layer or the build.

**C2. "Outside the layers", the `main.ts` table.** The row "What the desk hands `ui/`" becomes:

> | What the desk hands `ui/` | The session, the CSRF token, the socket, upload limits, the invite address, and the component names a template can use with no `components:` entry |

**C3. "Outside the layers", the build table.** Add:

> | Template plugin | Calls the template compiler for each `.js` and `.ts` app file that holds `template:`. Stops `bench build` on a template error, and returns a source map |

**C4. "Outside the layers", a new table after the build table:**

> **The template compiler**
>
> | Concept | What it is |
> | --- | --- |
> | Compile module | Finds each unquoted `template:` key and checks its names. Then it compiles the template with `@vue/compiler-dom` from `frontend/node_modules` and keeps every line number. Both tiers call it, so they give the same output and errors |
> | Names file | The names a template can use with no `components:` entry: `RouterLink`, `RouterView`, Vue's built-in components, `__` and `__n`. Part of the cache key |

**C5. Layer 1 table, after "Client Script class check":**

> | Client Script template compile | On save, compiles a script that holds `template:` and blocks the save on an error. On fetch, sends the compiled copy from the Redis cache. On a cache miss, it compiles with one `node` call per doctype. The record keeps the source only |

**C6. Layer 4 table:**

> | `TemplateNamesKey` | The component names a `template:` string can use with no `components:` entry. The Code field completes them. With no value, it completes Vue's built-in components only |

**C7. Flow "Load a stored script onto a record page".**

- Step 3 adds: "For a script that holds `template:`, it sends the compiled copy. A cache miss compiles all such scripts of the doctype in one `node` call. A script that fails to compile goes out with its error and no code." Its cache cell becomes: "Disabled modules, per request. Compiled copies in Redis, keyed by source hash, compiler version, build, options, compile script version and names file".
- Step 5: "A failing script is skipped and reported" becomes "A failing script, or one sent with a compile error, is skipped and reported".
- The budget line adds: "A cache miss on compiled scripts adds one `node` call, about 40 to 60 ms."

**C8. `frontend/architecture/layers.json`.** Add the entry below. The `build` entry's `mayUse` becomes `["1", "templateCompiler"]`. The `main` entry's `mayUse` gains `"templateCompiler"`.

```json
{"id": "templateCompiler", "name": "The template compiler", "place": "beside", "section": "outside-the-layers", "table": "**The template compiler**", "paths": ["frontend/templateCompiler/"], "mayUse": []}
```

**C9. `frontend/CONTEXT.md`, the `Client Script` entry.** Add after its first sentence:

> A script with a `template:` string runs as the server's compiled copy. The stored text stays the author's text.
