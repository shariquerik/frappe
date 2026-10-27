# Merge to develop: records the route guard and address check would refuse

Ticket: [frappe/frappe#45484](https://github.com/frappe/frappe/issues/45484). Map: [#45480](https://github.com/frappe/frappe/issues/45480) (ruling 5: both checks stay always-on).

Code read at `upstream/desk-v2` `8c96392df6` (2026-10-27). Counted on 2026-10-27.

## Answer

| Where | Route guard (`validate_route`) | Address check (`validate_address`) |
|---|---|---|
| `desk.localhost` (frappe, erpnext, crm, gameplan) | **0** of 35 routed rows | **0** of 584 DocTypes, **0** of 43 Module Defs |
| Shipped source, 10 apps | **0** fixtures, **0** generator defaults | **0** of 783 DocTypes, **0** of 59 modules; **0** page files |

No record on the site and no record that an app ships is refused by either check after the merge. The cost of `validate_route` on a save of a document that is not a website document is about **0.1 µs** for the function and about **3.5 µs** with the hook dispatch.

## What the checks refuse

### Route guard

`frappe/shell/route_guard.py`, wired as `doc_events["*"]["validate"]` in `frappe/hooks.py:272`.

- `RESERVED_ROUTES = frozenset({SHELL_ROOT})`, and `SHELL_ROOT = "apps"` (`frappe/shell/__init__.py`). One segment only.
- `is_reserved(route)` strips `/` and spaces, then compares the first segment with `apps`. `apps`, `/apps`, `apps/x` match. `apps-store`, `myapps` do not.
- `validate_route` refuses only when all are true: the doc has a `route`, the route is reserved, `has_website_route(doc)` (a `WebsiteGenerator`, a `has_web_view` meta, a `website_generators` hook entry, or a DocType row with `has_web_view`), and no `in_migrate` / `in_patch` / `in_install` flag.

### Address check

`frappe/shell/address_clash.py`, wired on `DocType` and `Module Def` (`validate` and `before_rename`, `frappe/hooks.py:320-326`).

- `validate_address` runs only when `doc.is_new()` and the doc is not a child table. A save of an existing DocType or Module Def is **never** checked. Only a new row or a rename can be refused.
- `clash()` refuses a name when its `slug()` (`frappe.scrub(name).replace("_", "-")`) equals:
  1. the file name of a page, `<app>/<module>/frontend/pages/<slug>.js` (`page_glob` in `frappe/shell/manifest.py:49`). DocTypes compete with pages of flat apps; modules compete with pages of modular apps (`app_modular = True` in hooks).
  2. the slug of another row of the same doctype (`CRM Deal` and `CRM-Deal` share `crm-deal`). Child tables are left out for DocType.
- In migrate, patch and install, a clash is logged and printed in yellow, not refused.

Note: the ticket says "an address an app **prefix** holds". The code does not compare names with app prefixes. A prefix is the first segment under `/apps`, and a DocType or module is a later segment, so the two cannot collide. This research counts the two things the code compares.

## Method

### desk.localhost

Read-only script (`frappe.init(site="desk.localhost"); frappe.connect()`, no save, `frappe.db.rollback()` at the end). The main checkout is on `desk-v2` and `frappe/shell/{route_guard,address_clash,registry,doctypes}.py` are identical to `upstream/desk-v2`, so the script imports the real predicates.

- **Routes.** Every table with a `route` column (from `information_schema.columns`) that is a DocType: 14 tables, 35 rows with a non-empty route. Each route goes through `is_reserved`. Hits: **0**.
  - Tables: BOM 0, CRM Dropdown Item 5, DocType 3, Help Article 0, Help Category 0, Navbar Item 2, Portal Menu Item 13, Sales Partner 0, Sidebar Item 0, Studio App 2, Studio Page 4, Web Form 6, Web Page 0, Website Sidebar Item 0.
  - This is wider than the guard: it includes rows that are not website documents (Navbar Item, Portal Menu Item, Sidebar Item). None of them starts with `apps` either.
  - First segments seen: `#` (5), `issues` (2), and single rows such as `desk`, `doctype`, `user`, `orders`, `project`, `rfq`.
- **Addresses.** `page_files(False)` and `page_files(True)` both return `{}`: no installed app has a file at `<module>/frontend/pages/*.js`. (The CRM proof page `fcrm/doctype/crm_organization/frontend/pages/organization_proof.js` is a doctype-level contribution, not an app page, so `page_glob` does not see it.) Grouping all 584 non-table DocTypes and all 43 Module Defs by `slug()`: **0** groups with more than one name.

### Shipped source

Trees scanned (all at their tip on 2026-10-27):

| App | Tree |
|---|---|
| frappe | `upstream/develop` and `upstream/desk-v2` |
| erpnext, crm, gameplan | `develop` (fetched, extracted with `git archive`), and the bench checkouts |
| hrms, helpdesk, lms, insights, builder, wiki | shallow clone of `develop` |

Checks per tree:

- Every `*.json` file, walked recursively: any object with a `route` string that `is_reserved` accepts. This covers fixtures, Web Page / Web Form / Workspace exports and DocType JSON. Hits: **0**.
- Every `*.py` file: `route = "apps..."` / `"route": "/apps..."` assignments (a website generator default or a fixture built in code). Hits outside tests: **0**. The only hits are the guard's own tests in `frappe/tests/test_shell.py` on `desk-v2`.
- `hooks.py` of each app: routes or rules under `/apps`. Only `frappe` on `develop`: `website_redirects` `{"source": "/apps", "target": "/desk"}` (hooks.py:86). This is a redirect, not a document, so neither check sees it.
- Page files (`*/*/frontend/pages/*.js`): **0** in every app.
- DocType names (783 non-table) and modules (`modules.txt`, 59), pooled over all 10 apps so that cross-app pairs show up: **0** slug collisions.

Lines that mention `/apps` but are not refused:

- `frappe/patches/v16_0/add_app_launcher_in_navbar_settings.py:24` adds a Navbar Item with route `/apps`. Navbar Item is a child table with no web view, so `has_website_route` is false and the guard lets it pass. (On `desk.localhost` this row is not present.)
- `frappe/apps.py:90` (develop) returns `/apps` as the default app route. This is a URL, not a stored route.

### Near misses (not refused, recorded for the map)

- **Module and DocType with the same slug:** `Workflow` (frappe module and frappe DocType) and `Communication` (erpnext module and frappe DocType). The address check compares a DocType only with DocTypes and a module only with modules, so it does not refuse these. `frappe/shell/registry.py:32-34` already explains why `app_modular` is fixed per app because of `Workflow`.
- **Module slug equals an app prefix:** `CRM` (prefix `crm`), `Gameplan` (`gameplan`), `Desk` (`desk`). Not compared by the code, and not a clash: the module is the second segment, the prefix the first.

### What this count cannot see

User data on other sites. A site owner can have a Web Page, Blog Post, Web Form, Builder Page or other web-view record at `/apps/...`, or two custom DocTypes such as `Foo Bar` and `Foo-Bar`. Such records are not refused at migrate (the flags skip them), but the next save of the web record is refused with `ReservedRouteError` until the route changes. Existing DocType / Module Def rows are never refused on save; only a new row or a rename is. A query that a site owner can run to find them:

```python
from frappe.shell.route_guard import is_reserved
for t in frappe.db.sql("select distinct table_name from information_schema.columns where table_schema=%s and column_name='route'", frappe.conf.db_name, pluck=True):
    for name, route in frappe.db.sql(f"select name, route from `{t}` where route like '%%apps%%'"):
        if is_reserved(route): print(t[3:], name, route)
```

## Cost of `validate_route` on a non-website save

Measured on `desk.localhost` (AMD EPYC, 8 cores), `timeit`, best of 5, in-memory docs only:

| Case | Time per call |
|---|---|
| `validate_route(todo)`: ToDo, no `route` attribute | **0.10 µs** |
| `validate_route(web_page)`: Web Page, route `about` | 0.30 µs |
| `validate_route(web_page)`: route `apps/x`, `in_migrate` set (reaches `has_website_route`, returns before the throw) | 1.04 µs |
| Hook dispatch for one handler, as `Document.hook.compose` does it (`frappe.get_attr` + `_accepts_method_argument` + `_disable_transaction_control` +/-) plus the call | **3.5 µs** |
| of which `frappe.get_attr("frappe.shell.route_guard.validate_route")` | 2.3 µs |
| reference: `frappe.get_meta("ToDo")` from cache | 0.8 µs |

Reading the code: for a doc that is not a website document, `getattr(doc, "route", None)` is `None` (or a route that is not reserved) and the function returns at the first `if`. It does no DB query, no cache read and no hook read. `has_website_route` (meta and `get_hooks`) runs only when the route already starts with `apps`.

The real cost is the dispatch, not the function. `Document.hook` (`frappe/model/document.py:2409`) resolves each `doc_events` handler with `frappe.get_attr` on every `validate`, with no cache. On `develop`, `doc_events["*"]` has no `validate` key in frappe (erpnext adds three), so this is one more handler: about **3.5 µs per save** (and per insert). A save does at least one DB write and several meta reads, so this is far below 0.1 % of a save.

## Sources

- `upstream/desk-v2` `8c96392df6`: `frappe/shell/__init__.py`, `frappe/shell/route_guard.py`, `frappe/shell/address_clash.py`, `frappe/shell/registry.py`, `frappe/shell/doctypes.py:15` (`slug`), `frappe/shell/manifest.py:49` (`page_glob`), `frappe/hooks.py:269-327`, `frappe/model/document.py:330` and `:2372-2421`, `frappe/utils/__init__.py:1281` (`get_attr`).
- `upstream/develop`: `frappe/hooks.py` (`doc_events["*"]`, `website_redirects`), `frappe/patches/v16_0/add_app_launcher_in_navbar_settings.py`.
- App trees on 2026-10-27: erpnext `821ca1d87e`, crm `bbca33dd`, gameplan `20da039`, hrms `ba8442a`, helpdesk `2da03bf`, lms `11b6244`, insights `afb0d64`, builder `88ff5ac`, wiki `0e75836`.
- Site: `desk.localhost` on this bench, apps frappe, erpnext, crm, gameplan.
