# Desk v2 record page: what makes up its JS and API calls, and what closes each part

Research for [frappe/frappe#43587](https://github.com/frappe/frappe/issues/43587). Code: `upstream/desk-v2` at `5298b96a98` (2026-09-29).

## Answer in short

| budget | today | budget | above budget | planned change that closes it | owner map |
| --- | --- | --- | --- | --- | --- |
| record JS, gzip | 723.5 KB | 460 KB | 263.5 KB | Show saved comments as HTML, load the editor only to write ([#43452](https://github.com/frappe/frappe/issues/43452)): removes 288.3 KB, result 435.2 KB | activity column, [#42758](https://github.com/frappe/frappe/issues/42758) |
| record API calls, cold ToDo | 13 | 9 | 4 | A Link field searches when its picker opens ([#43584](https://github.com/frappe/frappe/issues/43584)): removes 5 calls, result 8 | `@framework/ui` package, [#42660](https://github.com/frappe/frappe/issues/42660) |

- Each of the two changes alone closes its gap. Nothing above the budget is left without an owner.
- One condition: #43452 closes the JS gap only if the saved-comment view does not load the code colouring library (lowlight, 49.6 KB) at first paint. If it does, the record page is 484.8 KB, 24.8 KB above the budget. Then a second change is needed. The best one found is to load the child-table field on demand (59.5 KB). No ticket owns it.
- #43452's body says 277 KB. The measured cut is 288.3 KB, because the editor chunk also imports a separate `marked` chunk (11.2 KB).

## Method

- JS: the same build that `yarn test:page-js` (`frontend/check-page-js.mjs`) makes: `vite build` with `root: frontend`, the same page rule (the entry `index.html` plus the static imports of `src/pages/Record.vue`, each file gzipped with Node's `zlib`).
- The build used a frappe-only `frontend/manifest.json` (the shared bench's manifest with the `crm` and `erpnext` entries removed and `source_dir` set to the worktree), and a copy of the shared bench's `frontend/node_modules`. The generated `package.json` and `yarn.lock` came from the shared bench; `package.base.json` and `yarn.lock.base` are the same as at `5298b96a98`.
- Result: home 281.8 KB, list 374.2 KB, record 723.5 KB. These are equal to the baselines in `frontend/speed-budgets.json`. CI measured 724.5 KB at `e36b945f75` ([job log](https://github.com/frappe/frappe/actions/runs/36533494967/job/109300057290)).
- Source attribution: the build's source maps. Each byte of a chunk goes to the source file its mapping names. A source's gzip share is the chunk's gzip size times the source's share of raw bytes. This is an estimate; chunk totals are exact.
- Planned changes: each one was applied as a small patch, the page rule was run again, and the patch was removed. The patches are in this folder. They are measurement stand-ins, not the real fix.
- Calls: CI printed the 13 calls when the record check failed at `e1600abb8f` ([job log](https://github.com/frappe/frappe/actions/runs/36531503137/job/109286795743)). The only runtime change from that commit to `5298b96a98` is a developer-mode page renderer in `hooks.py`, so the list is valid for `5298b96a98`. Each call was traced to the code that sends it. No server was started and no live site was used.

## 1. The record page's JS by chunk

51 files, 723.5 KB gzip. Three groups:

| group | gzip KB | files |
| --- | --- | --- |
| also on home (boot bundle and shared UI) | 280.3 | 38 |
| also on the list, not on home | 71.2 | 3 |
| record page only | 371.9 | 10 |

Chunks of 5 KB or more (full list in `record-js.json`):

| chunk | gzip KB | loaded by | also on |
| --- | --- | --- | --- |
| `paperclip` (rich-text editor) | 277.0 | `ActivityTimeline` → `CommentItem.vue` imports `frappe-ui/editor` | record only |
| `vuedraggable.umd` | 63.7 | `FormLayout` → `fieldTypes.ts` → `TableField` → `Grid.vue` imports `vuedraggable` | list |
| `vue.runtime.esm-bundler` | 47.5 | entry | home |
| `index` (entry: shell, router, socket) | 32.1 | entry | home |
| `FormLayout` | 27.2 | `Record.vue` | record only |
| `Record` | 27.2 | the page | record only |
| `DateTimePicker` | 25.8 | entry | home |
| `Button` | 23.2 | entry | home |
| `Combobox` | 22.3 | entry | home |
| `registry` (record page engine) | 19.7 | entry | home |
| `ItemListRow` | 11.6 | entry | home |
| `marked.esm` | 11.2 | the editor chunk | record only |
| `Dropdown` | 11.1 | entry | home |
| `purify.es` | 10.9 | entry | home |
| `ActivityTimeline` | 10.2 | `Record.vue` | record only |
| `vue-router` | 10.0 | entry | home |
| `useColorScheme` | 9.9 | entry | home |
| `Skeleton` | 8.5 | entry | home |
| `Tabs` (frappe-ui tabs) | 8.1 | `Record.vue`, `FormLayout` | record only |
| `toast` | 7.5 | entry | home |
| `FileUploadDialog` | 6.9 | `Record.vue` → `RecordUploadDialog.vue` | record only |
| `target` | 6.9 | entry | home |
| `nativeElements` | 6.3 | `Tabs`, `vuedraggable.umd` | list |
| `writerContext` | 5.1 | entry | home |
| `useActivityTimeline` | 5.0 | entry | home |

The record page imports 17 more chunks only on demand (for example the comment writer 12.1 KB, CodeMirror 18.7 KB and more, leaflet 42.0 KB). The check does not count these, and this research does not either.

## 2. The record page's JS by source

Top groups, gzip KB share (per package and folder in `record-js-by-source.txt`):

| source | gzip KB | where |
| --- | --- | --- |
| rich-text editor stack (see below) | 286.1 | editor chunk and `marked.esm` |
| frappe-ui components, not the editor | 75.8 | shared UI chunks |
| desk shell and pages (`frontend/src`) | 66.6 | entry, `registry`, `Record` |
| Vue runtime and vue-router | 63.4 | entry |
| reka-ui and floating-ui | 59.0 | shared UI chunks |
| `@framework/ui` (`ui/src`) | 51.6 | `FormLayout`, `ActivityTimeline`, fields |
| vuedraggable and sortablejs | 31.5 | `vuedraggable.umd` |
| Vue template compiler (`@vue/compiler-core`, `compiler-dom`) | 26.7 | `vuedraggable.umd` |
| socket.io client | 13.2 | entry |
| not mapped to a source | 13.7 | all chunks |
| dompurify | 10.3 | entry |
| vue-sonner (toasts) | 7.2 | entry |
| leaflet and leaflet-draw (Geolocation field) | 7.1 | `FormLayout` |
| dayjs | 6.6 | `DateTimePicker` |

The editor, 288.2 KB (the editor chunk plus `marked.esm`):

| part | gzip KB |
| --- | --- |
| ProseMirror | 73.3 |
| Tiptap | 57.5 |
| lowlight and highlight.js (code colouring, 37 language files, two copies of highlight.js core: 11.12.0 and 11.11.2) | 53.6 |
| frappe-ui editor extensions and views | 51.2 |
| marked (two copies: 15.0.12 for frappe-ui, 17.0.6 inside `@tiptap/markdown`) | 23.1 |
| frappe-ui emoji extension (emoji list) | 21.4 |
| linkifyjs | 5.2 |

Two more facts from the source maps:

- The Vue template compiler (26.7 KB) is on the record page and on the list only because `vuedraggable`'s UMD build does `require("vue")`. That resolves to `vue/index.js`, the CommonJS build with the compiler. The desk never compiles templates at runtime.
- The `vuedraggable.umd` chunk also holds about 5 KB of field code (`Link.vue`, `NumberField.vue`, `formatNumber.ts`). The bundler put shared modules there. A ToDo has no child table, so `Grid.vue` is never drawn, but it is always loaded.

## 3. The 13 calls on a cold ToDo load

The page loads in three stages: boot, then the record reads (sent together), then the Link searches after the first paint.

| # | call | sent by | serves | first paint needs it | also on home or list |
| --- | --- | --- | --- | --- | --- |
| 1 | `frappe.shell.boot.get_boot` | `frontend/src/boot.ts:93`, awaited in `main.ts:29` | user, session, CSRF token, versions, navigation | yes, nothing mounts before it | home, list |
| 2 | `frappe.translate.get_boot_translations` | `ui/src/api/index.ts:294`, from `i18n.ts:13` | UI strings | no, not awaited; text updates when it lands | home, list |
| 3 | `frappe.shell.doctypes.get_addresses` | `frontend/src/addresses.ts:79`, awaited in `main.ts:48` | URL slug to DocType table; the router needs it | yes | home, list |
| 4 | `get_client_scripts?dt=ToDo&view=Record` | `frontend/src/recordPage/clientScripts.ts:131`, from `Record.vue:491` | Client Scripts | yes, but the page paints anyway after 500 ms (`paintGate.ts:9`) | no |
| 5 | `/api/v2/doctype/ToDo/meta` | `ui/src/composables/useDoctypeMeta.ts:89`, first from `useFormLayout.ts:58` | fields, permissions, child-table meta | yes (`Record.vue:637`) | list |
| 6 | `get_form_layouts?type=Details` | `recordPage/formLayoutSource/useFormLayout.ts:144`, from `Record.vue:493` | the form layout | yes (`Record.vue:652`) | no |
| 7 | `get_form_layouts?type=Side Panel` | same line, from `Record.vue:501` | side panel sections (a ToDo has none) | yes (`Record.vue:652`) | no |
| 8 | `/api/v2/document/ToDo/<name>?include=…` | `ui/src/api/index.ts:114`, from `pages/record/recordSource.ts:42` | the document and its extras (permissions, assignments, link titles, attachments, seen) | yes (`Record.vue:637`) | no |
| 9 | `User/search` | `ui/src/composables/useLinkSearch.ts:37`, from the immediate watch in `Link.vue:148` | `allocated_to` picker options | no, the form mounts after paint (`Record.vue:41`) | no |
| 10 | `DocType/search` | same | `reference_type` picker options | no | no |
| 11 | `Role/search` | same | `role` picker options | no | no |
| 12 | `User/search` | same | `assigned_by` picker options | no | no |
| 13 | `Assignment Rule/search` | same | `assignment_rule` picker options (the field is read-only) | no | no |

- Calls 1 and 3 run in series before the app mounts. Calls 4 to 8 start in the same tick. The page paints when 5 to 8 settle and 4 settles or 500 ms pass.
- The value shown in a Link field comes from `link_titles` in call 8. The five searches only fill pickers that are not open.
- User is searched twice because two fields each mount their own `Link.vue`, and no layer merges an identical GET that is in flight. The 60 s HTTP cache (`frappe/api/v2.py:273`) does not help: both go out in the same tick.
- A ToDo with `reference_type` set sends a sixth search, for `reference_name` (Dynamic Link).
- Calls 6 and 7 go to the same server function for the same DocType, in the same tick, and are awaited at the same line. The Side Panel call also makes the server build a fallback layout from meta that the client does not use (`form_layout.py:99`, `fallback: "none"`).
- No activity call goes out on a cold load without `?tab=activity`.

## 4. What each planned change removes

Planned changes were found on the maps #43265, #43276, #42758, #43484 and #42660 (sub-issues read with `gh api graphql`).

| change | owner map | JS removed | calls removed | record after | how measured |
| --- | --- | --- | --- | --- | --- |
| [#43452](https://github.com/frappe/frappe/issues/43452) saved comments as sanitised HTML, editor only to write | [#42758](https://github.com/frappe/frappe/issues/42758) activity column | 288.3 KB | 0 | 435.2 KB | `exp-editor-on-demand.patch` |
| the same, if the saved-comment view still loads lowlight to colour code blocks | [#42758](https://github.com/frappe/frappe/issues/42758) | 238.7 KB | 0 | 484.8 KB | `exp-editor-on-demand-lowlight-eager.patch` |
| [#43584](https://github.com/frappe/frappe/issues/43584) Link searches when its picker opens | [#42660](https://github.com/frappe/frappe/issues/42660) `@framework/ui` | about 0 | 5 (calls 9 to 13) | 8 calls | traced; the ticket's done-when says no search at load |
| no ticket: the Table field loads on demand (`fieldTypes.ts`) | none | 59.5 KB | 0 | 664.0 KB alone; 375.7 KB with #43452; 425.4 KB with #43452 and eager lowlight | `exp-table-field-on-demand.patch` |
| no ticket: one `get_form_layouts` call for both types | none (closest: the loader question [#43496](https://github.com/frappe/frappe/issues/43496) on #43484) | 0 | 1 | 7 calls with #43584 | traced |

Open tickets that touch the record load but do not change the two numbers:

| ticket | map | effect |
| --- | --- | --- |
| [#43462](https://github.com/frappe/frappe/issues/43462) one loader for file and stored scripts | [#43265](https://github.com/frappe/frappe/issues/43265) | merges how scripts arrive; does not say `get_client_scripts` goes away |
| [#43450](https://github.com/frappe/frappe/issues/43450) composer window gets writers by registration | #42758 | may move writer code into the record page's load; could add KB. Measure in its PR |
| [#43453](https://github.com/frappe/frappe/issues/43453) the shell stops importing pages | [#43085](https://github.com/frappe/frappe/issues/43085) | moves record page engine code (`registry`, 19.7 KB) from the entry to the record page; the record total does not change |
| [#43489](https://github.com/frappe/frappe/issues/43489) list loads its column and sort panels when opened | #43484 | list only; the record page still loads `vuedraggable` through `Grid.vue` |
| [#43466](https://github.com/frappe/frappe/issues/43466), [#43492](https://github.com/frappe/frappe/issues/43492) | #42660, #43484 | call 2 and call 3 stay; only their keys change |
| [#43211](https://github.com/frappe/frappe/issues/43211) Text Editor field on `frappe-ui/editor` | [#43206](https://github.com/frappe/frappe/issues/43206) | a risk: the field must load the editor on demand, or the 288 KB comes back |

## 5. What is left, by owner

JS after #43452 (435.2 KB; budget 460 KB):

| part | gzip KB | owner map | notes |
| --- | --- | --- | --- |
| boot bundle and shared UI, also on home | 280.6 | shell, [#43484](https://github.com/frappe/frappe/issues/43484); build, [#43085](https://github.com/frappe/frappe/issues/43085) | home is 282 KB against its 300 KB budget |
| `vuedraggable`, sortablejs, the Vue compiler and some field code, through `Grid.vue` | 63.7 | none. Fields map [#43206](https://github.com/frappe/frappe/issues/43206) or `ui/` map [#42660](https://github.com/frappe/frappe/issues/42660) own the code | on the list, #43489 owns it |
| `Record` chunk (`frontend/src/pages`) | 27.2 | record page map [#42271](https://github.com/frappe/frappe/issues/42271) is closed; the page engine is [#43265](https://github.com/frappe/frappe/issues/43265) | |
| `FormLayout` chunk (fields, leaflet parts 7.1 KB) | 27.2 | [#42660](https://github.com/frappe/frappe/issues/42660) | |
| `ActivityTimeline` and `Tabs` | 18.7 | [#42758](https://github.com/frappe/frappe/issues/42758) | |
| `FileUploadDialog`, `HoverCard`, `nativeElements`, `Breadcrumbs`, small chunks | 17.9 | none | |

Calls after #43584 (8; budget 9):

| call | owner map | could it go |
| --- | --- | --- |
| 1 boot, 2 translations, 3 addresses | [#43484](https://github.com/frappe/frappe/issues/43484) shell and server routes | shared by every page; no ticket removes them |
| 4 client scripts | [#43265](https://github.com/frappe/frappe/issues/43265) | cached in memory for the session only; no ticket removes it on a cold load |
| 5 meta | [#42660](https://github.com/frappe/frappe/issues/42660) (data layer) | needed |
| 6 and 7 form layouts | none (closest [#43496](https://github.com/frappe/frappe/issues/43496)) | 7 can merge into 6 |
| 8 document | [#43265](https://github.com/frappe/frappe/issues/43265) | needed |

## 6. Not owned today

These are not needed to meet the budgets once #43452 and #43584 land as sized. They are the margin if either change lands smaller.

| part | size | possible change |
| --- | --- | --- |
| Table field and `Grid.vue` loaded on every record | 59.5 KB | load `TableField` on demand, as `CodeEditorField` already is |
| Vue template compiler through `vuedraggable`'s UMD build | 26.7 KB (record and list) | resolve `vue` to the runtime build for `vuedraggable`, or use its ES build |
| two `get_form_layouts` calls | 1 call | one call for both types |
| editor stack duplicates (two highlight.js cores, two `marked` copies) and the emoji list | about 39 KB of the on-demand editor (5.9 + 11.9 + 21.4) | matters only for the writer after #43452 |

## 7. Other findings

- A `ui/node_modules` folder changes the build. The shared bench has one. With it, the linked `@framework/ui` resolves `dompurify`, `@vueuse`, `vuedraggable`, `sortablejs` and `leaflet` from its own folder, not from the framework's tree. The record page is then 732.1 KB, not 723.5 KB, and the check fails by 3.6 KB on a machine where CI passes. CI has no `ui/node_modules`. The build does not warn.
- The shared bench's generated `frontend/package.json` does not have the `test:page-js` script yet (it was made before the script was added), so `yarn test:page-js` fails there. `node check-page-js.mjs` runs the same code.

## Files

| file | what |
| --- | --- |
| `measure-record-js.mjs` | builds as the check does and writes chunk sizes, source shares and the manifest to JSON. Run from `frontend/`: `node ../research/desk-v2-record-speed-breakdown/measure-record-js.mjs out.json` |
| `summarize.py` | groups the JSON by package and folder |
| `record-js.json` | the raw result at `5298b96a98` |
| `record-js-by-source.txt` | the output of `summarize.py` |
| `calls-ci-record-cold.txt` | the 13 calls from the CI log |
| `exp-*.patch` | the stand-in patches used to size each change |
