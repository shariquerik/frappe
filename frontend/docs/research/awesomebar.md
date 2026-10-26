# Desk v1's awesomebar: what it finds, at what cost, and what fits `/api/v2`

Research for [Research: what desk v1's awesomebar finds, at what cost, and what fits /api/v2](https://github.com/frappe/frappe/issues/45259), a child of [Desk v2 — the command palette](https://github.com/frappe/frappe/issues/45257). This note gives facts only. It makes no recommendation.

## Sources

| Source | Version |
| --- | --- |
| `frappe` | `desk-v2` at `c3eb3c40e7` |
| `erpnext` | `desk-v2` at `d8aeb8b0ed` |
| `crm` | `desk-v2` at `70d47a2973` |
| `gameplan` | `develop` at `c643ae8f73` |
| Site | `desk.localhost`, MariaDB 11.8.6, apps `frappe`, `erpnext`, `crm`, `gameplan` |

All measurements are in-process Python on the bench (`frappe.connect()`, no HTTP). Each "warm" figure is the median of 7 calls after one "cold" call. The site wrote nothing to its database.

The site has little data: 3 Customers, 10 Items, 5 Sales Invoices, 32 Contacts, 13 CRM Leads, 55 ToDos, and 2,264 rows in `__global_search`. The timings are a lower limit, not a forecast for a production site.

Two users were measured:

- `Administrator` (all roles): reads 576 doctypes.
- `emily.demo@example.com` (System User, role Sales User only): reads 145 doctypes.

HTTP timings were not taken. The local API key returned 401, and a new key writes to the database.

## 1. What v1 lists for a typed query

### How the list is built

The modal input runs `get_options(txt)` after a 50 ms debounce (`frappe/public/js/frappe/ui/toolbar/awesome_bar.js:175`, `:233`). The text has its spaces squeezed first.

- With fewer than 2 characters, it lists recent pages, then frequent links.
- With 2 or more characters, it lists the defaults, then `build_options(txt)`, then (late) the hook results.
- With a space in the text, it also lists rows whose `type` starts with the last word ("Customer list" keeps only the List row). This is `set_specifics`.
- Text that starts with `#` replaces the built options with tag rows.

All rows except hook rows come from boot data in the browser. No request runs for them.

| Kind | Code | Source data | Index (rank) | Selecting it |
| --- | --- | --- | --- | --- |
| "Search for {txt}" | `make_global_search`, `awesome_bar.js:391` | none | 100 | Opens the Global Search dialog |
| "Find {txt} in {current list}" | `make_search_in_current`, `:440` | current route | 90 | Filters the open list on the title field, `like %txt%` |
| Calculator | `make_calculator`, `:467` | none | 80 | `msgprint` of the result |
| "Generate Random Password" | `make_random`, `:509` | none | none | `msgprint` of a random string |
| "New {doctype}" (text starts with "new") | `get_creatables`, `search_utils.js:167` | `boot.user.can_create` | 1 + fuzzy score | `frappe.new_doc` |
| "Find {a} in {doctype}" (text has " in ") | `get_search_in_list`, `:140` | `can_read` ∩ `can_search` | 1 + fuzzy score | List with `name like %a%` |
| Doctype: List or Tree, Report, New | `get_doctypes`, `:192` | `can_read`, `can_search`, `can_create`, `single_types`, `tree_view_doctypes` | score + 0.05, + 0.04, + 0.015 | List, Tree, Report view, or new form. A single opens its form. |
| DocType Layout | `get_doctype_layouts`, `:258` | `boot.doctype_layouts` | score | Filtered list with the layout |
| Report | `get_reports`, `:289` | `boot.allowed_reports` | score | Query report or Report Builder |
| Page | `get_pages`, `:313` | `boot.page_info` (not system pages), plus fixed Calendar, Hub, Email Inbox | score | The page |
| Workspace | `get_workspaces`, `:376` | `frappe.workspaces` | score | Opens the workspace sidebar |
| Dashboard | `get_dashboards`, `:403` | `boot.dashboards` | score | `dashboard-view` |
| Recent page | `get_recent_pages`, `:9` | `boot.user.recent` and `frappe.route_history` | 80 | The route |
| Executable | `get_executables`, `:693` | `make_function_searchable` calls | score | Runs the function. Desk registers two: "Generate Tracking URL" and "Background Jobs" (`frappe/public/js/frappe/ui/page.js:82`). |
| Tag (`#text`) | `frappe.tags.utils.get_tags` | `get_tags_list_for_awesomebar` | n/a | Tag search in the dialog |
| Hook row | `fetch_hook_results`, `awesome_bar.js:366` | `frappe.desk.search.awesomebar_search` | from the hook | The route |

### Ranking

- Each kind scores its candidates with `fuzzy_match` (`frappe/public/js/frappe/ui/toolbar/fuzzy_match.js`). A match starts at 100. It gets bonuses for adjacent letters (+25), a letter after a separator (+30), camel case (+30) and the first letter (+15). It gets penalties for leading letters (−5 each, −15 at most) and unmatched letters (−1 each). A good doctype match can score above the fixed rows at 100, 90 and 80.
- A translated label is matched first. The English label is the fallback when the user's language is not English.
- `build_options` sorts by `index`, high first. Awesomplete sorts again by `index` (`awesome_bar.js:163`). It shows at most 99 rows.
- `deduplicate` (`:329`) keeps one row per route and keeps the higher index. A recent row does not replace a non-recent one. List routes are cut to two parts first.

### Recents and frequency

| Store | Where it lives | What feeds it | Fact on this site |
| --- | --- | --- | --- |
| `boot.user.recent` | Redis hash `user_recent`, read in `frappe/sessions.py:173` | No code on this bench writes `user_recent`. Only `cache_manager.py` clears it. | `None` for Administrator. The list is always empty. |
| `frappe.route_history` | Browser memory, this tab only (`router.js:11`) | Every route change | Lost on reload |
| `Route History` | SQLite-backed virtual doctype (`route_history.py:13`). The client posts routes in batches through `deferred_insert`. | `router_history.js`, skips `Form` and plain `List` routes | 24 rows |
| `boot.frequently_visited_links` | `frequently_visited_links()`, `route_history.py:56`: top 25 routes by count, filtered to 5 | `Route History` | 0.6 ms. Shown only when the query has fewer than 2 characters. |

### Help links

The awesomebar on `desk-v2` lists no help rows. Help links live in the navbar help dropdown (`toolbar.js`, `setup_help`). The map's ruling already drops them.

## 2. The server side

### `awesomebar_search`

`frappe/desk/search.py:653`. It is whitelisted and takes `txt`. It returns `[]` for blank text. It calls each method in the `awesomebar_search` hook with `txt`. It logs and skips a method that raises. It keeps the first 20 items of each method and normalizes them (`_normalize_awesomebar_result`).

One result after normalization (from `frappe/tests/test_search.py:1280`):

```json
{ "label": "Open Help", "value": "Open Help", "index": 50, "route": ["https://docs.example.com"], "description": "Docs" }
```

| Key | Rule |
| --- | --- |
| `label` | Required. Falls back to `value`. |
| `value` | Falls back to `label` |
| `index` | Integer rank, default 0. The built-in "Search for" row is 100. |
| `route` | Required. A desk v1 route list (`["List", "ToDo"]`), an in-app path (`/desk/...`), or an `http(s)://` URL. A string becomes a one-item list. `//...` and other schemes are dropped. |
| `description`, `type` | Optional strings |
| `route_options` | Optional dict, set as `frappe.route_options` |

`boot.has_awesomebar_search` (`frappe/boot.py:126`) tells the client whether to call it. The client calls it only for text of 2 or more characters.

| App | Implements `awesomebar_search` |
| --- | --- |
| frappe | No. It defines the hook and ships a commented sample in `utils/boilerplate.py:572`. |
| erpnext | No |
| crm | No |
| gameplan | No. It has its own palette in `frontend/src/components/CommandPalette/`. |

On this bench the hook list is empty. A call costs 0.002 ms and returns `[]`.

The routes a hook returns are desk v1 routes. Desk v2's router builds addresses with `routeFor(doctype, name, {view})` (`frontend/src/router/routeFor.ts:50`). No code in `frontend/src` translates a v1 route list to a v2 address.

### `search_link` and its v2 route

| | v1 `search_link` (`search.py:64`) | v2 `GET /api/v2/doctype/<doctype>/search` (`api/v2.py:236`, rule at `:770`) |
| --- | --- | --- |
| Core | `search_widget` + `build_for_autosuggest` | the same |
| Arguments | `doctype`, `txt`, `query`, `filters`, `page_length`, `searchfield`, `reference_doctype`, `ignore_user_permissions`, `link_fieldname`, `start`, `include_image`, `keep_order` | `txt`, `filters`, `reference_doctype`, `query`, `limit`, `start` |
| Guest | refused by `@frappe.whitelist()` | refused with `PermissionError` |
| Cache | `@http_cache(max_age=60, stale_while_revalidate=300)` | sets the same `Cache-Control` header itself |
| Row | `{value, description, label?, image?}` | `{value, label, description}` |

`search_widget` (`search.py:152`) needs a doctype. It runs one `frappe.get_list` with:

- `or_filters`: `like %txt%` on `name`, the title field and the meta `search_fields` of text-like types;
- `enabled = 1` and `disabled != 1` when those fields exist;
- order by `_relevance` (`1 / LOCATE(txt, name)`), then `idx desc`, the meta sort, and `name`;
- then a Python sort that puts prefix matches first.

A `standard_queries` hook or a `query` argument replaces this with the app's own method. On this bench only `User` has one.

### Global Search doctypes

| Item | Fact |
| --- | --- |
| `Global Search Settings` | Single. One table field, `allowed_in_global_search`. System Manager writes, Desk User reads. It refuses Core module doctypes and repeats. |
| `Global Search DocType` | Child table with `document_type` (Link to DocType) and a `configure` button |
| Default list | From each app's `global_search_doctypes` hook, per domain. On this site: 50 doctypes, from Customer to Web Form. |
| Index | Table `__global_search`, MyISAM, with a FULLTEXT index on `content`. MyISAM indexes only words of 4 or more characters (`ft_min_word_len = 4`). |
| Index content | `label : value` for each field with `in_global_search`, joined by ` \|\|\| ` |
| Sync | A queued job (`sync_global_search`) |

## 3. Record search across doctypes

### How v1 finds a record when the user does not name the doctype

| Path | Query | Doctype given? |
| --- | --- | --- |
| "Search for {txt}" row, or `Ctrl+G` | `frappe.utils.global_search.search(text)`: one `MATCH(content) AGAINST(word)` per `&`-separated word, `LIMIT 20`, over the allowed doctypes | No |
| Recent pages | `frappe.route_history` in the browser, matched as a substring | No, but only pages opened in this tab |
| Hook rows | `awesomebar_search` | No, but no app on this bench adds any |
| "Find {a} in {doctype}" | Opens a list filtered `name like %a%` | Yes |
| "Find {txt} in {current list}" | Filters the open list on its title field | Yes, the open list |

The awesomebar has no path that matches a record name against many doctypes with `LIKE`. Global search is its only cross-doctype path.

### `global_search.search` (`frappe/utils/global_search.py:512`)

1. Allowed doctypes are `Global Search DocType` rows ∩ `can_read`.
2. It runs one full-text query per word.
3. For each row, it loads the document lazily, reads the title and image fields, and calls `frappe.has_permission(doctype, doc=doc)`.

This is one SQL call per result row. It also has these properties:

- The permission check runs after `LIMIT 20`. A user with row-level limits can get fewer than 20 rows.
- The "priority" loop walks `allowed_doctypes`, which is a Python `set`. The result order is set order, not the order in Global Search Settings.
- `content` holds every `in_global_search` field. The code does not filter it by the reader's permlevel access.
- The result row carries `content` and `rank`. The client cuts the snippet in `make_description`.

### Measured cost on `desk.localhost`

Terms: `gr` (2 characters), `SKU` (3), `Plastics` (one word), `Grant Plastics` (a customer name), `ACC-SINV-2026-00003` (a Sales Invoice name).

`global_search.search(text)`:

| Term | Admin warm (cold) | Admin rows / SQL calls | Sales User warm (cold) | Sales User rows / SQL calls |
| --- | --- | --- | --- | --- |
| `gr` | 8.6 ms (89.5) | 9 / 11 | 9.2 ms (81.2) | 3 / 13 |
| `SKU` | 11.4 ms (18.7) | 20 / 21 | 10.4 ms (13.6) | 15 / 16 |
| `Plastics` | 3.5 ms (3.7) | 5 / 6 | 3.1 ms (3.5) | 3 / 4 |
| `Grant Plastics` | 3.6 ms (3.5) | 5 / 6 | 2.3 ms (3.2) | 3 / 4 |
| `ACC-SINV-2026-00003` | 12.1 ms (46.4) | 20 / 21 | 22.9 ms (27.5) | 5 / 36 |

For the full invoice name, the invoice itself was row 18 of 20 for Administrator. With `limit=100` it was row 48 of 52. The full-text parser splits the name on `-` and matches `2026` and `00003` in other rows, so ToDos ranked first.

`search_link(doctype, txt, page_length=10)`, warm, one doctype:

| Doctype | Admin `gr` | Admin `Grant Plastics` | Admin `ACC-SINV-…` | Sales User |
| --- | --- | --- | --- | --- |
| Customer | 1.5 ms, 3 rows | 1.5 ms, 1 row | 1.4 ms, 0 rows | 1.4–2.8 ms, same rows |
| Item | 1.6 ms, 10 rows | 1.4 ms, 0 | 1.4 ms, 0 | 1.4–2.9 ms |
| Sales Invoice | 1.4 ms, 2 rows | 1.3 ms, 2 | 1.3 ms, 1 | `PermissionError` |
| Supplier | 1.3 ms, 3 rows | 1.2 ms, 0 | 1.2 ms, 0 | `PermissionError` |
| Purchase Invoice | 1.3 ms, 0 | 1.3 ms, 0 | 1.3 ms, 0 | `PermissionError` |
| Contact | 23–38 ms, 0, 4 SQL calls | | | 6.5–6.9 ms, 0 |
| User (`standard_queries`) | 1.4–1.5 ms, 2 SQL calls | | | 2.2–3.8 ms, 3 SQL calls |
| DocType | 16 ms, 10 rows for `gr` | 16 ms | 16 ms | 16 ms, 10 rows for `gr` |

One `search_widget` call per doctype, run in a loop with `page_length=5`:

| Doctype set | User | Doctypes | `gr` | `Grant Plastics` | `ACC-SINV-…` | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| `can_search` | Admin | 577 | 3,467 ms, 117 rows | 1,256 ms, 10 rows | 1,116 ms, 6 rows | 77: 71 singles and 6 virtual doctypes |
| `can_search` | Sales User | 130 | 577 ms, 56 rows | 232 ms, 3 rows | 226 ms, 0 rows | 0 |
| Global Search DocType ∩ `can_read` | Admin | 49 | 127 ms, 27 rows | 123 ms, 5 rows | 158 ms, 1 row | 0 |
| Global Search DocType ∩ `can_read` | Sales User | 19 | 43 ms, 18 rows | 43 ms, 3 rows | 58 ms, 0 rows | 0 |

Administrator's `can_search` holds singles. `frappe/utils/user.py:174` adds every non-table doctype for Administrator. The 6 virtual doctypes failed with these errors:

- `Error Log` (SQLite): "no such function: LOCATE";
- `System Health Report`: `NotImplementedError`;
- `Permission Inspector`: `TypeError`;
- `RQ Worker`: `KeyError`.

### Permission checks per path

| Path | Doctype check | Row check | Field check |
| --- | --- | --- | --- |
| `search_link`, v2 `/search` | `get_list` needs `read` or `select`. It raises `PermissionError` otherwise (measured for the Sales User). | `get_list` applies user permissions and permission query conditions. `ignore_user_permissions` holds only when `validate_ignore_user_permissions` accepts the form field (`search.py:394`). | The query engine keeps only permitted fields (`frappe/database/query.py:1104`) |
| `search_link` on `DocType` | None. `ignore_permissions=True` (`search.py:355`). Disabled modules are removed. | None | None. Any signed-in user gets doctype names (measured: Sales User, 10 rows). |
| `global_search.search` | `Global Search DocType` ∩ `can_read` | `has_permission(doc=...)` per row, after `LIMIT` | None on `content` |
| `awesomebar_search` | None in the dispatcher. Each hook method must check. | Hook's job | Hook's job |
| Boot rows (doctypes, reports, pages, workspaces, dashboards) | Built per user on the server: `can_read`, `allowed_reports`, `page_info`, workspaces, `get_allowed_dashboards` | n/a | n/a |
| `frequently_visited_links` | Report routes are filtered by allowed reports. Other routes pass, and the target page checks on open (`route_history.py:79`). | n/a | n/a |

## 4. What desk v2's boot carries

Desk v2's boot is `frappe.shell.boot.get_boot` (`frappe/shell/boot.py`). It is per prefix and separate from v1's `frappe.sessions.get()`.

| Place kind | In v2 boot? | Where it is | Size and cost on this site |
| --- | --- | --- | --- |
| Doctypes the user can read | No | `get_contents(app, module?)` (`shell/doctypes.py:184`), fetched by the pages that show it. It is per app and permission-filtered. `get_readable_doctypes()` (`:146`) is the server set behind it. | ERPNext: 279 rows, 21.4 KB, 22 ms (Admin). 59 rows, 4.2 KB, 4 ms (Sales User). CRM: 37 and 27 rows. Readable set: 577 and 149 doctypes, 25 ms and 4 ms. |
| Doctype names and addresses | No, fetched | `get_addresses` (`shell/doctypes.py:131`), cached a year on `metadata_version`. All 580 non-child doctypes on the bench, the same for every user, not filtered by permission. | 30.3 KB |
| Saved views | No | The route exists: `/:doctype/view/list/:viewName` (`frontend/src/router/generated.ts:27`). `Doctype View` has a `label` field for a saved view's name. No API lists saved views. `doctype_view/api.py` reads and writes one view's settings. | 0 `Doctype View` rows |
| Sidebar rows | Yes, `boot.navigation` | `resolve_navigation(app)` (`shell/navigation.py:59`): `{rail, sidebars}` for the current prefix only, resolved for the session user | ERPNext: 338 rows, 48.7 KB, 14 ms (Admin). 113 rows, 15.2 KB (Sales User). CRM: 22 rows, 3.0 KB. Item types seen: Sidebar, Module, Section, DocType, Default Company. |
| Settings panes | No | No settings dialog or pane list exists in `frontend/src` at this commit. "My settings" opens v1's User form (`frontend/src/shell/RailColumn.vue:189`). | n/a |
| Apps | Partly | `index_boot()` sends `apps` (title, logo, route, permission-filtered) on `/apps` only. A prefix boot sends `prefixes` (`{prefix: {app, modular}}`, every active app, not filtered by permission) and `app_order`. | 4 apps, 494 B |
| Contributed pages | In the bundle | `contributions.pages` (`frontend/src/contributions/registry.ts:13`), compiled into the frontend | No request |
| Reports, workspaces, dashboards | No | Not in v2 boot. The map leaves reports to area 4. | n/a |

For comparison, the v1 boot keys that the awesomebar reads:

| Key | Admin | Sales User |
| --- | --- | --- |
| `user.can_read` | 10.4 KB | 2.4 KB |
| `user.can_search` | 10.5 KB | 2.1 KB |
| `user.can_create` | 7.5 KB | 1.0 KB |
| `user.can_get_report` | 8.5 KB | 1.7 KB |
| `allowed_reports` | 193 reports, 34.8 KB, 30 ms | 41 reports, 7.4 KB, 23 ms |

## 5. Which v1 server calls have a `/api/v2` route

Every whitelisted method is callable at `/api/v2/method/<dotted.path>` (`handle_rpc_call`, `api/v2.py:57`, rule at `:736`). Desk v2's `runMethod` uses this route (`ui/src/api/request.ts:5`). The second column below names a dedicated REST route.

| v1 call | Used by | Dedicated v2 REST route | Under `/api/v2/method/` |
| --- | --- | --- | --- |
| `frappe.desk.search.awesomebar_search` | Hook rows | None | Yes |
| `frappe.utils.global_search.search` | Global Search dialog, "Search for" row | None | Yes |
| `frappe.desk.search.search_link` | Link fields | `GET /api/v2/doctype/<doctype>/search` | Yes |
| `frappe.desk.search.search_widget` | Older callers | Wrapped by the route above | Yes |
| `frappe.client.get` on `Global Search Settings` | Global Search dialog filter bar (`search.js:571`) | `GET /api/v2/document/Global Search Settings/Global Search Settings` | Yes |
| `frappe.desk.doctype.tag.tag.get_tags_list_for_awesomebar` | `#tag` rows | None | Yes |
| `frappe.desk.doctype.tag.tag.get_documents_for_tag` | Tag results | None | Yes |
| `frappe.desk.doctype.route_history.route_history.deferred_insert` | Records routes for frequent links | None | Yes |
| `frappe.desk.doctype.route_history.route_history.frequently_visited_links` | v1 boot (also whitelisted) | None | Yes |
| v1 boot keys (`can_read`, `can_create`, `allowed_reports`, `page_info`, `dashboards`, workspaces, `user.recent`) | All non-hook rows | None. The v2 boot (`frappe.shell.boot.get_boot`) has none of these keys. | No |
| List filter for "Find in" rows | The list page | `GET /api/v2/document/<doctype>` | n/a |
