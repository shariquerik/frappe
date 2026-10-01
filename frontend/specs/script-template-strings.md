# Spec: `template:` strings in Desk v2 scripts

Status: draft, for the owner to accept on the spec ticket,
[write the spec for `template:` strings](https://github.com/frappe/frappe/issues/43718).

This spec collects the decisions of the closed tickets on the map
[Desk v2: components in scripts without h()](https://github.com/frappe/frappe/issues/43692).
It makes no new decision. Where no ticket decided a point, section 12 says so.

Code references are at desk-v2 `005b121651`. The map was chartered at `31a8407561`.
Where code moved since then, this spec cites the current place.

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
| `props: { page: Object }` | A header component receives `{ ...item.props, page }`. The comment at `frontend/SCRIPTING.md:464` says so. | existing doc |
| Palette classes only | All seven classes are in `frontend/palette.txt`, so the text looks the same in both tiers. | [docs](https://github.com/frappe/frappe/issues/43717) |
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
| Cache key | The source hash, the compiler name, the exact version read from `@vue/compiler-dom/package.json`, the build, which is the Node build with `NODE_ENV=production` fixed, the compile options, and the version of the compile script. The global component list and the global value list are compile options, so they are in the key. | [stored path](https://github.com/frappe/frappe/issues/43698), [names](https://github.com/frappe/frappe/issues/43714) |
| `unsafe-eval` needed | No. No template compiles in the browser. Desk v2 sends no Content-Security-Policy today. | [stored path](https://github.com/frappe/frappe/issues/43698), [syntax costs](https://github.com/frappe/frappe/issues/43693) |
| Error shown: form save | The save is blocked. One dialog lists every error with script line, column, compiler text and the three lines around it. The Code field marks each error at its line. | [stored path](https://github.com/frappe/frappe/issues/43698), [editor](https://github.com/frappe/frappe/issues/43715) |
| Error shown: while typing | None. Only the save checks. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Error shown: build | `bench build` stops with file, line, column and compiler message. `yarn dev` shows the same error in the vite error screen. | [app-file path](https://github.com/frappe/frappe/issues/43699) |
| Error shown: fixture, Package Import, patch, restore | The record is kept. The first fetch compiles it. On failure the script is skipped, an Error Log row is written, and users who can write Client Scripts see a toast. | [stored path](https://github.com/frappe/frappe/issues/43698), [names](https://github.com/frappe/frappe/issues/43714) |

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
| Script values | A template reads script values through props or what `setup()` returns, with `{{ }}` or a `:` binding. A top-level `ref` lets a handler and a component share a value. | [which syntax](https://github.com/frappe/frappe/issues/43697) |
| Styles | A stored script can rely on frappe-ui components, `style` attributes and the palette classes. The build scans an app file, so any class works there. | [docs](https://github.com/frappe/frappe/issues/43717) |
| `h()` | Stays valid. Use a render function when code builds the markup, for example tags that differ by row. | [docs](https://github.com/frappe/frappe/issues/43717) |
| SFC text | An app file can import a `.vue` file, as today. A stored script cannot hold SFC text. | [which syntax](https://github.com/frappe/frappe/issues/43697) |

## 5. The shared compile module

One module in `frontend/plugin/` turns templates into render functions. The server runs
it through `node` for stored scripts. A vite plugin calls it for app files. So both
tiers find the same keys, give the same output and give the same errors. A separate
vite plugin with its own rules was rejected because the two tiers could drift apart.
([app-file path](https://github.com/frappe/frappe/issues/43699))

What it does, in order:

1. A plain text search for `template:`. A file without it passes through unchanged,
   with no parse. This keeps the build cost at 12 to 14 ms; parsing every file costs 91
   to 102 ms. ([app-file path](https://github.com/frappe/frappe/issues/43699))
2. A JavaScript parser reads the file and finds every unquoted `template:` key. It
   checks the value against the literal-string rule.
   ([stored path](https://github.com/frappe/frappe/issues/43698))
3. It checks each component tag and value name against the lists in section 4.
   ([names](https://github.com/frappe/frappe/issues/43714))
4. It compiles each template with `@vue/compiler-dom` from `frontend/node_modules`. That
   copy has the same version as the page's Vue runtime, 3.5.41 today. The root
   `node_modules` holds Vue 3.3.9 for Desk v1 and must not be used.
   ([stored path](https://github.com/frappe/frappe/issues/43698))
5. The output keeps every line number. Each render function takes as many lines as its
   template string. The `import` of Vue helpers goes at the start of line 1, before the
   author's first line. ([stored path](https://github.com/frappe/frappe/issues/43698))
6. Each error carries line, column and compiler text. The line is the template's start
   in the file plus the compiler's position inside the template.
   ([stored path](https://github.com/frappe/frappe/issues/43698))

Other points:

- **Parser.** The parser becomes a direct dependency in `frontend/package.base.json`.
  Today `@babel/parser` is installed only because the Vue compiler needs it.
  ([stored path](https://github.com/frappe/frappe/issues/43698)) The prototype that
  measured the build used `@babel/parser`.
  ([app-file path](https://github.com/frappe/frappe/issues/43699))
- **Names file.** The fixed names live in one JSON file beside the compile module. The
  compile module and the editor both read it, so they cannot disagree. It joins the
  cache key. This is a default the [editor](https://github.com/frappe/frappe/issues/43715)
  ticket filled in without asking the owner.
- **Parity.** In the prototype, the server path and the vite path gave identical output
  for the same 43-line example: 2,943 bytes each, in build and in dev.
  ([app-file path](https://github.com/frappe/frappe/issues/43699))

## 6. Stored scripts

| Topic | Ruling | Source |
| --- | --- | --- |
| Which scripts | Record-view scripts whose text contains `template:`. Every other script, including every `h()` script, goes to the page unchanged and never needs `node`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Who compiles, and when | The server, with `node` and the compile module. It compiles at save, to check, and at fetch on a cache miss. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Where the compiler comes from | `frontend/node_modules`, which `bench build` installs. `build_shell` in `frappe/bundler.py:125-168` runs `yarn install` at line 144. No frappe_docker or Frappe Cloud image deletes it. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| What is stored | The source only. No new fields on `Client Script`. The compiled text lives in the Redis cache. A stored output column was rejected: a Vue update makes it old, a fetch would write to the database, and fixtures would carry compiled text. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Cache key | See section 3. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| What invalidates it | A source change, a Vue update, a change to the compile script or its options, or a cache clear. The next fetch compiles again. The `client_script_changed` realtime event, sent on save by `notify_record_pages` in `client_script.py:75-80`, already makes open pages fetch again. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Save from the form | Blocked on any compile error, with the dialog in section 3. A missing `node` gives a clear message, not a traceback. This follows Website Theme, which runs `node` and throws on its output in `frappe/website/doctype/website_theme/website_theme.py:112-121`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Error shape | A new subclass of `ValidationError`. Its response carries a list of entries, each with field name, line, column and text. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Fixtures | Fixtures import with `data_import=True`, so `validate` runs during `bench migrate`. The compile error is logged and the record is kept. | [server compile](https://github.com/frappe/frappe/issues/43695), [stored path](https://github.com/frappe/frappe/issues/43698) |
| Package Import | `validate` does not run, but `before_validate` does. The error is logged and the record is kept. | [server compile](https://github.com/frappe/frappe/issues/43695), [stored path](https://github.com/frappe/frappe/issues/43698) |
| Patches and restores | Patches that use `frappe.db.sql`, `set_value` or `bulk_update` skip `validate`. A restore runs no document code. | [server compile](https://github.com/frappe/frappe/issues/43695) |
| Fallback | The first fetch compiles any record that skipped the save. If that fails, or `node` or the compiler is missing, the fetch sends the script name with the error and no code. The page treats it as a script that failed to load. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Failed script on the page | The current path in `reportFailure`, `frontend/src/recordPage/clientScripts.ts:203-218`: a console error, an Error Log row, the script skipped, and one toast to users who can write Client Scripts. The other scripts still run. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| Line numbers | No source map. Because line numbers are kept, a stack trace, the Error Log row and the `//# sourceURL` line point at the author's line. `named` in `evaluateClientScript.ts:23-25` adds that line. An error inside a template points at the template's first line. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| How it runs | Unchanged: a blob-URL module through the import map, in `evaluateClientScript.ts:9-20`. | [stored path](https://github.com/frappe/frappe/issues/43698) |
| "One bench, one build" | No conflict. That ruling keeps the import map for stored scripts because no build can pre-compile a script written after the build. This compile does not use the vite build. The new needs are `node` at request time and the compiler in `frontend/node_modules`. | [stored path](https://github.com/frappe/frappe/issues/43698), [one bench, one build](https://github.com/frappe/frappe/issues/43085) |

Code at `005b121651` that this path changes:

- `get_client_scripts`, `frappe/custom/doctype/client_script/client_script.py:83-102`,
  sends `name` and `script` only and has no cache.
- `validate`, `client_script.py:45-46`, only calls `warn_on_unknown_classes` at `:52-69`,
  which never blocks.
- `ClientScriptRow` in `frontend/src/recordPage/clientScriptTypes.ts` has `name` and
  `script` only.

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
| Check while typing | None. A browser check would add 29.0 kB and could disagree with the server. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Save error | For this error type the record page shows the dialog in place of today's toast. It passes the entries to the Code field with that field name. | [editor](https://github.com/frappe/frappe/issues/43715) |
| Lint marks | A gutter icon, an underline at the column, and the text on hover. The cursor moves to the first error. Marks move with edits and clear on the next save. Marks work for any Code field; only the template compile sends them for now. | [editor](https://github.com/frappe/frappe/issues/43715) |

Code at `005b121651` that this changes:

- The Code field takes no extensions or diagnostics from its caller. Its props are at
  `CodeEditorField.vue:134-149`. Lint loads for JSON fields only, at `:188-205`.
- A save error becomes plain text. `rethrowSaveError` in
  `frontend/src/pages/Record.vue:838-845` strips the tags, and `runSave` at `:867-873`
  shows a toast. The [editor](https://github.com/frappe/frappe/issues/43715) ticket cited
  `Record.vue:766-813`; the code moved but works the same way.
- `ApiError` in `ui/src/api/envelope.ts:16-31` keeps only `type`, `message`, `title`,
  `exception`, `indicator` and `status`. It gains one optional field for the entries.

Defaults the [editor](https://github.com/frappe/frappe/issues/43715) ticket filled in
without asking the owner. The owner can change them when accepting this spec:

- The names file is one JSON file beside the compile module.
- The error class is `TemplateCompileError`.
- The entries travel in the error response under one new key, and `ApiError` gains a
  matching optional field.

## 9. Documentation changes

`frontend/SCRIPTING.md` gets five edits. The accepted text is in appendix A. The
[docs](https://github.com/frappe/frappe/issues/43717) ticket cited lines at
`31a8407561`. Lines after 104 have moved down by 10 since.

| Edit | Lines now | Lines in the ticket |
| --- | --- | --- |
| New section "Writing a component", after "Where a script runs" and before "The frame: `page.frame`" at line 157 | new | new |
| `StageBadge` in the header section, rewritten with `template:` | 464-468 | 454-458 |
| The paragraph after the header example, which suggests `h()` or a string | 476-481 | 466-471 |
| `Note` in the panel section, rewritten with `template:` | 594-597 | 584-587 |
| The body example's first lines: an app file with relative `.vue` imports and `onRefresh` | 284-297, first lines 285-290 | 274-287 |

The `StageBadge` range starts with the comment line
`// A component in each zone. Each receives { ...item.props, page }.` The replacement
text has no such line. This spec reads the edit as replacing the object at 465-468 and
keeping the comment, because the example in section 2 relies on what it says.

`SCRIPTING.md` has no `h()` calls today, so no `h()` example stays beside a template one.
The ticket's "13 lines" were `onRefresh(page) {` lines.
([docs](https://github.com/frappe/frappe/issues/43717))

`frontend/COMPATIBILITY.md` gets a new section, "Writing a component with a `template:`
string". The accepted text is in appendix B. It comes from
[app-file path](https://github.com/frappe/frappe/issues/43699), with its "Rules" line
replaced by the text from [names](https://github.com/frappe/frappe/issues/43714), as that
ticket directs. The `SCRIPTING.md` section links to its anchor,
`#writing-a-component-with-a-template-string`.

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

## 11. Out of scope

- **TypeScript in scripts.** Owner ruling on the map. See section 12 for the open
  question on stripping types later.
- **SFC text in stored scripts.** One SFC holds one component, so it needs a new record
  type or a new export shape, a second compile path and a second cache key.
  ([which syntax](https://github.com/frappe/frappe/issues/43697))
- **Desk v1 and CRM v1.**
- **A Content-Security-Policy.** Desk v2 sends none today, and this spec adds none.

## 12. Not decided by any ticket

These need a ruling before or during the build. This spec does not decide them.

1. **Stripping types later.** The map asks the spec to record whether the chosen
   compiler could strip TypeScript types later. No ticket answered this.
2. **Where the names file lives.** The [editor](https://github.com/frappe/frappe/issues/43715)
   default puts it beside the compile module in `frontend/plugin/`, and the editor in
   `ui/` reads it. `frontend/ARCHITECTURE.md` says `ui/` never uses `frontend/`, and the
   running desk never imports the build.
3. **`ARCHITECTURE.md`.** The server calling a module in the build folder at request time
   is a new edge between layers. `AGENTS.md` says the same PR must update
   `ARCHITECTURE.md`. No ticket wrote that text.
4. **`COMPATIBILITY.md` on `__`.** The bullet "There is no global" at
   `COMPATIBILITY.md:482` says the import is the only way to get `__`.
   [names](https://github.com/frappe/frappe/issues/43714) makes `__` and `__n` global in
   templates. No ticket gave new text for that bullet. No ticket says where the new
   `COMPATIBILITY.md` section goes in the file.
5. **The editor defaults** in section 8 were not put to the owner. The response key for
   the entries has no name yet.
6. **The fetch error row.** A fetch sends "the script name with the error and no code".
   No ticket names the field that carries the error on `ClientScriptRow`.
7. **Save and cache.** No ticket says whether the compile at save writes its output to
   the Redis cache, or only checks it.
8. **`@vue/compiler-dom` as a dependency.** The parser becomes a direct dependency. The
   compiler arrives today only through `vue`. No ticket says whether it becomes direct.

## 13. Build work, in order

1. The shared compile module and the names file in `frontend/plugin/`, with the parser
   as a direct dependency. Tests: the literal-string rule, the names check, kept line
   numbers, error positions.
2. The vite plugin in `frontend/vite.config.js`, with source maps. A parity test: the
   same text gives the same output through the plugin and through `node`.
3. `__` and `__n` on `app.config.globalProperties` in `frontend/src/main.ts`, after
   `createApp` at line 63.
4. The server compile: the `node` call, the Redis cache and its key, the save check in
   `validate`, logging for fixtures and Package Import, and compile on fetch in
   `get_client_scripts` with the error row.
5. The page loader: a row with an error and no code goes to `reportFailure`.
6. The structured error: the `ValidationError` subclass, the `ApiError` field, the dialog
   in `Record.vue`, and the diagnostics input and lint marks on the Code field.
7. The editor: `@codemirror/lang-vue` nested under `template:`, and completion inside
   templates.
8. The docs: appendix A into `SCRIPTING.md`, appendix B into `COMPATIBILITY.md`, and
   the points in section 12 once they are ruled.

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
calls stay. The path uses the `custom` form from line 833, because Lead belongs to
another app.

```js
// App file: myapp/myapp/custom/lead/record.js
import Summary from './Summary.vue'
import Assistant from './Assistant.vue'

export default {
  onRefresh(page) {
```

## Appendix B: text for `frontend/COMPATIBILITY.md`

From [app-file path](https://github.com/frappe/frappe/issues/43699#issuecomment-5928374957),
with the "Rules" line replaced by the text from
[names](https://github.com/frappe/frappe/issues/43714#issuecomment-5928529328). Both
accepted by the owner.

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
