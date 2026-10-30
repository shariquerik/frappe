# Views: the list page's seams for a named view and a second view type

Ticket [frappe/frappe#45848](https://github.com/frappe/frappe/issues/45848), map [#45846](https://github.com/frappe/frappe/issues/45846). Read 2026-10-30. Commits: frappe `desk-v2` at `4c5b0f3acd` (all paths below are frappe paths unless named); crm `desk-v2` at `79b984370`; erpnext `desk-v2` at `3c1fbcd174`. Gameplan (`develop` at `c643ae8`) was not needed. Data: `desk.localhost`, read only. `crm.localhost` runs on the owner's laptop and could not be reached from here, so no CRM site data is in this file.

This file states facts only. The decisions belong to the map's grilling tickets.

## 1. The list page's state

### Who holds what

| State | Held in | Written to | Source |
| --- | --- | --- | --- |
| Filters | `filters` ref | The URL query only, one key per field | `frontend/src/list/useListPage.ts:95`, `:209-214`; `frontend/src/list/query.ts:28-36` |
| Sort | `sort` ref | The URL `_sort` key while it differs from the resolved sort, **and** the person's plain-view row on the person's own change | `useListPage.ts:96`, `:216-224`, `:232`; `query.ts:16` |
| Columns | `columns` ref | The person's plain-view row, debounced 500 ms | `useListPage.ts:97`, `:231`; `frontend/src/list/useListSettings.ts:13`, `:74-78` |
| Quick filter fields | `quickFilterFields` ref | The person's plain-view row, when customizing ends | `useListPage.ts:98`, `:233-237` |
| Page size, scroll | `history.state.list` and a per-doctype `Map` | Same | `frontend/src/list/pageState.ts:10-17`, `:26-41`; `useListPage.ts:101`, `:258-274` |

- The stored shape is `ListSettings = { columns?, sort?, quick_filter_fields? }` (`frontend/src/list/storedSettings.ts:15-19`). It has **no filters key and no group-by key**.
- `useListPage(doctype)` takes the doctype only (`useListPage.ts:85`). It has no view parameter.
- `useListSettings` addresses the server as `{ doctype, type: "List" }` (`useListSettings.ts:11`, `:70`, `:165`, `:171`). Its memo is one entry per doctype (`useListSettings.ts:66`, `:131-133`).
- The server reads and writes only `label = ""`, the plain view (`frappe/desk/doctype/doctype_view/api.py:72-95`). `VIEW_TYPES = ("List",)` (`frappe/desk/doctype/doctype_view/doctype_view.py:154`), and `_check` refuses any other type (`api.py:59-60`).

### Which source wins on load

The page seeds once, when meta, the settings read and permissions are all in (`useListPage.ts:107-109`, `:167-179`).

| Setting | Order, first wins | Source |
| --- | --- | --- |
| Filters | The URL query. Nothing else stores filters. | `useListPage.ts:154-158`; `query.ts:39-57` |
| Sort | URL `_sort`, then the stored sort (user row over site row), then meta's `sort_field`, then `modified desc` | `useListPage.ts:126-129`, `:161-165`; `frontend/src/list/defaults.ts:30-37` |
| Columns | User row, then site row, then the app default (`list.js` `columns` in run order, else meta's `in_list_view`, else `name` and `modified`) | `useListPage.ts:120-124`; `defaults.ts:24-28`, `:49-67` |
| Quick filter fields | User row, then site row, else `undefined` (the control's own default) | `useListPage.ts:131-135` |

- The user and site rows merge **key by key**: `{ ...site, ...user }` (`useListSettings.ts:99`). A user row with `sort` replaces the whole site `sort`.
- Every stored fieldname passes through meta and field read access. A fieldname that meta lacks, or that the person cannot read, is dropped (`storedSettings.ts:26-75`; `useListPage.ts:111-114`).
- The **session memory** holds no settings. `rowsByDoctype` holds page size and scroll per doctype, keyed by the filters-and-sort string (`pageState.ts:19-41`). The history entry holds page size and scroll (`pageState.ts:10-17`). On seed, the session memory gives only a page size when the history entry has none (`useListPage.ts:173-175`).
- Back, Forward or a pasted link re-reads the query. A query the page wrote itself is not read back (`useListPage.ts:199-205`).
- After a DocType change, each setting that the person did not change follows the fresh settings (`useListPage.ts:181-197`).

### Where a named view's settings and "modified" would plug in

- **Read.** Three places carry no view name today: the client address (`useListSettings.ts:70`), the memo key (`useListSettings.ts:66`) and the server filter `label: PLAIN_VIEW` (`api.py:82-95`).
- **The page.** `DoctypeList.vue` passes `view` to the star only (`frontend/src/pages/list/DoctypeList.vue:191-203`). It calls `useListPage(props.doctype)` with no view (`DoctypeList.vue:161`).
- **What exists that compares state with a base:**
  - `applied` holds the JSON the page last set per key. `persist` writes only when the value differs from it, so a value the page set is not saved as the person's act (`useListPage.ts:103-105`, `:239-245`).
  - `stateQuery` writes `_sort` only when the sort differs from the resolved sort (`useListPage.ts:222`), using `sameSort` (`defaults.ts:39-41`).
  - Nothing compares the filters with a base, because nothing stores filters.
- **Today's sort has two homes.** A person's sort change goes to the URL and is also saved to their plain-view row (`useListPage.ts:209`, `:232`). Ruling 9 sends a filter or sort change into the query only.
- **Columns write at once.** A column change is saved to the person's row 500 ms later (`useListSettings.ts:13`, `:74-78`). Nothing holds an unsaved column change.

## 2. The routes

Flat prefix (`frontend/src/router/generated.ts:14-37`). The modular table has the same names with a `/:module` segment first (`generated.ts:39-66`).

| Path | Name | Renders | Source |
| --- | --- | --- | --- |
| `/:doctype` | `list` | `standardPage("main")`, which is `MainPage`. `mainPageFor` picks the app's replacement list page for `boot.app`, else the standard `List.vue`. | `generated.ts:20`; `frontend/src/pages/standardPages.ts:9-10`; `frontend/src/router/mainPage.ts:18-27` |
| `/:doctype/view/list` | `standard-list` | Always the standard `List.vue` | `generated.ts:23`, `:74-76` |
| `/:doctype/view/list/:viewName` | `saved-view` | Always the standard `List.vue`, with `view` from `viewName` | `generated.ts:26`; `frontend/src/pages/List.vue:6`, `:21` |
| `/:doctype/new` | `new-record` | The standard new record page | `generated.ts:29` |
| `/:doctype/:name` | `record` | `MainPage` | `generated.ts:32` |

- **A replacement page never sees a view address.** `mainPageFor` answers only the `list` and `record` routes (`mainPage.ts:21`). A replacement list page gets the props `{ doctype }` and no view (`mainPage.ts:25`). On this bench, CRM replaces Note's list in the `crm` app (`crm:crm/fcrm/custom/note/pages.json`), and ERPNext replaces it in `erpnext` (`erpnext:erpnext/setup/custom/note/pages.json`). So `/apps/crm/note/view/list/<x>` opens the standard list, not CRM's page.
- **`viewName` is the `Doctype View` row's `name`**, a random hash (`doctype_view.json` `autoname: hash`). The favourite chip spells `…/view/list/<name>` (`frappe/shell/index_favourites.py:111`). The star toggles `Doctype View` `<name>` (`useListSettings.ts:213-214`).
- **Remounts.** `loadedPage` returns one component per loader (`mainPage.ts:15`, `:30-37`). So `standard-list` and `saved-view` render the same component, and `List.vue` keys `DoctypeList` on the doctype only (`List.vue:6`). Read from the code, not walked: a switch from one saved view to another of the same doctype keeps the same `DoctypeList` and its `useListPage` state, and only `props.view` changes. `list` renders through `MainPage`, so a move between `list` and `saved-view` goes through another component tree.
- **A single** redirects every non-record route to its record, and the `viewName` is dropped (`frontend/src/router/index.ts:58-65`).
- **Recent and the palette's places** do not hold a saved view. `parse_visit` keeps an address of 1 or 2 segments after the prefix (and after the module) only (`frappe/shell/route_history.py:46-50`). A `…/view/list/<name>` visit is 4 segments, so it is dropped.
- The palette treats `saved-view` as a page of its doctype (`frontend/src/shell/paletteRecords.ts:24`, `:138-143`). Its "Find … in <doctype>" row opens the plain list with a filter, not the current view (`paletteRecords.ts:145-150`).

### The code that builds view links

- `routeFor(doctype, null, { view })` returns `{ name: "saved-view", params: { …, viewName } }` (`frontend/src/router/routeFor.ts:30-31`, `:66-72`). The `standard` option does not apply to a view (`routeFor.ts:66-72`, `:106-109`). `urlFor` spells the same address as an href (`routeFor.ts:133-139`).
- No caller in `frontend/src` passes `view` to `routeFor`. The only builders of a view address are the server's favourite chip (`index_favourites.py:111`) and the route table.
- **`?view=` on a record** is named in a comment (`generated.ts:31`) and kept out of the list's filters (`query.ts:18`). Nothing writes it and nothing reads it. `rowLink` is `routeFor(doctype, row.name)`, with no query (`useListPage.ts:330`).
- `frappe/frappe#43494` (open, map #43484) moves `routeFor` and the item contract to desk services. No line of it changes the view route.

## 3. The return-visit cache (map #43276)

Map #43276 is closed. Its build for lists is `dc284361dd` (#43358, "List and saved view paint a return visit from the cache").

| Memory | Key | Source |
| --- | --- | --- |
| Shared data cache, list entry | `doctype` + `{ fields, filters, order_by }` (also `or_filters`, `group_by` when given). 20 lists, least recently used out. | `ui/src/cache/listKey.ts:4-14`; `ui/src/cache/dataCache.ts:26` |
| Rows memory (session) | `doctype` → `{ query, pageSize, scrollTop }`, where `query` is the filters-and-sort string. One entry per doctype. | `pageState.ts:19-41`; `useListPage.ts:226-228`, `:266-274` |
| History entry | `history.state.list = { pageSize, scrollTop }` | `pageState.ts:10-17` |
| List settings memo | `doctype`. Marked stale on `doctype_update`. | `useListSettings.ts:66`, `:117-123` |

- **No key holds a view name.** The plain list and every saved view of one doctype share these keys.
- `fields` comes from the columns (`defaults.ts:44-46`; `useListPage.ts:251`). Two views with the same columns, filters and sort read one cache entry. Two views that differ in columns have two entries.
- **A view switch** changes the query when the filters, sort or columns differ. The data cache then holds a separate entry per query. The rows memory keeps only one query per doctype: a new query replaces it (`pageState.ts:28-31`), so the scroll offset of the view left behind is lost. The history entry's scroll resets to the top on a new query (`useListPage.ts:259-263`).
- **A modified view** (ruling 9) is a different filters-and-sort string, so it has its own cache entry. A Back to the unmodified address reads the earlier entry when it is still among the 20.
- The scroll lands from the history entry first, then from the rows memory (`frontend/src/list/useScrollMemory.ts:38-39`).

## 4. The seams for a second view type

### What a Kanban page could reuse as it is

| Part | Where | Note |
| --- | --- | --- |
| Rows for one query | `useListRows(doctype, query)` (`frontend/src/list/useListRows.ts:77`) | Takes a query getter: key, fields, filters dict, order, limit. It paints from the shared cache and refetches quietly (`useListRows.ts:136-176`). One instance per Kanban column would work as it is. |
| The address | `queryFromAddress`, `addressFromQuery`, `ownedKeys` (`query.ts:28-66`) | Doctype-generic. |
| Stored-settings converters | `columnsFrom`, `sortFrom`, `quickFilterFieldsFrom` (`storedSettings.ts:26-75`) | Doctype-generic. The `ListSettings` type is List-shaped. |
| Meta and permissions | `useDoctypeMeta`, `useDocPermissions` | Called inside `useListPage.ts:88-89`. |
| The favourite star | `list_favourites` returns every starred `Doctype View` of the doctype, of any type (`frappe/desk/doctype/favourite/favourite.py:160-179`). `FavouriteStar.vue` and `favouriteWording` are shared with the record header. | The client side rides the List settings read (`useListSettings.ts:169-173`). |
| Create | `openCreate(doctype, { values })` (`frontend/src/shell/create.ts:42`) | The values come from the equality filters (`query.ts:82-87`; `useListPage.ts:331`). Map #44894 is closed. |
| The frame and page states | `PageFrame`, `failedState`, `PageState` | Shell-level (`DoctypeList.vue:116-118`). |

### What is fused into `DoctypeList.vue` and `useListPage.ts`

- **The header** (crumbs, star, Create) is inline template (`DoctypeList.vue:7-26`). The crumbs are `[{ label: doctype }]`, with no view label (`DoctypeList.vue:127`).
- **The controls row** (QuickFilter, Filter, SortBy, ColumnSettings, `⋯`) is inline template (`DoctypeList.vue:28-54`).
- **The create flow** and its toast are page code (`DoctypeList.vue:164-180`).
- **The acts.** `useListActs` registers one surface named `list` with `create`, `favourite`, `customize_quick_filter` and `delete` (`frontend/src/pages/list/listActs.ts:41-42`, `:57-99`). The surface name is fixed, so a second page that registers it also answers to `list.*`.
- **`useListPage` joins two things.** One is state and the address: filters, sort, settings tiers, URL sync. The other is the table: columns, `fetchFields(columns)`, rows, selection, delete (`useListPage.ts:247-256`, `:276-295`). The rows query reads its `fields` from the columns.
- **The view type is a constant** on both sides: `VIEW_TYPE = "List"` (`useListSettings.ts:11`) and `VIEW_TYPES = ("List",)` (`doctype_view.py:154`).

### The unused `ListView` module in `ui`

- `ui/src/components/ListView` exports `ListViewShell`, `useListView` and `useListData` (`ui/src/components/ListView/index.ts:6-11`). Nothing in `frontend/src` imports them. The list page uses `@framework/ui/experimental/List` instead (`DoctypeList.vue:102`).
- `useListView` has a `ListViewSnapshot` of filters, sort, columns, quick filter fields **and `groupBy`**, with `snapshot` and `restore` (`ui/src/components/ListView/useListView.ts:31-42`, `:90-125`). Its comment names "a named saved view" as a use (`useListView.ts:19-30`).
- `ui/CONTEXT.md:69-76` ("View Snapshot") says the library never owns a saved View.

## 5. `ui/src/components/GroupBy`

- **What it is.** "Desk's report view group by": one summary row per distinct value combination, with aggregates (`ui/CONTEXT.md:35-44`). The glossary avoids "group by view", which is CRM's name for records under group headings (`ui/CONTEXT.md:39`).
- **CRM's group by is the other thing.** CRM's `group_by` view type returns the records and the group field's options (`crm:crm/api/doc.py:492-535`). It draws each group's records under a heading (`crm:frontend/src/components/ListViews/ListRows.vue:1-30`).
- **The model.** `GroupBySettings = { fields, aggregates, widths?, sort?, showTotals? }`, and `null` means ungrouped (`ui/src/components/GroupBy/types.ts:21-31`). `parseGroupBy` reads stored JSON back, and drops anything malformed (`ui/src/components/GroupBy/groupBy.ts:293-328`).
- **Props.** `GroupBy`: `doctype`, `hideLabel`, `align`, `exclude`, with the settings as `v-model` (`types.ts:43-53`). `GroupByTable`: `doctype`, `groupBy`, `rows`, `totals`, `loading`, `rowHeight` (`types.ts:56-66`).
- **Reads.** `useGroupByData(doctype, groupBy, filters)` sends up to three `listAggregates` reads (`ui/src/components/GroupBy/useGroupByData.ts:56-119`):
  - the groups, one page at a time;
  - the group keys alone, up to 1,000, to count the groups;
  - the totals, only with `showTotals`.
  
  Each read aborts the one before it (`useGroupByData.ts:152-180`).
- **No cache.** The shared cache does not take a `group_by` read (`ui/src/cache/listKey.ts:16-20`). `useGroupByData` starts empty on each mount (`useGroupByData.ts:159`).
- **What it would need to run as the List type's `group_by` key** (facts on the gap only):
  - `ListSettings` has no `group_by` key (`storedSettings.ts:15-19`).
  - Nothing in `frontend/src` imports `GroupBy` (grep).
  - `useListPage` sends filters as a dict that keeps one condition per field (`useListPage.ts:336-343`). `useGroupByData` takes a dict or wire filters.
  - `GroupBySettings.sort` is the group table's own sort, apart from the list's `_sort`.
  - The footer's props map one to one: `rowCount`, `totalCount`, `totalCapped`, `hasCounts`, `hasNextPage`, `pageLength` (`useGroupByData.ts:21-46`).
  - A grouped list has no row link, no selection and no delete, because its rows are not documents.

## 6. The page model map's open list work

Open sub-issues of [#43265](https://github.com/frappe/frappe/issues/43265), read on 2026-10-30: #43581, #43710, #45057, #45423, #45424, #45446, #45447, #45448, #45588. These touch the list page or a view:

| Ticket | What it changes under a view |
| --- | --- |
| [#45423](https://github.com/frappe/frappe/issues/45423), the declarative record type | A new DocType. A row is one DocType, one page (`record`, `list` or an app page name) and one tier, and holds ops keyed by list name. App tier as files, site and user as rows. Merge: app record, app script, site record, site script, user record. Built on the record page first. "The list page reads the same record type when its engine lands." `Doctype View` does not change. A row is keyed by page `list`, not by a view, so it has no per-view tier. |
| [#45448](https://github.com/frappe/frappe/issues/45448), a person's removed columns against scripts | The `columns` built-ins come from the app default and the site row only. When the user row has `columns`, each built-in it leaves out folds as `hide` after the scripts, and its order folds as one `order`. A script's column shows after the person's. `Doctype View` does not change. It needs the list page's lists and scripts, which are not built (`DoctypeList.vue` has no engine). It reads the plain view's user row only. |
| [#43710](https://github.com/frappe/frappe/issues/43710), list settings stale marking | Moves `useListSettings`' own stale flag onto `memoizedState` (`ui/src/utils/sharedState.ts`), or records why it cannot. It may move to map #43484. It touches the file a named-view read would change (`useListSettings.ts:117-156`). |
| [#45057](https://github.com/frappe/frappe/issues/45057), one Quick Entry form part | The Create dialog's form (`frontend/src/pages/create/CreateDialog.vue`) becomes one part with `page.dialog.form`. The list's Create calls it. |
| [#45447](https://github.com/frappe/frappe/issues/45447), Form Layout rows as files | The Create dialog's layout gets an app-file tier. Not view-specific. |
| [#45446](https://github.com/frappe/frappe/issues/45446), an op that names a missing item | Applies to site and user records of #45423, so also to list records later. Blocked by #45423. |

The rest (#43581, #45424, #45588) are record page only.

**Rulings already closed on #43265 that shape a Kanban page** (read from the map body and the resolution comments):

- [#43267](https://github.com/frappe/frappe/issues/43267): the list page has seven lists: `frame`, `header`, `body` (`list`), `controls`, `columns`, `bulkActions` and `rowActions`. `page` adds `rows`, `filters`, `sort`, `selection` and `reload()`. There is one engine and one base `page` type for both pages. It names no view and no view type.
- [#43268](https://github.com/frappe/frappe/issues/43268) ([comment](https://github.com/frappe/frappe/issues/43268#issuecomment-6412864466)): Client Scripts on the list page use the view `List Page`, with `onRefresh` and `onOpen`. A replay runs only on a cold load, a return visit, `page.refresh()` and a script change. A filter or sort change only changes `page.rows`. The list's first paint waits for its scripts. It does not say whether a view switch is a replay.
- [#45415](https://github.com/frappe/frappe/issues/45415) and [#45417](https://github.com/frappe/frappe/issues/45417) (merged): an app page builds on `createPageEngine`. It runs its app's handler file, then `App Page` Client Scripts by doctype and page name (`frontend/SCRIPTING.md:12-49`).
- The map's "Not yet specified" still holds the list page's engine, its paint gate and its replay triggers. No build ticket for the list page's engine exists yet (searched 2026-10-30).

## 7. The rail and sidebar item model

### How a type is declared and contributed

- **Two files per type.** One is a `Navigation Item Type` record at `<module>/navigation_item_type/<scrubbed>/<scrubbed>.json`. The other is a renderer at `…/frontend/item.js` (`frappe/shell/manifest.py:68`; `frontend/src/navigation/registry.ts:33-35`).
- **The record's fields:** `type_name`, `module`, `target_doctype` and `permission_rule`. The rule is one of `Readable DocType`, `Module Contents`, `Derived From Children`, `Permitted Page`, `Always Visible` or `Custom` (`frappe/desk/doctype/navigation_item_type/navigation_item_type.py:23-33`). Rows are code-owned, so a write is refused outside developer mode or a system write (`navigation_item_type.py:36-53`).
- **The renderer** default-exports `{ render(item, context), label?, icon? }`. `render` returns `{ to }`, `{ href }`, `{ group: true }`, `{ expand }` or `null` (`frontend/src/navigation/types.ts:13-18`, `:51-56`). It gets `boot`, `addresses`, `router`, `sidebars`, `items`, `pages`, `contentsOf` and `renderingOf` (`types.ts:23-45`). The first app in site order wins a type, and a clash is logged (`frontend/src/contributions/registry.ts:152-168`).
- **The permission filter** runs on the server, on the merged list, before boot (`frappe/shell/navigation_filter.py:23-56`). `Custom` hands every item of the type, in one batch, to the `can_see` that the app names in the `navigation_item_resolvers` hook. When there is none, the items are dropped (`navigation_filter.py:80-99`, `:234-256`).
- **An app-added precedent.** ERPNext ships `Default Company`, a `Custom` type with a resolver (`erpnext:erpnext/hooks.py:31-33`; `erpnext:erpnext/setup/navigation_item_type/default_company/`).
- **A `Navigation Item` row** holds `key`, `parent_key`, `item_type`, `link_doctype`, `link_to`, `url`, a JSON `payload`, `label`, `icon`, `collapsible`, `keep_closed`, `hidden`, `added`, `overrides`, `anchors` and `switches_app` (`navigation_item.json`; `frappe/shell/navigation.py:17-34`). The `Record` type already addresses one document by `link_doctype` + `link_to` (`frappe/desk/navigation_item_type/record/frontend/item.js:12-14`). That is the same pair a `View` row would use for `Doctype View` + `<name>`.
- On `desk.localhost` there are 9 types: `DocType`, `Link`, `Module`, `Module Contents`, `Page`, `Record`, `Section`, `Sidebar` (frappe) and `Default Company` (ERPNext). There is no `View` type.

### What a derived row is

There are two kinds today:

1. **`Module Contents` rows.** The renderer returns `{ expand }`. That fetches the module's doctypes on demand (`frappe.shell.doctypes.get_contents`, `frontend/src/contents.ts:11-18`), drops those already on the list, and returns rows that are not stored. Their key is `<item.key>:<doctype>` (`frappe/desk/navigation_item_type/module_contents/frontend/item.js:20-48`). The comment says it is the one kind that may cost a request, because "expanding a list is not navigating" (`item.js:8-11`). Its rule is `Derived From Children`, which drops it when it holds nothing (`navigation_filter.py:102-126`).
2. **A derived rail.** An app that ships no `Rail` record gets one row per readable doctype it owns. The key is the doctype name (`frappe/shell/navigation.py:478-493`).

`boot.navigation` is not cached (`frontend/ARCHITECTURE.md:571`).

### How the per-user overlay writes

- **The way in.** The shell opens `#customize/rail` or `#customize/sidebar/<address>` (`frontend/src/shell/AppShell.vue:30`, `:256-260`). The dialog reorders, hides and renames, and writes only on Save (`frontend/src/shell/CustomizeSidebarDialog.vue:1-4`).
- **The save.** `save_arrangement(container, address, items, scope)` gets the whole ordered list. It reduces the list to deltas against the layer below and writes one `Rail` or `Sidebar` layer row per scope (`frappe/shell/arrangement.py:44-68`, `:341-357`). A delta holds `key`, `hidden`, `overrides` of `label`, `icon`, `collapsible` and `keep_closed`, and `anchors` (`arrangement.py:32`, `:236-255`).
- **The save cannot add a row.** `_known` keeps only keys that the layer below already holds (`arrangement.py:222-233`). The merge honours a layer row with `added = 1` as a whole new item (`navigation.py:235-248`), but only patches write such rows (`frappe/patches/v16_0/sidebar_archive.py:292`, `frappe/patches/v16_0/remove_modules_made_from_generated_sidebars.py:125`). Ruling 12 says a person adds a `View` row "through the existing sidebar overlay". The overlay has no add path today.
- **The current row** is matched by path-segment coverage (`frontend/src/navigation/current.ts:30-43`). A `…/view/list/<name>` row covers 4 segments, so it wins over its doctype row (1 segment) on its own address.

## Data on `desk.localhost` (read 2026-10-30)

- `Doctype View`: 2 rows. Both are user plain views of type `List`: `Client Script` `{"sort":[]}` and `CRM Lead` columns. There is no site row and no labelled row.
- `Favourite`: 6 rows (CRM Deal 1, CRM Organization 1, DocType 2, Field Coverage 1, ToDo 1). None is a `Doctype View`.
- `Client Script`: 42 rows, all `view = Record`. There is no `List Page` or `App Page` row.
- `Kanban Board`: 0 rows. `CRM View Settings`: 0 rows.

## Points for the map

- **Ruling 12** assumes the existing sidebar overlay can add a `View` row. `save_arrangement` drops every key that is not in the layer below (`arrangement.py:222-233`). So the overlay needs an add path, or ruling 12 needs another way in.
- **Ruling 13** names `ui/src/components/GroupBy` for the List type's `group_by`. That component draws report-view summary rows (one per group, with aggregates). CRM's group by draws the records under group headings (`crm:crm/api/doc.py:492-535`). The two are different features.
- A saved view always opens the standard list page (`generated.ts:26`). An app's replacement list page never gets a view (`mainPage.ts:21-25`).
