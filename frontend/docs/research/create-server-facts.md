# What the server gives desk v2 for a create

Research for frappe/frappe#44895. It records facts and makes no decision.

Read on `upstream/desk-v2` at `42dc370637`. Paths are relative to the frappe repo root. Live checks
ran read-only against the `crm-local` site with `frappectl`. That site runs the bench's own frappe
checkout, not `desk-v2`, so a live result only confirms behaviour; the code lines below are the
source.

## 1. The doctype-level create right

### What desk v1 uses

- The v1 boot calls `frappe.get_user().load_user()` (`frappe/boot.py:465-467`). That walks every
  doctype and the user's permission rows (`frappe/utils/user.py:119-190`) and ships lists such as
  `can_create` and `in_create` (`frappe/utils/user.py:296-317`).
- A doctype lands in `can_create` when the user has `create` at permlevel 0, the doctype is not a
  child table or single, and its "User Cannot Create" flag (`in_create`) is off. With that flag on,
  it lands in `in_create` instead (`frappe/utils/user.py:141-146`).
- `frappe.model.can_create` is a lookup in that list (`frappe/public/js/frappe/model/model.js:369-371`).
  The list view reads it once (`frappe/public/js/frappe/list/base_list.js:56`) and shows New only
  when it is true and the site is not in read-only mode (`frappe/public/js/frappe/list/list_view.js:396`).
- `in_create` hides the button only. Nothing on the insert path reads it (no use in
  `frappe/model/document.py` or `frappe/permissions.py`).

### What desk v2 has today

| Source | Has a doctype-level create answer? | Where |
|---|---|---|
| Shell boot (`frappe.shell.boot.get_boot`) | No. It carries `session` and `read_only_mode`, no permission lists. | `frappe/shell/boot.py:26-48` |
| `GET /api/v2/session` (also inside boot) | No. It has `user`, `roles`, `lang`, `timezone`, `defaults`. | `frappe/sessions.py:228-248`, `frappe/api/v2.py:90-106` |
| `GET /api/v2/doctype/<dt>/meta` | Not as an answer, but it carries the raw permission rows (`permissions`, with Custom DocPerm already swapped in) and the flags `in_create`, `issingle`, `istable`. | `frappe/api/v2.py:324-327`, `frappe/model/meta.py:651-668` |
| `?include=permissions` | Only on a record read. The meta route's only part is `children`. | `frappe/api/include.py:170-171`, `frappe/api/include.py:198` |
| `useDocPermissions` | `can(right)` reads the record's `permissions` part, so it is false with no record. `fieldAccess` crosses meta rows with session roles. | `ui/src/composables/useDocPermissions.ts:25-63` (`can` at :58) |

The list page already loads the meta and calls `useDocPermissions(doctype)` with no record
(`frontend/src/list/useListPage.ts:77-78`). The session, with roles, is published from boot before
mount (`frontend/src/main.ts:75`).

### How the server decides "create" with no record

`frappe.permissions.has_permission(doctype, "create")` with no doc:

1. Administrator is allowed everything (`frappe/permissions.py:311-313`).
2. A doctype whose module is disabled is refused (`frappe/permissions.py:135`).
3. Otherwise it keeps the meta permission rows whose role the user holds and whose permlevel is 0,
   and reads `create` off them (`frappe/permissions.py:168-174`, `:321-334`). `if_owner` does not
   narrow `create` (`frappe/permissions.py:339`).
4. Sharing cannot grant `create` (it is not a shareable right, `frappe/permissions.py:185-189`).

On insert the server checks again, this time with the new record (`frappe/model/document.py:1030`,
`:950-967`). That adds the controller `has_permission` hook (`frappe/permissions.py:244`) and user
permissions on the record's link values (`frappe/permissions.py:271-276`). So a doctype-level "yes"
can still end in a refused insert.

### Ways the list could know, and their cold-load cost

| Way | Extra requests on a cold list load | Matches the server? |
|---|---|---|
| Compute in the browser from meta `permissions` rows, session `roles`, `in_create`, `issingle`, `istable` and boot `read_only_mode` | None. Meta and roles are already loaded. | Same rows and same role list as step 3 (`frappe.get_roles` gives Administrator every role, `frappe/permissions.py:556-557`). It does not see a disabled module (step 2), and Administrator's "allow everything" differs only on a doctype with no create row for any role. |
| `GET /api/v2/method/frappe.client.has_permission?doctype=<dt>&docname=&perm_type=create` | One small GET per doctype. | Yes, steps 1-4. It works only because an empty `docname` falls through to the doctype-level path (`frappe/client.py:328-335`); `docname` is a required parameter. Live on `crm-local`: `{"has_permission": true}` for Tag. |
| `frappe.permissions.has_permission` directly | Not callable. | It is not whitelisted (`frappe/permissions.py:81-82`); live call refused with "not whitelisted". |
| A `can_create` list in the v2 boot, as v1 does | None after boot, but every boot pays `build_permissions` over all doctypes. | Yes, at v1's level. Not present in v2 today. |

## 2. A name from a prompt (`__newname`)

Yes. `POST /api/v2/document/<doctype>` accepts `__newname` for a prompt-named doctype, the same way
`frappe.client.insert` does.

The path:

1. The JSON body becomes `frappe.form_dict` unchanged (`frappe/app.py:368-381`).
2. `create_doc` calls `frappe.new_doc(doctype, **data)` (`frappe/api/v2.py:278-287`). `new_doc`
   ends in `doc.update(kwargs)` (`frappe/model/document.py:4417-4438`), which copies every key
   except a short reserved list (`frappe/model/document.py:2814`, list at `:4158-4168`).
   `__newname` is not reserved, so it sits on the document.
3. `insert` calls `set_new_name` (`frappe/model/document.py:1034`). For `autoname` equal to
   `prompt` (compared lower-case) it takes `__newname`, runs `validate_name` and stops
   (`frappe/model/document.py:1292-1296`). `validate_name` strips spaces and refuses an empty name,
   `<` or `>`, and a name equal to the doctype (`frappe/model/naming.py:521-548`).
4. If `__newname` is missing, prompt naming throws "Please set the document name"
   (`frappe/model/naming.py:607-614`).

`frappe.client.insert` reaches the same `set_new_name` through `frappe.get_doc(doc).insert()`
(`frappe/client.py:229-235`, `:533-549`). Desk v1's form save instead copies `__newname` into
`name` before saving (`frappe/desk/form/save.py:110-111`).

Nothing is missing for prompt naming. Two related facts:

- If the body carries `name`, v2 sets `flags.name_set` (`frappe/api/v2.py:284-285`) and
  `set_new_name` returns at once (`frappe/model/document.py:1287-1288`). That skips `__newname`,
  the doctype's naming rule and `validate_name`, for any naming rule, not only prompt.
- Live `crm-local` meta for Tag reads `autoname: "Prompt"`, `naming_rule: "Set by user"`. The
  server lower-cases before comparing; v1's link-field shortcut compares `=== "prompt"`
  (`frappe/public/js/frappe/model/create_new.js:50`).

There is no `/api/v2` test that posts `__newname`. Existing coverage is through `frappe.get_doc`
(`frappe/tests/test_naming.py:370-389`).

## 3. Defaults

### What the server fills on insert

`insert` calls `_set_defaults` first (`frappe/model/document.py:1027`). It builds a new-doc template
with `frappe.new_doc(doctype, as_dict=True)` and copies each value into a field that is `None`
(`frappe/model/document.py:1671-1686`, `update_if_missing` at `:2831-2843`). An empty string is
not `None`, so a field sent as `""` keeps `""`; a field sent as `null` or left out gets the default.
Child rows get their own defaults the same way.

The template (`frappe/model/create_new.py`), in the order the server applies it:

| Default | Server rule | Where |
|---|---|---|
| User-permission default | A Link field gets the user's "Is Default" allowed record, or the only one. Not for Link to User, not when the field ignores user permissions. | `create_new.py:84-86` |
| User default | A Link field gets `frappe.defaults` keyed by fieldname, if user permissions allow it. | `create_new.py:88-97` |
| `__user` | Session user. | `create_new.py:103-104` |
| `Today` | `nowdate()`. | `create_new.py:106-107` |
| Plain `default` | Kept if user permissions allow it (Links); skipped for the title field. | `create_new.py:73-78`, `:109-116` |
| Select with no default | First option. | `create_new.py:118-119` |
| `:Doctype` default | Value from the user's default record of that doctype (or the parent row's). Recomputed each call. | `create_new.py:141-145`, `:169-183` |
| `Now` on Datetime/Time | `now_datetime()` / `nowtime()`. Recomputed each call. | `create_new.py:147-151` |

The static part is cached per request (`create_new.py:18-24`).

### Where desk v1 differs (browser side)

`frappe/public/js/frappe/model/create_new.js:82-228` computes the same kinds of default in the
browser before the form opens, plus a few the server does not have:

- `user` and `user_fullname` as default values (`create_new.js:191-194`). The server knows only
  `__user`; it would store `user_fullname` as literal text.
- Last selected value for fields with `remember_last_selected_value` (`create_new.js:170-175`).
- A single user-permission value per Link target (`create_new.js:158-164`).
- A Time field with no default gets the current time (`create_new.js:223-224`).
- Mandatory child tables get one empty row (`create_new.js:119-129`).

### Can desk v2 ask the server for them?

There is no whitelisted method that returns a new document with defaults. `get_new_doc` and
`make_new_doc` (`frappe/model/create_new.py:18-48`) and `frappe.new_doc`
(`frappe/model/document.py:4417`) are Python-only. A search of whitelisted methods found nothing
that wraps them.

What v2 can already read, for a browser-side mirror of `create_new.py`:

| Input | Available in v2 | Where |
|---|---|---|
| Field defaults, Select options, `ignore_user_permissions`, title field | Meta route | `frappe/api/v2.py:324-327` |
| User and global defaults | `session.defaults`, desk users only | `frappe/sessions.py:247` |
| User permissions | `GET /api/v2/method/frappe.core.doctype.user_permission.user_permission.get_current_user_permissions` (whitelisted; live returned `{}` for this user) | `frappe/core/doctype/user_permission/user_permission.py:89-92` |
| `:Doctype` defaults | No route; needs a read of the referenced record. | `create_new.py:169-183` |

### What the v2 dialog does today

`PageFormDialog` starts from `options.defaults` (`frontend/src/pages/record/dialogs/PageFormDialog.vue:89`),
and `initialDoc` sets every rendered field to `null` under those defaults
(`frontend/src/recordPage/formDialogLayout.ts:98-105`). `createDocument` posts the body as is
(`ui/src/api/index.ts:177-186`). Because the fields are `null`, the server fills its defaults on
insert, but the person does not see them in the dialog first.
