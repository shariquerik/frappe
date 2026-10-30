# What reads DocType breaks, and what a DocType with no breaks loses

Research for frappe/frappe#45861, part of map #45858.
Read against `desk-v2` at `4c5b0f3acd` (2026-10-30), and ERPNext `desk-v2` at `3c1fbcd174`.

Charter ruling 2: a DocType built in desk v2 stores no Tab, Section or Column Breaks.
Its layout lives only in `Form Layout`.

## Answer

Most readers do one of two things with breaks: they skip them (no value), or they split the
form into tabs, sections and columns. A DocType with no breaks is fine for every reader of
the first kind. It renders as one flat section in every reader of the second kind.

Nothing outside desk v2 breaks. Desk v1's form, its grid row form, print, the print
format builders, web forms, data import and export, report view, the REST API, and the
`get_meta` users in frappe and ERPNext all keep working.

Four facts matter more than "it renders flat":

1. **There is no app tier yet.** `get_form_layouts` reads only database rows
   (`form_layout.py:107-119`). #45447 (layout files in `frontend/`) is open and has no PR.
   Until it lands, a v2-built app DocType can ship no layout. On every site but the one
   where someone saved a row, it renders flat in desk v2 too. Design mode has nowhere to
   write a layout.
2. **The child row dialog never reads `Form Layout`.** A `Table` field's row dialog is
   built from the child DocType's breaks (`buildLayoutFromMeta.ts:147-155`, `:193-195`).
   A v2-built child DocType always gets a flat row dialog. A layout saved for it has no
   effect there. The settings page does the same for a Single (`settingsRows.ts:36`).
3. **Container labels in a layout are not translatable.** The extractor reads break labels
   from the DocType JSON (`translate.py:355-356`, `gettext/extractors/doctype.py:34-35`).
   No extractor reads `Form Layout` rows or files. The v2 renderer also prints section
   labels raw (`FormLayoutSection.vue:13`).
4. **A field the layout does not place does not render.** `joinLayout` draws only the
   fields the row lists (`joinLayout.ts:36-94`). A v2-built DocType always has a row, so
   every field added later (an app release, a Custom Field, an ERPNext dimension) is hidden
   until the layout is edited. A hidden mandatory field fails the save on the server
   (`document.py:3534-3536`) and the person has no input to fill. This is #45864's question.

A side finding, true today for DocTypes with breaks: the server fallback keeps only a
break's `name` and `label` (`form_layout.py:428-433`). It drops a section's `depends_on`,
`collapsible` and `hide_border`, and a tab's `depends_on`. The client builder keeps them
(`buildLayoutFromMeta.ts:91-108`, `:233-239`). So the record page ignores those properties
on an existing DocType with no `Form Layout` row. This bears on #45863.

## Table

"Fine" means the reader does not need breaks. "Flat" means it shows one section with one
column. "Broken" means something stops working.

### Desk v2

| Reader | What it does with breaks | With no breaks | References |
| --- | --- | --- | --- |
| `get_form_layouts`, type Details | Returns the rows; the fallback is `get_meta_layout`, which splits on breaks | Flat when there is no row (`first_tab` / `section_1` / `column_1`). Fine with a row. | `form_layout.py:107-119`, `:411-452` |
| `get_meta_layout` (server fallback) | Tab, section and column per break; keeps only `name` and `label` | Flat | `form_layout.py:411-433` |
| Record page, Details | `useFormLayout` with `fallback: "meta"`: the row, else the server fallback | Flat with no row; fine with a row | `Record.vue:541-546`, `useFormLayout.ts:72-93` |
| Record page, Side Panel | `fallback: "none"`; never reads breaks | Fine | `Record.vue:549-554` |
| Create dialog (Quick Entry) | Fallback is mandatory and Quick Entry fields; skips breaks | Fine | `form_layout.py:164-194`, `CreateDialog.vue:85-90`, `PageFormDialog.vue:111-116` |
| New record page (New Record) | Its rows, else Details rows, else the meta fallback | Flat with no row; fine with a row | `form_layout.py:112-113`, `UnsavedRecord.vue:150-165` |
| `joinLayout` (row joined to meta) | Drops break fieldtypes; draws only listed fields | Fine. Unplaced fields are hidden (fact 4). | `joinLayout.ts:36-94` |
| `buildLayoutFromMeta` (client) | Splits on breaks; keeps section `collapsible`, `depends_on`, `hide_border` | Flat | `buildLayoutFromMeta.ts:206-255` |
| Table row dialog | `childLayout` built from the child DocType's breaks; `Form Layout` not read | Flat, always; a child layout row is ignored | `buildLayoutFromMeta.ts:147-155`, `:193-195`; `TableField.vue:474-478` |
| Mandatory check on save | Skips fields in hidden sections and tabs of the rendered layout | Fine | `requiredFields.ts:21-47`, `:56-58` |
| Settings page (Single, block with no `fields`) | Tabs and sections from breaks; `Form Layout` not read | Flat | `settingsRows.ts:31-69` |
| `Form Layout` validation | Excludes breaks from data fieldnames | Fine | `form_layout.py:277-279` |
| Column, sort, data import pickers | Exclude breaks | Fine | `getColumnOptions.ts:8-10`, `getSortOptions.ts:7-9`, `dataImport.ts:131-133` |
| Record page script API (`page.form`, sections) | Section names come from the layout; fallback names are synthetic | Fine with a row. A script that used `section_1` loses it once a row is saved. | `form.ts:52-58`, `SCRIPTING.md:864-876` |
| Print action | Opens desk v1's `/printview` | See print rows below | `builtinActions.ts:92-95` |
| `get_form_layouts` with desk v2 off | Refused over HTTP (`@frappe.desk_v2_only`) | The site sees only desk v1: flat | `form_layout.py:105`, `__init__.py:630-636` |

### Outside desk v2

| Reader | What it does with breaks | With no breaks | References |
| --- | --- | --- | --- |
| Desk v1 form | Sections, columns and tabs from breaks; adds an opening section | Flat (accepted by ruling 2) | `public/js/frappe/form/layout.js:168-224` |
| Desk v1 grid row form | Same `Layout` over the child's fields | Flat | `grid_row_form.js:12` |
| Desk v1 Quick Entry | Mandatory and Quick Entry fields; skips Tab Break | Fine | `quick_entry.js:75-86` |
| Desk v1 Form Builder (DocType, Customize Form) | Builds tabs from breaks; adds a "Details" tab and a section in memory | Flat. A save that changes nothing writes no breaks. A person who adds a section in v1 writes breaks. | `form_builder/utils.js:3-92`, `store.js:625-660` |
| Standard print (beta renderer) | `create_default_layout`: a section per break; `print_hide` on a break hides its section | Flat. Loses section labels, column split and hiding a whole section from print. | `classic_converter.py:322-394`, `:396-407`, `printview.py:183-192` |
| Print `layout` for Jinja templates | `make_layout`: sections and columns from breaks | Flat | `printview.py:598-668` |
| Print format builder (beta) | Seeds sections from breaks | Flat | `print_format_builder/utils.js:234-243` |
| Web form | Keeps its own `Web Form Field` rows; Get Fields lists the DocType fields | Fine. The author adds breaks in the web form itself. | `web_form.js:84-92`, `web_form.py:158-166`, `:338` |
| Report view, list view | Do not read breaks | Fine | `model/__init__.py:53-75` (`no_value_fields`) |
| Data import and export | Exclude `no_value_fields` and `display_fieldtypes` | Fine | `data_import/exporter.py:99`, `:129`; `importer.py:2084` |
| REST API v2 meta | Returns the fields, breaks included; no layout part | Fine. A non-desk client that groups by breaks gets one group. | `api/v2.py:329-332`, `api/include.py:48-54` |
| Translation extraction | Extracts break labels from the DocType JSON | Container labels are lost to translation (fact 3) | `translate.py:341-356`, `gettext/extractors/doctype.py:33-35`, `babel_extractors.csv:4` |
| `Meta` sort of custom fields | A custom break inserted after a field skips to the next break | Fine | `model/meta.py:614-631` |
| DocType validation | Names unnamed breaks; Fold must precede a Section Break | Fine. Fold cannot be used; desk v2 drops Fold anyway. | `doctype.py:516-531`, `:1585-1597` |
| MCP and flow tools | Exclude breaks | Fine | `mcp/tools/discover.py:17`, `:84`; `flow/tools/builtins.py:19`, `:126` |
| Server mandatory check | Reads `reqd` fields; ignores sections | Fine. An unplaced mandatory field fails here (fact 4). | `document.py:3500-3540` |
| Custom Field `insert_after` | Can target a break's fieldname | A site or app field cannot anchor on a section of a v2-built DocType. Placement goes through `Form Layout` (#45865). | `custom_field.py:255-262` |

### ERPNext

| Reader | What it does with breaks | With no breaks | References |
| --- | --- | --- | --- |
| Accounting dimensions | Inserts each dimension after `accounting_dimensions_section` or `dimension_col_break` in the DocTypes of the `accounting_dimension_doctypes` hook | Fine for ERPNext's own DocTypes. A v2-built DocType in that hook gets the field at the end of the meta (`meta.py:1100-1103`), and hidden in desk v2 if a row exists. | `accounting_dimension.py:137-175`, `hooks.py:598` |
| Inventory dimensions | Adds a Section Break and Column Break custom field to stock DocTypes | Fine (ERPNext's own DocTypes) | `inventory_dimension.py:181-184`, `:301-306` |
| Regional setup | Custom fields after named sections | Fine (ERPNext's own DocTypes) | `regional/italy/setup.py`, `regional/united_arab_emirates/setup.py:40-49` |
| Item Variant Settings, Bank mapping | Exclude breaks from field pickers | Fine | `item_variant_settings.py:52`, `bank.js:31` |
| Sales Order proforma tab | Toggles its own Tab Break in desk v1 | Fine (ERPNext's own DocType) | `public/js/sales_order_proforma.js:29-37` |

ERPNext reads breaks only on its own DocTypes. None of it needs breaks on a DocType it does
not own.

## Where the app-tier layout files stand

- **State.** #45447 is open, with no PR. The grilling #45441 is closed: option B.
  There is no `doctype/*/frontend/` folder in frappe on `desk-v2`, and Contact ships no
  layout file.
- **Folder.** The DocType's `frontend/` folder:
  `<app>/<module>/doctype/<scrubbed>/frontend/`. It already holds `record.js`
  (`SCRIPTING.md:1113-1116`) and `pages.json` (`SCRIPTING.md:40-44`).
- **File name.** Not chosen. #45447 says "one file per layout type" and asks the PR to name
  it in `SCRIPTING.md`.
- **Override.** The file is the lowest tier. `get_form_layouts` reads it only when no site
  row matches. A site row for the same doctype and type replaces the file whole; rows and
  files are not merged. `validate_single_default` and the stored rows do not change. The
  layout cache key must change when the file changes.
- **Open edges for #45447.** A site that has only conditional rows, none of which matches:
  the text says the file is read. `New Record` falls back to the `Details` rows today
  (`form_layout.py:112-113`); the order between a New Record file and a Details row is not
  stated. A site row made before the upgrade keeps winning and misses the file's new fields.

## What later tickets depend on

- Design mode (ruling 6) cannot write a layout until #45447 lands. It is a prerequisite
  for any build slice that saves an app DocType's layout.
- Ruling 4 puts child table DocTypes in scope. Their row dialog reads breaks only. Either
  the row dialog reads the child's `Form Layout` (Details), or a v2-built child DocType is
  flat in its row dialog. This needs a decision or a build ticket.
- #45864 (unplaced fields): every v2-built DocType has a row, so every later field is
  hidden by default. A hidden mandatory field blocks the save.
- #45863 (field or layout properties): section `depends_on`, `collapsible` and
  `hide_border` exist only on the layout for a v2-built DocType. Desk v1 and print cannot
  see them. The server fallback drops them today for DocTypes with breaks.
- #45865 (custom field placement): `insert_after` cannot anchor on a section of a
  v2-built DocType. Placement goes through the site `Form Layout` row.
- #45447 or a sibling: layout labels need a translation extractor, and the renderer needs
  to translate them.
- #45480 (wholesale merge): the flat v1 rendering is as ruled. Add print (one section, no
  section-level `print_hide`) and the v1 grid row form to what it is told.
