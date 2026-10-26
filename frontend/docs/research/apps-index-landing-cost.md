# Can the index boot tell which apps have nothing to land on?

Research for [#45252](https://github.com/frappe/frappe/issues/45252), a child of the map [#45250](https://github.com/frappe/frappe/issues/45250) (rulings 4, 6 and 10).

## Answer

Do not resolve navigation for every prefix on the index boot. Instead, hide a tile with a cheaper check:

- An app that has no `Rail` row at any layer has a derived rail. Hide its tile when the user reads none of its addressable doctypes. This check is exact.
- An app with an authored rail always keeps its tile. When nothing in it resolves, the shell shows the empty state.

On `desk.localhost`, the cheap check costs 5 queries and 5 ms warm for a user with one role. Full resolution costs 45 queries and 54 ms. The index boot costs 2 queries and 2.4 ms today. The cheap check gave the same answer as full resolution for 36 of 36 user and app pairs.

## Setup

| What | Value |
| --- | --- |
| frappe | `upstream/desk-v2` at `78da6b2663592337d2733b5e6b0f58dcbefc446a`, imported from the worktree |
| erpnext | `desk-v2` at `d8aeb8b0ed1929c44534c1c4aea7e9a64ddb0d22` |
| crm | `desk-v2` at `70d47a297308b3ce74e6e63bf7216bd618dfdf15` |
| gameplan | `develop` at `c643ae8f730e0f25478dad479f92ddf3d0a68cb3` |
| Site | `desk.localhost`. The registry is `{desk: frappe, erpnext: erpnext, crm: crm, gameplan: gameplan}`. |
| Users | `Administrator` (59 roles) and `john.demo@example.com` (one role, Sales User) for timings. Seven more existing System Users for the agreement check. No user was created. |

The measurement script ran in one process against the live site. It was read-only:

- `frappe.db.sql` was wrapped to count queries.
- Redis `set_value`, `hset` and `set` and `client_cache.set_value` were no-ops. `frappe.log_error` was recorded, not inserted. No errors were recorded.
- The transaction was rolled back at the end.

Each number is the median of 15 runs. Other sessions loaded the machine, so single runs varied by up to 2x. Each run starts like a new request: `frappe.local.cache`, `role_permissions` and `request_cache` are empty.

There are three cache states. No shared key was cleared, so other sessions were not affected:

- **warm**: Redis and the in-process client cache hold every key.
- **cold, user**: reads of keys for this user (`roles`, `user_permissions`, `defaults::<user>`) miss.
- **cold, all**: every Redis and client-cache read misses, as after `bench clear-cache`. A value written during the run goes to an in-memory dict for that run only, so a key is built once per run, as in a real request.

The landing rule ran as a Python copy of each kind's `item.js` (listed below). It was not checked in a browser.

## What the index boot does today

`index_boot` (`frappe/shell/boot.py:73-99`) lists the registered prefixes that pass `has_app_permission`. Then it adds the title and logo from `add_to_apps_screen`. It resolves no navigation. A prefix boot calls `resolve_navigation(app)` for its own app only (`frappe/shell/boot.py:170`).

`resolve_navigation` (`frappe/shell/navigation.py:59-69`) builds one `NavigationContext` and resolves the sidebars, then the rail. It reads these rows with `frappe.get_all` on every call:

- `Rail` layers and their `Navigation Item` rows (`navigation.py:366-387`)
- `Rail` rows that extend this app (`navigation.py:390-407`)
- `Sidebar` addresses, layers and rows (`navigation.py:416-455`)
- every `Navigation Item Type` (`navigation_filter.py:260-268`)
- every `Module Def`, for the blocked modules (`navigation_filter.py:196-203`)
- the readable doctypes, from `DocPerm`, `Custom DocPerm` and `DocShare` (`frappe/shell/doctypes.py:146-155`)

An app with no `Rail` row gets a derived rail (`navigation.py:478-492`). The derived rail is the doctypes the app owns that are addressable and readable.

## Cost of resolving every prefix

"Full" calls `resolve_navigation` for each permitted prefix, then runs the landing rule. "Shared context" is the same, but it reads the readable doctypes, blocked modules and item types once for all prefixes.

Warm, median of 15 runs:

| User | Index boot today | Full | Shared context | Cheap check |
| --- | --- | --- | --- | --- |
| Administrator | 3.4 ms, 1 query | 69.3 ms, 31 queries | 101.9 ms, 32 queries | 30.8 ms, 5 queries |
| john.demo | 2.4 ms, 2 queries | 53.5 ms, 45 queries | 42.1 ms, 35 queries | 5.0 ms, 5 queries |

Cold, user keys missed:

| User | Index boot today | Full | Shared context | Cheap check |
| --- | --- | --- | --- | --- |
| Administrator | 8.9 ms, 10 queries | 79.3 ms, 40 queries | 103.5 ms, 41 queries | 24.7 ms, 6 queries |
| john.demo | 7.0 ms, 17 queries | 60.6 ms, 60 queries | 55.2 ms, 50 queries | 13.7 ms, 13 queries |

Cold, all keys missed:

| User | Index boot today | Full | Shared context | Cheap check |
| --- | --- | --- | --- | --- |
| Administrator | 106.8 ms, 163 queries | 266.7 ms, 261 queries | 259.4 ms, 262 queries | 98.5 ms, 96 queries |
| john.demo | 98.7 ms, 156 queries | 238.6 ms, 310 queries | 250.8 ms, 300 queries | 133.7 ms, 179 queries |

The three right columns are the added cost. They do not include the index boot itself.

One warm `resolve_navigation`, per app:

| App | Administrator | john.demo |
| --- | --- | --- |
| frappe (derived rail) | 27.1 ms, 8 queries | 16.3 ms, 12 queries |
| erpnext (18 sidebars) | 10.9 ms, 8 queries | 19.1 ms, 16 queries |
| crm (4 sidebars) | 5.6 ms, 7 queries | 11.5 ms, 11 queries |
| gameplan (derived rail) | 26.1 ms, 8 queries | 8.7 ms, 7 queries |

These points follow from the tables:

- Full resolution makes the warm index boot about 20 times slower for both users. The cost grows with each installed app, because each prefix pays 7 to 16 queries.
- A shared context saves about 10 queries for a user with few roles. It saves no time, and for Administrator it was slower in these runs. It is not a different order of cost.
- The Administrator cheap check is slower than john's because `get_doctypes_with_read` reads every `DocPerm` row (`fields=["*"]`) for 59 roles (`frappe/permissions.py:508-532`).
- An earlier run of the same script gave john 42.3 ms and 51 queries for "full". The ratios did not change.

## Caches and invalidation

Navigation has no cache of its own. `NavigationContext` keeps its sets for one resolution only (`navigation_filter.py:148-149`). The `Rail`, `Sidebar`, `Navigation Item` and `Navigation Item Type` rows are read again on each boot.

The inputs that are cached, as read in a warm run:

| Key | Store | Invalidated by |
| --- | --- | --- |
| `shell_prefix_registry` | client cache (`registry.py:13`, `46-47`) | the `after_app_install` hook (`frappe/hooks.py:42`), and `frappe.clear_cache()` |
| `shell_address_table_v2` | client cache, versioned on `metadata_version` (`doctypes.py:112-122`) | any change that resets `metadata_version`: a DocType change or `clear_cache` (`frappe/cache_manager.py:340-344`) |
| `shell_doctype_owners` | client cache, versioned on `metadata_version` (`doctypes.py:37-49`) | the same |
| `roles` (hash, one field per user) | Redis (`frappe/permissions.py:575`) | a role change on the user, through `clear_user_cache` |
| `user_permissions` (hash, one field per user) | Redis | a User Permission change |
| `defaults::__default`, `defaults::<user>` | client cache | a change to defaults. Read by ERPNext's `Default Company` kind. |
| `doctype_meta::*`, `table_columns::*` | client cache | a DocType change |

`has_role:Page` is a per-user key that is written, but not read. `permitted_pages` calls `DeskViews.get_allowed_pages(cache=False)`, which rebuilds the value and writes it on each call (`navigation_filter.py:219-224`, `frappe/desk/desk_views.py:146-171`). This happens only for a non-Administrator user with a `Page` item. No shipped rail or sidebar on this bench has one.

## What the server cannot decide

A row is a landing when its rendering is `{ to }` (`frontend/src/navigation/types.ts:13-17`, `frontend/src/navigation/current.ts:58`). The browser decides each rendering through `renderingOf` (`frontend/src/navigation/registry.ts:23`). The server can copy most kinds, because they read data the server holds:

| Kind | `item.js` | Rendering | Can the server copy it? |
| --- | --- | --- | --- |
| DocType | `doctype/frontend/item.js:17-19` | `to`, or `null` when `routeFor` throws (no address, or no module under a modular prefix) | Yes, from the address table |
| Record | `record/frontend/item.js:12-14` | the same, on `link_doctype` | Yes |
| Module | `module/frontend/item.js:19-24` | `to` on a modular prefix with a known module slug | Yes |
| Section | `section/frontend/item.js:13-15` | `group`, never a landing | Yes |
| Link | `link/frontend/item.js:12-14` | `href`, never a landing | Yes |
| Module Contents | `module_contents/frontend/item.js:20-47` | `expand`, never a landing | Yes. Also, the server drops it first (see the side finding). |
| Sidebar | `sidebar/frontend/item.js:25-52` | the first `to` or `href` row in its sidebar | Yes, when its rows can be copied |
| Page | `page/frontend/item.js:18-21` | `to` only when the bundle serves the page slug in this prefix (`frontend/src/navigation/context.ts:26`) | **No.** The page list comes from the build and from `router.hasRoute`. The server can only guess from the file globs. |
| Default Company (ERPNext) | `erpnext/setup/navigation_item_type/default_company/frontend/item.js` | `to` the default company | Only because ERPNext also ships `can_see` (`default_company.py:29`). Any contributed kind is opaque to the server. |

So two kinds resolve only in the browser: `Page` and any kind an app contributes.

`Sidebar` has one trap. Its renderer returns the first row that is `to` *or* `href`. When the first row is a `Link`, the rail item renders as `href`, so the landing rule skips the whole sidebar. This is true even when a later row in it is a `to`.

**No shipped rail starts with a browser-only kind.** None of the four rails contains one:

- frappe and Gameplan ship no `Rail`. Their derived rails hold `DocType` items only.
- ERPNext's rail is 18 `Sidebar` items and 2 `Module` items (`erpnext/rail/erpnext/erpnext.json`). Its first item, `accounts`, opens with a `Section` and then `DocType Account`.
- CRM's rail is 4 `Sidebar` items and 2 `DocType` items (`crm/rail/crm/crm.json`). Its first item, `leads`, opens with `DocType CRM Lead`.
- The 22 shipped sidebars hold 287 `DocType` rows, 46 `Section` rows and one `Default Company` row (`module_def_setup.json:250`). They hold no `Page`, `Link`, `Record` or `Module Contents` row. No app on this bench ships a contributed page.

On this bench, "the filtered rail is not empty" and "the rail has a landing" gave the same answer for all 36 pairs.

## A cheaper check

**The check.** An app has a derived rail when it has no `Rail` row as standard, as the site layer, as this user's layer, or as an extension of it. Its rail is then exactly the doctypes it owns that are addressable and readable. On a modular prefix, each doctype must also have a module slug. Each of those `DocType` items renders `to`. So "this set is empty" is exact for such an app. The check reads the readable doctypes once for all apps, the cached owners and address table, and one `Rail` query.

An app with any `Rail` row keeps its tile. The check never hides a tile that has a landing. It can only show a tile that leads to the empty state.

**The check to avoid: "the user reads a doctype this app owns"** (`contents_for_app`, `doctypes.py:158`). It hides tiles that have a landing. CRM's `contacts` sidebar opens frappe's `Contact`, so a user who reads `Contact` but no CRM doctype lands in CRM.

Agreement over nine existing users and four apps (one run each):

| User | Gameplan (full / cheap / contents) | CRM (full / cheap / contents) | frappe, ERPNext |
| --- | --- | --- | --- |
| Administrator | land / land / land | land / land / land | land |
| shariq@frappe.io | land / land / land | land / land / land | land |
| test_link_validation | land / land / land | land / land / land | land |
| test-sidebar-sysmanager | land / land / land | land / land / land | land |
| john.demo | none / none / none | land / land / land | land |
| emily.demo | none / none / none | land / land / land | land |
| sarah.demo | none / none / none | land / land / land | land |
| link.create | none / none / none | land / land / **none** | land |
| test_single_virtual_fields | none / none / none | land / land / **none** | land |

The case ruling 6 targets is real on this bench. Five of nine users have nothing to land on in Gameplan. Gameplan declares no `app_prefix`, so it gets the default prefix `gameplan` and a derived rail of its doctypes. These five users read none of them. The cheap check finds all five.

## Boot size

The `apps` key of the index boot is 494 B. The whole index boot is 5.2 to 6.1 KB.

- **Hide on the server.** The answer is a smaller `apps` list, or one boolean per tile (about 14 B each). This is far below `KEY_BUDGET` (100,000 B, `boot.py:17`).
- **Send every prefix's navigation so the browser decides.** This is not possible. For Administrator, the four navigation payloads are 77,611 B: frappe 23,523, ERPNext 48,724, CRM 3,032 and Gameplan 2,332. In one key, that is 78% of the budget with four apps. For john.demo it is 24,381 B. One more large app puts Administrator over the budget.

## Recommendation

**Hide with the cheaper check.**

1. In `index_boot`, read the readable doctypes once, and read the apps that have a `Rail` row for this user or the site.
2. Leave out the tile of an app with no `Rail` row whose derived rail is empty.
3. Keep every other tile. A pasted or stale address gets the empty state from ruling 6.

To prevent drift, the check and `_derive_rail` should call one function. The check copies the derived rail's inputs, and the two must stay the same.

Do not hide on the server with full resolution. It adds 31 to 45 queries and 50 to 70 ms warm to each `/apps` load, with no cache, and the cost grows with each app. Also, it still cannot judge `Page` items or contributed kinds without a copy of each `item.js`.

Ruling 6 says "the server can tell from navigation it already resolves". The index resolves no navigation now, so the ruling read literally means "never hide". The cheap check does not resolve navigation. It reads the inputs of the derived rail. The map should decide if this reading is acceptable. If not, the choice is "never hide and rely on the empty state". This leaves Gameplan's tile in place for five of nine users on this bench.

## Side finding: `Module Contents` rows never reach the browser

`Module Contents` declares the `Derived From Children` rule (`frappe/desk/navigation_item_type/module_contents/module_contents.json`). The filter leaves such an item undecided (`navigation_filter.py:40-42`). Then `_holds_something` keeps it only if it has child rows, or if its target is `Sidebar` (`navigation_filter.py:127-142`). A `Module Contents` row has neither, so the cascade always drops it. An in-memory test confirmed this: a `Module Contents` row for `Accounts` and a `DocType ToDo` row went through `filter_items`, and only `ToDo` came back, for Administrator and for john.demo. No shipped row uses the kind, so nothing on this bench changes. The renderer's `expand` path is unreachable until the kind gets its own rule.
