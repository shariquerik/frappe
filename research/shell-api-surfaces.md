# The shell API: what each desk v2 script surface reaches, and what apps need

Ticket [frappe/frappe#46418](https://github.com/frappe/frappe/issues/46418), map [#46417](https://github.com/frappe/frappe/issues/46417). Researched 2026-11-04.
Commits read: frappe `desk-v2` @ `1a70c5ea7c`, crm `desk-v2` @ `efb449f09`, erpnext @ `3c1fbcd174`. HRMS is not on this bench. Helpdesk has no desk v2 port: no `desk-v2` branch on `frappe/helpdesk`, and no open PR names desk v2.

Paths without a prefix are in frappe `frontend/src/`. `ui/` is frappe's `ui/src/`. `crm:` paths are under `apps/crm/crm/`, and `crm v1:` paths are under `apps/crm/frontend/src/`. This file reports facts. It proposes no verbs: the grilling that follows does that.

## Contents

- [1. Inventory of the surfaces](#1-inventory-of-the-surfaces)
- [2. Needs per app](#2-needs-per-app)
- [3. Desk v1 for comparison](#3-desk-v1-for-comparison)
- [4. The gap table](#4-the-gap-table)
- [Corrections to the map's charter notes](#corrections-to-the-maps-charter-notes)

## 1. Inventory of the surfaces

"Arg" means the script reaches the member through the object it receives. "Import" means it reaches the member only by importing a module.

### What a script can import

- `@shell` is a vite alias to `public.ts` (`frontend/vite.config.js:50`). It exports `isModular`, `routeFor`, `routeForModule`, `urlFor` (`public.ts:4-10`), `askReload` (`:12`), `createPageEngine`, `FIRST_PAINT_LIMIT_MS`, `Surface` (`:13`) and types. **It exports no toast, call, create, dialog or acts.**
- An app's bundled files can import `@shell`, `frappe/i18n` and the packages in their own `package.json` (`frontend/plugin/oneTree.js:33-56`): `vue`, `vue-router`, `frappe-ui`, and the `@framework/ui` export keys (`ui/package.json:7-115`), which include `runMethod`, `listDocuments`, `getMeta` and `getSocketInstance`.
- `@/` is the private alias (`vite.config.js:47`). `public.ts:1` says apps must not import it. No build check stops them.
- A stored Client Script imports only the import map (`frappe/hooks.py:21-27`): `vue`, `vue-router`, `frappe-ui`, `@framework/ui` (root barrel only) and `frappe/i18n`, plus the names an app publishes (`frappe/shell/manifest.py:238-268`). **`@shell` is not in the map**, so a Client Script cannot import `routeFor`.
- No component can `inject` a shell. The provide keys in `main.ts` are `boot` (`:100`), `SessionKey` (`:101`), `UploadLimitsKey` (`:103`), `TemplateNamesKey` (`:107`), `CreateRecordKey` (`:108`, `{open: openCreate, useRight}`), `RecordLinkKey` (`:109`, `{href, open}`, which pushes the route, `router/recordLink.ts:6-17`), `FieldActionsKey` (`:110`) and `addresses` (`:111`). No key carries toast, call or dialog.

### Summary matrix

| Member | act `run` (`shell`) | `shell.js` setup | standing window | record script (`page`) | `list.js` / list acts | replacement page | view renderer | field control | stored Client Script | settings pane |
|---|---|---|---|---|---|---|---|---|---|---|
| router | arg | — | arg (`shell` prop) | arg `page.router` | — | import `useRouter` | import | import | arg (`page.router`) | import |
| toast | arg (success, error) | — | arg | arg (success, error) | — | import | import | import | arg | import (frappe-ui) |
| call (REST v2) | arg | import `runMethod` | arg | arg `page.call`, `page.cached` | — | import | import | import | arg | import |
| run(act) | arg | — | arg | arg `page.run` | row action names an act | import (`acts`, private) | `host.acts` registers only | — | arg | — |
| create | arg | — | arg | arg `page.create` | via act `shell.create` | import | `host.onCreate` | inject `CreateRecordKey` | arg | — |
| dialog confirm/danger | arg | — | arg | arg | — | import | import | import | arg | import (frappe-ui) |
| dialog open(component) / form | — | — | — | arg `page.dialog.open/form` | — | — | — | — | arg | — |
| open a record or list | `router.push(routeFor())` | — | `router.push(routeFor())` | `page.router.push(routeFor())` | row is a link only | import | import | inject `RecordLinkKey` | `page.router` (no `routeFor`) | import |
| record() / current page | arg `record()` | — | arg `record()` | the page itself | — | props `doctype`, `name` | props `view` | inject `DocKey` | the page itself | — |
| openSettings | arg | — | arg | arg `page.openSettings` | via act | — | — | — | arg | — |
| afterSave / window | — | arg | — | — | — | — | — | — | — | — |
| socket | import | import | import | import | — | import | import | import | — | import |

### Act `run`: `shell`

`Shell` at `shell/shellActs.ts:30-40`, built in `shellFor` (`:126-138`):
- `router` (`:31`), `toast.success/error` (`:32`, frappe-ui `toast` wrapped), `call(method, params)` (`:33`, `runMethod` → `envelope.data`), `run(name, value)` (`:34`, `acts.run`), `create(doctype, options)` (`:35`, `openCreate`, `shell/create.ts:42`), `openSettings` (`:36`), `dialog` (`:37`), `record()` (`:39`, reads `acts.contextOf("header")`, `:153-162`). All arg.
- `shell.dialog` is `confirm` and `danger` only (`shell/dialog.ts:10-14`, built over `narrowedDialog`, `:26-29`).
- The shell's own acts: `all_apps`, `customize_sidebar`, `copy_link`, `toggle_sidebar` (rail), `open_settings`, `my_settings`, `theme`, `desk_v1`, `log_out`, `create` (`shellActs.ts:164-290`). An app's `acts.js` items join as `shell.<app>.<item>` (`shell/appActs.ts:1-2`). **There is no open-record or open-list act.**

### An app's `shell.js` setup

`setup(shell)` gets `ShellHookApi` (`shell/shellHooks.ts:11-16`, frozen at `:68-74`): `afterSave(doctype, handler)` and `window(component, options)`. Nothing else. A setup reaches the server only by importing `runMethod`, and a reload prompt only by importing `askReload` from `@shell`.

### A standing window's component

- It receives the `window` handle (`shell/standingWindows.ts:23-40`: `state`, `open`, `minimise`, `close`, `setTitle`, `setActions`, `setClosable`, `setKeepAlive`, `setAttention`) **and the full `Shell` as its `shell` prop** (`shell/AppShell.vue:61`, `shell/StandingWindows.vue:13`, typed at `:24`). Both arg.
- So a window has `create`, `toast`, `call`, `run`, `router` and `record()` today. It has no `dialog.open` and no socket.

### A record script: `page`

- The engine's base `page` (`pageEngine/createPageEngine.ts:157-183`, types `pageEngine/types.ts:244-263`): `doctype`, `meta`, `perms`, `roles`, `frame`, `header`, `body`, `refresh`, `toast.success/error` (`:172`), `dialog` (`:176`), `call` (`:177`), `cached`, `router` (`:182`).
- `page.dialog` has `open(component)`, `form`, `confirm` and `danger`, on the page's own stack (`pageEngine/dialog.ts:1-2`).
- The record page adds the lists `quickActions`, `tabs`, `panelSections`, `fields`, `form`, `activity`, `files`, `composer` (`recordPage/createRecordPage.ts:344`) and the members `app`, `docname`, `doc`, `saved`, `fieldAccess`, `isDirty`, `isNew`, `rows`, `save`, `rename`, `reload`, `create` (runs the `shell.create` act, `:413-417`), `openSettings` (`:418`) and **`run(name, value)` → `acts.run`** (`:419-420`, since f185b9468d). All arg.
- `page` has no verb that opens a record or a list.

### A list: `list.js` and list acts

- `list.js` is data, not handlers (`contributions/types.ts:20-26`, registered at `contributions/registry.ts:144-148`).
  - `columns: {fieldname, width}[]`, read at `list/defaults.ts:146`.
  - `rowActions: {act, label, icon, value(row), when(row), fields}` (`contributions/types.ts:11-20`). `value` and `when` get only the row, which holds only the named `fields` (`list/useListView.ts:80`).
  - Other keys are typed open (`types.ts:25`). Nothing reads them, and there is no row-open key.
- A row action only names an act: `acts.perform(action.act, action.value?.(row))` (`pages/list/rowActions.ts:25-26`). `list.*` acts are refused (`list/defaults.ts:142`), so a row action reaches `shell.*` acts and what their `shell` gives. It cannot refresh the list.
- The list surface's act context is `undefined` (`pages/list/listActs.ts:59`). The built-in list acts are create, favourite, open_view, set_default_view, clear_default_view and customize_quick_filter (`listActs.ts:83-145`). No selection, no refresh.
- A row is a link to the record page (`list/useListView.ts:200`, `rowLink: routeFor(doctype, name)`).
- There is no list `page`. `registry.ts:25`: the record-page engine has no registrar for lists.

### A replacement page

- Declared in `pages.json` beside `pages/<name>.js` (`contributions/types.ts:47-59`, registered at `registry.ts:224-230`, chosen at `:51`).
- A record replacement gets the props `doctype`, `name` (`router/mainPage.ts:26`, `pages/MainPage.vue:10`). A list replacement gets `doctype` and `view` (`pages/list/ViewPage.vue:9-10`). A standalone page (`<module>/frontend/pages/<slug>.js`) gets no props, only the route meta `title` (`router/contributed.ts:16-21`).
- To get a `page`, the component imports `createPageEngine` from `@shell` and builds one (`pageEngine/createPageEngine.ts:28-49,120`), which runs its handler file and the App Page Client Scripts (`registry.ts:233-236`, `recordPage/appPageScripts.ts:34`). That `page` has the engine members only.
- `frontend/CLAUDE.md` says these handler files are "ignored for now", but `registry.ts:233-236` registers them. One of the two is stale.

### A view type's renderer

- `<module>/view_type/<x>/frontend/view.js` exports `{renderer}` (`contributions/types.ts:92-99`, `registry.ts:197-221`, loaded at `pages/list/renderer.ts:38-48`).
- Props `view` and `host` (`pages/list/ListPage.vue:52`). `view` is the view's state and setters (`list/view.ts:10-34`). `host` is `controls` (a teleport target), `acts(entries)` (registers `<type>.<act>`, context `undefined`) and `onCreate(cb)` (`renderer.ts:11-18`, built at `ListPage.vue:134-138`).
- No toast, router, call or row refresh: import only.

### A field control

- Apps have no contribution path. The one way is the global `registerFieldType(fieldtype, component)` (`ui/components/Fields/fieldTypes.ts:44`), imported from `@framework/ui`, at module load.
- A record script can also place a component through `page.fields` and pass props, which is how CRM hands a control its `page` (section 2).
- Props `field`, `modelValue`, `row?`, `error?`; emits `update:modelValue`, `change` (`ui/components/Fields/types.ts:98-116`). Injects `DocKey`, `ParentDocKey`, `UpdateKey`, `LinkTitlesKey`, `LinkMarksKey`, `CreateRecordKey` (`:149`), `RecordLinkKey` (`:158`), `FieldActionsKey` (`:181`), `FieldErrorsKey`, `CommitKey`, `CodeErrorsKey`.

### A stored Client Script

- Desk v2 runs only rows with `view` `Record` or `App Page`. `List` and `Form` rows are v1 (`frappe/custom/doctype/client_script/client_script.json:70`, `recordPage/clientScripts.ts:162`).
- Fetched at `clientScripts.ts:160-175`, evaluated as a blob module (`recordPage/evaluateClientScript.ts:6-20`). Each handler gets `page`, as a file script does. There is no stored list script.

### A settings pane (not in the ticket's list; CRM ships seven)

- A pane component gets `bindings` only (`crm: fcrm/frontend/settings/invite.vue:35`, `pages/settings/SettingsBlocks.vue:29`). It reaches toast, call and dialogs only by import.

## 2. Needs per app

### CRM desk v2

Each row: the need, where it is, what it does today, and the verb or member that would remove it. "Exists" means a member that works today already removes it.

**Opening a record or a list (7 places)**

| Need | Where | Today | Removed by |
|---|---|---|---|
| Open the Form Script list | `crm: fcrm/frontend/acts.js:25` (act) | `shell.router.push(routeFor('CRM Form Script'))` | an open verb or act |
| Open the caller's Lead or Deal | `crm: fcrm/frontend/telephony/CallWindow.vue:257-261` (window) | `props.shell.router.push(routeFor(doctype, name))` | an open verb or act |
| Open the new Deal after Convert | `crm: fcrm/frontend/convert/index.js:41` (record script) | `page.router.push(routeFor('CRM Deal', deal))` | an open verb on `page` |
| Link to Failed Syncs, filtered by source | `crm: fcrm/frontend/lead_sync/leadSync.js:45-47` (header item) | `page.router.resolve(routeFor(..., {query}))` for an `href`; `routeFor` is passed in as an argument by `lead_syncing/doctype/lead_sync_source/frontend/record.js:1,6` | a href for a list with filters |
| Open a contact from the Deal section | `crm: fcrm/frontend/contacts/DealContacts.vue:36` | `:route="routeFor('Contact', row.contact)"` | an href verb; it must honour #46406 |
| Open a linked row in a record tab | `crm: fcrm/frontend/linked/LinkedList.vue:19` | `ListRow :route="routeFor(...)"` | same |
| Open ERPNext in a new tab | `crm: fcrm/frontend/erpnext/quotation.js:25,47` | `window.open(url, '_blank')` | none needed: an external URL |

**Telephony: the call window, its acts and the record section**

- *Server calls from setup.* `crm: fcrm/frontend/telephony/callApi.js:2-5` imports `runMethod` from `@framework/ui/api`: setup has no `call`. The window uses the same module, though `props.shell.call` exists. Removed by: `call` on the setup's shell.
- *Socket events.* `CallWindow.vue:71,93` imports `getSocketInstance()` from `@framework/ui/socket`. No surface carries a socket. Removed by: a socket member, if the grilling wants one.
- *State shared by setup, act, window and record section.* `telephony/callState.js:6` is a module-scope `reactive({media, defaultMedium, liveExotel})`. Setup writes it (`attachCallWindow.js:8-12`), the act's `when` reads it (`makeCall.js:11`), and so do the window (`CallWindow.vue:84,90,133,323-326`) and the record section (`contacts/dealContacts.js:26`). Removed by: nothing on the map yet; the window handle has no state channel.
- *The act reaches the window.* `callState.js:7-27` keeps a module `let starter`. The window registers it (`registerOutgoingStarter`, `CallWindow.vue:161`), and the act's run (`makeCall.js:78-81`) calls `startOutgoingCall`, which throws "still loading" before the window mounts. Removed by: an act that the window itself registers, or a window handle verb.
- *The record section starts a call.* `contacts/dealContacts.js:30-35` imports `startOutgoingCall`. **Exists:** `page.run('shell.crm.make_a_call', number)` reaches the same run today (`createRecordPage.ts:419`, `makeCall.js:78`).
- *Create a Note or Task during a call.* `CallWindow.vue:233-255` calls `props.shell.create(doctype, {values})`, then `callApi.link(callSid, ...)`. This works today.
- *Open the Call Log.* The window never opens it. `log_a_call` (`acts.js:15`) only runs `shell.create('CRM Call Log')`. CRM v1 opens a Call Log detail dialog (below). Removed by: `shell.dialog.open(component)`, or the #46406 opt-in plus an open verb.
- *The current record.* The window finds the record by phone number (`contactRecord.js:4-21`), not `shell.record()`. The act reads `shell.record?.()` for its number options (`makeCall.js:63`).

**Direct `@shell` imports.** `askReload` in `crm: fcrm/frontend/shell.js:2` (setup); `routeFor` in `acts.js:2`, `CallWindow.vue:72`, `convert/index.js:3`, `contacts/DealContacts.vue:78`, `linked/LinkedList.vue:40`, `lead_syncing/doctype/lead_sync_source/frontend/record.js:1`, and `fcrm/custom/note/pages/notes_proof.vue:16`.

**`@framework/ui` data calls instead of `page.call` / `shell.call`**
- Helpers called without `page`: `listDocuments` (`status/index.js:27`, `forecasting/index.js:19`, `sla/slaPolicy.js:41`), `getMeta` (`convert/index.js:28`, `lead_sync/leadSync.js:69`), `getDocumentFields` (`form_script/standardScript.js:6`), `useDoctypeMeta` plus a hand-written `settled()` watch (`conditions/index.js:40-55`).
- `runDocumentMethod` where `page` is present: `lead_sync/leadSync.js:53,88`.
- A doc method on an unsaved doc: `sla/holidayList.js:27-35` sends `run_doc_method` with `__islocal`.

**Settings panes (7 panes, `bindings` only)**
- `runMethod`, `runDocumentMethod`, `getDocument`, `listDocuments`, `updateDocument`, `deleteDocument`, `createDocument` imports: `settings/telephony.vue:50,76`, `email-accounts.vue:40,57`, `users.vue:93,122,145,164`, `users/AddUsersDialog.vue:33,56`, `productSync.vue:86,147,160`, `verifyConnection.vue:50,94`, `sales-hierarchy.vue:99-105,144,161,215`, `sales-hierarchy/AddToHierarchyDialog.vue:37,71`, `sales-hierarchy/MoveDialog.vue:25,51`.
- frappe-ui `toast`: `invite.vue:57-63` (uses `toast.info`, which `shell.toast` lacks), `productSync.vue:161,163`, `users.vue:150,152,169`, `sales-hierarchy.vue:218,220`, the three dialogs above.
- Hand-built frappe-ui `<Dialog>` forms: `users/AddUsersDialog.vue:3`, `sales-hierarchy/AddToHierarchyDialog.vue:3`, `sales-hierarchy/MoveDialog.vue:3`.
- `dialog.confirm({theme: "red"})` where the shell has `danger`: `users.vue:158`, `sales-hierarchy.vue:201`.

**Props passed down and module state on the record page**
- `page` handed to field controls by props: `conditions/conditions.js:72` (`ConditionsField`), `contact/contactReach.js:21` (`ReachPicker`). A control gets no `page` from the host.
- One `ContactsEditor` holding `page` shared by a section and its header by `props: {editor}` (`contacts/index.js:9-20`), used for `page.create`, toast and composer in `DealContacts.vue` and `DealContactsAdd.vue`.
- A module `WeakMap` of editors per page (`contact/contactReach.js:26`), because the picker unmounts on each close.
- A builder dialog in a field control: `conditions/ConditionsField.vue:20`, frappe-ui `<Dialog size="3xl">`.

### CRM v1: behaviour still to port

- **`useDoctypeModal`** (`crm v1: composables/doctypeModal.js:29`): one module-scope modal, mounted once (`App.vue:9`, `components/Modals/DoctypeModals.vue`). `showModal({doctype, name?, defaults, callbacks})` creates, or edits when `name` is given. 22 calls in 15 files: FCRM Note 6, CRM Task 6, CRM Call Log 4, Address 6. Samples: `pages/Notes.vue:155` (edit), `components/Activities/AllModals.vue:115` (create a Call Log linked to the doc), `components/Telephony/TwilioCallUI.vue:233` (from the call UI). This is the [#46406](https://github.com/frappe/frappe/issues/46406) feature.
- **`CallLogDetailModal.vue`**: a read-only detail dialog. It opens from the Call Logs list row (`components/ListViews/CallLogsListView.vue:6` → `pages/CallLogs.vue:120`), after a new Call Log is saved (`CallLogs.vue:151`), and from the activity feed's call card (`components/Activities/CallArea.vue:25,91`). In it: add a Note or Task (`:211`, `:223`, then `add_note_to_call_log`/`add_task_to_call_log`), edit the Call Log (`:375`), open the Lead or Deal (`:293-301`, `router.push`), create a Lead from the call (`:352`, `create_lead_from_call_log`, then `router.push`).
- **`globalStore`** (`crm v1: stores/global.js`), 36 files: `$dialog` (26 files, 23 calls, e.g. `pages/Calendar.vue:407`), `$socket` (16 files, 21 `on`/`off`, e.g. `pages/Deal.vue:512`), `makeCall` (8 calls, e.g. `pages/Lead.vue:138`), `setMakeCall` (1, `components/Telephony/CallUI.vue:129`). `callState.js` is the desk v2 port of `makeCall`/`setMakeCall`.
- **What v1 form scripts received**: `data/script.js:68-79` injects `createDialog`, `toast`, `socket`, `router`, `call`, `formDialog`, `throwError`. The older `setupCustomizations` (`utils/index.js:369`) passes `$dialog`, `$socket`, `router`, `toast`, `createToast`, `updateField`, `deleteDoc`, `call`.
- **Other counts**: `toast.` 199 hits in 67 files; `router.push`/`replace` 50 calls (top targets Deal 9, Leads 5, Lead 5, Organization 4, Contact 3); `showQuickEntryModal` 18 hits in 9 files (module ref, `composables/modals.js:3`); `capture(` 87 hits in 44 files.

### frappe's own desk v2 code

- **Hand-built routes.** About 17 `routeFor` callers, 3 `routeForNew`, 5 `urlFor`, 1 `hrefForNew`, and 19 `router.push`/`replace` calls.
  - Opens a record: `pages/list/ListPage.vue:107` (the toast's Open after create), `pages/Record.vue:963,1049`, `pages/record/UnsavedRecord.vue:343`, `pages/record/renameAct.ts:38`, `pages/record/amendAct.ts:34`, `router/recordLink.ts:11,16`, `list/useListView.ts:200`, `pages/record/panel/RecordImage.vue:155`, `pages/record/RecordHeader.vue:211`, and the palette: `shell/paletteRecords.ts:120`, `shell/paletteScope.ts:27`, `shell/recentVisits.ts:97`, `shell/palettePlaces.ts:128`.
  - Opens a list: `ListPage.vue:88,126`, `pages/record/builtinActions.ts:141-144`, `Record.vue:434`, `UnsavedRecord.vue:309`, `shell/paletteRecords.ts:92,150`, `shell/PageState.vue:33`, `shell/palettePlaces.ts:171`.
  - Opens a new record by route: `builtinActions.ts:124` (duplicate), `amendAct.ts:34` (amend), `pages/create/CreateDialog.vue:202` (full page), `shell/palettePlaces.ts:78-81`.
- **Direct imports instead of received verbs.** frappe-ui `toast` in 28 files (57 calls); `runMethod` in 29 files; `openCreate` imported in `pages/list/ListPage.vue:68`; frappe-ui `dialog` in `pages/settings/SettingsBlocks.vue:66` (`dialog.confirm` at `:155`); `useRouter()` in 11 files.
- **Module-scope singletons that join surfaces.** `shell/create.ts:25-27` (the Create stack), `shell/palette.ts:40,43,56` (`paletteOpen`, `paletteArgument`, `pageRowSources`), `shell/pageMenu.ts:6`, `shell/composer.ts:33-44` (18 importers), `acts/dispatcher.ts:222` (`acts`; `shell.record()` reads the record page through `acts.contextOf("header")`).
- **The palette.** Its context is `{boot, router, addresses}` (`shell/ShellPalette.vue:137-141`). Its rows navigate or run `shell.create` / `shell.open_settings` (`palettePlaces.ts:215,228`). It cannot mount a component. Settings, Customize sidebar and Logout are hard-wired into `AppShell.vue:48-57` and opened by hash or ref.
- **Comments that name the seam.** `shell/emailFieldAction.ts:9` (the app hands the email writer in); `shell/paletteFlow.ts:1-2,17` (the palette sends a `flow:ask` window event because it imports nothing from Flow).
- **The Call Log list.** Desk v2 has no Call Log list page of its own, and CRM ships no `crm_call_log/frontend/list.js`. A row opens the record page.

### Helpdesk

No desk v2 port yet (see the header). No needs to report.

## 3. Desk v1 for comparison

Occurrences of each global in `.js` files, excluding `node_modules`, built assets and desk v2 `frontend/` dirs. ERPNext has 681 `.js` files; CRM has 48 desk v1 `.js` files. Input only.

| Global | ERPNext (files) | CRM v1 desk scripts |
|---|---|---|
| `frappe.call(` | 459 (156) | 1 |
| `frm.call(` | 132 | 7 |
| `frappe.xcall(` | 13 | 0 |
| `frappe.model.*(` | 715 | 14 |
| ↳ `set_value` / `sync` / `open_mapped_doc` / `can_create` | 396 / 79 / 79 / 48 | |
| `cur_frm` | 224 (57) | 0 |
| `cur_list` | 2 | 0 |
| `frappe.set_route(` | 207 (103) | 2 |
| `frappe.route_options` | 77 | 0 |
| `frappe.new_doc(` | 17 (16) | 1 |
| `frappe.ui.form.make_quick_entry` | 4 | 0 |
| `frappe.msgprint(` | 162 | 3 |
| `frappe.ui.Dialog` | 111 (73) | 2 |
| `frappe.show_alert(` | 84 (46) | 8 |
| `frappe.confirm(` | 38 | 1 |
| `frappe.prompt(` | 34 | 0 |
| `frappe.db.get_value/get_list/...(` | 80 | 0 |
| `frappe.realtime.on(` | 17 | 1 |
| `frappe.utils.play_sound/copy_to_clipboard` | 21 | 0 |
| `window.open(` / `frappe.open_in_new_tab` | 8 | 0 |

Read: routing (`set_route` plus `route_options`, 284) and a custom dialog (`ui.Dialog` plus `prompt`, 145) are ERPNext's most used reach-anywhere verbs after server calls and model writes. CRM's own v1 desk scripts barely use any; CRM v1's real reach-anywhere needs are in its SPA (section 2).

## 4. The gap table

Each gap has a named consumer. "Home" is the existing surface it belongs on, by the map's ruling 2. "Act covers?" says whether an act already reaches it.

| # | Gap | First consumer | Home surface | Act covers? |
|---|---|---|---|---|
| 1 | Show a component in a dialog from outside a page | CRM settings panes' three form dialogs; the Call Log detail dialog (CRM v1 `CallLogDetailModal.vue`) from the call window; the palette | `shell.dialog` (has `confirm`/`danger`, `shell/dialog.ts:10`); `page.dialog.open` already exists | No |
| 2 | Open a record, a list (with filters) or a new record by name, honouring the #46406 opt-in | CRM `CallWindow.vue:258`, `acts.js:25`, `convert/index.js:41`, `leadSync.js:45`; frappe's ~17 `routeFor` callers | `shell` and `page` (a `page` verb can be `page.run` over an act) | No: no open act. `shell.create` covers only a new record in Create |
| 2a | An href for the same (a link, not a push) | CRM `DealContacts.vue:36`, `LinkedList.vue:19`; frappe `useListView.ts:200` | `RecordLinkKey` has `href` already (`router/recordLink.ts`) for fields only | No |
| 3 | `shell` inside `shell.js` setup | CRM `callApi.js` (`runMethod`), `shell.js:2` (`askReload`) | `setup(shell)`: `ShellHookApi` | No. A standing window already has the full `shell` |
| 4 | A list-page script surface: row open, refresh, selection | The Call Log list (row opens the detail dialog, CRM v1 `CallLogs.vue:120`) | `list.js` (`ListHandlers`, open keys today) | No: list acts' context is `undefined` |
| 5 | Settings panes reach `shell` | CRM's 7 panes (toast, calls, dialogs, `confirm` red) | the pane component (gets only `bindings`) | No |
| 6 | The act reaches its app's standing window; state shared by setup, act and window | CRM `callState.js:6-27` (`makeCall.js:78`, `CallWindow.vue:161`) | the window handle (`standingWindows.ts:23`) or an act the window registers | Partly: from a record, `page.run('shell.crm.make_a_call')` works today |
| 7 | A component placed by a record script reaches `page` | CRM `conditions.js:72`, `contactReach.js:21`, `contacts/index.js:9-20` | `page` (by inject, not props) | No |
| 8 | Realtime events | CRM `CallWindow.vue:71,93` (`getSocketInstance`); CRM v1 `$socket` (16 files) | `shell` | No |
| 9 | `toast.info` (and frappe-ui's other kinds) | CRM `invite.vue:57` | `shell.toast`, `page.toast` | No |
| 10 | A stored Client Script can build a route | none found | import map (`frappe/hooks.py:21`) | n/a. Gap 2 on `page` would remove the need |

Gaps with no consumer found (listed so the grilling can drop them): a view renderer's `host` has no toast, router or call (`pages/list/renderer.ts:11-18`); a replacement page gets no `page` unless it builds one.

### Top workarounds

1. **Hand-pushed routes**: 7 in CRM, about 17 `routeFor` callers in frappe. Every one would bypass a record-in-a-dialog opt-in.
2. **`callState.js` module singletons** join CRM's setup, act, window and record section; the act fails "still loading" before the window mounts.
3. **Settings panes import frappe-ui `toast`, `<Dialog>` and `@framework/ui` data calls** in all 7 CRM panes, because a pane gets only `bindings`.
4. **`page` passed down by props** to field controls and shared editors, plus a module `WeakMap` to keep editor state across unmounts.
5. **`runMethod` imported where `shell.call` or `page.call` exists** (`callApi.js` in the window, `leadSync.js:53,88`): existing members, not gaps.

## Corrections to the map's charter notes

- **Gap 3 is half closed.** A standing window's component already receives the full `Shell` as its `shell` prop (`shell/StandingWindows.vue:13`, `AppShell.vue:61`, file last changed in 6d0fcac100). Only `shell.js` setup lacks it.
- **`page.run` exists** (`recordPage/createRecordPage.ts:419`, f185b9468d). A record script reaches any act by name today. `crm: contacts/dealContacts.js:30-35` imports `startOutgoingCall` though `page.run('shell.crm.make_a_call', number)` would do.
- **`list.js` has no handlers**: `columns` and `rowActions` are data. A row action only names a `shell.*` act; it gets no list context.
- **Settings panes are a script surface** with the fewest members (`bindings` only), and CRM's heaviest workaround site.
