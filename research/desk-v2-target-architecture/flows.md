# Five desk v2 flows, step by step

Read at frappe `desk-v2` commit `6352fefbdf` (detached worktree `wt-arch`). Paths are relative to the repo root.

Layers (draft list): 1 Framework server, 2 Desk server (`frappe/shell`), 3 ui data (`ui/src/api`, cache, socket, session, composables), 4 ui components, 5 Desk services (`frontend/src` root modules, icons, `routeFor`), 6 Registry (contributions), 7 Shell (shell, navigation, router), 8 Page engines (`recordPage`, `list`), 9 Pages, 10 Customization (scripts).

Placement choices made for this write-up:

- `frontend/src/main.ts` is a root module, so it sits in layer 5. It is the entry point, so most of its calls go up. If it were treated as the top of the stack, those would not count as up-calls.
- `recordPage/clientScripts.ts` and `recordPage/evaluateClientScript.ts` are counted as layer 10 (Customization), although they live in the engine folder. If they count as layer 8, the engine's calls into them are sideways, not up.
- "Up" means a static import or direct call from a lower layer into a higher one. A lower layer running a function a higher layer handed it (a registered handler or a host callback) is written "callback" and listed apart. It is not in the up-call count.
- Browser storage (localStorage, sessionStorage, the HTTP cache) is per origin. A Frappe site is served on its own host name, so the origin stands for the site. None of these keys carry the site name.
- No IndexedDB is used anywhere in `frontend/src` or `ui/src`.

---

## Flow 1. Boot: open `/apps/<prefix>` to the painted shell

| # | What happens | Layer | Permission check | Cache | Server request | Up-call |
|---|---|---|---|---|---|---|
| 1 | The website router tries the shell renderer before static pages. The renderer maps the prefix to an app and returns the built `index.html` with no caching. | 1 → 2 | The user may open this app: `has_app_permission` via `guard_prefix`, `frappe/shell/permissions.py:37-47`, called at `frappe/website/page_renderers/shell_page.py:62`. **Server.** It says itself it is a courtesy gate; doctype permissions are the real boundary. | Server process memory `_document_cache` (`shell_page.py:17`), key = file path of `index.html`. It is the same file for every site. Prefix to app map in `frappe.client_cache` (Redis plus local copy, site-prefixed key `CACHE_KEY`, `frappe/shell/registry.py:47`). The page itself is marked `no_cache` (`shell_page.py:59`). | `GET /apps/<prefix>/...` (HTML) | **Up 1 → 2**: `shell_page.py` (framework website code) imports `frappe.shell.permissions` and `frappe.shell.registry`. |
| 2 | An inline script in the HTML sets light or dark theme before paint. | 5 | None | localStorage `theme`. No user in the key. | None | |
| 3 | `main.ts` asks for boot and waits. On 401 or 403 it mounts the "Not permitted" page. | 5 → 3 | None in the browser; it only reacts to the server's 401/403 (`frontend/src/boot.ts:103`). | None (no `Cache-Control` set) | `GET /api/v2/method/frappe.shell.boot.get_boot?path=...` | |
| 4 | The server builds boot: core keys, session, metadata version, prefix map, and the rail and sidebars filtered for this user, with site and user layers merged. | 2 (+1) | App gate again, `frappe/shell/boot.py:155` (index: `:76`, and each app tile `:83`). Rail and sidebar items filtered by the user's readable doctypes, modules and pages, `frappe/shell/navigation_filter.py:23`, `:165-224`. **Server.** | Redis: session by sid (`frappe/sessions.py`), `metadata_version` and the prefix map in `frappe.client_cache` (site-prefixed). The navigation filter caches nothing across requests (`navigation_filter.py:148`, `:221`). | Same request | |
| 5 | `main.ts` fires translations and the icon sprite without waiting, and hands the record page its icon source and drawn props. | 5 | None | HTTP cache, private, 1 year, for translations (`frappe/translate.py:138-139`); key = URL with `lang` and `translations_version`. Sprite is a static asset. Messages kept in browser memory (`frontend/src/i18n.ts:10`). | `GET` translations; `GET /assets/frappe/icons/lucide/icons.svg` | **Up 5 → 8** (`main.ts:16` imports `@/recordPage`), **Up 5 → 9** (`main.ts:17` imports `@/pages/record/drawnProps`) |
| 6 | `main.ts` fetches the address table (every doctype's URL slug and module) and waits for it. | 5 → 3 → 2 | The user may enter at least one app, `frappe/shell/doctypes.py:140`. **Server.** | Redis `frappe.client_cache` key `ADDRESS_CACHE_KEY`, checked against `metadata_version` (`doctypes.py:112-122`). HTTP cache, private, 1 year (`doctypes.py:130`); key = URL with `v=<metadata_version>`. | `GET /api/v2/method/frappe.shell.doctypes.get_addresses?v=...` | |
| 7 | Contributions register: navigation item kinds, page replacements (active apps only) and each app's `record.js` handlers into the record-page registry. | 6 → 8 | None | Browser memory: `itemRenderers` by item type, `replacements` by `key:doctype`, `listHandlers` by doctype (`frontend/src/contributions/registry.ts:16-26`), record handlers by doctype. | None (build-time module) | **Up 5 → 6** (`main.ts:55`), **Up 6 → 8** (`contributions/registry.ts:4` imports `registerRecordPage`) |
| 8 | The router is created from boot and the address table, and `routeFor` gets its shell slot. | 7 | None. The route guard checks the URL against the address table only (`frontend/src/router/index.ts:35-71`). | Browser memory (router, address table) | None | **Up 5 → 7** (`main.ts:58` calls `createShellRouter`), **Up 7 → 9** (`router/generated.ts:3-7` imports `MainPage.vue`, `Home.vue`, `Module.vue`) |
| 9 | The socket opens, rejoins held rooms on each connect, and two watchers start (stored-script changes, doctype changes). The session goes into the ui session store. | 7, 10, 3 | Rooms: user room, and the site room only for System Users (`realtime/handlers.js:5-10`); each document room checked by `frappe.realtime.has_permission` (`handlers.js:12-20`, `:58-61`). **Server** (realtime server). | Browser memory: session store (`ui/src/composables/useSession.ts`). | Socket.IO connect to `/<site_name>` | **Up 5 → 7** (`main.ts:66` `createSocket`, `:78` mounts `AppShell`), **Up 5 → 10** (`main.ts:67` `watchClientScripts`) |
| 10 | `AppShell` picks the open sidebar and draws the rail and sidebar. Each item is drawn by its kind's renderer, which builds its link with `routeFor`. The composer window is mounted empty. | 7 → 6 → 5 | None in the browser; the items were already filtered on the server in step 4. | sessionStorage `frappe:desk:sidebar`, key = address only (`navigation/sidebarMemory.ts:4`). localStorage `frappe:desk:sections`, user inside the value (`navigation/sectionMemory.ts:6`, `:50`). localStorage `frappe:desk:sidebar-collapsed`, no user (`shell/SidebarPanel.vue:72`). Composer keys carry the user (`shell/ComposerWindow.vue:126`, `shell/composer.ts:91`). | None | **Up 7 → 9** (`shell/ComposerWindow.vue:104-109` imports `@/pages/record/composer/*`) |
| 11 | The home page loads and asks what the app contains. | 9 → 5 → 2 | App gate `doctypes.py:199` and readable doctypes only, `doctypes.py:175`. **Server.** | None (no HTTP cache on `get_contents`) | `GET /api/v2/method/frappe.shell.doctypes.get_contents?app=...` | |

11 steps. Up-calls: 10 (1→2, 5→8, 5→9, 5→6, 6→8, 5→7 router, 7→9 routes, 5→7 socket and shell mount, 5→10, 7→9 composer). Seven of them start in `main.ts`.

**Checks only in the browser:** none. Every gate in this flow runs on the server. The router guard (step 8) checks only that the URL names a known doctype, not whether the user may read it.

---

## Flow 2. Open a list: sidebar click to rows painted

| # | What happens | Layer | Permission check | Cache | Server request | Up-call |
|---|---|---|---|---|---|---|
| 1 | The sidebar link, built by the DocType item's `item.js` through `routeFor`, is clicked and pushed to the router. | 7, 6, 5 | None | None | None | **Up 5 → 6**: `router/routeFor.ts:7` imports `replacementFor` from contributions (called only for the `standard` option) |
| 2 | The route guard checks the doctype slug against the address table and canonicalises it. The latest navigation is noted for error reporting. | 7 | None (address check, not permission) | Browser memory (address table) | None | |
| 3 | The main-page loader picks an app's replacement list page or the standard one and loads its code before the navigation confirms. | 7 | None | Browser memory `pages` map, key = loader (`router/mainPage.ts:13`) | JS chunk from `/assets` | **Up 7 → 9**: `router/standardPages.ts` imports the pages |
| 4 | `MainPage.vue` renders `List.vue` and `DoctypeList.vue` inside `PageFrame`. `AppShell` re-picks the sidebar for the new address. | 9, 7 | None | sessionStorage `frappe:desk:sidebar` (key = address) | None | |
| 5 | The list page asks for the doctype's meta. Roles come from the boot session. | 8 → 3 | Any signed-in user: `frappe.only_for("All")`, `frappe/api/v2.py:323`. **Server.** | Browser memory, key = doctype (`ui/src/composables/useDoctypeMeta.ts`, `ui/src/utils/sharedState.ts:20`). Server Redis doctype meta (framework). | `GET /api/v2/doctype/<dt>/meta?include=children` | |
| 6 | The list page loads the stored list settings (the site row and the user's own row) and resolves columns, sort and quick filters. Columns on fields the user cannot read are dropped. | 8 → 3 | Read on the doctype, and System Manager for the site scope: `frappe/desk/doctype/doctype_view/api.py:52`, `:61`. **Server.** Column drop by permlevel: `frontend/src/list/useListPage.ts:92-95` with `ui/src/composables/useDocPermissions.ts:49-55`. **Browser**, with the server behind it: the list query refuses fields the user cannot read (`frappe/database/query.py:1064-1104`). | Browser memory `entries`, key = doctype only (`list/useListSettings.ts:46`). Holds the user's own row. | `POST /api/v2/method/frappe.desk.doctype.doctype_view.api.get` | |
| 7 | The rows are read with the count on the first page. The reply goes into the shared data cache, which the list does not read back. | 8 → 3 → 1 | Doctype read and row-level rules: `frappe.qb.get_query(..., ignore_permissions=False)`, `v2.py:196-206`; field permissions in `query.py:1074`; count through `frappe/desk/reportview.py`. **Server.** | Browser memory data cache, key = doctype + query JSON (`ui/src/cache/listKey.ts:7-14`). Browser memory `rowsByDoctype`, key = doctype (`list/pageState.ts:29`). Page size and scroll in `history.state`. | `GET /api/v2/document/<dt>?fields=...&filters=...&include=count` | |
| 8 | The rows paint through the ui virtual list, and scroll is restored. Each row's link is built with `routeFor`. | 4, 8 | None | `history.state`, `rowsByDoctype` | None | (`routeFor` → contributions again, same edge as step 1) |

8 steps. Up-calls: 2 (5→6 `routeFor` imports contributions; 7→9 router loads pages).

**Checks only in the browser:** the column drop by permlevel (step 6). It has a server check behind it, so there is none without one.

---

## Flow 3. Open a record: row click to the record page painted

| # | What happens | Layer | Permission check | Cache | Server request | Up-call |
|---|---|---|---|---|---|---|
| 1 | The row link (`list/useListPage.ts:278`, via `routeFor`) goes through the same guard and main-page loader, which loads the record page code. `MainPage.vue` remounts the page per record. | 7 | None | Browser memory `pages` map | JS chunk | **Up 5 → 6** (`routeFor`), **Up 7 → 9** (loader imports `Record.vue`) |
| 2 | `load()` blanks the page, shows skeletons, recalls the last form tab and joins the record's realtime room. | 9 → 3 | Room join checked by the realtime server (`realtime/handlers.js:58-61`). **Server.** | localStorage `frappe:desk:formTab`, user inside the value (`pages/record/formTabMemory.ts:3`, `:34`) | Socket `doc_subscribe` | |
| 3 | In parallel, the page starts the stored scripts (flow 5) and fetches the two form layouts (Details and Side Panel). | 9 → 10, 8 → 3 | Layouts: read on the doctype, `frappe/desk/doctype/form_layout/form_layout.py:88`. **Server.** | Browser memory, key = `doctype:type` (`recordPage/formLayoutSource/useFormLayout.ts:120`) | `GET /api/v2/method/frappe.desk.doctype.form_layout.form_layout.get_form_layouts` ×2 | **Up 9 → 10**: `Record.vue:491` calls `loadClientScripts` |
| 4a | Return visit: if memory holds the full record, meta, layouts and feed, the page paints from memory at once, then re-reads and merges. A 403 or 404 on the re-read blanks the page. | 9 → 3 | None before the paint. The server check comes with the re-read (step 5); `Record.vue:609-613` blanks on its refusal. | Browser memory data cache, key = `doctype\0name` (`ui/src/cache/entries.ts:44`), holds the record and its `permissions` part | Background re-read, as step 5 | |
| 4b | First visit: the activity feed read starts beside the record read. | 9 → 3 | `get_lazy_doc(..., check_permission=True)`, `frappe/desk/form/activity.py:76`. **Server.** | Browser memory (activity timeline store) | `GET /api/v2/document/<dt>/<name>/activity` | |
| 5 | The record is read with its parts (permissions, assignments, shares, tags, favourites, follows, users, attachments, link titles, seen) and meta, and fed into the data cache. | 9 → 3 → 1 | `doc.check_permission("read")` and `apply_fieldlevel_read_permissions()`, `frappe/api/v2.py:114-115`. The `permissions` part is the server's answer for this user. **Server.** | Browser memory data cache, key = `doctype\0name`; meta by doctype | `GET /api/v2/document/<dt>/<name>/?include=...,seen`; meta if not in memory | |
| 6 | The page builds the record-page controller (engine), with page permissions: the rights from the `permissions` part, roles from the session, field access by permlevel. | 9 → 8 | Field access by permlevel: `recordPage/pagePermissions.ts:76-80`, `recordPage/formLayoutSource/fieldAccess.ts:12-16`. **Browser**, display only. It fails open (shows "write") until roles and meta load (`useDocPermissions.ts:47-51`). The server behind it: `validate_higher_perm_levels` on save (`frappe/model/document.py:848`) and field-level read on every read. | Browser memory: registry handlers by doctype | None | **Up 8 → 10**: `createRecordPage.ts:32` imports `clientScriptsLoaded`; `paintGate.ts:4` imports `clientScriptWait` |
| 7 | Built-in actions are offered by right: Email (`email`), Print (`print`), Tags (`write`), Attach (`write`), Delete in the menu (`delete`), share and assign rows in the panel (`share`, `write`). | 9 | `pages/record/builtinActions.ts:15-24`, `:75`; `Record.vue:697`; `panel/RecordPeople.vue:51-52`; `panel/RecordIdentity.vue:81`; `panel/RecordImage.vue:142`; `feed/FilesTab.vue:95`. **Browser**, display only. Server behind each: `frappe/api/collaboration.py:65` with `PART_RIGHT` (`:227-234`), `frappe/api/files.py:54`, delete through `frappe.client.delete_doc`, print through the print view. | None | None | |
| 8 | First paint: the page waits for both layouts, the feed and the scripts (at most 500 ms, `paintGate.ts:9`), runs the first replay of every handler, lands the paint, then waits a tick. | 9, 8 | None | None | None | Callback 8 → 10: the replay runs app and stored-script handlers |
| 9 | Header, body, tabs, form (ui `FormLayout`), panel and activity feed draw. Open sections and column choices are recalled. | 9, 4 | None beyond step 6 and 7 | localStorage `frappe:desk:sections` (user inside), `pages/record/body/columnStore.ts:40` (user inside), composer height keyed by user (`composer/useDockHeight.ts:10`) | None | |

10 rows (9 steps, step 4 has two branches). Up-calls: 5 (5→6, 7→9, 9→10, 8→10 twice). Plus one callback (8→10, the handler replay).

**Checks only in the browser:** field access by permlevel (step 6) and the right-gated actions (step 7). Each has a server check behind it. None stands alone.

Note: on a return visit (step 4a) the record paints from memory before the server re-checks read access. If access was removed since the last visit, the old copy shows until the re-read comes back and blanks it.

---

## Flow 4. Save a record: edit a field and save, to the saved state shown

| # | What happens | Layer | Permission check | Cache | Server request | Up-call |
|---|---|---|---|---|---|---|
| 1 | A field control changes. `FormLayoutField.vue` notes that a commit is owed (`:41`), and `FormLayout.vue:133` writes the value into the draft. | 4 | The control is read-only or hidden if field access said so (flow 3 step 6). **Browser**; server behind it (`document.py:848`). | None | None | |
| 2 | The page sees the draft differ from the saved copy (`Record.vue:249`, JSON compare). The commit channel drops repeats and fires field handlers. | 9, 8 | None | None | None | Callback 8 → 10: field handlers from app and stored scripts |
| 3 | Save is pressed (header button, or Ctrl+S at `Record.vue:859`). The engine flushes owed commits, runs `beforeSave`, then calls the page's save, then `afterSave` (`createRecordPage.ts:394-412`). | 9 → 8 | None. Save is offered to every reader (`Record.vue:381`); the server decides. | None | None | Callback 8 → 9 (`host.save` is the page's `write`), callback 8 → 10 (`beforeSave`, `afterSave`) |
| 4 | `write()` refuses if the route moved, sends one request at a time, and sends the whole draft with `modified` (`Record.vue:715-746`, `pages/record/recordSource.ts:33-39`, `ui/src/api/index.ts:162-179`). | 9 → 3 | None | None yet | `PATCH /api/v2/document/<dt>/<name>/` | |
| 5 | The server loads the document for update, applies the body and runs the normal save: write check, timestamp check, higher permlevel reset, version row, `doc_update` after commit. The reply has field-level read applied. | 1 | `check_permission("write")` `frappe/model/document.py:840`; `check_if_latest` `:844`; `validate_higher_perm_levels` `:848`; `apply_fieldlevel_read_permissions` `frappe/api/v2.py:307`. **Server.** | Framework document handling only | Same request | |
| 6 | The reply goes into the data cache. On a timestamp conflict the page re-reads the record and asks the reader what to do. | 3, 9 | Re-read as flow 3 step 5. **Server.** | Browser memory data cache, key = `doctype\0name`, ordered by request ticket (`ui/src/cache/writeGate.ts`) | On conflict: `GET` the record | |
| 7 | The page replaces `saved` and `doc`, re-reads the side parts quietly, replays all surfaces and handlers, and redraws. | 9 → 3, 8 | Parts re-read: `v2.py:114`. **Server.** | Data cache | `GET /api/v2/document/<dt>/<name>/?include=<parts>` | Callback 8 → 10 (replay) |
| 8 | The activity feed hears `doc_update` over the socket and re-reads its newest page. | 3, 4 | Room join was checked (`realtime/handlers.js:58-61`); feed read `activity.py:76`. **Server.** | Browser memory (timeline store) | `GET /api/v2/document/<dt>/<name>/activity` | |

8 steps. Up-calls (imports or direct calls): 0. Callbacks up: 4 (8→10 field handlers, 8→9 `host.save`, 8→10 before/after save, 8→10 replay).

**Checks only in the browser:** field access by permlevel (step 1), with the server check behind it. None stands alone.

---

## Flow 5. Load a stored script onto a record page

| # | What happens | Layer | Permission check | Cache | Server request | Up-call |
|---|---|---|---|---|---|---|
| 1 | `load()` asks for the doctype's stored scripts beside the record read. | 9 → 10 | None | None | None | **Up 9 → 10**: `Record.vue:491` |
| 2 | The script tier keeps one promise per doctype and a build counter, so a later build wins. | 10 | None | Browser memory `tiers`, key = doctype (`recordPage/clientScripts.ts:20`, `:72-76`) | None | |
| 3 | The tier fetches the enabled scripts for the Record view. | 10 → 3 | None | None (no HTTP cache) | `GET /api/v2/method/frappe.custom.doctype.client_script.client_script.get_client_scripts?dt=...&view=Record` | |
| 4 | The server checks the view, checks read on the target doctype, reads enabled rows in run order, drops rows of disabled modules, and reports whether the user may write Client Scripts. | 1 | `frappe.has_permission(dt, "read", throw=True)`, `frappe/custom/doctype/client_script/client_script.py:87`; `can_write` from `has_permission("Client Script", "write")`, `:101`. **Server.** | Disabled modules: per-request cache (`frappe/app_state.py:30`) | Same request | |
| 5 | The browser keeps the `can_write` answer. It decides whether script failures are toasted and whether the editor entry point shows. | 10 | Toast and editor entry shown only to script writers: `clientScripts.ts:61`, `:117`, `:179`. **Browser**, display only. Server behind it: Client Script write on save and on reorder (`client_script.py:111`). | Browser memory `writable`, one value, no user in it (`clientScripts.ts:31`) | None | |
| 6 | Each script is loaded as an ES module from a blob URL and its handlers are registered under the script's name. A script that fails is skipped. | 10 → 8 | None | Browser module map (blob URL revoked after import) | None | |
| 7 | The engine refuses the first paint until the tier is in, or 500 ms pass, then runs a two-pass replay (`createRecordPage.ts:314-322`, `paintGate.ts:86-131`). Handlers can read `page.perms`, `page.roles` and `page.fieldAccess`. | 8 | Anything a script does with `page.roles` or `page.perms` (hide a field, a button) is a **browser-only** display choice by design; the engine does not add server checks for it. | None | None | **Up 8 → 10** (`createRecordPage.ts:32`, `paintGate.ts:4`); callback 8 → 10 (replay) |
| 8 | Live update: a saved, reordered or deleted script publishes `client_script_changed` after commit to the site room. The shell's watcher drops the tier, and an open, clean record page re-runs its scripts. | 1, 5 → 10, 9 → 10 | Only System Users are in the site room (`realtime/handlers.js:8-10`). **Server.** | Tier dropped from browser memory | Socket event; then the step 3 request | **Up 5 → 10** (`main.ts:67`), **Up 9 → 10** (`pages/record/liveClientScripts.ts:3`) |

8 steps. Up-calls: 5 (9→10 load, 8→10 twice, 5→10 watcher, 9→10 live refresh). Plus one callback (8→10, the replay).

**Checks only in the browser:** the `can_write` gate on error toasts and the editor entry (step 5), with the server check behind it. Role or permission checks written inside stored scripts (step 7) are browser-only by design and have no server check behind them unless the doctype's own permissions cover the same thing.

---

## Caches whose key has no user or site

| Cache | Where | Key | Holds | Risk |
|---|---|---|---|---|
| Data cache (`ui/src/cache`) | Browser memory | `doctype\0name`; `doctype\0query` | Records as this user may read them, with the `permissions` part | Cleared when the session user changes (`ui/src/composables/useSession.ts:96`). Sign-out also reloads the page (`frontend/src/shell/session.ts:9`). Low. |
| List settings (`list/useListSettings.ts:46`) | Browser memory | doctype | The user's own list settings row | Not cleared on user change; relies on the page reload at sign-out. Low. |
| Script tier and `can_write` (`recordPage/clientScripts.ts:20`, `:31`) | Browser memory | doctype; single value | Scripts the user may see; the user's write right | Same as above. Low. |
| Meta, form layouts, list rows memory | Browser memory | doctype; `doctype:type` | Site data | Per tab, so per site. None. |
| `frappe:desk:sidebar` (`navigation/sidebarMemory.ts:4`) | sessionStorage | address | Which sidebar this user last saw for an address (from the user's filtered navigation) | Survives sign-out in the same tab, so the next user in that tab starts from the last user's choice. Low. |
| `theme`, `frappe:desk:sidebar-collapsed` | localStorage | fixed key | UI preferences | Shared by every user of the browser profile. Not private data. |
| Address table (`get_addresses`) | HTTP cache, private, 1 year | URL with `v=<metadata_version>` | Site data, the same for every user | A later user in the same browser gets the cached reply without passing the server's app gate. The data does not depend on permissions. None. |
| Shell document (`shell_page.py:17`) | Server process memory | file path | The built `index.html`, the same for every site | None. |

All server Redis keys in these flows (prefix registry, address table, doctype owners, `metadata_version`) go through `frappe.client_cache`, which adds the site prefix (`frappe/utils/redis_wrapper.py:557`). Sessions and roles are keyed by sid or user in the framework.
