# What desk v1's DocType save, Customize Form and Form Builder validate and write

Research for frappe/frappe#45859, a child of map #45858. Read on `desk-v2` at `4c5b0f3acd`.
All references are paths in this repo at that commit. The sources are the code itself.

## Answer in short

- The Form Builder has no server side of its own. It rewrites the host form's `fields` table in the browser (with Tab, Section and Column Breaks), and the host saves it. The host is the DocType form or Customize Form.
- The DocType save is the `DocType` controller (`frappe/core/doctype/doctype/doctype.py`). It runs through any normal document save, so `POST /api/v2/document/DocType` and `PUT /api/v2/document/DocType/<name>` reuse it as it is.
- Customize Form is a Single that is never stored. It is a diff engine. The client sends the whole form state, and `save_customization` compares it with the meta and writes `Custom Field` and `Property Setter` rows. The allow-lists and the refusals live only in this method. `POST /api/v2/method/run_doc_method` can call it as it is, but with v2's argument names (`document`, `kwargs`), not v1's (`docs`, `args`).
- A direct `Property Setter` or `Custom Field` insert skips most of the Customize Form rules. To keep ruling 7, the v2 customize save must go through `save_customization`.
- v1 has no "is this app editable here" check. The only gate on a standard DocType is `developer_mode`. Ruling 6 needs new server code for that.
- Customize Form refuses custom DocTypes, Single DocTypes and the core list. A custom DocType is edited with the DocType save on any site, with no developer mode.

## 1. Customize Form

### What it refuses before it loads

`CustomizeForm.validate_doctype` (`frappe/custom/doctype/customize_form/customize_form.py:126-137`) throws for:

- a DocType in `core_doctypes_list` (`frappe/model/__init__.py:103-122`): DocType, DocField, DocPerm, User, Role, Custom Field, Property Setter, Customize Form, Report, Print Format, Page, Module Def, Client Script and a few more;
- a Single DocType (`meta.issingle`);
- a custom DocType (`meta.custom`): "Only standard DocTypes are allowed to be customized from Customize Form."

### The round trip

1. `fetch_to_customize` (`customize_form.py:105-124`) loads the meta (with existing customizations) into the Customize Form doc. It copies every key of `doctype_properties` and, per field, every key of `docfield_properties`, plus `links`, `actions` and `states` (`load_properties`, `:139-160`). If `allow_auto_repeat` is on, it creates the `auto_repeat` custom field (`:162-185`).
2. The client edits that doc. v1's Form Builder rewrites its `fields` table (`frappe/custom/doctype/customize_form/customize_form.js:449-467`).
3. `save_customization` (`customize_form.py:232-273`) runs, in this order:
   - `validate_series` and `validate_autoincrement_autoname` (`:237-238`);
   - `update_custom_fields` (`:473-484`): inserts, updates or deletes `Custom Field` rows;
   - `set_property_setters` (`:275-290`): writes `Property Setter` rows for the DocType, its standard fields, and its links, actions and states;
   - `set_name_translation` (`:196-218`): the DocType `label` becomes a `Translation` row;
   - `validate_fields_for_doctype` and `check_email_append_to` (`:244-245`);
   - `frappe.db.updatedb` if a column change is needed (`:247-259`);
   - clears the cache, reloads with `fetch_to_customize`, publishes `doctype_update`, and may queue a global search rebuild (`:261-273`).
4. `on_update` deletes the Single's rows (`:101-103`). Nothing of Customize Form itself is stored.

The diff is whole-state. A custom field missing from `fields` is deleted (`delete_custom_fields`, `:536-544`). The order of `fields` becomes the order of the form.

### Properties a site can change on a standard DocType

`doctype_properties` (`customize_form.py:734-772`), 37 keys:
`search_fields`, `title_field`, `image_field`, `sort_field`, `sort_order`, `default_print_format`, `hide_toolbar`, `allow_copy`, `istable`, `quick_entry`, `queue_in_background`, `editable_grid`, `max_attachments`, `make_attachments_public`, `protect_attached_files`, `track_changes`, `track_views`, `allow_auto_repeat`, `allow_import`, `allow_bulk_edit`, `show_name_in_global_search`, `show_preview_popup`, `default_email_template`, `email_append_to`, `subject_field`, `sender_field`, `naming_rule`, `autoname`, `show_title_field_in_link`, `is_calendar_and_gantt`, `default_view`, `force_re_route_to_default_view`, `translated_doctype`, `link_display_mode`, `show_image_in_link`, `grid_page_length`, `rows_threshold_for_grid_search`.

Each changed key becomes one `Property Setter` with `doctype_or_field = "DocType"` (`set_property_setters_for_doctype`, `:318-325`). A value equal to the DocType's own value deletes the setter instead (`make_property_setter`, `:546-569`; `get_existing_property_value`, `:571-583`).

A DocType property that is **not** in the list cannot be customized. Among them: `module`, `is_submittable`, `issingle`, `is_tree`, `custom`, `track_seen`, `allow_rename`, `has_web_view`, `route`, `is_virtual`, `document_type`, `icon`, `timeline_field`, `read_only`, `in_create`, `description`. The permissions table is not in it either. Site permissions are `Custom DocPerm`, outside Customize Form.

Two keys are on the Customize Form DocType but not in the list: `sender_name_field` and `recipient_account_field` (`:82`, `:86`). The form shows them, but `save_customization` never writes them.

The field order is one more DocType setter, `field_order`, a JSON list of every fieldname including breaks (`set_property_setter_for_field_order`, `:292-316`). It is deleted when the order equals the default.

Links, actions and states (`:417-471`): a standard row gets setters with `row_name` for the keys in `doctype_link_properties`, `doctype_action_properties` and `doctype_state_properties` (`:835-850`). A new row is saved as a real row with `custom = 1`. Order goes to `links_order`, `actions_order` or `states_order`.

### Properties a site can change on a standard field

`docfield_properties` (`customize_form.py:774-833`), 59 keys. Each changed key becomes a `Property Setter` with `doctype_or_field = "DocField"` (`set_property_setters_for_docfield`, `:327-333`). `idx` is skipped there.

DocField properties **not** in the list cannot be customized: `fieldname`, `search_index`, `not_nullable`, `in_filter`, `max_height`, `sticky`, `show_on_timeline`, `show_description_on_click`, `documentation_url`.

`allow_property_change` (`:335-415`) then refuses some changes. Most refusals are a `msgprint` and a silent skip, not an error. Only a bad fieldtype throws.

| Change on a standard field | Result | Line |
|---|---|---|
| `fieldtype` outside `ALLOWED_FIELDTYPE_CHANGE` | throws | `:336-337`, `:585-607`, groups at `:853-863` |
| `fieldtype` inside a group | allowed, sets `update_db` | `:589-600` |
| `length` made shorter | checks stored data, then allowed (see the bug below) | `:339-347`, `:609-634` |
| `length` made longer | allowed, sets `update_db` | `:346-347` |
| `allow_on_submit` turned on when the DocField has it off | refused (msgprint) | `:349-356` |
| `reqd` turned off when the DocField has it on | refused (msgprint) | `:358-366` |
| `in_list_view` on a no-value fieldtype | refused (msgprint) | `:368-376` |
| `read_only` turned off when the DocField has it on | refused (msgprint) | `:388-398` |
| `options` on a fieldtype other than Read Only, HTML, Data | refused (msgprint) | `:400-402`, `:865` |
| `translatable` on a fieldtype that cannot translate | refused (msgprint) | `:404-406` |
| `is_virtual` turned on | refused (msgprint) | `:411-413` |
| `unique`, or `precision` above 6 | allowed, sets `update_db` | `:378-386` |
| `in_global_search` | allowed, queues a search rebuild | `:408-409` |

The fieldtype groups (`:853-863`): Currency/Float/Percent; Small Text/Data; Text/Data; Text/Text Editor/Code/Signature/HTML Editor; Data/Select; Text/Small Text/Long Text; Text/Data/Barcode; Code/Geolocation; Table/Table MultiSelect.

Bug: `self.check_length_for_fieldtypes` is used at `:344`, `:597` and `:610` but never set. Commit `219b60a6b1` (2021) removed its initialization. Making a `length` shorter, or changing to a fieldtype with a shorter column, raises `AttributeError`. I checked on `desk.localhost`: `hasattr(frappe.get_doc("Customize Form"), "check_length_for_fieldtypes")` is `False`.

### Properties a site can change on a custom field

A row is "custom" when `is_custom_field` is set and `is_system_generated` is not (`is_standard_or_system_generated_field`, `:719-720`). A system-generated custom field (one an app made) is treated like a standard field: it gets Property Setters, not edits.

For a user custom field, `update_in_custom_field` (`:504-534`) copies every key of `docfield_properties` onto the `Custom Field` row. `allow_property_change` does not run. So `reqd`, `read_only`, `options` and the rest change freely. Only a fieldtype outside the groups throws (`:515-516`). The row is written with `db_update()` (`:532`), so the `Custom Field` controller's `validate` does not run on an update from Customize Form.

## 2. Custom Field

Controller: `frappe/custom/doctype/custom_field/custom_field.py`.

### Validation

- **Name.** `fieldname` comes from the label as `custom_<label>` when not given, lowercased, with a `1` added to a restricted name (`set_fieldname`, `:139-170`). The record name is `<dt>-<fieldname>` (`autoname`, `:135-137`).
- **Clash.** A new field whose fieldname is already in the meta throws (`:186-191`). `check_fieldname_conflicts` throws when the name is a method or property of the controller (`:217`; `frappe/core/doctype/doctype/doctype.py:2162-2171`).
- **Fieldtype change.** On an update, the same `ALLOWED_FIELDTYPE_CHANGE` groups apply (`:199-209`).
- **Translatable** is cleared on a fieldtype that cannot translate (`:214-215`).
- **After save**, `validate_fields_for_doctype(dt)` checks the whole DocType's fields (`on_update`, `:219-224`).
- **Delete.** A field owned by Administrator can only be deleted by Administrator. Deleting also deletes the field's Property Setters and removes it from `DocType Layout` rows (`on_trash`, `:231-254`).

What the server does **not** check:

- It does not refuse core DocTypes or custom DocTypes. Only the v1 picker `get_fields_label` refuses them (`:286-299`).
- It does not check `insert_after`. `validate_insert_after` (`:256-268`) is never called.

### Placement with `insert_after`

- `insert_after = "append"` becomes the current last fieldname (`:193-194`).
- If `insert_after` names a field, `idx` is set after it (`:196-197`). The idx is only a hint.
- The real order is built in `Meta.sort_fields` (`frappe/model/meta.py:562-641`):
  - a `field_order` setter wins (`:570-598`);
  - a custom Section Break or Column Break after a field goes after the end of that field's column or section, not straight after the field (`:616-624`);
  - a custom Tab Break goes after the end of that tab (`:625-632`);
  - a custom field with **no** `insert_after` goes to the **top** of the form (`:634-636`);
  - an `insert_after` that names no field puts the field at the **end** (`:1100-1103`).
- Customize Form sets `insert_after` to the fieldname of the row before it (`customize_form.py:494-496`, `:523-529`).

### What adding one does to the table

`on_update` calls `frappe.db.updatedb(dt)` (`custom_field.py:226-229`), which adds the column. Inside `create_custom_fields` (the bulk helper apps use), the flag `in_create_custom_fields` defers this to one `updatedb` per DocType (`:331-394`).

### Rename

`rename_fieldname(custom_field, fieldname)` (`:410-439`) is whitelisted, POST only, System Manager only. It refuses a system-generated field and a name that is already a column. It renames the DB column (data kept), updates `__Auth` for a Password field and the `insert_after` of other custom fields, and **commits**.

## 3. Property Setter

Controller: `frappe/custom/doctype/property_setter/property_setter.py`.

- A new setter deletes any older setter for the same DocType, property, field and row (`:45-46`).
- The only refusal is a `fieldtype` change on `naming_series` (`:8`, `:53-55`).
- After save, `validate_fields_for_doctype` runs unless a flag turns it off (`:57-64`).
- Helpers: `frappe.make_property_setter` (`frappe/__init__.py:1212`) and the module's `make_property_setter` (`:77-103`, ignores permissions); `delete_property_setter` (`:106-117`).
- The meta applies setters by `doctype_or_field`: DocType, DocField, DocType Link, DocType Action, DocType State (`frappe/model/meta.py:430-470`).

So the allow-list is **not** in Property Setter. A direct insert can set any property, for example `search_index` or `fieldname`, or turn `reqd` off.

## 4. The DocType save

Controller: `frappe/core/doctype/doctype/doctype.py`.

### When a DocType may be edited at all

`check_developer_mode` (`:353-369`) runs first in `validate`:

- it is skipped in a patch and in tests (`:355-356`);
- a standard DocType (`custom = 0`) needs `developer_mode` (`:358-362`);
- a custom DocType saves on any site;
- a custom DocType cannot be virtual (`:364-365`).

It does not check the user. The v1 client is stricter. It forces `custom = 1` and locks the `custom` checkbox unless the user is Administrator **and** developer mode is on (`frappe/core/doctype/doctype/doctype.js:45-53`; `doctype_list.js:19`). Without developer mode it makes a standard DocType read-only and points to Customize Form (`doctype.js:64-73`). The Form Builder is read-only on the same condition (`frappe/public/js/form_builder/store.js:382-383`).

Other gates:

- `default_print_format` on a standard DocType throws "use Customize Form" (`doctype.py:256-257`).
- Rename: a standard DocType only by Administrator, and only in developer mode; DocTypes never merge (`before_rename`, `:718-727`).
- `check_pending_migration` (`:1147-1163`, whitelisted) warns when the JSON on disk is newer than the DB.

### Module and app checks

There is no check that the module's app is editable on this site. There is also no check that a standard DocType keeps to its own app. What exists:

- `make_module_and_roles` (`:2114-2159`) creates the `Module Def` when it is missing. Its `app_name` comes from `frappe.local.module_app`, else `"frappe"`. It also creates any missing `Role` from the permission rows.
- `warn_on_module_change` (`:931-947`) only warns that the old folder stays behind when the module changes.
- The export writes to the module's folder in its app (`frappe/modules/export_file.py:41-64`). A custom module exports under the site folder, and a path outside it throws (`:61-62`).

### What `validate` does to the doc

In order (`:211-257`):

1. `validate_name` (`:1123-1145`): length, no leading or trailing space, starts with a letter, only letters, numbers, spaces, `_` and `-`, no route clash.
2. `set_defaults_for_single_and_table` (`:304-313`): a Single gets no import, rename, submit or table. A child table gets no import and **no permissions**.
3. `scrub_field_names` (`:501-553`): a missing fieldname comes from the label, with `_section`, `_column` or `_tab` added for breaks. A restricted fieldname throws. Illegal characters are removed. `unique` clears `search_index`. No-value fieldtypes lose `unique`, `search_index` and `not_nullable`.
4. `set_default_in_list_view` (`:315-326`): if no field is in list view, the first 4 mandatory visible fields are.
5. `validate_series`, `validate_autoincrement_autoname` (`:1192-1296`). A change to or from autoincrement changes the `name` column type (`setup_autoincrement_and_sequence`, `:644-653`).
6. `validate_fields` (`:1376-1890`). The checks are listed in its docstring (`:1377-1391`). The ones that matter most here:
   - a fieldname is unique, legal and not reserved (`:1395-1432`);
   - Link and Table `options` must name an existing DocType (`:1441-1473`);
   - a Table or Table MultiSelect must point to a DocType with `istable` (`:1763-1778`);
   - a field cannot be hidden and mandatory with no default (`:1475-1482`);
   - `unique` is only for Data, Link, Read Only and Int, and fails when the column already holds duplicates (`:1549-1577`);
   - `search_fields`, `title_field`, `sort_field`, `image_field`, `timeline_field` must name real fields (`:1599-1690`);
   - at most one Fold, and it must come before a Section Break (`:1585-1597`).
7. `validate_permissions` for a non-table DocType (`:235-236`, `:1922-2111`).
8. Fields the server adds: `amended_from` when submittable (`make_amendable`, `:992-1011`); `lft`, `rgt`, `is_group`, `old_parent` and `parent_<name>` when a tree (`add_nestedset_fields`, `:1046-1100`); the `auto_repeat` custom field (`make_repeatable`, `:1013-1030`).
9. Web view needs a `route` field (`:439-450`).
10. On an update: fetch-from queries are prepared (`:371-425`), and fieldnames must not clash with controller methods (`:259-302`).

The server does not need any field, and it does not need any break. "DocType must have at least one field" is a check in the browser only (`store.js:431-433`). So a DocType with no breaks (ruling 2) saves without change.

### `before_insert`

A new non-table DocType with no permission rows gets one System Manager row (`:192-209`).

### `on_update`: DB, files and caches

In order (`:563-631`):

1. `frappe.db.updatedb(self.name, Meta(self))` (`:569-573`). See the DB section below.
2. `change_modified_of_parent` (`:491-499`): touches each DocType that uses this one as a table, to clear caches.
3. `make_module_and_roles` (`:576`).
4. Runs the fetch-from update queries (`:427-431`).
5. **JSON export**, only when the DocType is standard, not in an import, and `developer_mode` (or `frappe.flags.allow_doctype_export`) is on (`:580-583`). It writes `[module]/doctype/[name]/[name].json` (`export_doc`, `:949-953`), creates the controller boilerplate if missing (`make_controller_template`, `:955-978`), swaps the base class when `has_web_view` changed (`:671-709`), and writes type hints when the app asks for them (`:980-990`). `before_export` (`:860-906`) drops empty values, writes `field_order`, and keeps the old field order of the file.
6. In a web request the export runs **after the response** (`request.after_response`, `:585-612`). An export error does not reach the client that saved.
7. Runs the module's `on_doctype_update` and, on insert, `after_doctype_insert` (`:592-616`).
8. Syncs `DocType Layout` rows, clears the cache and the user's boot cache, rebuilds global search if needed, and publishes `doctype_update` (`:618-631`).

A custom DocType never exports and never runs module methods.

### DB column changes

`updatedb` (`frappe/database/mariadb/database.py:510-526`) builds a `MariaDBTable`, validates it and syncs it. It skips Single and virtual DocTypes.

- **New table**: created with every value field. A child table also gets `parent`, `parentfield` and `parenttype` (`frappe/database/mariadb/schema.py:9-40`).
- **New field**: `ADD COLUMN`, with a unique key or an index when set (`frappe/database/schema.py:278-290`).
- **Changed fieldtype, length or precision**: `MODIFY` to the new type (`schema.py:292-297`). The DocType save has **no** fieldtype allow-list. Only Customize Form and Custom Field have one. A shorter varchar is reverted with a message when stored data is longer (`schema.py:135-170`).
- **Unique, index, default, not null**: added or dropped to match (`schema.py:299-321`).
- **Deleted field**: the column **stays**, with its data. Only its unique key is dropped (`frappe/database/mariadb/schema.py:98-129`). `trim_table` drops such columns (`frappe/model/meta.py:1055-1078`). v1 offers it as Customize Form's "Trim Table" (`customize_form.py:662-673`) and `get_orphaned_columns` (`:687-691`), and as `bench trim-tables`.
- **Renamed field**: the DocType save has no rename. A new fieldname is a new, empty column. The old column stays with the old data, and nothing copies it. A real rename needs `frappe.model.utils.rename_field.rename_field` (`frappe/model/utils/rename_field.py:11-56`). It copies the data, and updates reports, property setters and user settings. It is not whitelisted. Patches use it. A custom field has `rename_fieldname` (section 2).

## 5. Child tables

v1 has no "create a child table and link it" action. It is two separate saves.

1. **Create the child.** The Table control in the Form Builder shows a button when its `options` is empty (`frappe/public/js/form_builder/components/controls/TableControl.vue:17-22`). It opens the same "New DocType" dialog with `is_child: 1`, and with `is_custom` when inside Customize Form. The dialog inserts a DocType with `istable = 1`, one System Manager permission row and one Section Break field (`frappe/core/doctype/doctype/doctype_list.js:106-130`), then opens it in a new form. The server then removes the permission rows of a child table (`doctype.py:311-313`).
2. **Link it.** The user goes back to the parent and types the child's name into the Table field's `options`. The parent save checks that `options` names an existing DocType with `istable` (`doctype.py:1441-1473`, `:1763-1778`). So the child must exist before the parent saves.

In customize mode the link is a `Custom Field` of type Table that points to a custom child DocType. A custom child cannot be opened in Customize Form later (it is custom). It is edited with the DocType save.

There is no server check that a standard parent points to a standard child. A developer can export a standard DocType whose Table points to a custom, site-only child.

## 6. The Form Builder

`frappe/public/js/form_builder/`.

- It turns the host's `fields` into tabs, sections, columns and fields, and back again (`store.js:625-695`). Empty sections are dropped. The first tab, section and column are written only when they differ from a blank one.
- `validate_fields` (`store.js:423-506`) repeats some server checks in the browser: at least one field, no duplicate fieldname, options on Link and Table, hidden and mandatory with no default, list view and global search fieldtypes, and JSON link filters.
- `update_fields` (`store.js:599-623`) writes the result into `frm.doc.fields`. The DocType form calls it in `before_save` (`doctype.js:15-25`). Customize Form calls it before `save_customization` (`customize_form.js:449-467`).
- Its only server calls are reads: `frappe.desk.form.load.getdoctype` (`utils.js:100`) and `get_link_filters_from_doc_without_customisations` (`components/Field.vue:105-106`). That second method checks no permission (`customize_form.py:723-731`).

So the Form Builder holds no server rule that v2 must reuse. Its layout logic is client code, and ruling 2 replaces it with `Form Layout`.

## 7. Whitelisted entry points and v2

v1's `frm.call` sends `{method, docs, args}` to `run_doc_method` (`frappe/handler.py:336-381`). v2 has its own `run_doc_method` at `/api/v2/method/run_doc_method` with `{method, document, kwargs}` (`frappe/api/v2.py:653-697`, route `:742-746`). A test calls it (`frappe/tests/test_api.py:527-539`). It checks `write` on POST (`create` for a new non-Single doc) and `check_if_latest`. Its route `/api/v2/document/<dt>/<name>/method/<m>` (`execute_doc_method`, `v2.py:335-356`) loads the doc from the DB and passes the request body as method arguments. That does not work for Customize Form, whose state lives only in the request.

Any dotted-path method is callable as `/api/v2/method/<path>` with the same arguments (`handle_rpc_call`, `v2.py:58-78`).

| v1 call | Where v1 calls it | Guard | Same arguments from `/api/v2/method/`? |
|---|---|---|---|
| `frappe.desk.form.save.savedocs(doc, action)`: the DocType form save | `frm.save` | whitelisted POST/PUT; doc permissions | Yes. `POST /api/v2/document/DocType` and `PUT /api/v2/document/DocType/<name>` run the same controller (`v2.py:279-320`). |
| `frappe.client.insert(doc)`: the New DocType dialog | `doctype_list.js:106` | doc permissions | Yes, or `POST /api/v2/document/DocType`. |
| `DocType.check_pending_migration` | `doctype.js:12` | doc method | Not the same names: `run_doc_method` with `document`, or `/api/v2/document/DocType/<name>/method/check_pending_migration`. |
| `CustomizeForm.fetch_to_customize` | `customize_form.js:58-79` | System Manager (write on the Single) | Not the same names: `POST /api/v2/method/run_doc_method` with `{method, document: {doctype: "Customize Form", doc_type}}`. The loaded doc comes back in `docs`. |
| `CustomizeForm.save_customization` | `customize_form.js:433-447` | same | Same as above, with the whole edited doc as `document`. Use POST: the method is not limited to POST, and GET checks only `read`. |
| `CustomizeForm.reset_to_defaults`, `reset_layout`, `trim_table` | `customize_form.js:203-245`, `:481-500` | same | Same as above. |
| `customize_form.get_orphaned_columns(doctype)` | `customize_form.js:221-223` | System Manager only; read-only transaction | Yes. |
| `customize_form.get_link_filters_from_doc_without_customisations(doctype, fieldname)` | `Field.vue:105-106` | **none** | Yes. |
| `custom_field.get_fields_label(doctype)` | `custom_field.js:58` | none; refuses core and custom DocTypes with a msgprint | Yes. v2's meta route gives the same data. |
| `custom_field.rename_fieldname(custom_field, fieldname)` | `custom_field.js:129` | POST, System Manager; commits | Yes. |
| `frappe.modules.utils.export_customizations(module, doctype, ...)` | `customize_form.js:294-303` | developer mode only (`frappe/modules/utils.py:90-91`) | Yes. |
| `doctype.get_row_size_utilization(doctype)` | `frappe/public/js/frappe/doctype/index.js:33` | DocType permission | Yes. |
| `frappe.desk.form.load.getdoctype(doctype)` | Form Builder `utils.js:100` | read | Yes, or `GET /api/v2/doctype/<dt>/meta`. |

## The table the ticket asks for

| Piece | What it does | Reusable as is? |
|---|---|---|
| `DocType` controller (`validate`, `on_update`) | Developer-mode gate, name rules, field rules, permissions, added fields, `updatedb`, JSON and controller export, caches, `doctype_update` | **Yes**, through `POST`/`PUT /api/v2/document/DocType`. It accepts a DocType with no breaks. |
| DocType JSON export | Writes `[module]/doctype/[name]/` for a standard DocType in developer mode, after the response | **Yes**, it runs inside the save. Its errors do not reach the client. |
| `updatedb` / `DBTable` | Creates the table, adds and modifies columns, keys and indexes. Never drops a column. | **Yes**, it runs inside the save. |
| Field rename for a DocType field | Not in the save. `rename_field` is a patch helper and not whitelisted. | **No.** v2 needs a new whitelisted wrapper, or must forbid renaming a saved field. |
| Orphan column removal | `trim_table`, `get_orphaned_columns` | **Yes** (Customize Form method, whitelisted function). |
| `CustomizeForm.fetch_to_customize` + `save_customization` | Whole-state diff into `Custom Field` and `Property Setter`, with the allow-lists and refusals | **Yes**, through `POST /api/v2/method/run_doc_method` with `document` and `method`. v2 must send the whole doc (fields, links, actions, states) and read `_server_messages`, because most refusals are a msgprint and a silent skip. |
| `doctype_properties`, `docfield_properties`, `allow_property_change`, `ALLOWED_FIELDTYPE_CHANGE` | The Customize Form allow-lists | **Yes** inside `save_customization`. They are module constants and a classmethod, so v2 can also import them to grey out fields. |
| Length or fieldtype narrowing in Customize Form | Should check stored data | **No.** It raises `AttributeError` (`check_length_for_fieldtypes` is never set). It needs a one-line fix in v1 code. |
| `Custom Field` controller | Fieldname, clash checks, fieldtype groups, `updatedb`, cleanup on delete | **Yes**, but a direct insert skips the core and custom DocType refusal and does not check `insert_after`. Go through `save_customization`, or add those checks. |
| `Property Setter` controller | Replaces older setters, refuses fieldtype on `naming_series` | **Only through `save_customization`.** A direct insert skips the allow-list. |
| `Meta.sort_fields` | Places custom fields by `field_order` and `insert_after` | **Yes**, it is read-side. Note that no `insert_after` means the top, and a wrong one means the end. |
| `custom_field.rename_fieldname` | Renames a custom field and its column, and keeps the data | **Yes.** |
| Child table creation | Two separate inserts: child (`istable`) first, then the parent's Table field | **Yes** as two calls in that order. There is no atomic endpoint. |
| Form Builder (`store.js`) | Browser-only layout to `fields` conversion, plus some repeated checks | **No.** It is client code. v2 uses `Form Layout` (ruling 2). |
| "App is editable here" check | Does not exist in v1 | **No.** Ruling 6 needs new server code. |
