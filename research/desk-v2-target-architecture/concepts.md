# Desk v2 concepts by proposed layer

Code: frappe `desk-v2` at commit 6352fefbdf. A concept is a name a code reader or an app/script author must learn: an exported API, a store, a registration point, a hook, a lifecycle event, a cache, a published name, a DocType desk v2 depends on, or a server route only desk v2 uses. Helpers used by one file are not counted. A family of names learned together is one row.

Paths in the client tables are relative to `frontend/src/` unless they start with `frappe/`, `ui/` or `frontend/`. The layer 3 and 4 tables use paths relative to `ui/src/`.

## Layer 1 Framework server (frappe/, frappe/api, frappe/utils, desk v2 DocTypes)

| Concept | Kind | Meaning (one plain line) | Defined at (file:line) | Duplicate of |
|---|---|---|---|---|
| Rail | DocType | The list of app icons down the left edge, per app, with site and per-user copies. | frappe/desk/doctype/rail/rail.json:1 | |
| Sidebar (`navigation_items` table) | DocType | A sidebar per module or doctype; desk v2 reads its `navigation_items` rows, classic reads `items`. | frappe/desk/doctype/sidebar/sidebar.json:1 | Sidebar's own `items` table (classic sidebar rows) |
| Navigation Item | DocType | One row in a rail or sidebar: key, parent, type, target, label, icon, hidden, anchors, overrides. | frappe/desk/doctype/navigation_item/navigation_item.json:1 | Sidebar Item (classic row) |
| Navigation Item Type | DocType | A kind of navigation row and the rule that decides who can see it. | frappe/desk/doctype/navigation_item_type/navigation_item_type.json:1 | |
| Doctype View | DocType | Saved list settings (columns, sort, quick filters) per person or per site. | frappe/desk/doctype/doctype_view/doctype_view.json:1 | |
| Form Layout | DocType | A stored layout for a doctype's record page parts (Details, Side Panel, Quick Entry), with an optional condition. | frappe/desk/doctype/form_layout/form_layout.json:1 | |
| Client Script, `view = Record` | DocType | Stored scripts; the new `Record` view is the one the desk v2 record page runs. | frappe/custom/doctype/client_script/client_script.json:1 | |
| Client Script class check (`classes.json`) | API | On save, warns about CSS classes the built stylesheet does not define; reads the build's `classes.json`. | frappe/custom/doctype/client_script/client_script.py:16 | |
| `code_only_modules` | hook | Modules that hold code only; their navigation is handed to named heir modules. | frappe/hooks.py:692, read at frappe/utils/modules.py:65 | |
| Layer resolution and anchors (`frappe.desk.layers`) | API | Merges base, site and user copies of a list and places items by anchors; shared with Workspace, Dock and classic sidebar. | frappe/desk/layers.py:45 | |
| `get_url_to_form` (canonical address) | API | The link used in emails and notifications now points at `/apps/<prefix>/...`; delegates to the desk server. | frappe/utils/data.py:2140 | `canonical_path` (layer 2) |
| Doctype View API (get, save, reset) | route | Reads and writes a list's saved settings. | frappe/desk/doctype/doctype_view/api.py:12 | |
| `get_form_layouts` | route | Returns a doctype's stored Form Layouts of one type. | frappe/desk/doctype/form_layout/form_layout.py:86 | |
| `get_client_scripts` (Record view) | route | Returns the enabled stored scripts for a doctype and view, in run order. | frappe/custom/doctype/client_script/client_script.py:84 | |
| `report_customization_error` | route | Writes one rate-limited Error Log row when a script on the record page fails. | frappe/desk/customization_error.py:29 | |
| `get_outgoing_senders` | route | The addresses the user may send email from, for the record page email writer. | frappe/email/inbox.py:43 | |
| `get_boot_translations` | route | All translations for a language, cached for a year and keyed by a version in boot. | frappe/translate.py:140 | classic boot's inline `__messages` |
| `GET /api/v2/session` | route | The signed-in user and site defaults. | frappe/api/v2.py:94 | |
| v2 document parts (assignments, shares, tags, favourites, follows, comments) | route | Add, remove or update one collaboration part on a record, and get that part back. | frappe/api/collaboration.py:246, rules at frappe/api/v2.py:682 | classic `frappe.desk.form.*` docinfo methods |
| v2 `include=` parts | route | Ask a record, meta or list read to also return parts (assignments, tags, users, count, children). | frappe/api/include.py:26, :170 | classic `getdoc` docinfo |
| v2 activity | route | The record's timeline entries in one read. | frappe/api/activity.py:8 | classic docinfo `communications`/`versions` |
| v2 attachments and file upload | route | Upload a file, attach it to a record, or detach it. | frappe/api/files.py:19, :35, :51 | classic `upload_file` |

Count: 22 (7 DocTypes, 1 DocType check, 2 shared APIs/hooks, 1 changed API, 11 routes).

## Layer 2 Desk server (frappe/shell/, the shell page renderer)

| Concept | Kind | Meaning (one plain line) | Defined at (file:line) | Duplicate of |
|---|---|---|---|---|
| `SHELL_ROOT` (`/apps`) | published name | The URL root every desk v2 page lives under. | frappe/shell/__init__.py:4 | |
| `ShellPage` renderer | API | Serves the one built `index.html` for `/apps` and every claimed prefix; checks permission first. | frappe/website/page_renderers/shell_page.py:41 | |
| Built document cache | cache | Keeps the built `index.html` in memory until its file time changes. | frappe/website/page_renderers/shell_page.py:17 | |
| `app_prefix` | hook | The URL prefix an app claims, e.g. `desk`; defaults from the app name. | frappe/shell/registry.py:23 | |
| `app_modular` | hook | Whether an app's record URLs include the module segment. | frappe/shell/registry.py:31 | `isModular` in frontend/src/router/routeFor.ts:25 |
| Prefix registry | cache | Map of prefix to app, cached under `shell_prefix_registry`, cleared on app install. | frappe/shell/registry.py:46 | |
| Shell path helpers (`split_shell_path`, `resolve_prefix`, `shell_base`, `prefix_map`) | API | Split an `/apps/...` path into prefix and rest, and find its app. | frappe/shell/registry.py:59 | |
| `app_permission` | hook | Who may enter an app's prefix; missing means "is a System User". | frappe/shell/permissions.py:24 | |
| `guard_prefix` | API | Sends a guest to login or throws for a user without app permission. | frappe/shell/permissions.py:37 | |
| Boot payload (core, app, index) | API | The keys every page gets at start, plus the app's own keys and, on `/apps`, the app list. | frappe/shell/boot.py:26, :73 | classic `frappe.boot` |
| `app_boot` | hook | An app adds its own keys to boot; a failing contributor is dropped and logged. | frappe/shell/boot.py:51 | classic `boot_session` hook |
| `add_to_apps_screen` (reused) | hook | Title and logo of an app tile on the `/apps` index. | frappe/shell/boot.py:64 | classic apps screen |
| Boot key budget | API | Logs any boot key over 100 KB. | frappe/shell/boot.py:17, :102 | |
| `metadata_version` | published name | Boot key that changes when doctypes change; the client uses it to refetch the address table. | frappe/shell/doctypes.py:56 | |
| Doctype owners | cache | Which app owns each doctype, cached under `shell_doctype_owners`. | frappe/shell/doctypes.py:37 | |
| Address table | cache | Every doctype and module mapped to its URL slug and owning app, cached under `shell_address_table_v2`. | frappe/shell/doctypes.py:112 | |
| `slug` | API | `Sales Order` to `sales-order`, the URL form of a name. | frappe/shell/doctypes.py:16 | `slug` in frontend/plugin/pageClashes.js:9 |
| `canonical_path` | API | The one URL for a record when no prefix is known: owning app's prefix and route shape. | frappe/shell/links.py:11 | `routeFor`/`urlFor` in frontend/src/router/routeFor.ts:50 |
| Address clash guard | hook | `doc_events` on DocType and Module Def refuse a name whose slug clashes with a page file. | frappe/shell/address_clash.py:67 | `pageClashes` build warning (frontend/plugin/pageClashes.js:37) |
| Reserved route guard | hook | A `*` validate event refuses any website route starting with `apps`. | frappe/shell/route_guard.py:27 | |
| Prefix check on install | hook | `before_app_install` refuses an app whose prefix is taken or malformed. | frappe/shell/install.py:15 | |
| Navigation resolution | API | Builds an app's rail and sidebars from base, site and user layers, filtered for the user, in a fixed wire shape. | frappe/shell/navigation.py:59, wire fields at :38 | |
| Cross-app extensions (`app:key`) | registration point | Another app's rail rows merged in with namespaced keys and anchors. | frappe/shell/extensions.py:19 | |
| `NavigationContext` and visibility rules | API | Decides per row whether the user may see it: readable doctype, module contents, permitted page, always, custom. | frappe/shell/navigation_filter.py:145, rules at :15 | |
| `navigation_item_resolvers` | hook | An app supplies `can_see` for its own navigation item type. | frappe/shell/navigation_filter.py:241 | |
| Arrangement (user and site scope) | API | Stores only the difference between what the user arranged and the layer below, with anchors. | frappe/shell/arrangement.py:208, :266 | frontend/src/arrangement.ts (client moves) |
| Build manifest | API | The list of apps that contribute to the desk, with source dirs and deps, written to `manifest.json`. | frappe/shell/manifest.py:131, :361 | `readManifest` (frontend/plugin/manifest.js:24) |
| Contribution file layout | registration point | The file paths that count as contributions: `record.js`, `list.js`, `pages.json`, `pages/*.js`, `custom/*`, `frontend/pages/*.js`, `item.js`. | frappe/shell/manifest.py:54 | `discover` (frontend/plugin/contributions.js:46) |
| Singletons | API | Packages every app must share one copy of (vue, vue-router, frappe-ui, @framework/ui, reka-ui, dompurify); a conflict stops the build. | frappe/shell/manifest.py:21, :220 | |
| `desk.package.json` | registration point | An app's declared frontend dependencies. | frappe/shell/manifest.py:33, :92 | |
| `import_map` | hook | Bare names a stored script may import, checked before vite runs. | frappe/shell/manifest.py:120, :212; frappe/hooks.py:21 | `importMap` plugin (frontend/plugin/importMap.js:8) |
| Composed package.json and base lockfile | build step | Adds each app's declared deps to the framework's `package.base.json` and `yarn.lock.base`. | frappe/shell/manifest.py:24, :306 | |
| `get_boot` | route | Returns the boot payload for a path. | frappe/shell/boot.py:136 | |
| `get_addresses` | route | Returns the address table, HTTP-cached for a year on `metadata_version`. | frappe/shell/doctypes.py:131 | |
| `get_contents` | route | The doctypes, reports and pages of an app or module that the user can read. | frappe/shell/doctypes.py:185 | |
| Arrangement routes (get, save, reset) | route | Read, save or reset the user's or site's rail or sidebar order. | frappe/shell/arrangement.py:36, :43, :69 | |

Count: 36 (32 non-route concepts, 4 routes).

## Layer 3 ui data (ui/src/api, ui/src/cache, ui/src/socket.ts, session)

| Concept | Kind | Meaning (one plain line) | Defined at | Duplicate of |
|---|---|---|---|---|
| Response envelope and ApiError (`Envelope`, `ApiError`, `isApiError`, `TIMESTAMP_MISMATCH`, `readEnvelope`) | type contract | Every `/api/v2` reply is `{data, ...}`; failures become one error class | api/envelope.ts:11, :16, :38 | |
| Request transport (`request`, `apiUrl`, `requestHeaders`) | API | The one fetch wrapper for `/api/v2`; also clears the cache and feeds `docs` replies | api/request.ts:18, :39 | |
| Document calls (`getDocument`, `listDocuments`, `countDocuments`, `searchDocuments`, `createDocument`, `updateDocument`, `deleteDocument`, `copyDocument`) | API | Read and write one record or a list; each reply is fed into the data cache | api/index.ts:107-192 | |
| Server method calls (`runMethod`, `runDocumentMethod`) | API | Call a whitelisted method, or a method on one document | api/index.ts:209, :229 | |
| `getMeta` | API | Fetch a DocType's meta | api/index.ts:269 | |
| Record parts (`getDocumentPart`, `addPart`/`removePart`/`updatePart`, `CollabPart`, `PartResponse`, `Users`) | API | Read or change one named part of a record (docinfo pieces) and get back the user map | api/index.ts:256, :313, :348-372 | |
| Collaboration calls (assign, share, tag, favourite, follow: add/remove each) | API | One pair of calls per side-panel feature, all built on the parts calls | api/index.ts:384-439 | |
| Comment calls (`addComment`, `updateComment`, `removeComment`, `Comment`) | API | Post, edit, delete a comment on a record | api/index.ts:338, :453-474 | |
| File calls (`uploadFile`, `attachFile`, `removeAttachment`, `downloadFile`, `AttachmentsPart`, `UploadFields`) | API | Chunked upload and attach to a record | api/upload.ts:50-96 | FileUpload `defaultTransport` wraps these (layer 4) |
| Session calls (`getSession`, `logout`, `getTranslations`, `Session`, `SessionUser`) | API | Fetch the signed-in user and roles, end the session, fetch translations | api/index.ts:90-99, :280-289 | |
| Reply-to-cache feeding (`fed`, `fedAfter`, `feedPartReply`) | API | Wraps each call so its reply is written into the cache in ticket order | api/feed.ts:11, :22, :41 | |
| Data cache (`DataCache`) | cache | The one in-memory store of documents and list queries, with size limits and eviction | cache/dataCache.ts:25 | TimelineStore/StoreCache keep their own copy of timeline parts (layer 4) |
| Cache read API (`readCachedDocument`, `readCachedList`, `readCachedRows`, `clearDataCache`, `listCacheKey`) | API | Read what the cache already holds, e.g. for a return visit painted before the fetch | cache/index.ts:10-33 | |
| Cache entry shapes (`RECORD_PARTS`, `DocumentEntry`, `ListEntry`) | type contract | What one cached record or list holds, and which record parts count as complete | cache/entries.ts:5, :17, :27 | |
| Write gate and tickets (`WriteGate`, `takeTicket`, `settleTicket`) | store | Numbers each request at send time so an older reply never overwrites a newer one | cache/writeGate.ts:9; cache/index.ts:38, :43 | |
| Cache feed functions (`feedRecordRead`, `feedListRead`, `feedDocumentWrite`, `feedDocsDocument`, `feedDelete`, `feedPartWrite`, `feedReadError`) | API | The cache side of feeding: apply one reply under its ticket | cache/index.ts:47-91 | |
| Realtime socket lookup (`RealtimeSocket`, `getSocketInstance`) | API | Finds the socket from four places: two injection names or two global properties | socket.ts:3, :12 | frontend/src/shell/socket.ts:10 creates it and puts it on `$socket` |
| Document rooms (`subscribeToDoc`, `resubscribeHeldDocs`) | API | Join a record's realtime room with a hold count; rejoin all held rooms after reconnect | socket.ts:48, :87 | frontend/src/shell/socket.ts:17 `repairRooms` is a one-line wrapper |
| Session store (`useSession`, `setSession`, `provideSession`, `currentSession`, `resetSession`, `SessionKey`) | store / injection key | One shared session ref for the app, provided at boot and read anywhere | composables/useSession.ts:12-64 | |
| `sessionUser()` cookie reader | API | Reads the user id from the `user_id` cookie | utils/session.ts:5 | Session store `currentSession().user` (only Onboarding uses this) |

Count: 20

## Layer 4 ui components (only what desk v2 imports)

| Concept | Kind | Meaning (one plain line) | Defined at | Duplicate of |
|---|---|---|---|---|
| FormLayout component and schema (`FormLayout`, `FormLayoutSchema`, `Tab`, `Section`, `Column`, `ColumnPart`, `FieldNode`) | component / type contract | Draws a form from a tabs-sections-columns-fields tree | components/FormLayout/index.ts:1; components/FormLayout/types.ts:75, :185 | |
| Meta field shapes (`RawMetaField`, `FieldMeta`) | type contract | A DocField as the meta sends it, and as the form uses it | components/FormLayout/types.ts:84; components/Fields/types.ts:12 | |
| Layout from meta (`mapField`, `Decorator`, `compose`, `fieldsToLayout`) | API | Turn meta fields into a layout tree; decorators add per-field UI | components/FormLayout/buildLayoutFromMeta.ts:40, :56, :151; components/FormLayout/fieldsToLayout.ts:12 | |
| Layout resolving (`resolveLayout`, `resolveFieldConditionals`, `resolveTabConditionals`, `applyTabOverride`, `TabOverride`, `FieldOverride`, `FieldUI`) | API | Apply depends-on, hidden, and overrides to a layout for one doc | components/FormLayout/resolveLayout.ts:103-209; components/FormLayout/types.ts:33, :63, :169 | |
| Tab identity (`identifyTabs`, `tabStripLabel`) | API | Stable names and labels for form tabs | components/FormLayout/tabIdentity.ts:26, :43 | |
| Field value formatting (`formatField`, `getFormatDefaults`, `resolveFieldCurrency`) | API | Format numbers, currency, dates for display | components/FormLayout/formatNumber.ts:236; formatDefaults.ts:49; resolveCurrency.ts:104 | |
| Field type registry (`registerFieldType`, `getFieldComponent`, `useFieldTypes`, `ResolveFieldKey`) | store / registration point | Maps a fieldtype to the Vue component that draws it | components/Fields/fieldTypes.ts:42, :61; components/FormLayout/useFieldTypes.ts:5; components/FormLayout/types.ts:194 | |
| `setScoped` scoped registry | API | Override a Map entry for one Vue scope, restored on dispose; backs `{global:false}` field types | utils/scopedRegistry.ts:34 | |
| Form injection keys (`DocKey`, `UpdateKey`, `LinkTitlesKey`) | injection key | How a field reads the doc, writes a value, and shows link titles | components/Fields/types.ts:91, :104, :108 | |
| Commit channel contract (`CommitChannel`, `CommitKey`, `NO_COMMIT`, `RowAddress`, `RowChange`, `warnMissingCommit`) | type contract / injection key | How a field tells the host a value or child row changed | components/Fields/types.ts:112-148; components/FormLayout/warnMissingCommit.ts:8 | |
| Child row identity (`ROW_ID`, `rowKey`, `identify`, `holdsChildRows`) | API | Gives unsaved child-table rows a stable key | components/Fields/rowIdentity.ts:8-37 | |
| ActivityTimeline component (`ActivityTimeline`, `TimelineSkeleton`, `EmailItem`) | component | Draws a record's activity feed | components/ActivityTimeline/index.ts:1-8 | |
| Activity types (`BaseActivity`, `EmailActivity`, `CustomActivity`, `UserInfo`, `VisibleTypes`) | type contract | Shapes of feed rows, including app-added ones | components/ActivityTimeline/types.ts:30, :43, :59 | |
| Timeline data API (`useActivityTimeline`, `prefetchActivityTimeline`, `endActivityPrefetch`, `activityTimelineRows`, `hasActivityTimeline`, `stageActivityTimelineRead`, `reloadActivityTimeline`) | hook/composable | Load, prefetch, and reload one record's feed rows | components/ActivityTimeline/useActivityTimeline.ts:12-121 | |
| Timeline store (`TimelineStore`) | store | Per-record feed rows fetched through `getDocumentPart`, debounced refresh | components/ActivityTimeline/timelineStore.ts:21 | Data cache parts (layer 3) |
| Timeline store cache (`StoreCache`, keeps 20 idle stores) | cache | Keeps recent record feeds so a return visit paints at once | components/ActivityTimeline/storeCache.ts:7 | Data cache (layer 3) |
| Pending feed rows (`addPendingActivity`) | store | Shows a just-posted comment or email before the server confirms it | components/ActivityTimeline/pendingRows.ts:35 | |
| Timeline live updates (`createLiveUpdates`) | API | Joins the record's room and applies `docinfo_update` events to the feed | components/ActivityTimeline/liveUpdates.ts:21 | frontend/src/pages/record/liveDocinfo.ts (same room, same event, for docinfo) |
| Activity ordering (`compareActivities`) | API | The one sort order for feed rows | components/ActivityTimeline/grouping.ts:20 | |
| Composer (`CommentComposer`, `EmailComposer`, `UploadedFile`, `Recipient`, `EmailPayload`, `CommentPayload`) | component / type contract | Comment and email editors and the payload each emits; desk loads them lazily | components/Composer/index.ts:5; components/Composer/types.ts:4-113 | |
| File upload (`FileUploadDialog`, `UploadTransport`, `defaultTransport`, `UploadArgs`, `UploadResult`) | component / API | Upload dialog with a swappable transport | components/FileUpload/index.ts:7, :12; components/FileUpload/types.ts:36, :100; components/FileUpload/useFileUpload.ts:27 | `attachFile`/`uploadFile` (layer 3); desk calls both |
| `UploadLimitsKey` | injection key | Max size and allowed types, provided once at boot | components/FileUpload/types.ts:55 | |
| Filter (`Filter`, `FilterCondition`, `FilterField`, `getFilterableFields`, `parseFilters`, `serializeFilters`, `WireFilters`) | component / API | List filter control and its URL/wire format | components/Filter/index.ts:5; components/Filter/filters.ts:82, :113 | |
| SortBy (`SortBy`, `Sort`, `parseOrderBy`, `serializeOrderBy`, `getSortOptions`) | component / API | List sort control and its `order_by` string | components/SortBy/index.ts:5; components/SortBy/orderBy.ts:5, :15 | |
| QuickFilter | component | Inline filter inputs above a list | components/QuickFilter/index.ts:6 | Filter (both edit list filters) |
| ColumnSettings (`ColumnSettings`, `Column`, `getColumnAlign`, `applyColumnWidth`, `clearColumnWidth`, `getDefaultColumns`, `getColumnOptions`) | component / API | Pick, order, and size list columns | components/ColumnSettings/index.ts:7; components/ColumnSettings/columns.ts:30, :113, :128 | |
| Experimental List (`List`, `ListFooter`, `ListBulkBar`, `ListColumn`, `BulkAction`) | component | Virtual-scroll list table with selection and bulk bar | experimental/List/index.ts:3-8 | ListView `ListViewShell`/`useListView`/`useListData` (not used by desk) |
| Doctype meta store (`useDoctypeMeta`, `dropDoctypeMeta`, `DoctypeMeta`) | cache / hook | Fetch and hold each DocType's meta, shared by all callers until dropped | composables/useDoctypeMeta.ts:16, :45, :66 | |
| Doc permissions (`useDocPermissions`, `FieldAccess`) | hook/composable | Field access from meta perm rows crossed with the user's roles | composables/useDocPermissions.ts:6, :25 | |
| User roles (`useUserRoles`) | hook/composable | The session user's roles, read off the session store | composables/useUserRoles.ts:13 | Session store `roles` (a thin view of it) |
| Shared memo (`memoizedState`, `MemoizedState`) | API | Build state once per key in a detached scope, with drop and reset | utils/sharedState.ts:4, :17 | |

Count: 31

## Layer 5 Desk services (root modules, icons, routeFor)

| Concept | Kind | Meaning | Defined at | Duplicate of |
|---|---|---|---|---|
| Boot payload (`Boot`, `fetchBoot`, `BootUnauthorized`) | API | The small startup payload per prefix: user, versions, app order, navigation. Nothing renders before it. | frontend/src/boot.ts:36, :87, :89 | Desk v1's `frappe.sessions.get()` (named as the thing it replaces) |
| `NavigationItem` / `Navigation` | API | Shape of one rail or sidebar row, and of the rail plus all sidebars keyed by address. | frontend/src/boot.ts:9, :27 | |
| `window.csrf_token` global | published name | Boot writes the CSRF token onto `window`; the ui request code reads it from there. | frontend/src/boot.ts:109 | |
| Address table (`Addresses`, `fetchAddresses`) | cache | Every doctype's URL slug and module; fetched keyed by `metadata_version` and held for the session. | frontend/src/addresses.ts:15, :77 | |
| Sidebar arrangement API (`fetchArrangement`, `saveArrangement`, `resetArrangement`, `move`, `dropOn`, `Container`, `Scope`, `Address`) | API | Read, save and reset a user's or site's order of rail and sidebar items, plus the reorder helpers. Used only by the customize dialog. | frontend/src/arrangement.ts:25, :37, :51, :67 | |
| Module contents (`fetchContents`, `useContents`, `ContentEntry`) | hook/composable | What doctypes a module holds, permission-filtered, as a call and as a reactive composable. | frontend/src/contents.ts:7, :12, :31 | |
| `loadTranslations` | lifecycle event | Fires the translation fetch at start, not awaited. | frontend/src/i18n.ts:12 | |
| `__` / `__n` | API | Translate a string, and a plural form; desk v1's shape. | frontend/src/i18n.ts:23, :33 | ui has no translator; the pair is re-published as `frappe/i18n` (layer 10) |
| Icon sprite (`loadSprite`, `spriteLoaded`, `hasSymbol`, `symbolId`, `symbolGeometry`, `isEmoji`, `reportMissingIcon`) | store | The one SVG sprite, loaded once, and lookups into it. | frontend/src/icons/sprite.ts:11, :18 | |
| `Icon` component | API | Draws a sprite symbol or an emoji. Used only by rail and sidebar rows. | frontend/src/icons/Icon.vue:1 | |
| Route builders (`routeFor`, `routeForModule`, `urlFor`, `RouteOptions`) | API | Build a route or href for a doctype list, record, or module; honours page replacements. | frontend/src/router/routeFor.ts:30, :50, :96, :103 | |
| Shell slot (`registerShell`, `Shell`) | registration point | Module-level slot holding boot, addresses and router, filled once so `routeFor` can work without arguments. | frontend/src/router/routeFor.ts:9, :14 | The same objects are also `app.provide`d (next row) |
| `isModular` | API | Whether this prefix's URLs carry a module segment. | frontend/src/router/routeFor.ts:25 | |
| Start sequence and app provides (`start`, `provide("boot")`, `provide("addresses")`, `UploadLimitsKey`) | lifecycle event | Order: boot, translations and sprite, addresses, contributions, router, shell slot, socket, mount. Provides boot and addresses to the app; no `inject("boot")` or `inject("addresses")` exists in `frontend/src`. | frontend/src/main.ts:25, :70, :73, :77 | Shell slot (`registerShell`) |

Count: 14

## Layer 6 Registry (contributions/ and build output)

| Concept | Kind | Meaning | Defined at | Duplicate of |
|---|---|---|---|---|
| `virtual:frappe/contributions` | virtual module | Build-generated index of every app's contributed files; the only source of app identity at runtime. | frontend/plugin/contributions.js:10 (consumed at frontend/src/contributions/registry.ts:3) | |
| Contribution file layout | registration point | Where an app puts files: `doctype/<dt>/frontend/record.js`, `list.js`, `pages.json` + `pages/<name>.js`; `custom/<dt>/record.js`; `frontend/pages/<slug>.js`; `navigation_item_type/<t>/frontend/item.js`. | frontend/src/contributions/types.ts:22-53; frontend/plugin/contributions.js:71-99 | |
| `Contributions` (the whole set) | API | "The complete list of what an app may contribute": doctypes, pages, item types, replacements. | frontend/src/contributions/types.ts:54 | |
| `DoctypeContribution` (`record`, `list`, `custom` kinds) | API | One app's handlers for a doctype, its own or a foreign one. | frontend/src/contributions/types.ts:22 | |
| `RecordHandlers` | API | Loose type for what a `record.js` exports (actions and anything else). | frontend/src/contributions/types.ts:5 | `RecordPageHandlers` in frontend/src/recordPage/types.ts:613 |
| List handlers (`ListHandlers`, `listHandlersFor`) | registration point | Per-doctype list customizations (extra columns), stored here because the list engine has no registrar. | frontend/src/contributions/types.ts:10; registry.ts:21 | |
| Contributed pages (`PageContribution`, `pages`) | registration point | New pages an app ships under `frontend/pages/`. | frontend/src/contributions/types.ts:15; registry.ts:13 | |
| Page replacements (`ReplacementContribution`, `replacementFor`, `declaredReplacements`) | registration point | An app's page in place of a doctype's standard list or record page; last app in order wins. | frontend/src/contributions/types.ts:33; registry.ts:28, :33 | |
| Item types (`ItemTypeContribution`, `itemRenderers`) | registration point | Renderer per navigation item kind; first app in order wins. | frontend/src/contributions/types.ts:47; registry.ts:16 | |
| `registerContributions(appOrder)` | lifecycle event | Runs once before the router's first resolution; applies run order (owner app first, then `app_order`) and hands record handlers to the record-page engine. | frontend/src/contributions/registry.ts:63 | |

Count: 10

## Layer 7 Shell (shell/, navigation/, router/)

| Concept | Kind | Meaning | Defined at | Duplicate of |
|---|---|---|---|---|
| `AppShell` | API | Root component: rail, sidebar, page area, error states, customize dialog. | frontend/src/shell/AppShell.vue:1 | |
| `PageFrame` + `pageGutter` | API | The frame every page renders inside (header, scroll area, gutter class). | frontend/src/shell/PageFrame.vue:1, :37 | |
| Shell error and loading states (`BootError`, `Unauthorized`, `NotFound`, `PageLoadError`, `LoadingStatus`) | API | The shell owns every error state; an app cannot brand them. | frontend/src/shell/*.vue | |
| Rail and sidebar components (`RailColumn`, `SidebarPanel`, `SidebarRow`, `SidebarEdge`) | API | Draw the rail, the sidebar tree and its drag edge from navigation items. | frontend/src/shell/RailColumn.vue:1, SidebarPanel.vue:1, SidebarRow.vue:1, SidebarEdge.vue:1 | |
| `CustomizeSidebarDialog` | API | Dialog to reorder and hide rail and sidebar items, per user or site. | frontend/src/shell/CustomizeSidebarDialog.vue:1 | |
| Hash dialogs (`useHashDialog`, `HashDialog`) | hook/composable | An overlay addressed by `#<root>/...` in the URL so Back closes it. Only the customize dialog uses it. | frontend/src/shell/useHashDialog.ts:7, :18 | |
| Logout (`logout`, `LogoutDialog`) | API | End the session and go to the login page with a way back. | frontend/src/shell/session.ts:6; LogoutDialog.vue:1 | Wraps `logout` in ui/src/api/index.ts:284 |
| Composer window state (`composerState`, `openComposer`, `closeComposer`, `setComposerWindow`, `preferredWindow`, `activeWriter`) | store | Which record's composer is open, which writer, docked or floating. | frontend/src/shell/composer.ts:44, :47, :69, :89, :98 | |
| Composer drafts (`composerDraft`, `saveComposerDraft`, `replaceComposerDraft`, `draftRevision`, `clearComposerDraft`) | cache | Unsent comment and email drafts per record and writer. | frontend/src/shell/composer.ts:143-176 | |
| Composer record registration (`registerComposerRecord`, `registerComposerDock`, `keepComposerRecord`, `composerRecord`, `composerRecordFor`, `composerKept`, `composerDock`, `WriterContext`) | registration point | A record page registers its writers and dock element so the shell-level composer can outlive the page. | frontend/src/shell/composer.ts:13, :64, :112, :122 | |
| `ComposerWindow` | API | Shell-level composer card, docked or floating; keeps its own floating rectangle in localStorage. | frontend/src/shell/ComposerWindow.vue:1 (storage at :164) | Placement is stored twice: `floatKey` here and `windowStorageKey` in composer.ts:91 |
| Socket (`createSocket`, `repairRooms`, `socketUrl`, `$socket` global property) | API | Opens the realtime socket and puts it on `app.config.globalProperties.$socket`, where ui's `getSocketInstance` looks. | frontend/src/shell/socket.ts:9, :16, :21; main.ts:67 | |
| `watchDoctypeUpdates` | lifecycle event | On a doctype change message, drops cached meta, form layouts and list settings. | frontend/src/shell/doctypeUpdates.ts:10 | |
| Item renderer contract (`ItemRenderer`, `Rendering`, `ItemContext`) | registration point | What an app's `item.js` implements to draw a navigation item kind: a route, href, heading or lazy rows. | frontend/src/navigation/types.ts:13, :22, :50 | |
| Renderer lookup (`rendererFor`, `renderingOf`, `labelOf`, `iconOf`, `resetNavigationReports`) | API | Resolve an item through its kind's renderer, with depth guard and fallbacks. | frontend/src/navigation/registry.ts:18, :23, :65, :81 | |
| `itemContext` | API | Builds the context object handed to every renderer. | frontend/src/navigation/context.ts:12 | |
| Current item (`currentNavigation`, `navigationDestinations`, `currentFrom`, `coverage`, `CurrentNavigation`) | API | Works out which rail item and sidebar the current URL belongs to. | frontend/src/navigation/current.ts:32, :48, :87, :120 | |
| Section memory (`sectionMemory`, `SectionMemory`) | store | Which sidebar sections a user opened or closed; localStorage, per user. | frontend/src/navigation/sectionMemory.ts:12, :41 | |
| Sidebar memory (`recallSidebar`, `rememberSidebar`) | store | Which sidebar this tab last showed for a path; sessionStorage, per tab. A second memory of sidebar state beside section memory, but a different job. | frontend/src/navigation/sidebarMemory.ts:22, :28 | |
| Item tree (`buildTree`, `containsKey`, `ItemNode`, `useItemTree`) | hook/composable | Turn flat navigation items into a parent/child tree. | frontend/src/navigation/tree.ts:6, :15; useItemTree.ts:12 | |
| `createShellRouter` | API | Builds the route table from boot and addresses, with guards. | frontend/src/router/index.ts:16 | |
| Standard pages and generated routes (`standardPages`, `generatedRoutes`) | route | The built-in list and record routes, and the page each opens when nothing replaces it. | frontend/src/router/standardPages.ts:3; generated.ts:10 | |
| `contributedRoutes` | route | Routes for app-contributed pages. | frontend/src/router/contributed.ts:7 | |
| Main-page loader (`mainPageFor`, `preloadMainPage`, `loadedPage`, `clearLoadedPages`) | cache | Pick the standard or replacement component for a list or record address and keep it loaded. | frontend/src/router/mainPage.ts:18, :30, :38, :50 | |
| Failed page (`failedPage`, `trackFailedPages`, `resetFailedPage`) | store | Which route's page chunk failed to load, for the shell's error state. | frontend/src/router/failedPage.ts:12, :15, :35 | |

Count: 25

## Layer 8 Page engines

### List engine (frontend/src/list)

| Concept | Kind | Meaning | Defined at | Duplicate of |
|---|---|---|---|---|
| `useListPage` (`ListPage`, `DeleteOutcome`) | hook/composable | Everything a list page needs: meta, columns, filters, sort, rows, settings, delete. | frontend/src/list/useListPage.ts:28, :33, :65 | `useListView` in ui/src/components/ListView/useListView.ts |
| `useListRows` (`ListRows`, `RowsQuery`, `ListRow`) | hook/composable | Rows and total for one query, fetched a page at a time. | frontend/src/list/useListRows.ts:15, :19, :30, :70 | `usePagedList` (ui/src/composables/usePagedList.ts) and `useListData` (ui/src/components/ListView/useListData.ts) |
| List settings (`useListSettings`, `dropListSettings`, `resetListSettings`, `VIEW_TYPE`, `Scope`) | cache | Per-doctype saved columns, sort and quick filters, user or site scope, cached in the module. | frontend/src/list/useListSettings.ts:8, :14, :48, :94 | |
| Stored settings conversions (`ListSettings`, `StoredColumn`, `columnsFrom`, `sortFrom`, `quickFilterFieldsFrom`, `toStoredColumns`, `toStoredQuickFilterFields`) | API | Convert between saved settings and live columns, sort and quick-filter fields, dropping unreadable fields. | frontend/src/list/storedSettings.ts:9, :15, :26-82 | |
| List URL (`ListAddress`, `queryFromAddress`, `addressFromQuery`, `SORT_KEY`, `ownedKeys`, `sameQuery`, `completeFilters`) | API | How filters and sort are written into and read from the list URL. | frontend/src/list/query.ts:15-72 | |
| List defaults (`ListMeta`, `DEFAULT_SORT`, `defaultColumns`, `defaultSort`, `sameSort`, `fetchFields`) | API | Default columns (with contributed ones) and sort for a doctype. | frontend/src/list/defaults.ts:10-44 | `fetchFields` repeats `fetchFields` in ui/src/components/ColumnSettings/columns.ts:168 |
| History-state list memory (`readListMemory`, `writeListMemory`, `ListMemory`) | store | Page size and scroll kept in the browser history entry, so Back lands in place. | frontend/src/list/pageState.ts:5, :10, :16 | |
| Rows memory (`rememberRows`, `recallRows`, `forgetRows`, `rememberScroll`, `RowsMemory`) | cache | Per-doctype rows shown and scroll kept for the session, so a return by any route lands in place. | frontend/src/list/pageState.ts:21-46 | Overlaps the history-state memory above (both keep scroll) |
| `useScrollMemory` | hook/composable | Restores and saves list scroll from the two memories above. | frontend/src/list/useScrollMemory.ts:15 | |

Subtotal: 9

### Record page engine (frontend/src/recordPage), for code readers

| # | Concept | Kind | Meaning (one plain line) | Defined at | Duplicate of |
|---|---|---|---|---|---|
| 1 | `createRecordPage` and `RecordPageController` | API | Builds `page` and every surface for one record, fires events, runs the replay. | recordPage/createRecordPage.ts:209, :169 | |
| 2 | `RecordPageHost` | API | The contract a page must fill (doc, save, tabs, feeds, composer) so the engine draws nothing itself. | recordPage/createRecordPage.ts:118 | |
| 3 | Registry internals | store | Module-level list of registrations; `registrationsFor`, `unregisterSource`, `resetRegistry`. | recordPage/registry.ts:31 | |
| 4 | Source context | API | Which source is registering or running right now: `HOST_SOURCE`, `withRegisteringSource`, `withRunningSource`. | recordPage/context.ts:3 | |
| 5 | `Surface` base class | API | A list surface records ops and replays them over built-ins; `ResolvedItem`, `BUILTIN`, key vocabulary. | recordPage/surface.ts:33 | |
| 6 | `StagedOverlay` and staging | API | Ops wait in a buffer during a replay or hold and appear at one commit. | recordPage/staging.ts:19 | |
| 7 | Paint gate | API | When the page first paints (waits up to 500 ms for scripts), late `onRefresh` holds, background replays. | recordPage/paintGate.ts:66 | |
| 8 | Commit channel and dotted keys | API | Turns a field commit into the handler key (`qty`, `items.qty`, `items.onAdd`) and fires it. | recordPage/commitChannel.ts:25; recordPage/flattenHandlers.ts:11 | |
| 9 | Field and form-tab overlays | API | `FieldsSurface` and `FormTabsSurface`: patch overlays keyed by fieldname or tab identity, not item lists. | recordPage/fields.ts:87; recordPage/formTabs.ts:40 | Each other ("modelled on FieldsSurface") |
| 10 | Header projection | API | Turns the flat header list into two zones, nesting and overflow. | recordPage/headerRenderings.ts:69 | |
| 11 | Frame and body projection | API | Orders frame bands and computes body column widths, snapping and collapse. | recordPage/frame.ts:47; recordPage/body.ts:89 | |
| 12 | Form join | API | Joins the Details layout with `page.form`'s resolved list. | recordPage/formJoin.ts:28 | Close to pages/record/panel/panelEntries.ts:63 (panel side of the same join) |
| 13 | Form layout source | cache | `useFormLayout`: one fetch per doctype and layout type of `Form Layout` rows, picks the matching row, joins with meta. | recordPage/formLayoutSource/useFormLayout.ts:57 | |
| 14 | Client Script loader | cache | Fetches, evaluates and registers a doctype's stored scripts once; reloads on realtime change. | recordPage/clientScripts.ts:72 | |
| 15 | Page permissions | API | Rights, roles and field access, ready before handlers run. | recordPage/pagePermissions.ts:30 | Wraps ui `useDocPermissions` |
| 16 | Read-only guard | API | Objects handed to scripts throw on write with advice on what to use. | recordPage/readOnly.ts:24 | |
| 17 | Removed-name tombstones | registration point | `REMOVALS` list: a removed `page` member throws or warns with its replacement (empty today). | recordPage/pageCompatibility.ts:19 | |
| 18 | Customization error reports | API | Writes an Error Log row per script failure, by tier. | recordPage/reportError.ts:38 | |
| 19 | Page dialogs engine | API | `createPageDialogs` and the form-dialog layout builder behind `page.dialog`. | recordPage/dialog.ts:80; recordPage/formDialogLayout.ts:31 | |
| 20 | Row handles | API | `createRows`: handles that re-find their row and throw once it is gone. | recordPage/rows.ts:51 | |
| 21 | Feed surfaces | API | `FeedSurface` base with `ActivitySurface` and `FilesSurface`. | recordPage/feed.ts:38 | |
| 22 | Composer surface and `ComposerHost` | API | `page.composer` over a host that owns the real composer state. | recordPage/composer.ts:33, :43 | Delegates to shell/composer.ts (layer 7) |
| 23 | `setIconSource` | registration point | The host hands the engine a sprite lookup so script-named icons get CSS classes. | recordPage/iconClasses.ts:18 | Same injection pattern as 24 |
| 24 | `setDrawnProps` | registration point | The host hands the engine frappe-ui's prop names so header `props` are filtered. | recordPage/drawnProps.ts:24 | Same pattern as 23; host half is pages/record/drawnProps.ts:10 |

Subtotal: 24. Rows 9, 19, 20, 21, 22 implement a layer 10 surface; without them the count is 19.

## Layer 9 Pages

### Pages other than the record page

| Concept | Kind | Meaning | Defined at | Duplicate of |
|---|---|---|---|---|
| `Home` | route | The prefix's landing page: module tiles. | frontend/src/pages/Home.vue:1 | |
| `Module` | route | One module's contents page. | frontend/src/pages/Module.vue:1 | |
| `MainPage` | route | Picks the standard or replacement page for a list or record address. | frontend/src/pages/MainPage.vue:1 | |
| `List` | route | Standard list page wrapper in a `PageFrame`. | frontend/src/pages/List.vue:1 | |
| `DoctypeList` | API | The list page body built on `useListPage`. | frontend/src/pages/list/DoctypeList.vue:1 | |
| `DeleteDialog` | API | Confirm bulk delete and report failures. | frontend/src/pages/list/DeleteDialog.vue:1 | |
| `TileGridSkeleton` | API | Shared loading skeleton for Home and Module. | frontend/src/pages/TileGridSkeleton.vue:1 | |

Subtotal: 7

### Record page (pages/Record.vue, pages/record/)

| # | Concept | Kind | Meaning (one plain line) | Defined at | Duplicate of |
|---|---|---|---|---|---|
| 1 | Record page host | API | `Record.vue` fills `RecordPageHost`: loads, saves, wires layouts, feeds, tabs and composer (885 lines). | pages/Record.vue:663 | |
| 2 | Record source | cache | The load, the parts re-read, the save, and a cached read of the record. | pages/record/recordSource.ts:15, :20 | `readCachedRecord` wraps ui `readCachedDocument` (ui/src/cache/index.ts:17) |
| 3 | Meta source | cache | The doctype meta as one promise or its current value. | pages/record/metaSource.ts:7 | Wraps ui `useDoctypeMeta` |
| 4 | Refetch merge | API | A background re-read merged into the draft the reader is editing. | pages/record/refetchMerge.ts:9 | |
| 5 | Save conflict | published name | `SaveConflict` error name and the fields the reader would lose. | pages/record/saveResponse.ts:6 | Sibling of `SAVE_VETO` (engine) |
| 6 | Live docinfo | hook/composable | Keeps assignments, shares, tags, likes live over the record's realtime room. | pages/record/liveDocinfo.ts:35 | Similar job to ui ActivityTimeline liveUpdates |
| 7 | Live Client Scripts | hook/composable | Re-runs the page's scripts when a Client Script of its doctype changes. | pages/record/liveClientScripts.ts:18 | |
| 8 | `RecordFeeds` | store | The Activity and Files data behind `page.activity`/`page.files`, provided by injection key, with prefetch. | pages/record/feed/recordFeeds.ts:55, :57 | |
| 9 | Record tabs host | API | `RecordTabsHost`, the four built-in tabs, the tab named in the URL (`useRecordTabs`). | pages/record/tabs/recordTabs.ts:72; pages/record/tabs/useRecordTabs.ts:14 | |
| 10 | Panel context | store | `PanelContextKey` and `DocInfo`: what built-in panel sections read. | pages/record/panel/context.ts:6, :32 | |
| 11 | Panel entries | API | Joins panel items with the Side Panel layout; embeds quick actions. | pages/record/panel/panelEntries.ts:63 | Close to engine form join |
| 12 | Panel disclosure | store | Open/shut state of panel sections, kept through the nav's section memory. | pages/record/panel/disclosure.ts:27 | Reuses navigation/sectionMemory.ts |
| 13 | Built-in actions | registration point | Framework quick actions and `...` menu rows, gated by rights. | pages/record/builtinActions.ts:8, :48 | |
| 14 | Composer host and writer context | API | `composerHost` joins `page.composer` to the shell's composer store; `openWriterContext` gives a writer its record. | pages/record/composer/composerHost.ts:17; pages/record/composer/writerContext.ts:20 | |
| 15 | Comment writer | store | Comment draft, `useCommentDraft`, `postComment` (pending row, then server key). | pages/record/composer/commentDraft.ts:12; pages/record/composer/commentPost.ts:25 | Parallel to 16 |
| 16 | Email writer | store | Email draft, seed, post, senders and recipient search. | pages/record/composer/emailDraft.ts:23; pages/record/composer/emailPost.ts:28; pages/record/composer/emailSenders.ts:15 | Parallel to 15 |
| 17 | Body column store | store | Per-user column widths and collapse, in localStorage. | pages/record/body/columnStore.ts:10 | navigation/sectionMemory.ts pattern |
| 18 | Form tab memory | store | Per-user last form tab per doctype, in localStorage. | pages/record/formTabMemory.ts:31 | navigation/sectionMemory.ts pattern |
| 19 | Dock height | store | Per-user docked composer height, in localStorage. | pages/record/composer/useDockHeight.ts:9 | Same pattern as 17, 18 |
| 20 | Docinfo readers | API | Assignees, shares, tags, favourites, follow gate read off docinfo, plus the matching actions. | pages/record/panel/people.ts:17; pages/record/favourites.ts:6; pages/record/follow.ts:5; pages/record/panel/peopleActions.ts:17 | |
| 21 | Remote search | hook/composable | Debounced server search for user and tag pickers; last answer wins. | pages/record/panel/remoteSearch.ts:28 | ui `useLinkSearch` (ui/src/composables/useLinkSearch.ts) |
| 22 | Drawn props host half | registration point | Reads frappe-ui `Button` props and hands them to `setDrawnProps`. | pages/record/drawnProps.ts:10 | Pair of engine row 24 |

Subtotal: 22.

## Layer 10 Customization surface

### Record page: what a file script or stored Client Script touches

| # | Concept | Kind | Meaning (one plain line) | Defined at | Duplicate of |
|---|---|---|---|---|---|
| 1 | File script | registration point | An app ships a file whose `export default { ... }` is a handlers object for a doctype; the contributions registry registers it under the app's name. | contributions/registry.ts:85 | |
| 2 | Stored Client Script | registration point | A `Client Script` row with view Record; its text is the same `export default {}` module, run from a blob URL so bare imports resolve through the import map. | recordPage/evaluateClientScript.ts:6; frappe/custom/doctype/client_script/client_script.py:84 | Same handlers shape as 1 |
| 3 | Customization tiers and run order | API | Scripts run host first, then other apps' file scripts ("extension"), then Client Scripts; later tiers win. Errors are logged under the tier name. | recordPage/reportError.ts:12; recordPage/registry.ts:1 | |
| 4 | `*` doctype key | registration point | Registering for `ALL_DOCTYPES` ("*") runs the handlers on every record, before the doctype's own. | recordPage/registry.ts:7 | |
| 5 | Handlers object and `Handler` signature | API | Keys are event names or fieldnames; each value is `(page, row?)`. | recordPage/types.ts:599, :607 | |
| 6 | Lifecycle events | lifecycle event | The closed list: `onRefresh`, `beforeSave`, `afterSave`, `onTabChange`, `onFormTabChange`, `onPost`. | recordPage/createRecordPage.ts:77 | |
| 7 | Field change handler | lifecycle event | A key that is a fieldname fires when that field's value is committed. | recordPage/commitChannel.ts:83 | |
| 8 | Child table block | lifecycle event | Handlers nested under a table fieldname: field keys plus `onAdd`/`onRemove`, called with a row handle. | recordPage/flattenHandlers.ts:9 | |
| 9 | `SAVE_VETO` | published name | Throwing in `beforeSave` cancels the save and keeps the draft; the error is renamed `SaveVeto`. | recordPage/createRecordPage.ts:53 | Sibling of `SAVE_CONFLICT` (layer 9, row 5) |
| 10 | `page.doc`, `page.saved`, `page.isDirty`, `page.doctype`, `page.docname` | API | The draft, the last saved copy (read-only), and whether they differ. | recordPage/types.ts:546 | |
| 11 | `page.meta` | API | The doctype meta, read-only; writes throw and point to `page.fields.update`. | recordPage/types.ts:552; recordPage/createRecordPage.ts:88 | |
| 12 | `page.perms`, `page.roles`, `page.fieldAccess()` | API | The user's rights on the doctype, their roles, and per-field access by permlevel. | recordPage/types.ts:554-558 | |
| 13 | `page.save()`, `page.reload()`, `page.refresh()` | API | Save the draft, re-read the record, re-run every script's `onRefresh`. | recordPage/types.ts:579 | |
| 14 | `page.call()`, `page.router`, `page.toast` | API | Call a whitelisted method, navigate, show a toast. | recordPage/types.ts:584-585, :288 | |
| 15 | Surface verbs and `Position` | API | The shared verbs on every list surface: `add`, `hide`, `show`, `update`, `move`, `has`, `order`, `clear`, with `{ before \| after }`. | recordPage/types.ts:265, :12 | |
| 16 | Built-in item names | published name | The names a script hides or moves: frame `header`/`body`, body `form`/`panel`, tabs `details`/`activity`/`emails`/`files`, three panel sections, quick actions and `...` menu rows, writers `comment`/`email`. | recordPage/frame.ts:8; recordPage/body.ts:19; pages/record/tabs/recordTabs.ts:26; pages/record/panel/builtins.ts:8; pages/record/builtinActions.ts:8, :48; pages/record/composer/composerHost.ts:41 | Spread over 7 files in 2 layers |
| 17 | `page.quickActions` | API | Buttons in the side panel; item has `label`, `icon`, `run(page)`. | recordPage/types.ts:21 | |
| 18 | `page.header` | API | Header controls in a left or right zone, shown as button, dropdown, section or crumb. | recordPage/types.ts:44 | |
| 19 | `page.frame` | API | The page column: built-in header and body, plus bands a script adds around them. | recordPage/types.ts:126 | |
| 20 | `page.body` | API | The row under the header as columns, with width, min/max width and collapse. | recordPage/types.ts:137 | |
| 21 | `page.tabs` | API | The record's tab strip; adds `activate`, and a tab may carry a `create` action or the composer. | recordPage/types.ts:79, :279 | Parallel to 23 (two tab strips, different verbs) |
| 22 | `page.panelSections` | API | Sections of the side panel; adds `open`/`close`. | recordPage/types.ts:100, :256 | |
| 23 | `page.form` and `page.form.tabs` | API | The Details form's sections plus a script's parts; its tabs are addressed by identity and can be overridden, not added. | recordPage/types.ts:396, :379 | Parallel to 21 |
| 24 | `page.fields` | API | Override field properties (hidden, reqd, label, options, component...), `get`, `focus`. | recordPage/types.ts:348 | |
| 25 | `page.rows(parentfield)` | API | Handles to child table rows; `trigger(fieldname)` fires a row field's handler. | recordPage/types.ts:404, :578 | |
| 26 | `page.activity` | API | The Activity tab's rows plus a script's own; `types()`, `scrollTo()`, `reload()`. | recordPage/types.ts:201, :214 | Shares `PageFeedList` with 27 |
| 27 | `page.files` | API | The record's attachments plus a script's own rows. | recordPage/types.ts:221 | Shares `PageFeedList` with 26 |
| 28 | `page.composer` | API | Writers in the band under Activity/Emails; `open`, `close`, docked or floating `window`. | recordPage/types.ts:224, :245 | |
| 29 | `page.dialog` | API | `open` (a component), `form` (fields, tabs or a doctype), `confirm`, `danger`; each returns a promise. | recordPage/types.ts:294-544 | |
| 30 | Published import names | published name | What a script may `import` bare: `vue`, `vue-router`, `frappe-ui`, `@framework/ui`, `frappe/i18n`. | frappe/hooks.py:21 | Also counted by the build/registry part, if that part lists it |

Subtotal: 30 (29 without row 30, which another part may own).

### Published names from the rest of the client

| Concept | Kind | Meaning | Defined at | Duplicate of |
|---|---|---|---|---|
| `@shell` import name | published name | The only module a contributed file may import from the shell; alias to `public.ts`. | frontend/src/public.ts:1; frontend/vite.config.js (alias) | |
| `routeFor` / `routeForModule` / `urlFor` / `RouteOptions` via `@shell` | published name | Route builders published so apps never hard-code URL shape. | frontend/src/public.ts:4 | Re-export of layer 5 row, counted once there as API |
| `isModular` via `@shell` | published name | Published so an item renderer can tell prefix shape. | frontend/src/public.ts:4 | Re-export of layer 5 row |
| `ContentEntry` via `@shell` | published name | Type of one module-contents row, for item renderers. | frontend/src/public.ts:11 | Re-export of layer 5 row |
| `frappe/i18n` (`__`, `__n`) | published name | The names a stored Client Script may import for translation, via the `import_map` hook. | frappe/frontend/i18n.js:2; frappe/hooks.py:26 | Re-export of layer 5 row |

Subtotal: 5 (4 of them re-publish a layer 5 concept; counting only new names gives 1-2)

## Build (frontend/plugin/, frontend/vite.config.js, bench glue)

| Concept | Kind | Meaning (one plain line) | Defined at (file:line) | Duplicate of |
|---|---|---|---|---|
| `build_shell` | build step | `bench build` writes the manifest, installs deps if needed, runs the one vite build into a staging folder and swaps it in. | frappe/bundler.py:125 | |
| One bench-wide vite config | build step | One build for all apps, output to `frappe/public/frontend`, served at `/assets/frappe/frontend/`. | frontend/vite.config.js:21 | |
| `@shell` and `@/` aliases | published name | `@shell` is what app files may import (frontend/src/public.ts); `@/` is private to the framework. | frontend/vite.config.js:42 | |
| `readManifest` / `readAllSourceDirs` | build step | Reads the manifest Python wrote. | frontend/plugin/manifest.js:24 | Build manifest (layer 2) |
| `virtual:frappe/contributions` | published name | The generated module listing every app's contributed files. | frontend/plugin/contributions.js:10 | |
| Contribution discovery | build step | Walks each app for record, list, custom, page and item-type files. | frontend/plugin/contributions.js:46 | Contribution file layout (layer 2) |
| Replacement pages (`pages.json`, `STANDARD_PAGES`) | registration point | A doctype's `pages.json` replaces its record or list page with a file from `pages/`. | frontend/plugin/replacements.js:8, :11 | |
| Page clash warnings | build step | Warns when a page slug equals a doctype or module slug. | frontend/plugin/pageClashes.js:37 | Address clash guard (layer 2) |
| One tree resolution | build step | An app's bare imports resolve from the framework's `node_modules`, only if declared. | frontend/plugin/oneTree.js:18 | |
| Import map plugin | build step | Emits the page's import map pointing each `import_map` name at a built chunk. | frontend/plugin/importMap.js:8 | `import_map` checks (layer 2) |
| `classes.json` | build step | Writes every CSS class the build defines, for the Client Script check. | frontend/plugin/classList.js:6 | |
| Tailwind presets | registration point | Each app's `frontend/tailwind.preset.js`; one writer per theme leaf. | frontend/plugin/presets.js:32 | |
| Tailwind content list | build step | Which folders Tailwind scans: every app's source and published file folders. | frontend/plugin/content.js:21 | |

Count: 13.

## Imports that cross layers the wrong way

- `contributions/registry.ts` (6) imports `@/recordPage` (8) and `@/navigation/types` (7); `contributions/types.ts` (6) imports `@/navigation/types` (7).
- `router/routeFor.ts` sits in `router/` (7) but is assigned to 5; it imports `replacementFor` from `@/contributions/registry` (6).
- `main.ts` imports shell, router, contributions, recordPage and `pages/record/drawnProps`; it is the start-up root and fits no single layer.
- `shell/ComposerWindow.vue` (7) imports seven modules from `pages/record/composer/` (9); `shell/composer.ts` (7) imports types from `@/recordPage` (8).
- `shell/doctypeUpdates.ts` (7) imports `recordPage/formLayoutSource/useFormLayout` (8) and `list/useListSettings` (8).
- `router/generated.ts` and `router/standardPages.ts` (7) import `pages/MainPage.vue`, `pages/List.vue`, `pages/Record.vue` (9).
- `list/useListPage.ts` (8) imports `router/routeFor` and `contributions/registry`; downward, fine. `list/` does not import `pages/`.
- The item renderer contract (`navigation/types.ts`, 7) is what an app's `item.js` implements, so it is really layer 6 or 10.
- `arrangement.ts`, `icons/` (5) are used only by shell components; they behave as layer 7.

- `frappe/utils/data.py:2153` (`get_url_to_form`, layer 1) imports `frappe.shell.links.canonical_path` (layer 2).
- `frappe/bundler.py:127` (bench build) imports `frappe.shell.manifest` (layer 2).
- The shell page renderer lives at `frappe/website/page_renderers/shell_page.py`, outside `frappe/shell/`, and imports `frappe.shell`; by its job it is layer 2.
- `ui/src/composables/useDoctypeMeta.ts`, `useDocPermissions.ts`, `useUserRoles.ts` fetch and hold data, so by job they are layer 3, but they sit in layer 4. `useDoctypeMeta` imports a type from `components/FormLayout`.
- The ActivityTimeline store, store cache and live updates (`ui/src/components/ActivityTimeline/`) are data code in a component folder, and keep a second copy of timeline data beside the main data cache.
- `recordPage/` production code imports nothing from `pages/` or `shell/`; only two test files do.
- Hide-by-name keys for built-in record page items are spread over 7 files; the tab, panel section, quick action, menu row and writer names live in `pages/record` (layer 9) although script authors (layer 10) use them.

## Not counted, noted

- `ListView` (`ListViewShell`, `useListView`, `useListData`) and `usePagedList`: ui's own paged list data. Desk v2 does not import them; `frontend/src/list/useListRows.ts` pages lists itself with `listDocuments`/`countDocuments`. Same job, three places.
- `RowsMemo`, `NameCounts`, entries.ts builders: internal to `DataCache`.
- `uploadTray`: internal to the upload dialog.

## Count per layer

| Layer | Count | Notes |
|---|---|---|
| 1 Framework server | 22 | 7 DocTypes, 11 routes only desk v2 uses |
| 2 Desk server | 36 | 4 routes; hooks listed one per row |
| 3 ui data | 20 | only what desk v2 uses |
| 4 ui components | 31 | only what desk v2 imports |
| 5 Desk services | 14 | |
| 6 Registry | 10 | |
| 7 Shell | 25 | |
| 8 Page engines | 33 | list 9, record page 24 |
| 9 Pages | 29 | other pages 7, record page 22 |
| 10 Customization surface | 35 | record page 30, other published names 5 |
| Build | 13 | |
| **Total** | **268** | |

Double counts inside the total: 4 of the 5 non-record layer 10 rows re-publish a layer 5 concept; the layer 10 "published import names" row is the same thing as the layer 2 `import_map` hook; 5 of the 24 record page engine rows only implement a layer 10 surface.

### Against the earlier totals

| Earlier bucket | Earlier | Now | Why |
|---|---|---|---|
| Client outside the record page | 70 | 70 (layers 5, 6, 7, list engine, other pages, 5 published names) | same scope; ui/ was not in it |
| Python shell and build | 34 | 45 (32 desk server non-route + 13 build) | each app hook (`app_prefix`, `app_modular`, `app_permission`, `app_boot`, `navigation_item_resolvers`) and each of 3 caches is its own row; merging them gives about 34 |
| Server routes only desk v2 uses | 10 | 15 (11 in layer 1, 4 in layer 2) | the 5 new `/api/v2` routes (session, document parts, `include=`, activity, attachments) are counted; classic desk calls none of them |
| Record page for script authors | about 29 | 30 | 29 plus the published import names row |
| Record page for code readers | 16 | 24 engine + 22 pages | the earlier count seems to cover only the engine core; 19 without rows that only implement a script surface; pages/record stores were not in it |
| (not counted before) | | 11 layer 1 non-route items (mostly DocTypes); 51 ui/ concepts | new scope |
