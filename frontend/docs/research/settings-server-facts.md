# What the server gives desk v2 for settings

Research for frappe/frappe#45150, on map frappe/frappe#45148. It records facts and makes no decision.

Read on `upstream/desk-v2` at `f53bed6a7f`. Paths are relative to the frappe repo root. Live checks
ran against `desk.localhost`, which runs the bench checkout of `desk-v2` at the same sha. They used
two non-admin users with minted sessions, deleted after the checks:

- `john.demo@example.com`: roles Desk User and Sales User.
- `sarah.demo@example.com`: roles Desk User, Sales User and Sales Manager.

No check changed data. The two write attempts below failed before the save.

## 1. The v2 routes for a Single

| Act | Route | Handler |
|---|---|---|
| Read | `GET /api/v2/document/<doctype>/<name>` | `read_doc`, `frappe/api/v2.py:109-121`, rule at `:750` |
| Update | `PATCH` or `PUT /api/v2/document/<doctype>/<name>` | `update_doc`, `frappe/api/v2.py:301-315`, rule at `:752` |
| Meta | `GET /api/v2/doctype/<doctype>/meta` | `get_meta`, `frappe/api/v2.py:324-327`, rule at `:768` |

There is no Single-only route. A Single uses the document routes.

### The name in the URL

Use the doctype name, for example `/api/v2/document/System%20Settings/System%20Settings`. That is the
`name` the server puts on the record. But the server does not read the name for a Single:

- `Document.__init__` keeps the URL name (`frappe/model/document.py:763`).
- `load_from_db` reads `tabSingles` for the doctype and then sets `name` to the doctype
  (`frappe/model/document.py:811-819`).
- Live: `GET /api/v2/document/CRM%20Settings/whatever` as sarah returned 200 with
  `name: "CRM Settings"`.

So any name returns the Single. A client that uses another name gets a reply whose `name` differs
from the name it asked for.

### What a read returns

`read_doc` checks `read`, removes the fields the user may not read, adds the `include` parts and
returns `doc.as_dict()` (`frappe/api/v2.py:110-121`). The body is `data` with:

- `name` (the doctype), `doctype`, `owner`, `creation`, `modified`, `modified_by`, `idx`, `docstatus`.
- Every value field of the doctype, and each table field as a list of rows.

A Single that was never saved still answers 200. `load_from_db` falls back to `frappe.new_doc`
defaults (`frappe/model/document.py:812-815`).

`?include=permissions` adds a `permissions` part, which is `get_doc_permissions(doc)`
(`frappe/api/include.py:170-171`). Section 3 shows where this part and the server disagree.

### What an update does

`update_doc` (`frappe/api/v2.py:301-315`):

1. Loads the record with `for_update=True` (`:304`).
2. Checks `write` (`:305`).
3. Drops `flags` from the body and copies every other key onto the record (`:306-307`). The body
   can hold only the changed fields. `Document.update` skips only a short reserved list
   (`frappe/model/document.py:2822`, list at `:4199-4209`).
4. Runs a full `save()` (`:308`). For a Single that writes `tabSingles` (`frappe/model/document.py:1159-1160`).
5. Removes the unreadable fields and returns the saved record (`:309-315`).

`save()` runs `validate`, `before_save`, `on_update` and the rest of the controller
(`frappe/model/document.py:1113-1172`).

## 2. The current User: what a non-admin reads and writes

### Access comes from a share, not from a role

The User doctype gives no role read or write except System Manager. Desk User has `select` only
(`frappe/core/doctype/user/user.json:960-984`):

| Role | permlevel | Rights |
|---|---|---|
| System Manager | 0 | all |
| System Manager | 1 | read, write |
| Desk User | 0 | select |

A user reaches their own record through a DocShare:

- `User.on_update` calls `share_with_self` (`frappe/core/doctype/user/user.py:344`).
- `share_with_self` adds a share with `write=1, share=1` for every user except Administrator and Guest
  (`frappe/core/doctype/user/user.py:493-499`). `add_docshare` always adds `read`
  (`frappe/share.py:49-59`).
- `has_permission` falls back to shares when the role check fails (`frappe/permissions.py:184-216`).
- Live: every one of the 8 users on the site has this share row with read, write and share.

`if_owner` plays no part. The User doctype has no `if_owner` row, and the share is what grants access.

The controller hook only denies. `frappe.core.doctype.user.user.has_permission` is registered in
`frappe/hooks.py:222`. It refuses Administrator and Guest to anyone but Administrator
(`frappe/core/doctype/user/user.py:1483-1487`). A hook cannot grant a right
(`frappe/permissions.py:488-505`).

Live, as john:

| Request | Result |
|---|---|
| `GET /api/v2/document/User/john.demo%40example.com` | 200 |
| `GET /api/v2/document/User/sarah.demo%40example.com` | 403 `PermissionError` |
| `GET /api/v2/document/User/Administrator` | 403 `PermissionError` |
| `frappe.client.has_permission`, User, own record, `write` | `true` |

### Which fields a non-admin can write

The writable set is every permlevel-0 field. The mechanism is permlevel:

- `get_permlevel_access` lists the permlevels that the user's roles hold
  (`frappe/model/document.py:1647-1655`). It reads roles only, not shares. For john on User it
  returns `[]` for read and for write (live, in-process).
- `validate_higher_perm_levels` runs on every save. For each field above permlevel 0 that the user
  cannot write, it puts back the stored value (`frappe/model/document.py:1622-1634`,
  `:4076-4108`). It does not raise an error. The save succeeds and the value does not change.
- A field's `read_only` is not checked on save. `frappe/model/document.py` reads only the
  doctype's `read_only` (`:2274`) and the site's read-only mode (`:2534`, `:2567`), and no other
  file in `frappe/model/` reads a field's `read_only`. So `enabled`, which is `read_only` in the form
  (`frappe/core/doctype/user/user.json:127-132`), is writable by the user over the API.

The User fields at permlevel 1, so not writable by a non-System-Manager: `role_profile_name`,
`roles`, `reset_password_key`, `user_emails`, `block_modules`, `user_type`, `login_after`,
`login_before`, `restrict_ip`, `third_party_authentication`, `api_key`, `api_secret`,
`role_profiles`, `bulk_actions` and a few section breaks and buttons.

All other fields (92 of them, including layout fields) are permlevel 0. The ones a settings pane
would show are all here: names, `username`, `user_image`, `language`, `time_zone`, `desk_theme`,
`dock_mode`, the list, form and report switches, the email switches, `email_signature`, `defaults`.

### What the User controller adds on save

`User.validate` (`frappe/core/doctype/user/user.py:235-277`) and `User.on_update`
(`:342-381`) run on every save. The parts that matter for settings:

- `set_full_name` rebuilds `full_name` from the three name fields (`:392-393`).
- `validate_allowed_modules`: if `module_profile` is set, it replaces `block_modules` with the
  profile's list (`:263`, `:331-336`). `module_profile` is permlevel 0 and `block_modules` is
  permlevel 1. The permlevel reset runs before `validate` (`frappe/model/document.py:1146-1148`),
  so a user who sets `module_profile` changes their own blocked modules.
- `new_password` is permlevel 0. A save with it sets the password without the old password
  (`:236-238`, `:348`, `:408-411`, `:523`). The whitelisted `update_password` asks for the old one
  (`:1072-1074`).
- `on_update` writes user defaults: `time_zone` always, and `date_format`, `time_format`,
  `number_format`, `first_day_of_the_week` when `language` changes (`:358-372`).
- `on_update` clears the user's cache (`:346`).

### What a read of the own User returns

The unreadable permlevel-1 fields stay in the body, with an empty value. See section 4. Live, as john:
`roles: []`, `user_type: null`, `api_key: null`, `bulk_actions: 0` (stored value 1). The body has
86 keys, including `active_sessions`.

## 3. Read and write permission on a Single

### How the check runs

`read_doc` calls `doc.check_permission("read")` and `update_doc` calls
`doc.check_permission("write")` (`frappe/api/v2.py:111`, `:305`). That calls
`frappe.permissions.has_permission(doctype, ptype, doc)` (`frappe/model/document.py:951-968`):

1. Administrator gets everything (`frappe/permissions.py:109-111`).
2. A doctype in a disabled module is refused (`:135-137`).
3. For a Single, the doc is always the singleton, even with no doc passed (`:139-141`).
4. `get_doc_permissions` runs the controller hooks, then the role rows at permlevel 0
   (`:244-248`, `:321-322`), then `if_owner` (`:262-266`), then user permissions (`:271-280`).
   Strict user permissions are off for a Single (`:372-375`).
5. If the roles do not allow it, a share can (`:214-216`).

Rights at permlevel 0 decide access to the record. Rights at a higher permlevel only decide fields.

### What a user with no read gets

HTTP 403 with one error of type `PermissionError`. `PermissionError` has `http_status_code = 403`
(`frappe/exceptions.py:41-42`). The message names the doctype, because the doc is a Single
(`frappe/permissions.py:152-158`). Live, john reading System Settings:

```json
{"errors": [{"type": "PermissionError",
  "message": "User <strong>john.demo@example.com</strong> does not have access to this document: System Settings",
  "title": "Message", "as_table": false, "exception": "Traceback ..."}]}
```

A `PATCH` without `write` gives the same 403 before any save (`frappe/api/v2.py:305`). Live,
john patching System Settings: 403.

The meta route answers any desk user, readable Single or not. It checks only the `All` role
(`frappe/api/v2.py:325`). Live, john got 200 for System Settings meta.

### Ways to know read or write before rendering a block

| Way | Requests | Matches the server? |
|---|---|---|
| The read itself, 403 means hide | One per Single, already needed for the values | Yes |
| `GET /api/v2/method/frappe.client.has_permission?doctype=&docname=&perm_type=` (`frappe/client.py:328-336`) | One per Single and right | Yes. Live: john got `false` for System Settings `read` and `true` for own User `write`. |
| Meta `permissions` rows crossed with session `roles`, as `useDocPermissions` does (`ui/src/composables/useDocPermissions.ts:32-56`) | None beyond meta | Role rows only. It misses shares, controller hooks, user permissions and disabled modules. |
| The `permissions` part (`?include=permissions`) | Part of the read | No for shared records. See below. |

### The `permissions` part misses shares

The part is `get_doc_permissions(doc)` (`frappe/api/include.py:171`). Shares are added later, in
`has_permission` (`frappe/permissions.py:214-216`), so the part never sees them.
`frappe.client.get_doc_permissions` is the same function (`frappe/client.py:339-347`).

Live, john reading his own User with `?include=permissions` got `read: 0, write: 0`. The read
itself succeeded, and `has_permission` says `write: true`.

The record page gates its writes on this part (`frontend/src/pages/Record.vue:779`,
`frontend/src/pages/record/panel/RecordIdentity.vue:81`, `frontend/src/pages/record/feed/FilesTab.vue:95`).
So a block bound to the session User cannot use this part to decide if it is editable.

For a Single that nobody has shared, the part is correct. Live: sarah on CRM Settings
got `read: 1, write: 1`, john on Stock Settings got `read: 1, write: 0`.

## 4. permlevel and what a read returns

Yes, permlevel changes the read. But the field is not removed from the body. Its value is replaced
with an empty value.

1. `apply_fieldlevel_read_permissions` deletes each field above permlevel 0 that the user's roles
   cannot read (`frappe/model/document.py:1558-1588`). Administrator skips this (`:1560-1561`).
2. `as_dict` then builds the body from every valid field of the meta, not from the attributes on
   the record (`frappe/model/document.py:3061-3122`, `as_dict` at `:3189-3199`). A deleted field
   comes back as `None`, then gets its type's empty value: Check becomes `0` (`:3089-3090`), Int `0`,
   Float and Currency `0.0`, Table `[]` (`:3205-3216`).

Live, as sarah on CRM Settings: `enable_frappe_crm_data_synchronization` (Check, permlevel 1) and
`allowed_users` (Table MultiSelect, permlevel 1) are in the body as `0` and `[]`. Live, as john on
his own User: `bulk_actions` reads `0`, but the stored value is `1`.

So the body alone does not tell "hidden" from "empty". A client that needs to know uses the meta
`permlevel` and the session roles. `useDocPermissions.fieldAccess` does this
(`ui/src/composables/useDocPermissions.ts:50-56`). This matches the server, which also counts
roles only (`frappe/model/document.py:1647-1655`).

On save the server protects these fields. If the client sends the empty value back,
`validate_higher_perm_levels` restores the stored value (section 2).

Desk v1 shows the same field to everyone. Its user settings dialog has an *Allow bulk actions*
switch (`frappe/public/js/frappe/ui/user_settings_dialog.js:213-218`). For a non-System-Manager the
save shows "Saved" and the value does not change.

## 5. Saving: desk v1 `set_value` and the v2 way

### How desk v1 saves

1. The dialog loads one User with `frappe.db.get_value` (`frappe/public/js/frappe/ui/user_settings_dialog.js:70-107`).
2. Each change calls `_save_user`, which calls `frappe.db.set_value("User", frappe.session.user, ...)`
   (`:111-113`). A switch saves when it changes (`:151-156`).
3. `frappe.db.set_value` calls `frappe.client.set_value` (`frappe/public/js/frappe/db.js:68-81`).
4. `frappe.client.set_value` loads the record, copies the values on it and calls `save()`
   (`frappe/client.py:182-225`). It strips the standard fields first, `modified` included
   (`:202-211`). So the save never checks for a newer copy, and the last write wins.
   The reply is `doc.as_dict()` without the permlevel filter (`:225`).

After the save, v1 changes boot values in place and shows a "Refresh to see changes" toast
(`user_settings_dialog.js:115-123`):

| v1 boot value | Changed for | Where |
|---|---|---|
| `frappe.boot.user[field]` | `first_name`, `last_name`, `email_signature`, `language`, `mute_sounds`, `send_me_a_copy`, `send_read_receipt`, `show_absolute_datetime_in_timeline` | `:3-12`, `:124-139` |
| `frappe.boot.user_info[user].fullname` | name save | `:409-411` |
| `frappe.boot.user_info[user].image` | image upload | `:424-427` |
| `frappe.boot.desk_settings.dock_mode` | dock mode | `:577-580` |

Session defaults save through a separate method and then clear the cache (`:835-844`).

### The v2 equivalent

`PATCH /api/v2/document/User/<session user>` with the changed fields and `modified`
(`frappe/api/v2.py:301-315`). For a Single, the same route with the doctype name. The desk v2
wrapper is `updateDocument(doctype, name, doc)` (`ui/src/api/index.ts:191-209`).

It differs from `set_value` in four ways:

- **Conflict check.** `updateDocument` refuses a body without `modified` (`ui/src/api/index.ts:197-204`).
  The server keeps `modified` from the body (`frappe/model/document.py:1354`) and compares it with
  the stored value (`:1689-1717`). A stale value gives 417 `TimestampMismatchError`
  (`frappe/exceptions.py:24-25`, `:168`). Live, john patching his User with an old `modified`: 417,
  and the record did not change.
- **Each save changes `modified`.** A pane that saves field by field must take `modified` from each
  reply before the next save. Two blocks bound to the same record share one `modified`.
- **Reply filter.** The v2 reply has the permlevel filter (`frappe/api/v2.py:309`). The v1 reply does not.
- **Standard fields.** v2 does not strip them. It copies every body key except `flags` and the
  reserved list (`frappe/api/v2.py:306-307`).

`frappe.client.set_value` is still reachable as `POST /api/v2/method/frappe.client.set_value`
through the generic method route (`frappe/api/v2.py:736`). It is not the document route.

### Which desk v2 boot values go stale after a save

Desk v2 boot carries `session` from `get_session_info` (`frappe/shell/boot.py:36`,
`frappe/sessions.py:228-248`). The shell provides `boot` as a plain object (`frontend/src/main.ts:82`)
and publishes `boot.session` as the session store (`:83`, `ui/src/composables/useSession.ts:43-56`).
`useSession().reload()` fetches `GET /api/v2/session` and replaces the store value
(`useSession.ts:38`, `:74-92`). It does not change `boot.session`, which many components read
directly.

After a User save:

| Value | Changed by | Read by |
|---|---|---|
| `session.user.full_name` | name fields (`frappe/core/doctype/user/user.py:392-393`) | the rail avatar and menu header, from `boot.session` (`frontend/src/shell/RailColumn.vue:73-77`, `:236`) |
| `session.user.user_image` | `user_image` | the same rail lines |
| `session.user.document_follow_notify` | `document_follow_notify` | the record page's Follow, from `boot.session` (`frontend/src/pages/Record.vue:276`, `frontend/src/pages/record/follow.ts:5-11`) |
| `session.lang` | `language` | translations, loaded once at start (`frontend/src/main.ts:49`) |
| `session.defaults` | `time_zone`, and date, time and number formats on a `language` change (`user.py:358-372`) | field formatting, from the session store (`ui/src/components/FormLayout/formatDefaults.ts:45`) |

`session.defaults` is the site defaults with the user's defaults on top
(`frappe/defaults.py:105-116`). It is empty for a user who is not a System User
(`frappe/sessions.py:235`, `:247`).

`session.timezone` is the system time zone (`frappe/sessions.py:246`, `frappe/utils/data.py:389-391`).
A User `time_zone` save does not change it. A System Settings save does.

After a Single save: System Settings writes each changed field as a site default
(`frappe/core/doctype/system_settings/system_settings.py:215-230`). So `session.defaults` and
`session.timezone` go stale. Other Singles change no boot value unless their controller does.

`session.roles` does not change on a self-save, because `roles` is permlevel 1.
