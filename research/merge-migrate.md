# Merge to develop: migrate a develop site onto the merged code

Ticket: [frappe/frappe#45493](https://github.com/frappe/frappe/issues/45493). Map: [#45480](https://github.com/frappe/frappe/issues/45480) (ruling 3: with `enable_desk_v2` off, desk v1's UI and APIs do not change).

Run on 2026-10-27 on a scratch SQLite site, frappe only.

| Code | Commit |
|---|---|
| Old (merge base) | `b9e4d35824` = `git merge-base upstream/develop upstream/desk-v2` |
| `upstream/desk-v2` | `4ff91049d0` |
| `upstream/develop` | `cbaa7936dc` |
| Merged (local only) | `0d5ee57893` = `desk-v2` + `develop`, one conflict resolved (see below) |

## Answer

- **Migrate passes.** Exit 0, **7.1 s** (wall, frappe only, SQLite). A second migrate on the merged code passes in 2.8 s with no schema change. A control migrate on the old code also takes 2.8 s.
- **No patch runs.** The merge adds no line to `patches.txt` and no Python pin change.
- **Schema:** 9 new tables, 4 new columns, 1 new unique index. `tabSidebar` is rebuilt to drop the `title` unique index. All rows are kept.
- **No v1 data is changed, lost or refused.** The only data that changes because of the merge is the defaults that fill the new columns.
- **The v1 loaders work.** `frappe.desk.form.load.getdoc` and `frappe.desk.reportview.get` give the same result before and after migrate for all 10 DocTypes tested. This is true for Administrator and for a System Manager user. The differences are 3 new keys in the `docs` payload: Sidebar has `user: ""` and `navigation_items: []`, and Client Script has `run_order: 0`. The docinfo (`shared`, `tags` and the other keys) does not change.
- **Turning the setting on and off works.** The odd results: when v2 is on, `/apps` gives **417** "The desk shell has not been built" on a bench that has not run `bench build`. After the first save, v1's boot carries `"enable_desk_v2":"0"`, and v1's sidebar menu reads it: a third reader of the setting, not in the map Notes. See [the toggle section](#enable_desk_v2-on-and-off).

## The merge

`git merge upstream/develop` into `upstream/desk-v2` stops on **one conflicted file: `frappe/hooks.py`**, in `ignore_links_on_delete`. `desk-v2` adds `"Rail"` and `"Settings Dialog"`, and `develop` adds `"Background Task"` at the same place. Both sides only add list entries, so the resolution keeps all three.

The ticket said to use `upstream/desk-v2` alone if the merge conflicts. I used the merged code instead, because it includes develop's 57 commits (for example Background Task's new `timeout` column), and those commits are part of the real merge. The merge commit stays local. It is not on the research branch.

Compared with the merge base, the merged code changes no `patches.txt` line and no `pyproject.toml` line. The bench's own `env` ran both the old and the merged code (`PYTHONPATH=<worktree>`).

## Schema diff (merge base → merged), primary DB

### New tables

`tabDoctype View`, `tabFavourite`, `tabForm Layout`, `tabNavigation Item`, `tabNavigation Item Type`, `tabRail`, `tabSettings Block`, `tabSettings Dialog`, `tabSettings Pane`. The `tabDocType` row count goes from 336 to 345, `tabDocField` from 3,910 to 3,999 and `tabDocPerm` from 356 to 366.

### Changed tables

| Table | Change | Value on existing rows |
|---|---|---|
| `tabSidebar` | + `link_doctype varchar(140)` NULL | `NULL` |
| `tabSidebar` | + `link_to varchar(140)` NULL | `NULL` |
| `tabSidebar` | + `user varchar(140) NOT NULL DEFAULT ''` (`not_nullable`) | `''` |
| `tabSidebar` | + unique index `unique_sidebar_address (link_doctype, link_to, user, standard)` | 16 v1 rows coexist: `NULL` `link_doctype` is distinct in a unique index |
| `tabSidebar` | − `sqlite_autoindex_tabSidebar_2` = `UNIQUE(title)` | — |
| `tabClient Script` | + `run_order INT NOT NULL DEFAULT 0` | `0` |
| `tabBackground Task` | + `timeout INT NOT NULL DEFAULT 0` (from `develop`) | (no rows) |

No column is removed or changed. No other index is added or removed in the primary DB.

**How the Sidebar `title` unique index goes.** SQLite cannot drop a column-level `UNIQUE`, so migrate rebuilds `tabSidebar`. Before migrate, the table has `"title" varchar(140) UNIQUE` and `name ... PRIMARY KEY`. After migrate, `title` is a plain column and the table has `PRIMARY KEY ("name")`. The rebuild keeps all 16 rows (14 standard rows, `Seed Sidebar 45493` and a legacy row `Seed Drift 45493` with the title `Seed Drift Title 45493`). It also keeps `tabSidebar_creation_idx`. The migrate log prints no index message.

Other DocType JSONs change with no schema effect: Client Script `view` gets the option `Record`. DocField and Custom Field `fieldtype` get `Vue Component`. System Settings gets `enable_desk_v2` (Check, default 0). Migrate writes no `tabSingles` row for this field, and the setting reads as off until the first System Settings save.

### Route History (log DB)

On `develop`, Route History is a virtual DocType. Its rows are in the site's log DB, `private/files/sqlite.db`, not in the primary DB. The merge adds `search_index` to its **`user`** field. Migrate does not create the index, because `DBTable.sync` skips virtual DocTypes. `ensure_log_table` (`frappe/utils/logging.py`) creates `tabRoute History_user_idx` on the first Route History write after migrate. I confirmed this: after migrate the log DB had only `tabRoute History_creation_idx`, and after the next write it also had `tabRoute History_user_idx`. The merge also filters `/apps/%` routes out of `frequently_visited_links`. That filter has no effect on v1 rows.

## Data: changed or refused

The rows of all seeded tables were compared before and after migrate. These tables are Sidebar, Sidebar Item, Custom Sidebar, Client Script, Contact, Contact Email, Contact Phone, Tag, Tag Link, DocShare, Web Page, Data Import, ToDo, and System Settings in `tabSingles`. No row is lost. The only changed values are the defaults of the new columns.

Migrate also changes these rows, but the merge is not the cause. A **control migrate of the same pre-migrate DB on the old code** makes the same changes:

- System Settings `setup_complete` 0 → 1. `InstalledApplications.update_versions` marks frappe's setup complete when a user other than Administrator exists, and the seed added one. The merge only renames a local variable in this file (`get_setup_wizard_pending_apps`).
- Standard Workspace Link, Workspace Shortcut, DocType State and Installed Application child rows are re-imported with new names but the same values. Workspace, Flow Tool and Navbar Item get a new `modified`.

**Refused by migrate:** nothing. "Removing orphan Sidebars" keeps both non-standard seeded sidebars.

**Re-saving each seeded record** (28 records, rolled back) gives the same result on the old code and on the merged code. All records save, but the 3 Sidebars are refused in both with "belongs to its app and can only be edited in developer mode". That is v1's rule for Sidebar, not a change.

**One message changes, in developer mode only.** Insert a Sidebar whose title is the same as the title of the legacy row `Seed Drift 45493`:

| | Not in developer mode | In developer mode |
|---|---|---|
| Old code | refused: "belongs to its app" | refused: `UniqueValidationError` (`UNIQUE constraint failed: tabSidebar.title`) |
| Merged | refused: "belongs to its app" | refused: `ValidationError` "**Seed Drift Title 45493** is already the title of the sidebar **Seed Drift 45493**." |

The DB index is gone, but the Sidebar controller refuses the duplicate title. The record is refused in both cases. Only the exception class and the message change.

## v1 loaders, setting off

`probe.py` called `getdoc(doctype, name)` and `reportview.get` with a v1 list view field list (`name`, `owner`, `modified`, `docstatus`, `_user_tags`, `_assign`, `_liked_by`, the `in_list_view` fields and the title field, with `with_comment_count=1`). It ran on the old code before migrate and on the merged code after migrate, once as Administrator and once as `seed45493@example.com` (System Manager, with a ToDo and the Contact shared to it). There were 56 `getdoc` calls and 20 list calls. The results were compared key by key, without `modified`, `creation` and `_seen`.

| DocType | getdoc | list |
|---|---|---|
| Sidebar (2 seeded + standard `Contacts`) | same + `user: ""`, `navigation_items: []` in `docs[0]` | same |
| Custom Sidebar (site-wide + per user) | same | same |
| Client Script (Form, List) | same + `run_order: 0` | same |
| Route History (10 rows) | same | same |
| Contact (2 emails, 2 phones, 1 tag, shared) | same, incl. docinfo `shared` and `tags` | same |
| Tag Link (3), DocShare (3) | same | same |
| Web Page | same | same |
| Data Import (`Contact Import-00001`) | same | same |
| ToDo (tagged; shared) | same | same |

The calls that fail on the merged code also fail on the old code, with the same error. The System Manager user gets `PermissionError` on the Custom Sidebar of Administrator and on Web Page (no Website Manager role). In both versions, `reportview.get` refuses `_comments` ("Field not permitted in query") when `with_comment_count` is set, so the probe does not ask for it.

Over HTTP on the merged code, with the setting off: `/desk` and `/desk/todo` give 200. `/app/todo` gives 301 to `/desk/todo` (v1's own redirect). `/seed-page-45493` gives 200. `getdoc` for Contact gives 200 with the 22 docinfo keys of v1. `reportview.get` for ToDo gives 200 with the tags.

## `enable_desk_v2` on and off

The setting was set to 1 and then to 0 with `System Settings.save()`, and the routes were called at each step (`toggle.py`, werkzeug test client, logged in as Administrator).

| | Before (never saved) | On | Off again |
|---|---|---|---|
| Save | — | ok | ok |
| `tabSingles` changes | — | `enable_desk_v2` None → 1, `modified` | 1 → 0, `modified` |
| `is_desk_v2_enabled()` | False | True | False |
| `get_url_to_form("Contact", …)` | `/desk/contact/Seed%20Contact%2045493` | `/apps/desk/contact/Seed%20Contact%2045493` | `/desk/contact/…` |
| `/apps` | 302 → `/desk` | **417** "The desk shell has not been built. Run `bench build`." | 302 → `/desk` |
| `/apps/todo` | 404 | 404 | 404 |
| `/desk`, `/desk/todo`, `/app/todo`, Web Page | 200, 200, 301, 200 | same status; `/desk` +66 bytes | same as "On" |
| `getdoc` Contact, `reportview.get` ToDo | 200 | same result | same result |

Odd results:

- The **417 at `/apps` with v2 on** comes from `ShellPage`, because the worktree has no `frappe/public/frontend/index.html`. On a merged bench, `bench build` always builds the shell (ruling 4), so only a bench that has not run `bench build` since the merge shows this page. With the setting off, `/apps` never reaches that check.
- **A fresh site cannot save System Settings** until `language` and `time_zone` are set (`MandatoryError`), because the setup wizard has not run. The old code does the same. A real develop site has both values.
- After the first save, v1's boot on `/desk` has the key `"enable_desk_v2":"0"` (two times, about 66 bytes). Every System Settings field that has a row in `tabSingles` goes into the boot this way. Before the first save there is no row and no key. Turning the setting off does not remove the key, because the row stays with the value `0`. v1 reads the key in one place: the sidebar menu (`frappe/public/js/frappe/ui/sidebar/sidebar.js:452`, from `a3560eba3e`) shows a "Desk v2" link to `/apps` only when `cint(frappe.boot.sysdefaults.enable_desk_v2)` is 1. With `"0"` or no key, the menu has no link, so v1 is the same with the setting off. The map Notes say the setting is read in two places (`ShellPage` and `get_url_to_form`). This client-side reader is a third one.
- Only the setting's own row and `modified` change. Turning the setting off returns every route and loader to the "before" state, except the boot key above.

## Method

1. Worktrees: `~/wt/merge-migrate-45493-old` (detached at the merge base) and `~/wt/merge-migrate-45493` (`upstream/desk-v2` + `git merge upstream/develop`, conflict resolved as above).
2. Site, on the old code, from `sites/`: `PYTHONPATH=<old> ../env/bin/python -m frappe.utils.bench_helper frappe new-site merge-check-45493.localhost --db-type sqlite --admin-password admin` (32.6 s).
3. Seed, on the old code, with one script:
   - a System Manager user;
   - two ToDos;
   - a Sidebar with 3 items (inserted in developer mode, because v1 refuses the insert otherwise), and a legacy Sidebar row inserted with SQL, whose name is not its title;
   - two Custom Sidebars (site-wide and per user);
   - Client Scripts for ToDo, one Form and one List;
   - 5 Route History rows;
   - a Contact with 2 email rows and 2 phone rows;
   - 3 tags (Tag Link) on the ToDo and the Contact;
   - 2 DocShares;
   - a published Web Page;
   - a Data Import on Contact (ToDo is refused: "Allow Import" is off).

   A failed first seed run left 5 more Route History rows. The log DB commits its own DDL and writes, so a rollback does not remove them.
4. Snapshot (`sqlite3` read-only: `pragma table_xinfo`, `index_list`, `index_info`, a row hash per table, all rows of the seeded tables) and probe on the old code. Then back up the DB file.
5. Migrate on the merged code: `PYTHONPATH=<merged> … --site merge-check-45493.localhost migrate`. Snapshot and probe again.
6. Control: restore the backup, migrate on the old code, snapshot. Then restore the merged result. Compare the control with the merged result, so that changes that every migrate makes are not reported as merge changes.
7. Toggle, then a second migrate on the merged code.

The site was dropped after the run.
