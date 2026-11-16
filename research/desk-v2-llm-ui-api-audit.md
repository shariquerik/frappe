# Desk v2 — how LLM-controllable is the UI? (audit, 2026-11-16)

Read-only audit of `apps/frappe` on `desk-v2` at `22494aa39f`. All paths are under `apps/frappe/`. Lines marked "inferred" were not checked directly.

**In short:** the building blocks are mostly there, but nothing can reach them from outside the app. There is one act dispatcher (an "act" is a named command the desk can run). Nothing is published on `window`, acts have no parameter schemas, the most common record and list actions are not acts, and confirmation dialogs block a headless caller.

Related open maps: #45257 (command palette: acts, places and records), #46417 (the shell API: what a script reaches from anywhere), #42061 (root map).

## 1. Inventory

**Act dispatcher** (`frontend/src/acts/dispatcher.ts`), one instance (`:255`).
- **Shape:** an act has `name`, `label`, `icon`, `run(context, value)`, an optional default `key`, a `right` (permission), `palette:false` and a `when()` predicate (`:28-44`). Full names are `<surface>.<item>`. `frontend/CONTEXT.md:461` names "an LLM" as an intended caller.
- **Arguments:** one untyped `value`. `argument` only supplies pickable `options(context, query)` with a label (`:22-25`). There is no JSON schema and no description.
- **Discovery:** `available()` and `listed()` list what can run right now (`:135-149`). `describe()` returns name, label, icon, key, right and palette, but drops `when` (`:270-278`). A parameterised act's value shape is visible only as a TypeScript type, e.g. `Keys = Record<string, unknown>` (`pages/doctypeEditor/canvasActs.ts:11`).
- **Invoking:** `run(name, value)` returns what the act returns and rejects with a typed `ActDenied` (reason `missing`, `hidden` or `right`) (`:91-96`, `:174-178`). `perform()` swallows errors into a toast (`:181-195`). Return values vary: `header.save` gives a boolean (`SCRIPTING.md:1480-1500`), the danger acts give `void`.
- **Reach:** a module singleton only. The only global the shell sets is `window.csrf_token` (`frontend/src/boot.ts:188`). `main.ts` publishes nothing. There is no postMessage listener.

**Who registers acts** (five places):
- `shell/shellActs.ts:105`
- `recordPage/pageActs.ts:21` (header, quickActions, tabs)
- `pages/list/listActs.ts:62`
- `pages/doctypeEditor/editorActs.ts:51` (seven surfaces)
- `pages/create/CreateDialog.vue:99`, which only masks the page's acts

Apps add `shell.<app>.<item>` acts through `acts.js` (`shell/appActs.ts:1-60`).

**Script APIs:**
- `PageApi.run`, `open` and `create` (`pageEngine/types.ts:139-164`).
- `RecordPageApi`: `doc`, `saved`, `isDirty`, `fields.*`, `rows()`, `save()`, `rename()` (`recordPage/types.ts:359-393`).
- `ListPageApi`: `rows`, `selection` (read-only), `filters` and `sort` (writable), `callSelected` (`listPage/types.ts:49-66`).
- All of these reach only code loaded inside the app.

**Router and public exports:** `routeFor`/`urlFor` and `createPageEngine` (`public.ts:4-34`); seven fixed route names (`router/generated.ts:18-37`).

**Server side:**
- An MCP server already exists at `/api/v2/mcp` (`frappe/api/v2.py:519`). It has 13 data-level tools with pydantic argument schemas (`frappe/mcp/tools/__init__.py:84-117`, `:74`), plus `/discovery` (`v2.py:521-530`). It does not touch the UI.
- The DocType editor's edits use the same act vocabulary on the server: `save_doctype_editor(edits=[{act:"fields.add_field",…}])` (`frappe/desk/doctype_editor/save.py:29-30`). `test_ts_parity.py` keeps the TS and Python lists in step.

## 2. Coverage

| Area | Acts | Gaps |
|---|---|---|
| DocType editor | add/move field, set/reset property, add tab/section/column, save, undo/redo, settings, permissions, layouts, danger (`canvasActs.ts:15-136`, `editorActs.ts:74-223`). 67 `perform` calls replace clicks. | Almost none |
| Record page | save (`pages/Record.vue:466`), submit/cancel (`docstatusActs.ts:42-70`), assign with a user (`assignAct.ts:14-27`), rename, duplicate, amend, delete, follow, favourite | Setting a field and adding a child row are script-only. `comment`/`email` only open the composer and cannot post (`builtinActions.ts:113-119`). Attach opens a file picker. Tab switching is script-only. |
| List | create, open view, set default view (`listActs.ts:103-166`). Bulk acts exist only while rows are selected (`useBulkBar.ts:81-84`) and open dialogs (`bulkBarParts.ts:94-142`). | Filter, sort and columns are built-ins with no `run` (`ListPage.vue:190-196`). `toggle_row` needs the mouse cursor, so rows cannot be selected by name (`bulkKeys.ts:28-36`). The v2 list has no group-by. |
| Navigation and search | `shell.open`, `shell.create`, `shell.open_settings` (`shellActs.ts:240-287`) | Record search is a palette server call, not an act (`frappe/shell/palette.py:54`). No act for back. |
| Dialogs | none | No act lists, answers or closes a dialog. The Create dialog has no save act. |

**Estimate (inferred):** about 50% of the sampled actions exist as acts. Only about 35% can finish with no human click, because many acts end in a dialog or file picker.

## 3. Reading UI state

- **Inside the app:** `acts.contextOf(surface)` returns the live page API (`dispatcher.ts:130`). For a record that is `doc`, `isDirty`, `meta`, `perms`; for a list, `rows`, `selection`, `filters`, `view`. `shell.record()` (`shellActs.ts:181-190`) is the nearest thing to a snapshot.
- **Missing:** no getter for field errors (`recordPage/types.ts:301-302`). Confirm and danger dialogs are frappe-ui's own and are not on the readable stack (`shell/dialogs/pageDialogs.ts:1-2`). No route or page summary.
- **From outside:** none of this is reachable. Reading the router through `#app.__vue_app__` should work (Vue sets that property) but is inferred and unsupported.
- **Accessibility:** `aria-label` appears 224 times across 114 of about 360 `.vue` files, `role=` 104 times, and only 2 `data-testid`. `data-fieldname` is on form and grid cells (`ui/src/components/FormLayout/FormLayoutField.vue:5`, `Grid/Grid.vue:142`). Usable, but uneven.

## 4. Safety

- **Permissions:** the dispatcher checks `right` before every run (`dispatcher.ts:214-221`). The editor scope passes everything (`editorActs.ts:62`) and relies on the server.
- **Confirmations:** delete (`builtinActions.ts:148-153`), submit/cancel (`docstatusActs.ts:72-96`) and DocType delete always ask. They are awaited modals, so a headless `run` hangs until a person answers.
- **Danger acts with a value skip the dialog:** change kind, rename and move run with no confirmation when a value is passed (`dangerActs.ts:50`, `:135-137`). `delete_doctype` ignores its value and always asks (`:121-128`). An agent could rename or move a DocType with no confirm.
- **Undo** exists only in the DocType editor (`editorActs.ts:170-190`).

## 5. Scores (1–5)

| Dimension | Score | Why |
|---|---|---|
| Discoverability | 3 | You can list what is available now, but there are no descriptions and no parameter schemas. |
| Invocability | 2 | Run by name with a value works, but only from inside the bundle. |
| Coverage | 3 | The editor is about 90%; record and list pages are about 35–50%. |
| State readability | 2 | The page APIs are rich but internal; no snapshot, dialog or error state. |
| Feedback/errors | 3 | `ActDenied` is typed, but return values are uneven and `perform` errors only toast. |
| Safety | 3 | Rights checks and confirmations exist, but confirms block headless callers and danger acts with a value skip them. |

## 6. Gap list, in order

1. **Publish `window.desk.acts`** with `list()` and `run(id, args)`, behind a site setting. Size S. Builds on `available()`, `run()` and `ActDenied`.
2. **Acts get `description` and a JSON-schema `params`,** validated in the dispatcher, and `describe()` keeps `when`. Size M. Builds on `ActFields` and the editor's flat-edit keys.
3. **A page state snapshot,** `desk.state()`: route, page kind, doctype/name, doc, dirty flag, selection, filters, open dialogs, field errors. Size M. Builds on `contextOf`, `shell.record()` and the `FieldErrors` class.
4. **Dialogs become answerable:** confirm and danger go on the page dialog stack with ids, plus `desk.dialogs.answer(id, value)`. A `confirm:"agent"` policy would decide whether an agent may pre-confirm. Size M.
5. **Fill the coverage gaps with acts:**
   - Record: `record.set_value`, `add_row`, `post_comment`, `attach_url`, `open_tab`. Size M. Builds on `page.doc`, `rows()`, the composer, `tabs.activate`.
   - List: `set_filters`, `set_sort`, `select(names)`, `columns`. Size M. Builds on the `filters`/`sort` setters and the table's `toggle`.
   - Navigation: `search`, `back`. Size S.
6. **Uniform results:** every act resolves `{ok, data, error}`. Size S–M.
7. **A danger policy:** a value never skips the confirm unless a pre-confirmation is passed. Size S. Builds on `dangerActs.answer`.
8. **An MCP bridge to the live tab:** a browser extension, or a socket relay through the existing realtime layer, exposing `tools/list` from item 2. Size L. Builds on `frappe/mcp` and the socket.
9. **Accessibility pass:** `data-act` on every act-backed control, labels on icon buttons, test ids. Size M.
10. **Undo for record edits, or a dry-run mode.** Size L.

**Planning notes:** the DocType editor is already near-complete for agents through the server edit vocabulary in `save.py`. Data-only tasks are better routed to the existing `/api/v2/mcp` than through the UI.
