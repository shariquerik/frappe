# Desk v2 security: every door into the desk and the check at each door

Research for the question "where are the doors into desk v2, and what check guards each one?"
(frappe/frappe#43427, a child of the desk v2 architecture map #43426).

- Measured at `upstream/desk-v2` commit `6352fefbdf` (the merge of PR #43382, the record page's
  return-visit cache). The base for "what desk v2 added" is the merge base with develop, `51aff2068c`.
- Method: code reading in a worktree, plus read-only calls on the local dev site `crm.localhost`
  as a Desk User (not System Manager), a Website User and a Guest. The live site served the same
  commit. The one test insert was rolled back.
- This file decides nothing. Each gap names a class of problem and a place, and the smallest fix.
  It gives no working exploit.

## Summary

| | Count |
|---|---|
| Doors listed (table rows in section 1) | 66 |
| High gaps | 0 |
| Medium gaps | 4 |
| Low gaps | 11 |

No door lets one user read or write another user's own rows, and no door lets a user who is not
a System Manager put code into another user's browser. The four medium gaps are leaks to people
outside the desk (Guest, Website Users, email senders) or depend on one server cleaner alone.

Compared with desk v1:

- Stored scripts: v2 is **narrower**. The same roles write them, but the text now needs read on
  the doctype and runs on fewer pages.
- Boot data: v2 is **narrower** for desk users, and **wider** in one place: the new session
  endpoint gives Website Users the full site defaults (gap M2).

## 1. Door table

"Any user" means any signed-in user, including Website Users. "System User" is the desk user type.
"App permission" is `has_app_permission`, which by default means "is a System User"
(`frappe/shell/permissions.py:10-21`).

### 1a. Whitelisted methods and v2 routes that desk v2 adds or changes

| # | Door | What it is | file:line | Who can reach | Check that runs | Gap |
|---|---|---|---|---|---|---|
| 1 | `GET /api/v2/session` | The signed-in person, their roles and the site defaults | `frappe/api/v2.py:94`, body at `frappe/sessions.py:226-247` | Everyone, Guest included | A Guest gets empty defaults; everyone else gets all of them | **M2** |
| 2 | `read_doc` with `?include=` | Adds permissions, attachments, assignments, shares, tags, favourites, follows, comments and more next to a document | `frappe/api/v2.py:112`, `frappe/api/include.py:35-63` | Any user | `doc.check_permission("read")` before any part is built (`v2.py:113-116`); an unknown part name raises | none |
| 3 | `document_list` with `include=count` | A list read with OR filters, and a row count capped at 1000 | `frappe/api/v2.py:127`, `include.py:206` | Any user | The list and the count both apply the user's permissions (`reportview.py:125`) | none |
| 4 | `GET /api/v2/doctype/<dt>/search` | The link-field search | `frappe/api/v2.py:239` | **Guest included** | `search_widget`, which skips permissions when the doctype is DocType (`frappe/desk/search.py:303`) | **M3** |
| 5 | `get_meta` with `include=children` | A doctype's meta plus its child tables | `frappe/api/v2.py:322` | Any user | `frappe.only_for("All")`, the same as develop | none |
| 6 | Collaboration routes | Add, remove or edit assignments, shares, tags, favourites, follows and comments on a document | `frappe/api/collaboration.py:27,37,48` | Any user | Loads the doc with write (assignments, tags), share (shares) or read (the rest); the framework call then checks again (comment edit is owner-only) | none |
| 7 | `GET .../activity` | One page of the merged activity feed | `frappe/api/activity.py:8`, `frappe/desk/form/activity.py:68` | Any user | Read on the doc; field changes filtered by permission level | none |
| 8 | `POST /api/v2/document/File` | Upload a file attached to nothing | `frappe/api/files.py:19` | Any user; Guest if guest uploads are on | `upload_file`, as in v1 | none |
| 9 | `POST .../attachments` | Upload a file, attach it to a record, and return the record's attachment list | `frappe/api/files.py:35-48` | Any user; **Guest if guest uploads are on** | `upload_file` checks write, but skips the check for Guest; the answer re-reads the record with no read check (`:48`) | **M4** |
| 10 | `DELETE .../attachments/<file>` | Delete a file attached to a record | `frappe/api/files.py:51` | Any user | Write on the doc, then File delete permission | none |
| 11 | `doctype_view.api.get` / `save` / `reset` | Read or change a list view's settings, for the site or for the caller | `frappe/desk/doctype/doctype_view/api.py:12,20,32` | Any user except Guest | Read on the target doctype; site scope needs System Manager; the user is always the session user (`:73`) | none |
| 12 | `toggle_favourite` | Add or remove the caller's favourite on a record | `frappe/desk/doctype/favourite/favourite.py:69` | Any user except Guest | Read on the record; the row is keyed on the session user (`:75`) | none |
| 13 | `get_form_layouts` / `save_form_layout` | Read or save a form layout | `frappe/desk/doctype/form_layout/form_layout.py:86,103` | Any user except Guest | Read on the doctype; saving needs write on Form Layout (System Manager only) | none |
| 14 | `get_client_scripts` | Returns the record-page script text for a doctype | `frappe/custom/doctype/client_script/client_script.py:84-102` | Any user except Guest | Read on the doctype (`:87`); only `Record` rows; skips disabled modules | none |
| 15 | `reorder` (Client Script) | Changes the order the scripts run in | `client_script.py:106-118` | System Manager | Write on Client Script (`:111`); refuses names from another doctype | none |
| 16 | `report_customization_error` | Writes an Error Log row for a script that failed in the browser | `frappe/desk/customization_error.py:27-80` | **Any user, Website Users included** | 30 calls a minute, a known tier name, text cut to length; inserted with `ignore_permissions` | **L7** |
| 17 | `get_arrangement` / `save_arrangement` / `reset_arrangement` | A person's or the site's order of the rail and sidebars | `frappe/shell/arrangement.py:36,43,69` | Any user except Guest | App is active and app permission; site scope needs System Manager; the user is the session user (`:105`) | none |
| 18 | `get_boot` | The shell's boot data | `frappe/shell/boot.py:135-175` | Any user except Guest | App permission for the index (`:76`) and for the prefix (`:155`), before the app's boot hook runs | none |
| 19 | `get_addresses` | Every doctype's name, URL slug and module | `frappe/shell/doctypes.py:129-143` | Users with any app permission | None beyond that | L10 |
| 20 | `get_contents` | One app's doctypes | `frappe/shell/doctypes.py:184-202` | App permission | Only doctypes the user can read (`:175`) | none |
| 21 | `get_activity_timeline` (changed) | Paged activity feed | `frappe/desk/form/activity.py:68` | Any user except Guest | Read on the doc | none |
| 22 | `get_docinfo` (changed) | Now also returns everyone who favourited the record | `frappe/desk/form/load.py:96,137` | Any user except Guest | Read on the doc | L3 |
| 23 | `get_count` (refactored) | Row count through the new shared helper | `frappe/desk/reportview.py:71` | Any user except Guest | The user's permissions | none |
| 24 | `get_outgoing_senders` | The caller's outgoing email addresses | `frappe/email/inbox.py:43` | System Users | `is_system_user()`; rows filtered on the session user | none |
| 25 | `update_user_onboarding_status` (argument renamed) | Save onboarding steps | `frappe/onboarding.py:13` | Any user except Guest | Writes only the session user's record | none |
| 26 | `resend_invitation` (changed) | Resend a user invitation | `frappe/core/api/user_invitation.py:108` | Any user except Guest | `validate_role(app_name)` | none |
| 27 | `UserInvitation.resend_invite` (new document method) | Resend an invitation email | `frappe/core/doctype/user_invitation/user_invitation.py:71` | Anyone with read on User Invitation | The v1 document-method route checks read only (`frappe/handler.py:313`); the v2 route checks write | L6 |
| 28 | `DataImport.start_import` (newly whitelisted) | Queue a data import | `frappe/core/doctype/data_import/data_import.py:150` | Anyone with read on Data Import | Same as row 27 | L6 |

### 1b. Per-user overlays (records keyed by a user)

| # | Door | What it is | file:line | Who can reach | Check that runs | Gap |
|---|---|---|---|---|---|---|
| 29 | Favourite rows | One row per user per starred record | `favourite.json` permissions; rules at `favourite.py:49-65` | Desk User: read, delete, report. Nobody may create through REST | `has_permission` and query hooks in `hooks.py`: own rows only, unless System Manager | none (but see L3) |
| 30 | Doctype View rows | Site and personal list view settings | `doctype_view.json`, hooks in `hooks.py` | Desk User: read only | Site rows (no user) plus own rows; write only own rows | none |
| 31 | Rail and Sidebar user layers | A person's own rail and sidebar arrangement | `rail.json`, `sidebar.json`; reads at `frappe/shell/navigation.py:374,438` | Desk User: read only | Rail: own rows only. Sidebar: site rows plus own rows | none |
| 32 | Form Layout | Site form layouts | `form_layout.json` | System Manager only | Not per-user, so no hook needed | none |

Live check: a Desk User got `False` for read, write and delete on another user's Favourite, Rail,
Doctype View and Sidebar rows; `get_list` and `qb.get_query` returned none of them; and
`doctype_view.api.get` returned nothing. No desk v2 method accepts a user argument; every one uses
`frappe.session.user`.

### 1c. Boot payload

| # | Door | What it is | file:line | Who can reach | Check that runs | Gap |
|---|---|---|---|---|---|---|
| 33 | Site facts in boot | Version, site name, socket port, limits, cache versions | `frappe/shell/boot.py:29-45` | App permission | Site-wide, not per user | none |
| 34 | `session` block in boot | Own name, email, image, roles, site defaults | `frappe/sessions.py:226-247` | App permission | Own data only; defaults as in v1 | none in boot (the leak is door 1) |
| 35 | `app_order`, `prefixes` | Every active app and its URL prefix | `boot.py:43,47` | App permission | Not filtered | L10 |
| 36 | `apps` tiles (index only) | The app launcher | `boot.py:79-97` | App permission | Each tile checked with `has_app_permission` | none |
| 37 | `navigation.rail`, `navigation.sidebars` | The rail and sidebars | `frappe/shell/navigation.py:59-69`, filter at `frappe/shell/navigation_filter.py:23-99` | App permission | Only the site layer and the user's own layer are read; each item kind is filtered; unknown kinds are hidden | L5 |
| 38 | App boot hook keys | Extra keys an app adds | `boot.py:51-61` | App permission | Up to each app; framework keys are merged last, so a hook cannot overwrite the CSRF token or session | none |

### 1d. Stored scripts, by tier

| # | Door | What it is | file:line | Who writes / who runs | Check that runs | Gap |
|---|---|---|---|---|---|---|
| 39 | App tier: scripts shipped as files | Record, list and `custom/` scripts an app puts in its published folder | `frontend/src/contributions/registry.ts:68-88` | Written: the bench operator (code on disk). Runs: every user on every site of the bench | None; code on disk is trusted | L8 |
| 40 | Site tier: Client Script rows with view `Record` | A stored script, loaded as a real module from a blob URL in the page's own window | Load at `frontend/src/recordPage/evaluateClientScript.ts:9-13`, fetch at `frontend/src/recordPage/clientScripts.ts:139-145` | Written: System Manager only (same permission rows as develop). Runs: every user with read on the doctype | Delivery needs read on the doctype (door 14). No content check, the same as v1 | none beyond the v1 baseline |
| 41 | Form Layout `condition` | A JavaScript expression that picks a layout | `frontend/src/recordPage/formLayoutSource/chooseLayout.ts:37` | Written: System Manager. Runs: every reader of the doctype | Same kind of expression as v1's `depends_on` | none beyond the v1 baseline |
| 42 | Field `depends_on` family | Expressions on DocFields | `ui/src/components/FormLayout/dependsOn.ts:31` | Written: Customize Form / DocType (System Manager) | Same as v1 | none |
| 43 | Per-user tier | – | – | Does not exist. No DocType lets a user store code that runs anywhere | – | none |

### 1e. Route guard, published modules and the import map

| # | Door | What it is | file:line | Who can reach | Check that runs | Gap |
|---|---|---|---|---|---|---|
| 44 | Shell page `/apps` (index) | The built static `index.html`, no user data in it | `frappe/website/page_renderers/shell_page.py:56-75` | Anyone | A Guest is sent to login (`:63-65`); anyone else gets the page; boot then refuses a Website User. Never cached (`:59`) | L9 |
| 45 | Shell page `/apps/<prefix>/...` | The same static page | `shell_page.py:61-62`, `frappe/shell/permissions.py:37-47` | Anyone | `guard_prefix`: Guest to login, anyone without app permission gets 403; an app's own rule fails closed if it raises | none |
| 46 | `route_guard.py` | Stops website documents from claiming a route under `/apps`. Not an access check | `frappe/shell/route_guard.py:26-46` | Anyone saving a website document | Refuses the save | none |
| 47 | Frontend router | Turns doctype names into URLs and shows a not-found page; no permission logic | `frontend/src/router/index.ts:35-74` | – | All data checks are on the server | none |
| 48 | Import map and bundle | The fixed list of published module names, written into `index.html` at build time | `frontend/plugin/importMap.js:53-66`, checked by `frappe/shell/manifest.py:178-217` | Only an app on the bench, through `hooks.py`, at `bench build` | Each name must start with the app's name; a file must resolve inside the app's folder (symlinks and `..` followed); a package must be a declared dependency. No DocType, setting or URL adds a module at runtime | none |

### 1f. Caches

| # | Cache | file:line | Key | Holds per-user data? | Gap |
|---|---|---|---|---|---|
| 49 | Server caches in `frappe/shell/` | Prefix registry `registry.py:46-51`; doctype owners `doctypes.py:37-49`; address table `doctypes.py:112-122`; built shell page `shell_page.py:17-38`; boot size log `boot.py:115-117` | Shared, and tied to `metadata_version` or cleared on app install | No | none |
| 50 | Per-request memos | `NavigationContext` in `navigation_filter.py:145-268` | One object per resolution; the class avoids `@request_cache` on purpose (`:148`) | Yes, but not shared | none |

No desk v2 server code puts per-user data in `@request_cache`, `@site_cache` or `lru_cache`.
This matters because `@request_cache` is not cleared when `frappe.set_user` changes the user
inside one request. Browser-side: the record and list data cache (`ui/src/cache/dataCache.ts:26-27`)
is in memory and is dropped by the full page load at logout (`frontend/src/shell/session.ts:6-10`).
The `localStorage` keys hold layout preferences keyed by user. One `sessionStorage` key,
`frappe:desk:sidebar` (`frontend/src/navigation/sidebarMemory.ts:4`), maps visited paths to a
sidebar and is not keyed by user (L11).

### 1g. Realtime

The node realtime server (`realtime/`) is unchanged on desk v2. A socket joins a document room
only after `frappe.realtime.has_permission` (`realtime/handlers.js:43-66`), and only System Users
join the site room (`:8-9`). The v2 frontend rejoins document rooms on every reconnect
(`ui/src/socket.ts:60,90`).

| # | Call | file:line | Room | Who receives | Gap |
|---|---|---|---|---|---|
| 51a | `docinfo_update`, favourites | `frappe/desk/doctype/favourite/favourite.py:32-40` | Document room | Readers of the record | L3 |
| 51b | `docinfo_update`, shares | `frappe/core/doctype/docshare/docshare.py:103-118` | Document room | Readers of the record | none (v1 docinfo already shows shares) |
| 51c | `docinfo_update`, tags | `frappe/desk/doctype/tag_link/tag_link.py:40-56` | Document room | Readers of the record | none |
| 51d | `client_script_changed` | `client_script.py:78-80,118` | Site room | System Users | none (a doctype name only) |
| 51e | `doctype_update` | `frappe/desk/doctype/form_layout/form_layout.py:114-116` | Site room | System Users | none (develop already sends this) |

### 1h. HTML rendering

`frontend/src` has no `v-html`. HTML reaches the page through `@framework/ui` components and
frappe-ui. Every string field that contains `<` or `>` is cleaned on save by `sanitize_html`
(`frappe/model/base_document.py:1400-1438`, `frappe/utils/html_utils.py:156`), except Attach,
Attach Image, Code, JSON, Barcode, email Data fields and fields marked `ignore_xss_filter`.
A value with no `<` or `>` (for example a bare URL) is never checked.

| # | Sink | file:line | Input and who writes it | Cleaned? | Gap |
|---|---|---|---|---|---|
| 52a | `innerHTML` on a div made by the live page | `ui/src/components/ActivityTimeline/utils.ts:111-112`, called from `EmailContent.vue:29` | Email body (`Communication.content`): outside senders | Server cleaner only; the client's own stripping runs after this step | **M1** |
| 52b | iframe `srcdoc` | `EmailContent.vue:4` | Email body | Server cleaner, client stripping, sandbox without scripts, CSP meta tag | none |
| 52c | Read-only editor for comments | `ui/src/components/ActivityTimeline/CommentItem.vue:32-40` | Any desk user who can comment | `Comment.validate` cleans on save (`comment.py:74`); the editor keeps only known tags | none |
| 52d | `innerHTML` for a quoted reply | `ui/src/components/Composer/ComposerEditor.vue:358` | Built from text nodes | DOMPurify (`ui/src/utils/sanitize.ts`) | none |
| 52e | `<a :href>` for a Link navigation item | `frontend/src/shell/SidebarRow.vue:42`, `frontend/src/shell/RailColumn.vue:51`, value from `frappe/desk/navigation_item_type/link/frontend/item.js:13` | `Navigation Item.url`: System Manager or an app's JSON. A user's own arrangement cannot set it (`arrangement.py:33`) | No URL scheme check | L1 |
| 52f | `window.open(value)` | `ui/src/components/Fields/AttachField.vue:167` | Attach field value: any user with write on the record | No scheme check; Attach is skipped by the server cleaner | L2 |
| 52g | `v-html` code preview | `ui/src/components/Fields/CodePreview.vue:9,33,36` | Markdown, HTML and Code field values: the record's writer | DOMPurify defaults, which keep `<style>` and `<form>` | L4 |
| 52h | `v-html` HTML field | `ui/src/components/Fields/HtmlField.vue:4` | DocType options (admin) | DOMPurify | none |
| 52i | Icon sprite `innerHTML` | `frontend/src/icons/sprite.ts:28` | A fixed file shipped in the build | Trusted source | none |
| 52j | Icon field | `frontend/src/icons/Icon.vue:6,19` | Navigation rows, including a user's own overrides | An emoji is shown as text; a name only becomes a reference to an existing sprite symbol | none |
| 52k | frappe-ui error message and toast | `ErrorMessage.vue:6`, `toast.ts:18` | Server messages, translations | DOMPurify | none |

Labels (tags, navigation items, link titles, activity lines) render as plain text. Two `ui/src`
components with unsanitised `v-html` (`ui/src/components/Notifications/NotificationItem.vue:60,66`
and `ui/src/components/DataImport/PreviewStep.vue:50,135`) are not imported by the desk.

## 2. Gaps, by severity

Each gap names the pull request that made the door, with one sentence on what that PR did.

### Medium

| ID | Gap | Where | Smallest fix | Made by |
|---|---|---|---|---|
| M1 | Email HTML is parsed into an element of the live page before the sandbox. Inline event handlers and remote images in that HTML act at this step, so the only barrier is the server cleaner on `Communication.content`. A Communication row written without the normal save (direct `db_set`, SQL, app code) would run script as the reader | `ui/src/components/ActivityTimeline/utils.ts:111-112`, called first at `EmailContent.vue:29` | Parse once with `DOMParser`, which runs nothing; strip active content, then colours, then fold quotes on that one document | PR #40216, which added the `ActivityTimeline` component to `ui/` |
| M2 | A signed-in Website User (a portal customer or supplier) gets every site default from the session endpoint: about 97 keys on the dev site, including login and password policy settings and company defaults. v1 gives such a user 8 formatting keys (`frappe/website/utils.py:196-205`) | `frappe/sessions.py:233,247`, reached through `frappe/api/v2.py:94,714` | Send defaults only to System Users, as the Guest case already does; add a Website User test next to the Guest one | PR #43019, which moved the session and boot data onto REST API v2 |
| M3 | A signed-out visitor can list DocType names and modules through the v2 link search. v1's `search_link` refuses Guest (confirmed live: v2 answered 200, v1 answered 403) | `frappe/api/v2.py:239`, permissions skipped for DocType at `frappe/desk/search.py:303` | Refuse Guest at the top of `search()` | PR #43002, which moved the desk's lists onto v2 and added this search route |
| M4 | The attach route returns the record's full attachment list and owner names without a read check. For Guest, when "Allow Guests to Upload Files" is on (off by default), `upload_file` skips the write check too, so a Guest can read a record's file list. Not confirmed live, since that needs a settings change | `frappe/api/files.py:48` | Call `doc.check_permission("read")` before building the answer, or return only the new File | PR #43080, which moved file upload, attach and detach onto v2 routes |

### Low

| ID | Gap | Where | Smallest fix | Made by |
|---|---|---|---|---|
| L1 | A Link navigation item's URL has no scheme check, so a non-web URL saved on a site rail or sidebar runs on click for every user. Only a System Manager or an app can write it, and a System Manager can already run script for all users | `frappe/desk/doctype/navigation_item/navigation_item.py:41`, `link/frontend/item.js:13` | Accept only http(s) or a path starting with `/` in `validate`, and return nothing from `render()` for other schemes | PR #42425, which rendered every navigation item kind through the app contribution folders |
| L2 | An Attach field value is opened with `window.open` and no scheme check. Any user with write on the record sets it; another user opens it. `noopener` gives the new window a blank origin, so this rests on browser behaviour | `ui/src/components/Fields/AttachField.vue:167`; Attach skipped by the cleaner at `base_document.py:1428` | Open only http(s) values; better, reject other schemes for Attach values on the server | PR #39780, which added the `FormLayout` form renderer to `ui/` |
| L3 | Every reader of a record sees who favourited it, in docinfo, the v2 include and the realtime message, while the Favourite doctype limits rows to their owner. PR #42777 chose this on purpose ("lists everyone who favourited the record on hover"), so the design and the doctype rule disagree. The realtime message also sends the whole row though the page only re-reads | `favourite.py:32-40,90-97`, `frappe/api/include.py:110`, `load.py:137` | Either document favourites as visible to readers, or return only the caller's row. Trim realtime messages to key, action and name | PR #42777 (the favourite star), PR #42908 (realtime `docinfo_update` for shares, tags, favourites), PR #42990 (the record page on v2) |
| L4 | The code and HTML preview allows `<style>` and `<form>`, so a field value can restyle the desk page or draw a fake form for later readers. No script runs. The server skips Code fields | `ui/src/components/Fields/CodePreview.vue:33,36` | Forbid `style` and form tags in the DOMPurify call, or render in a sandboxed iframe as email does | PR #39780 (the `FormLayout` renderer) |
| L5 | A navigation "Record" item only checks read on its doctype, so its name and label reach users whose User Permissions exclude that record | `frappe/desk/navigation_item_type/record/record.json`, applied at `navigation_filter.py:63-77` | Check each Record item with `has_permission`, or document the rule | The navigation filter work (not traced to one PR) |
| L6 | Two new document methods (resend an invitation, start a data import) act with only read permission through v1's document-method route. No effect today, since both doctypes are System Manager only; a custom read-only role would open it | `user_invitation.py:71`, `data_import.py:150`, v1 route at `frappe/handler.py:313` | `self.check_permission("write")` at the top of each | PR #43095, which moved the desk's last v1 calls onto v2 |
| L7 | Any signed-in user, Website Users included, can write Error Log rows with their own title, text and reference, up to 30 a minute. Admins see them as real script failures. The text is shown as text | `frappe/desk/customization_error.py:27-80` | Require a System User | PR #42919, which added the endpoint the record page posts script failures to |
| L8 | Scripts from an app that is disabled on this site, or installed only on another site of the bench, still run on this site's pages. Stored scripts respect disabled modules; page replacements are filtered (`registry.ts:119`); file scripts are not | `frontend/src/contributions/registry.ts:68-88`; bench-wide bundle at `manifest.py:131` | Skip a contribution whose app is not in `appOrder`, as `:119` does | PR #42173, which ran app record customizations through the engine; the bench-wide bundle came from PR #42172 |
| L9 | A signed-in Website User gets the shell HTML at `/apps` instead of a 403; boot then refuses them, so they see an empty shell | `frappe/website/page_renderers/shell_page.py:63-65` | Call `guard_prefix` for everyone on the index, not only for Guest | PR #42171, which served apps by prefix under `/apps` |
| L10 | Any desk user gets the names of every active app and every doctype, including doctypes they cannot read. v1 sends more of this kind (all app versions, the module map) | `boot.py:43,47`, `doctypes.py:129-143` | None needed; note it | PR #42171 and PR #42277, which gave every doctype an address under every prefix |
| L11 | The impersonation marker v1 sets in boot (`frappe/sessions.py:216`) is missing from v2, so an admin impersonating someone sees no reminder. Separately, the sidebar memory in `sessionStorage` is not keyed by user | `get_session_info` in `frappe/sessions.py:226`; `frontend/src/navigation/sidebarMemory.ts:4` | Add `impersonated_by` to the session block and show a banner; key the sidebar memory by user | PR #43019 (session on v2) |

## 3. Desk v1 compared with desk v2

### Stored scripts

| | v1 (develop) | v2 (desk-v2) |
|---|---|---|
| Who can write | System Manager and Administrator | The same permission rows; no per-user tier |
| How the text reaches the browser | Inside the doctype meta from `getdoctype` (`frappe/desk/form/load.py:64`, `meta.py:143-186`), with no read check on the doctype | `get_client_scripts` needs read on the doctype; `Record` rows are kept out of v1's meta (`meta.py:163-176`) |
| Who runs it | Every desk user who opens the form or list | Every user with read on the doctype who opens the record page |
| Where it runs | Form and list | Record page only; on lists, only app file scripts |
| What it can reach | The whole window and the viewer's session | The same; it is a real module and can import the published names |
| Server check on content | None | None (a warning about unknown CSS classes only) |
| Verdict | | **Narrower**: the same writers, less delivery, fewer pages |

### Boot data (desk user)

| Data | v1 (`frappe/boot.py`, `frappe/sessions.py`) | v2 |
|---|---|---|
| Site defaults | Full | Full, in `session.defaults` |
| Own user | Roles, readable and writable doctype lists, defaults, recent items | Name, email, image, follow setting, roles |
| App versions | Every app | Frappe only |
| Config values | Developer mode, socket and file-watcher ports, error email, Sentry DSN and more | Socket port and a dev-server flag |
| Doctype maps | Module map, single types, tree lists, and more | Not in boot; all doctype names come from `get_addresses` |
| Navigation | Workspaces, sidebars, dock, filtered by permission | Rail and sidebars, filtered by permission |
| Impersonation marker | Yes | No (L11) |
| Website User | 8 formatting keys | Full site defaults through `/api/v2/session` (M2) |
| Verdict | | **Narrower** for desk users; **wider** for Website Users |
