# CRM on desk v2: what CRM v1's own formats hold and where each goes

Research for frappe/frappe#45836, on map frappe/frappe#45834. This file states facts. It makes no rulings.

Sources, read at these commits:

- `crm:` is `frappe/crm`, branch `desk-v2`, at `79b98437`.
- `frappe:` is `frappe/frappe`, branch `desk-v2`, at `c78f73ddf4`.

A citation `crm:frontend/src/data/script.js:70` means that file and line at that commit.

## Counts

| Doctype | `desk.localhost` | App fixtures | Created by app code |
| --- | --- | --- | --- |
| `CRM Form Script` | 3 | none | 3 or 4 (below) |
| `CRM Fields Layout` | 14 | none | 14 (below) |
| `CRM View Settings` | 0 | none | 0 |
| `CRM Dashboard` | 1 | none | 1 |

- The app has no `crm/fixtures` folder, and `crm/hooks.py` declares no `fixtures`.
- `after_install` makes the defaults (`crm:crm/install.py:18-37`). Settings and patches make more (below).
- The 3 scripts on `desk.localhost` are all `is_standard = 1`, `view = Form`: `Forecasting Script` (CRM Deal), `Product Details Script for CRM Deal`, `Product Details Script for CRM Lead`.
- The 14 layouts on `desk.localhost` are the install defaults. 12 store a bare list of sections. 2 store tabs (`CRM Deal-Data Fields`, `CRM Task-Quick Entry`).
- The 1 dashboard is `Manager Dashboard`, `private = 0`, with 17 items.
- Counts on real customer sites are unknown. CRM reports counts of `CRM Form Script`, `CRM Fields Layout` and `CRM View Settings` through the `get_site_info` hook (`crm:crm/activation.py:3-33`, `crm:crm/hooks.py:25`). This research did not see that data.

On the same site, for scale: `Form Layout` 1 row (none for a CRM doctype), `Doctype View` 2, `Client Script` 42 (all `view = Record`), `List View Settings` 0.

## CRM Form Script

### Fields

| Field | Type | Holds |
| --- | --- | --- |
| `name` | prompt | The author's name for the script. |
| `dt` | Link DocType, required | The doctype. The desk v1 form limits it to non-child doctypes (`crm:crm/fcrm/doctype/crm_form_script/crm_form_script.js:6-10`). |
| `view` | Select `Form`, `List` | Which page runs it. Default `Form`. |
| `enabled` | Check | Only enabled rows load. |
| `is_standard` | Check | App-owned. Outside developer mode only `enabled` can change (`crm_form_script.py:24-39`). |
| `script` | Code JS | The source text. Default is a `setupForm` boilerplate. |

### What reads them

There are three script shapes. One table holds all three.

1. **Class-based form script** (`view = Form`). The engine finds every `class X` in the text (`crm:frontend/src/utils/scriptHelpers.js:8-18`). It evaluates the text with `new Function(...helperNames, script + "return X")` (`crm:frontend/src/data/script.js:433-447`). A class named like the doctype without spaces is the parent controller. Any other class is a child-table controller. A child class needs a parent class in the same load (`script.js:107-139`). All enabled rows for the doctype run, in fetch order. File scripts at `crm:frontend/src/doctypes/<slug>/<view>.js` run first (`script.js:13-34`, `script.js:141-153`). Two exist: `crm_task/form.js` and `fcrm_note/form.js`.
2. **Legacy `setupForm` script** (`view = Form`). `setupCustomizations` calls `setupForm(obj)` and reads `actions` and `statuses` from its return value (`crm:frontend/src/utils/index.js:361-381`). `obj` holds `doc`, `$dialog`, `$socket`, `router`, `toast`, `updateField`, `createToast`, `deleteDoc` and `call` (`crm:frontend/src/pages/Lead.vue:365-377`). Lead, Deal, Contact, Organization, the mobile pages and `DoctypeModal` run it. The default `script` value is this shape (`crm_form_script.json`, field `script`).
3. **List script** (`view = List`). `get_data` sends it as `list_script` (`crm:crm/api/doc.py:543`). `setupListCustomizations` calls `setupList(obj)` and reads `actions` and `bulk_actions` (`crm:frontend/src/utils/index.js:383-410`). `obj` holds `list`, `call`, `createToast`, `toast`, `$dialog`, `$socket` and `router` (`crm:frontend/src/components/ListBulkActions.vue:233-241`). A bulk action's `onClick` gets `{ list, selections, unselectAll, call, createToast, toast, $dialog, router }` (`ListBulkActions.vue:200-215`).

The action shape both form shapes return: `{ label, icon?, onClick(close) }`, or a group `{ group, buttonLabel?, items: [{ label, onClick }] }` (`crm:frontend/src/components/CustomActions.vue:39-104`). The `statuses` shape is a list of status names. It narrows the status dropdown to those names (`crm:frontend/src/stores/statuses.js:82-112`).

App code writes these standard rows:

| Name | Doctype | Written by |
| --- | --- | --- |
| `Product Details Script for CRM Lead`, `... CRM Deal` | CRM Lead, CRM Deal | `add_default_scripts` on install and migrate (`crm:crm/install.py:532-537`, `crm:crm/fcrm/doctype/crm_products/crm_products.py:91-109`). Kept in sync with the code on every run. |
| `Forecasting Script` | CRM Deal | `create_forecasting_script` (`crm:crm/fcrm/doctype/fcrm_settings/fcrm_settings.py:217-245`). |
| `Create Quotation from CRM Deal` | CRM Deal | Only when the ERPNext integration is enabled (`crm:crm/fcrm/doctype/erpnext_crm_settings/erpnext_crm_settings.py:180-194`, script at `:638-688`). |

### Desk v2 counterpart

A `Client Script` row with `view = Record` and `dt` set (`frappe:frontend/SCRIPTING.md:54-59`). Its fields: `dt`, `script`, `enabled`, `run_order`, `view` (`List`, `Form`, `Record`, `App Page`), `page`, `module` (`frappe:frappe/custom/doctype/client_script/client_script.json`). The script is an ES module whose default export is an object of handlers. An app ships the same text as a file script at `<app>/<module>/doctype/<scrubbed>/frontend/record.js` (`SCRIPTING.md:1111-1120`).

### What does not fit

- **The text.** A v1 class does not run on desk v2. Ruling 4 of #45834 says no shim runs it. Every row needs a rewrite, not a copy.
- **`is_standard`.** `Client Script` has no such field. The desk v2 place for app-owned code is a file script. The four standard rows above become CRM `record.js` files, not rows.
- **`view = List`.** Desk v2 has no list script. `list.js` takes only `columns` (`frappe:frontend/src/contributions/types.ts:10-11`). `actions` and `bulk_actions` from `setupList` have no counterpart.
- **Legacy `setupForm`.** Its `actions` map to `page.header.add`. Its `statuses` have no counterpart (see the table).
- **Order.** v1 runs rows in fetch order with no order field. `Client Script` has `run_order`.
- **Many classes per row.** One v1 row can hold the parent class and child-table classes. A desk v2 module has one default export, and a child table is a nested block in it (`frappe:frontend/CONTEXT.md:279-282`).

## CRM Fields Layout

### Fields

| Field | Type | Holds |
| --- | --- | --- |
| `name` | `format:{dt}-{type}` | One row per doctype and type. |
| `dt` | Link DocType | The doctype. For `Grid Row` it is the child doctype. |
| `type` | Select | `Quick Entry`, `Side Panel`, `Data Fields`, `Grid Row`, `Required Fields`. |
| `layout` | Code JSON | The tree. |

### The JSON shape

The tree is either a list of tabs or a bare list of sections. The reader wraps a bare list in one tab named `first_tab` (`crm:crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:30-46`).

```json
[{ "name": "first_tab", "label": "?", "sections": [
  { "name": "details_section", "label": "Details", "opened": true,
    "hideLabel": false, "hideBorder": false, "collapsible": false,
    "hidden": false, "editable": false,
    "columns": [{ "name": "column_z9XL", "label": "?", "fields": ["organization", "website"] }] }
]}]
```

Keys and their readers:

| Level | Key | Read by |
| --- | --- | --- |
| tab | `name`, `label`, `sections` | `crm:frontend/src/components/FieldLayout/FieldLayout.vue:65-89`. A tab is drawn as a tab only when there are two or more, or the one tab has a label. |
| tab | `hidden` | Only from a script override (`FieldLayout.vue:81`). |
| section | `name`, `label`, `hideLabel`, `hideBorder`, `opened`, `collapsible`, `columns` | `crm:frontend/src/components/FieldLayout/Section.vue:1-29`. |
| section | `hidden` | `Section.vue:3`. Stored `true` on two Deal Quick Entry sections. `DealModal` flips four sections by name at run time (`crm:frontend/src/components/Modals/DealModal.vue:162-178`). |
| section | `editable` | Layout editors only. `false` stops a reader from changing the section (`crm:frontend/src/components/FieldLayoutEditor.vue:506`, `SidePanelLayoutEditor.vue:49`). |
| section | `contacts` | Deal Side Panel only, on `contacts_section`. Deal.vue draws its own contact list there (`crm:frontend/src/pages/Deal.vue:155-184`). |
| section | `editingLabel` | Editor state. The editor saves it by mistake (stored in `CRM Deal-Data Fields` on `desk.localhost`). No renderer reads it. |
| column | `name`, `label`, `hideLabel`, `fields` | `crm:frontend/src/components/FieldLayout/Column.vue:1-12`. |
| field | a fieldname string | The server swaps each string for the DocField dict before it sends the tree (`crm_fields_layout.py:70-81`). |

Per type:

| Type | What it is | Read by |
| --- | --- | --- |
| `Quick Entry` | The create dialog of a doctype. | `get_fields_layout` from LeadModal, DealModal, ContactModal, OrganizationModal, CreateDocumentModal, DoctypeModal, FieldLayoutDialog. |
| `Side Panel` | The record page's right column. Sections only, no tabs. Only `columns[0]` draws (`crm:frontend/src/components/SidePanelLayout.vue:30-38`). | `get_sidepanel_sections` (`crm_fields_layout.py:113-146`) from Lead, Deal, Contact, Organization and their mobile pages. |
| `Data Fields` | The "Data" tab on the Lead and Deal pages. | `crm:frontend/src/components/Activities/DataFields.vue:118-120`. |
| `Grid Row` | The edit dialog of one child-table row. `dt` is the child doctype. | `crm:frontend/src/components/Controls/GridRowModal.vue:67-73`. |
| `Required Fields` | The fields Convert to Deal asks for. With no stored row, the server builds a section of the mandatory fields with no default (`crm_fields_layout.py:58-111`). | `crm:frontend/src/components/Modals/ConvertToDealModal.vue:195-197`. |

The server also writes this table:

- `add_or_remove_lost_reason_section_in_sidepanel` edits the shared `{doctype}-Side Panel` row when one Lead or Deal changes status to or from a Lost type (`crm:crm/fcrm/doctype/utils.py:6-45`, called at `crm_deal.py:289-290`, `crm_lead.py:167`).
- FCRM Settings adds or removes a `forecasted_sales_section` in `CRM Deal-Side Panel` and `CRM Deal-Quick Entry` (`fcrm_settings.py:115-188`).
- Patches reshape rows: `update_layouts_to_new_format`, `update_deal_quick_entry_layout`, `reorder_address_quick_entry_layout`, `add_enrichment_fields_to_layouts`, `create_default_sidebar_fields_layout`.

### Desk v2 counterpart

`Form Layout` (`frappe:frappe/desk/doctype/form_layout/`). Fields: `dt`, `type` (`Details`, `Side Panel`, `Quick Entry`, `New Record`), `condition` (a `depends_on` expression, empty for the default row), `layout` (Code JSON). Named by autoincrement. More than one row per doctype and type is allowed. Only one row may have no condition (`form_layout.py:84-102`).

The stored tree (`frappe:frontend/src/recordPage/formLayoutSource/types.ts:7-35`):

- tab: `name`, `label`, `dependsOn`, `sections`.
- section: `name`, `label`, `hideLabel`, `hideBorder`, `collapsible`, `opened`, `dependsOn`, `columns`.
- column: `name`, `label`, `hideLabel`, `fields`.
- field: a fieldname string, or, in `Quick Entry` and `New Record` only, a DocField-shaped dict (`form_layout.py:47-59`).

A bare list of sections is wrapped in a tab named `first_tab`, the same as v1 (`form_layout.py:244-248`).

| CRM v1 type | Desk v2 type |
| --- | --- |
| `Quick Entry` | `Quick Entry` |
| `Side Panel` | `Side Panel` |
| `Data Fields` | `Details` (the Details tab of the record page) |
| `Grid Row` | none |
| `Required Fields` | none. `New Record` is the full-page new record, not a convert dialog. |

### What does not fit

- **`Grid Row`.** No Form Layout type lays out a child row's edit dialog.
- **`Required Fields`.** No type for a convert flow. Desk v2 has no convert flow yet.
- **Section `hidden`.** The desk v2 section builder copies no `hidden` key (`frappe:frontend/src/recordPage/formLayoutSource/section.ts:16-27`). A section stored `hidden: true` shows on desk v2. The two Deal Quick Entry sections are stored this way. A `dependsOn` on the section is the desk v2 way to hide one by data.
- **Section `editable`, `contacts`, `editingLabel`.** Desk v2 reads none of them. `contacts_section` holds no `columns`, so it carries no fields.
- **The Lost Reason write.** v1 rewrites the shared Side Panel row per record. Desk v2 can say the same with a `dependsOn` on the section, or a second row with a `condition`. Both are per record and write nothing.
- **Names.** Desk v2 refuses a tab or section named like a data field of the doctype (`form_layout.py:37-45`). No row on `desk.localhost` collides. Desk v2 also refuses two sections with one name anywhere in the form (`form_layout.py:351-380`).
- **Unknown fieldnames.** Desk v2 drops a fieldname the meta does not have, with no message (`frappe:frontend/src/recordPage/formLayoutSource/joinLayout.ts:86-87`). Every fieldname on `desk.localhost` is in its doctype's meta.
- **Fallback.** v1 falls back to a meta layout for every type except `Required Fields` (`crm_fields_layout.py:40-41`). Desk v2 Side Panel has no fallback: no row means no layout sections (`frappe:frontend/SCRIPTING.md:754-756`).

## CRM View Settings

### Fields

| Field | Type | Holds |
| --- | --- | --- |
| `name` | autoincrement | `create` sets `doc.name = view.label`, but autoincrement names the row (`crm_view_settings.py:66`). |
| `dt` | Link DocType | The doctype. |
| `label`, `icon` | Data | The view's name and its icon: an emoji or a lucide name. |
| `type` | Select `list`, `group_by`, `kanban` | The view type. |
| `user` | Link User | The owner. Blank when `public` (`crm_view_settings.py:139`). |
| `public` | Check | Shown to everyone. Set only by Administrator or Sales Manager (`:131-141`). |
| `pinned` | Check | Shown in the app sidebar (`crm:frontend/src/components/Layouts/AppSidebar.vue:325-333`). |
| `is_standard` | Check | One per user, doctype and type. It holds that user's changes to the plain view (`crm_view_settings.py:218-288`). |
| `is_default` | Check | The view the home route and the list route open first (`crm:frontend/src/router.js:205-290`). |
| `route_name` | Data | The v1 route, for example `Leads` (`crm_view_settings.py:320-329`). |
| `filters` | Code | A JSON object: `{ field: value }` or `{ field: [operator, value] }`. `@me` and `%@me%` stand for the session user (`crm:crm/api/doc.py:283-293`). |
| `order_by` | Code | An SQL order string, for example `modified desc`. |
| `columns` | Code | JSON list: `{ label, type, key, width, options?, align? }`. `width` is a CSS string such as `12rem` (`crm_lead.py:447-500`). |
| `rows` | Code | JSON list of fieldnames to fetch. The server adds the controller's default rows (`crm_view_settings.py:169-176`). |
| `load_default_columns` | Check | Use the controller's default columns, not the stored ones (`crm:crm/api/doc.py:489-490`). |
| `group_by_field` | Data | The fieldname for a `group_by` view. Default `owner`. |
| `column_field` | Data | The kanban column field. Default `status`. |
| `title_field` | Data | The kanban card title. |
| `kanban_fields` | Code | JSON list of fieldnames shown on a card. |
| `kanban_columns` | Code | JSON list: `{ name, color?, order?, delete?, page_length? }` (`crm:frontend/src/components/Kanban/KanbanView.vue:255-277`). `order` is the list of record names in their card order. `delete: true` hides a column (`crm:crm/api/doc.py:405-452`). |

### What reads them

- `crm.api.views.get_views` returns the rows where `user` is blank or the session user (`crm:crm/api/views.py:6-16`). `crm:frontend/src/stores/views.js:17-45` sorts them into pinned, public, standard and default.
- `crm.api.doc.get_data` takes the view's values as arguments, runs the list, group-by or kanban query, and reads the user's `is_standard` row when no custom view is open (`crm:crm/api/doc.py:257-545`).
- `crm:frontend/src/components/ViewControls.vue:433-520` builds the open view from a row and writes changes back through `create`, `update` and `create_or_update_standard_view`.

### Desk v2 counterpart

`Doctype View` (`frappe:frappe/desk/doctype/doctype_view/`). Fields: `reference_doctype`, `type`, `user` (blank for the site row), `label` (blank for the plain view, a name for a saved view), `settings` (one JSON object, at most 16 KB). One row per `(reference_doctype, type, user, label)` (`doctype_view.py:97-103`). The only `type` is `List` (`doctype_view.py:16`).

The `List` settings object holds three keys (`frappe:frontend/src/list/storedSettings.ts:15-19`):

- `columns`: `[{ fieldname, width? }]`. `width` is a CSS string.
- `sort`: `[{ fieldname, direction }]`, `direction` `asc` or `desc`.
- `quick_filter_fields`: a list of fieldnames.

| CRM v1 | Desk v2 |
| --- | --- |
| A user's `is_standard` row, type `list` | The plain view's user row (`label` blank, `user` set). |
| Columns from the controller's `default_list_data` | The plain view's site row (`user` blank), which only a System Manager writes (`api.py:65-69`). v1 has no stored site default. |
| A saved view (`is_standard = 0`) | A saved view row (`label` set). The route `/:doctype/view/list/:viewName` exists (`frappe:frontend/src/router/generated.ts:26`). But the API reads and writes only the plain view (`label` blank) (`api.py:72-95`). The list page uses the view name only for its favourite star (`frappe:frontend/src/pages/list/DoctypeList.vue:192,203`). |
| `pinned` | A `Favourite` row on `Doctype View` (`frappe:frontend/ARCHITECTURE.md:128`). v1 `pinned` is a flag on the view row, so a public view's pin shows for everyone. A desk v2 favourite is one row per person. |

### What does not fit

- **`type` `kanban` and `group_by`.** Desk v2 has only `List` (`doctype_view.py:16`). So `column_field`, `title_field`, `kanban_fields`, `kanban_columns` (with card `order`, `color`, `delete`) and `group_by_field` have no counterpart.
- **`filters`.** The `List` settings object has no filters key. The `@me` token has no counterpart either.
- **`order_by`.** A string in v1. A list of `{ fieldname, direction }` in desk v2. A copy must parse it.
- **Column `label`.** v1 stores a label per column. Desk v2 stores none and reads the label from meta (`storedSettings.ts:77-80`).
- **`rows`.** v1 stores the fetched fieldnames. Desk v2 derives them.
- **`public`.** Desk v2 has a site row for the plain view only. A public saved view has no counterpart.
- **`is_default`, `route_name`, `icon`, `load_default_columns`.** No counterpart.
- **Quick filters.** CRM v1 keeps them per doctype in `CRM Global Settings`, not in this table (`crm:crm/install.py:497-516`). Desk v2 keeps them per view in `quick_filter_fields`.

## CRM Dashboard

### Fields

| Field | Type | Holds |
| --- | --- | --- |
| `title` | Data, names the row | The frontend uses one row only: `Manager Dashboard`. |
| `layout` | Code JSON | The item list. |
| `private`, `user` | Check, Link | No reader. The frontend and `crm/api/dashboard.py` never read them. |

### The JSON shape

```json
[{ "name": "sales_trend", "type": "axis_chart", "tooltip": "?",
   "layout": { "x": 0, "y": 4, "w": 10, "h": 9, "i": "sales_trend" } }]
```

- `type` is `number_chart`, `axis_chart`, `donut_chart` or `spacer` (`crm:frontend/src/components/Dashboard/DashboardItem.vue:4-33`).
- `name` selects a Python function: `get_<name>` in `crm/api/dashboard.py`. The chart is that hard-coded query, not a configured chart (`crm:crm/api/dashboard.py:53-58`).
- `layout` is a grid cell on 20 columns of 42 px rows (`crm:frontend/src/components/Dashboard/DashboardGrid.vue:7-8`).
- Save writes the whole list back to `Manager Dashboard` (`crm:frontend/src/pages/Dashboard.vue:283-296`). `reset_to_default` rewrites it from code (`crm:crm/fcrm/doctype/crm_dashboard/crm_dashboard.py:12-32`).

### Desk v2 counterpart

None. Desk v2 has no dashboard or chart page. Dashboards are area 4 of the root map #42061.

### What does not fit

All of it. Only the item `name`s carry meaning outside CRM v1, and they name CRM's own Python functions.

## Form Script: v1 helper or handler to `page` verb

In this table, "v1" is the class-based script unless a row says "legacy". `page` members are from `frappe:frontend/SCRIPTING.md` and `frappe:frontend/src/recordPage/types.ts`.

### Shape

| v1 | Desk v2 | Note |
| --- | --- | --- |
| `class CRMDeal { ... }` | `export default { ... }` | One object of handlers per module (`SCRIPTING.md:54-59`). |
| `class CRMProducts { ... }` (child class, routed by its doctype) | `products: { ... }` under the parent's export, keyed by the Table fieldname | `CONTEXT.md:279-282`. |
| `this` | the `page` argument | Every handler gets `page` (`SCRIPTING.md:56-57`). |
| `this.doc` | `page.doc` | The draft. `page.saved` is the last saved copy (`CONTEXT.md:187-192`). |
| Helpers as bare names (`call`, `toast`, ...) | `page.call`, `page.toast`, ... | No bare helpers. A stored script imports `vue`, `vue-router`, `frappe-ui`, `@framework/ui`, `frappe/i18n` (`SCRIPTING.md:711-715`). |
| `__()` as a global | `import { __ } from 'frappe/i18n'` | `SCRIPTING.md:266`. A component `template:` string sees `__` and `__n` as globals (`SCRIPTING.md:375-377`). |

### Lifecycle handlers (`crm:frontend/src/data/document.js:272-313`)

| v1 (and aliases) | Desk v2 | Note |
| --- | --- | --- |
| `onLoad` (`on_load`, `onload`) | `onOpen` | v1 runs it once per document while the document stays cached (`document.js:188-233`). Desk v2 runs `onOpen` once per visit (`SCRIPTING.md:128-151`). |
| `onRender` (`on_render`, `refresh`) | `onRefresh` | v1 runs it on load and on each page mount (`crm:frontend/src/pages/Deal.vue:510-516`). Desk v2 runs `onRefresh` on every replay and clears every surface first (`SCRIPTING.md:61-83`). |
| `onValidate` (`on_validate`, `validate`) | `beforeSave` | A throw stops the save in both (`SCRIPTING.md:1000`). |
| `onSave` (`on_save`) | `afterSave` | Runs after the server accepts (`SCRIPTING.md:1005`). |
| `onError` (`on_error`) | none | No handler fires on a failed save. |
| `onBeforeCreate` (`on_before_create`) | none in the create dialog | The create dialog runs no handlers (`frappe:frontend/src/pages/create/CreateDialog.vue:73`). On the full-page new record, use `beforeSave` with `page.isNew` (`SCRIPTING.md:322-340`). |
| `onCreateLead` (`on_create_lead`) | none | CRM v1 call-log flow (`crm:frontend/src/components/Modals/CallLogDetailModal.vue:353`). |
| `convertToDeal` (`convert_to_deal`) | none | CRM v1 convert flow (`crm:frontend/src/components/Modals/ConvertToDealModal.vue:152`). |

### Field and row handlers

| v1 | Desk v2 | Note |
| --- | --- | --- |
| A method named like a field: `status()` | A key named like the field: `status(page)` | Fires on commit (`SCRIPTING.md:1016-1018`). A script's own write is not a commit (`CONTEXT.md:314-320`). |
| `this.value` | `page.doc.<field>` | |
| `this.oldValue` | none | `page.saved.<field>` is the saved value, not the value before this edit. |
| Child class method `qty()` | `products: { qty(page, row) {} }` | `SCRIPTING.md:1058-1063`. |
| `this.currentRowIdx` | the `row` argument | `CONTEXT.md:272-277`. |
| `<table>_add()`, with `this.value` the new row | `products: { onAdd(page, row) {} }` | The v1 spelling `products_add` is a plain fieldname key on desk v2. `products.add` warns (`frappe:frontend/src/recordPage/flattenHandlers.ts:47-62`). |
| `<table>_remove()`, with `this.selectedRows`, `this.rows` | `products: { onRemove(page) {} }` | `onRemove` gets no row (`frappe:frontend/src/recordPage/types.ts:393-395`). Read what is left with `page.rows('products')`. The removed names have no counterpart. |
| A method named like a `Button` field, run on click (`document.js:397-405`) | none | The record page passes no `decorate` hook (`frappe:frontend/src/pages/Record.vue:774-797`). That hook is "what makes a `Button` field clickable" (`frappe:frontend/src/recordPage/formLayoutSource/useFormLayout.ts:22`). `page.fields.update(name, { component })` swaps the control. |

### Helpers on `this` (`setupHelperMethods`, `crm:frontend/src/data/script.js:227-429`)

| v1 | Desk v2 | Note |
| --- | --- | --- |
| `this.doc.trigger('method', ...args)` (`scriptHelpers.js:40-59`) | none | Call a plain function in the module: `updateProbability(page)`. |
| `this.doc.getRow(table, idx?)`, `this.getRow(table, idx?)` (`script.js:228-276`) | `page.rows(table)` | Returns row handles in array order (`types.ts:371`). In a table handler, use `row`. |
| `row.trigger('qty')` | `row.trigger('qty')` | Runs the row's `products.qty` handler (`types.ts:338-339`). |
| `this.actions = [...]`, `this.actions.push(...)` (`script.js:278-310`) | `page.header.add({ name, label, run })` | `SCRIPTING.md:551-565`. |
| An action group `{ group, items }` or `{ buttonLabel, group, items }` | `page.header.add({ name, label, display: 'dropdown' })`, then each member with `group: <name>` | `SCRIPTING.md:558-561`. |
| `onClick(close)` on an action | `run(page, value)` | |
| `this.statuses = [...]` (`script.js:312-346`) | none | It narrows CRM v1's header status dropdown. The nearest verb is `page.fields.update('status', { link_filters })`. It narrows a Link field's search. It is not the same control. |
| `this.setFieldProperty(field, prop, value)` (`script.js:363-383`) | `page.fields.update(field, { [prop]: value })`, `page.fields.hide(field)`, `page.fields.show(field)` | Keys: `hidden`, `read_only`, `reqd`, `label`, `placeholder`, `description`, `options`, `link_filters`, `precision` (`SCRIPTING.md:954-964`). The overlay reaches the Details form and the panel. |
| `setFieldProperty` with `button_color` | `page.fields.update(field, { props })` | `props` binds onto the control (`frappe:frontend/src/recordPage/fields.ts:63-64`). |
| `setFieldProperty` on a Details section | `page.form.hide(name)`, `page.form.show(name)`, `page.form.update(name, { label })` | A section takes `label` only (`SCRIPTING.md:876-882`). `collapsible`, `opened`, `hideLabel`, `hideBorder` have no verb. |
| `setFieldProperty` on a Side Panel section | `page.panelSections.hide`, `show`, `update(name, { label, opened })`, `open`, `close` | `SCRIPTING.md:728-737`, `:799-806`. |
| `setFieldProperty` on a tab | `page.form.tabs.hide`, `show`, `update(name, { label })` | `SCRIPTING.md:900-917`. |
| `setFieldProperty('products.discount', ...)` (a child column) | none | `page.fields` finds a name only among the parent's own fields (`fields.ts:186-191`). |
| `setFieldProperty(..., rowName)` (one row) | none | Only errors are per row: `row.setError` (`SCRIPTING.md:977-988`). |
| `this.setFieldProperties(field, {...})` | `page.fields.update(field, {...})` | |
| `this.removeFieldProperty(...)` | none needed | The overlay clears on each replay. Put the condition in `onRefresh` (`SCRIPTING.md:61-64`). |
| `this.getField(field)` (`script.js:414-428`) | `page.fields.get(field)` | Both merge overrides. Desk v2 also folds in `depends_on` (`SCRIPTING.md:966-967`). |
| `this.setFieldHtml(field, html)` (`script.js:348-361`) | `page.fields.update(field, { component, props })` | A component draws the field. No verb takes HTML. |
| `this.getMeta(doctype)` (`script.js:202-208`) | `page.meta` | Own doctype only. Another doctype's meta has no verb. |

### Injected helpers (`crm:frontend/src/data/script.js:68-80`, `crm:frontend/src/data/document.js:206-212`)

| v1 | Desk v2 | Note |
| --- | --- | --- |
| `call(method, params)` | `page.call(method, params)` | `frappe:frontend/src/pageEngine/types.ts:259`. |
| `toast.success`, `toast.error` | `page.toast.success`, `page.toast.error` | `pageEngine/types.ts:112-115`. |
| `toast.info`, `toast.create`, legacy `createToast` | none | `page.toast` has `success` and `error` only. |
| `createDialog(options)` (`$dialog`) | `page.dialog.confirm`, `page.dialog.danger`, `page.dialog.open(component)` | Each resolves `null` on dismiss (`pageEngine/types.ts:219-232`). |
| `formDialog(options)` | `page.dialog.form(options)` | The same option names: `title`, `fields`, `tabs`, `doctype`, `fieldnames`, `defaults`, `required`, `size`, `actions`, `onSubmit`, `onCancel`, `submitLabel`, `cancelLabel` (`pageEngine/types.ts:182-200`). A field takes fewer keys (`pageEngine/types.ts:118-131`). |
| `router` | `page.router` | |
| `router.previousRoute` | none | A CRM v1 addition (`crm:.pi/SPEC.md:275`). |
| `socket` | none | |
| `throwError(message)` | `throw new Error(message)` in `beforeSave`, or `page.toast.error(message)` then `throw` | `SCRIPTING.md:1000`. |
| `crm.makePhoneCall(number)` | none | CRM's only global act is `log_a_call` (`SCRIPTING.md:264-278`). |
| `crm.openSettings(page)` | `page.openSettings(prefix, pane, block)` | `SCRIPTING.md:206-225`. |
| legacy `updateField` | `page.doc.<field> = value`, then `page.save()` | |
| legacy `deleteDoc` | `page.run('header.delete')` | The built-in `delete` asks first (`SCRIPTING.md:594`). |
| legacy `doc` | `page.doc` | |

### Examples for the non-obvious rows

An action added after a server call. v1 pushes in `onLoad` after `call` returns. Desk v2 reads the value with `page.cached` in `onRefresh` (`SCRIPTING.md:85-121`):

```js
// v1: Create Quotation from CRM Deal (erpnext_crm_settings.py:638-688)
onLoad() { call('frappe.client.get_single_value', {...}).then((on) => on && this.doc.trigger('setActions')) }

// desk v2
export default {
  onRefresh(page) {
    if (page.isNew) return
    const enabled = page.cached('erpnext-enabled', () =>
      page.call('frappe.client.get_single_value', { doctype: 'ERPNext CRM Settings', field: 'enabled' }))
    if (!enabled) return
    page.header.add({ name: 'create_quotation', label: __('Create Quotation'), run: createQuotation })
  },
}
```

A method called through `trigger`. Desk v2 has no `trigger` on the document. The module calls its own function:

```js
// v1: Forecasting Script (fcrm_settings.py:233-245)
class CRMDeal { async status() { await this.doc.trigger('updateProbability') } ... }

// desk v2
async function updateProbability(page) {
  const status = await page.call('frappe.client.get_value', {
    doctype: 'CRM Deal Status', fieldname: 'probability', filters: { name: page.doc.status } })
  page.doc.probability = status.probability
}
export default { status: updateProbability }
```

A child class with row add and remove. Desk v2 nests the handlers under the Table fieldname:

```js
// v1: Product Details Script (crm_products.py:112-151)
class CRMProducts {
  products_add() { this.doc.getRow('products').trigger('qty'); this.doc.trigger('update_total') }
  products_remove() { this.doc.trigger('update_total') }
}

// desk v2
export default {
  products: {
    onAdd(page, row) { row.trigger('qty'); updateTotal(page) },
    onRemove(page) { updateTotal(page) },
  },
}
```

An action group. v1 groups actions under a button label. Desk v2 adds a dropdown, then its members:

```js
// v1
this.actions = [{ group: 'ERPNext', buttonLabel: 'ERPNext', items: [{ label: 'Quotation', onClick }] }]

// desk v2
page.header.add({ name: 'erpnext', label: 'ERPNext', display: 'dropdown' })
page.header.add({ name: 'quotation', label: 'Quotation', group: 'erpnext', run: createQuotation })
```

A field shown or hidden by a condition. v1 sets and removes the property. Desk v2 states the condition on each replay:

```js
// v1
annual_revenue() { this.value > 0 ? this.setFieldProperty('rating', 'hidden', false) : this.setFieldProperty('rating', 'hidden', true) }

// desk v2
export default {
  onRefresh(page) {
    if (!(page.doc.annual_revenue > 0)) page.fields.hide('rating')
  },
}
```
