# Views: how desk v1 and CRM v1 build each view type, and what each stores

Ticket [frappe/frappe#45847](https://github.com/frappe/frappe/issues/45847), map [#45846](https://github.com/frappe/frappe/issues/45846). Researched 2026-10-30.
Commits read: frappe `desk-v2` @ `4c5b0f3acd`, crm `desk-v2` @ `79b984370`, erpnext `desk-v2` @ `3c1fbcd174`.
Data: `desk.localhost` only, read-only. `crm.localhost` runs on the owner's laptop, and this bench cannot reach it. That site has no row counts here.

Paths without a prefix are in frappe. `crm:` and `erpnext:` paths are in those apps. Desk v1 JS paths are under `frappe/public/js/frappe/` and are written from there as `js/...`. LOC is `wc -l` and excludes scss and tests unless stated.

## Contents

- [Shared desk v1 base](#shared-desk-v1-base)
- desk v1: [Report](#1-report-report-builder) · [Kanban](#2-kanban) · [Calendar](#3-calendar) · [Gantt](#4-gantt) · [Tree](#5-tree) · [Image](#6-image) · [Inbox](#7-inbox) · [Map](#8-map) · [Dashboard view](#9-dashboard-view)
- CRM v1: [Shared CRM base](#shared-crm-v1-base) · [list](#10-crm-list) · [group by](#11-crm-group-by) · [kanban](#12-crm-kanban) · [calendar](#13-crm-calendar) · [cards](#14-crm-cards-notes-page)
- [Use on desk.localhost](#use-on-desklocalhost)
- [Meta setups in ERPNext, frappe and CRM](#meta-setups-in-erpnext-frappe-and-crm)
- [Summary table](#summary-table)

## Shared desk v1 base

**View switcher**
- The view modes are List, Report, Dashboard, Gantt, Kanban, Calendar, Image, Inbox, Tree and Map (`js/list/base_list.js:1468-1479`).
- The switcher shows only when `desk_settings.view_switcher` is on and `force_re_route_to_default_view` is off (`js/list/base_list.js:215`).
- Conditions per view (`js/list/list_view_select.js:128-182`):

| View | Offered when |
|---|---|
| List | always |
| Report | `frappe.model.can_get_report` |
| Dashboard | always |
| Calendar and Gantt | `frappe.views.calendar[doctype]` or `meta.is_calendar_and_gantt` (both views use the same condition) |
| Inbox | doctype is Communication and the user has email accounts |
| Image | `meta.image_field` |
| Tree | `frappe.treeview_settings[doctype]` or `meta.is_tree` |
| Kanban | any doctype except File |
| Map | `listview_settings.get_coords_method`, or `latitude` and `longitude` fields, or a Geolocation field named `location` |

- Submenus list the stored variants:
  - saved layouts (List Filter): `:214-240`
  - Report Builder reports: `:284-313`, `:393-439`
  - Calendar View rows: `:472-501`
  - email accounts: `:336-352`
  - Kanban boards: `:354-376`
- A switch carries the current filters as `frappe.route_options` (`:378-387`).

**Per-user view state: `__UserSettings`**
- The table holds one JSON blob per (user, doctype). It is cached in Redis (`frappe/model/utils/user_settings.py:13-27,73-80`).
- The client writes it with `frappe.model.user_settings.save` (`js/model/user_settings.js:9,39`).
- Each view keeps its state under `user_settings[<View>]` (`js/list/list_view.js:118-120`). Every ListView subclass stores `filters`, `sort_by` and `sort_order` there (`js/list/list_view.js:1083-1087`).

**Last view**
- `user_settings.last_view` is written by List (`js/list/list_view.js:1071`), Report (`js/views/reports/report_view.js:192`) and both Kanbans (`js/views/kanban/kanban_view.js:442`, `js/views/kanban_v2/kanban_page.js:363`).
- A bare doctype route resolves to `meta.default_view` or List (`js/router.js:383-395`). `DocType.default_view` and `force_re_route_to_default_view` are defined at `frappe/core/doctype/doctype/doctype.json:633,639`.

**List View Settings** (site-wide, one row per doctype; `frappe/desk/doctype/list_view_settings/list_view_settings.json`)
- Fields: `disable_count` :26, `disable_sidebar_stats` :32, `disable_auto_refresh` :38, `fields` :48, `disable_comment_count` :56, `allow_edit` :63, `disable_automatic_recency_filters` :69, `disable_scrolling` :75, `show_tags` :89.
- It is read through `frappe.desk.listview.get_list_settings` (`frappe/desk/listview.py:16`).

**List Filter** (saved list layouts; `frappe/desk/doctype/list_filter/list_filter.json`)
- Fields: `filter_name` :25, `reference_doctype` :30, `for_user` :36, `route_signature` :42, `filters` :48, `columns` :53, `sort_field` :58, `sort_order` :63, `is_standard` :83, `module` :91, `layout_order` :99.
- It is written by `update_list_filter` (`js/list/list_filter/list_filter_api.js:144,209`).
- The active layout is stored as `user_settings.List.active_layout_name` (`js/list/list_view_select.js:252-254`).

**App files for List Filter and Kanban Board**
- Standard List Filters and Kanban Boards already ship as app files at `doctype/{reference_doctype}/{list_filter,kanban_board}/{name}.json`. Migrate syncs them (`frappe/model/sync.py:202-207`), and they are orphan-swept when their file is gone (`frappe/model/sync.py:260-261,292-293`).
- In developer mode, a standard Kanban Board writes its own file on save (`frappe/desk/doctype/kanban_board/kanban_board.py:87-95,118-132`).
- No app on this bench ships either kind of file (`find` over frappe, erpnext and crm finds none).

**Size of the shared base**
- `js/list/base_list.js` (1,480) and `js/list/list_view.js` (3,511) total **4,991**.
- Other shared code:

| File | LOC |
|---|---|
| `list_view_select.js` | 592 |
| `list_settings.js` | 486 |
| `list/list_filter/*` | 1,515 |
| `bulk_operations.js` | 519 |
| `list_view_virtualization.js` | 422 |
| `list_sidebar_group_by.js` | 220 |
| `list_factory.js` | 121 |
| `frappe/desk/reportview.py` | 1,386 (the data endpoint for every list view) |
| `list_filter.py` | 322 |
| `list_view_settings.py` | 109 |
| `user_settings.py` | 127 |

---

## 1. Report (Report Builder)

**Shows and jobs**
- A datatable of one doctype's rows (`js/views/reports/report_view.js:9`). A person can:
  - pick columns;
  - filter and sort;
  - group by with aggregates (`:113-128`);
  - add a totals row (`:1628-1635`);
  - show a chart (`:99-111`);
  - edit cells inline (`:756-770`);
  - export (`:1788`);
  - use Save, Save As or Delete on a named report (`:1900-1924`).

**Stores**
- Unsaved state: `user_settings.Report` = `{fields, filters, order_by, group_by, chart_args, add_totals_row}` (`report_view.js:195-202`).
- A saved report is a `Report` row (`frappe/core/doctype/report/report.json`): `report_name` :45, `ref_doctype` :52, `is_standard` :66, `report_type = "Report Builder"` :100, `json` :134.
- `json` holds `filters`, `fields`, `order_by`, `add_totals_row`, `page_length`, `column_widths`, `group_by` and `chart_args` (`report_view.js:1428-1437`).
- `group_by` = `{group_by: [...], aggregates: [{aggregate_function, aggregate_on}]}` (`js/ui/group_by/group_by.js:305-320`). The legacy single-field form is normalised in `frappe/desk/reportview.py:287-296`.

**Reads from meta and hooks**
- Default columns: `title_field`, `image_field`, and fields with `in_list_view` or `in_standard_filter` that are not `report_hide` (`report_view.js:878-896`).
- `can_get_report` (`:12`).
- The switcher's report list: `listview_settings.reports` and `frappe.boot.allowed_reports` (`js/list/list_view_select.js:425-436`).

**Writes**
- A cell edit calls `frappe.db.set_value`, which goes to `frappe.client.set_value` (`report_view.js:759-760`). `is_editable` decides which cells may change (`:832-854`).
- Save and Save As call `frappe.desk.reportview.save_report` (`report_view.js:1439-1445`). It:
  - refuses standard reports and reports of other types (`frappe/desk/reportview.py:492-496`);
  - creates the Report if needed (`:508-510`);
  - sets `report_type` and `json` (`:516-518`).
- Delete calls `delete_report` (`frappe/desk/reportview.py:528`).

**Size: 2,742 LOC (exclusive)**
- `report_view.js` 1,978, `ui/group_by/group_by.js` 666, `group_by.html` 42, `link_side_panel.js` 41, `report_factory.js` 15.
- Shared with query and script reports, not counted: `report_utils.js` 360, the Report doctype (`report.py` 627 + `.json` 317 + `.js` 90), and `reportview.py`.

## 2. Kanban

desk v1 has two Kanban engines on this branch. **Kanban v2 is wired up and is the default:**
- `ListFactory` picks the engine by `Kanban Board.use_kanban_v2` (`js/list/list_factory.js:21-38,111-121`).
- `before_insert` sets `use_kanban_v2 = 1` on every new board that is not imported (`frappe/desk/doctype/kanban_board/kanban_board.py:134-140`).
- A standard board must use v2 (`kanban_board.py:76-77`).
- v1 (`js/views/kanban/`) still serves older boards (`js/views/kanban/kanban_view.js:9`).

**Shows and jobs**
- Cards in columns by one field's value. A person can:
  - create a board (`kanban_view.js:608-713`);
  - drag a card to another column;
  - reorder cards and columns;
  - add, archive or restore a column, and set its colour;
  - save the board's filters;
  - choose the card fields.
- v2 adds:
  - swimlanes by a second field (`kanban_board.py:447-491`);
  - bulk moves (`js/views/kanban_v2/providers/frappe_data_provider.js:125-144`);
  - Duplicate Board (`kanban_page.js:997-1007`).

**Stores**
- `Kanban Board` (`frappe/desk/doctype/kanban_board/kanban_board.json`):
  - identity and scope: `kanban_board_name` :38, `reference_doctype` :45, `private` :115, `is_standard` :98, `module` :107;
  - the board's field and filters: `field_name` :53, `filters` :90;
  - child tables: `columns` :63, `card_fields` :70, `preview_fields` :77, `group_by_fields` :84;
  - card display: `fields` :120 (v1 card fields, JSON), `show_labels` :132, `title_field` :153, `show_assigned_to` :160, `show_tags_on_card` :167, `image_field` :177, `footer_date_field` :184;
  - engine: `use_kanban_v2` :140.
- `Kanban Board Column` (`kanban_board_column.json`): `column_name` :15, `status` (Active or Archived) :22, `indicator` :30, `order` (a JSON list of card names) :37.
- Two further child doctypes: `Kanban Board Field` and `Kanban Board Group Field`.
- `user_settings.Kanban.last_kanban_board` (`kanban_view.js:443-445`, `kanban_page.js:364-366`).

**Reads from meta and hooks**
- The column field must be a Select field. v1's create dialog offers only Select fields, and not `kanban_column` (`kanban_view.js:636-637`; board form `kanban_board.js:38`).
- Swimlane fields must be Select or Link (`kanban_board.js:111-120`). The default swimlanes are the visible Select fields (`kanban_board.py:252-254`).
- `quick_kanban_board` seeds columns from the Select options (`kanban_board.py:705-717`).
- `{doctype}_kanban.js` and the `doctype_kanban_js` hook (`frappe/desk/form/meta.py:109,119`) feed the `frappe.kanban_v2.settings` registry (`js/views/kanban_v2/settings.js:1-43`).

**Writes**
- **v1 card drag** (`update_order_for_single_card`): writes both columns' `order` on the board, then `frappe.set_value(doctype, name, field_name, to_column)` (`kanban_board.py:637-643`).
- **v2 card drag**: `frappe.client.set_value` on the record's `field_name` only. No card order is saved (`frappe_data_provider.js:111-121`). Bulk moves use `frappe.client.bulk_update` (`:126-135`).
- **Column reorder**: `update_column_order` rebuilds `columns` (`kanban_board.py:735-764`).
- **Archive and restore**: `archive_restore_column` (`:553-562`). **Colour**: `set_indicator` (`:768-778`).
- **v1 add column**:
  - only on a custom field (`js/views/kanban/kanban_board.bundle.js:594-600`);
  - appends the option to the Select field through Customize Form `save_customization` (`:1603-1644`);
  - then calls `add_column` (`kanban_board.py:539-549`).
- **Filters**: `frappe.db.set_value("Kanban Board", ..., "filters")` (`kanban_view.js:461`, `kanban_page.js:1014-1021`).
- **Settings**:
  - v1 `save_settings` writes `fields` and `show_labels` (`kanban_board.py:782-799`);
  - v2 saves the whole board (`kanban_settings.bundle.js:416`);
  - a v2 change of `field_name` rebuilds the columns (`:368-385`).

**Size: 9,604 LOC**
- v1 `js/views/kanban/*`: 3,684.
- v2 `js/views/kanban_v2/**`: 4,444.
- Doctypes (board, column, field, group field), tests excluded: 1,476.
- Not counted: scss 871 and `test_kanban_board.py` 594.

## 3. Calendar

**Shows and jobs**
- A FullCalendar of records placed by date. A person can:
  - drag or resize an event to change its dates (`js/views/calendar/calendar.js:395-400`);
  - select a range to create a record with the dates filled in (`:401-423`);
  - click an event to open its form (`:388-393`);
  - switch between month, week and day, and toggle weekends.

**Stores**
- `Calendar View` (`frappe/desk/doctype/calendar_view/calendar_view.json`): `reference_doctype` :19, `subject_field` :27, `start_date_field` :34, `end_date_field` :40, `all_day` :51. It is a named calendar that a person makes without code.
- `user_settings.Calendar.last_calendar` (`calendar.js:45-47`).
- localStorage `cal_initialView` and `cal_weekends` (`:133-134,232,308`).

**Reads from meta and hooks**
- The `default` calendar uses `frappe.views.calendar[doctype]` (`calendar.js:71-76`). That object comes from `{doctype}_calendar.js` or the `doctype_calendar_js` hook (`frappe/desk/form/meta.py:110,121`). Its keys:
  - `field_map`;
  - `get_events_method` and `update_event_method`;
  - `fields`, `style_map` and `gantt` (example `frappe/desk/doctype/event/event_calendar.js:1-16`).
- A named calendar builds `field_map` from its Calendar View row (`calendar.js:78-101`).
- The `calendars` hook (`frappe/hooks.py:130`) becomes `boot.calendars` (`frappe/boot.py:123`). It adds menu links to other calendars (`calendar.js:153-157`).
- Events come from `get_events_method`, else `frappe.desk.calendar.get_events` (`calendar.js:377`, `frappe/desk/calendar.py:34-76`).

**Writes**
- `frappe.desk.calendar.update_event` (`calendar.js:634-636`).
- The server sets only `field_map.start` and `field_map.end`, then saves (`frappe/desk/calendar.py:13-20`).

**Size: 922 LOC.** `calendar.js` 675, `calendar.bundle.js` 8, `desk/calendar.py` 76, `calendar_view` doctype 163. scss 174 not counted.

## 4. Gantt

**Shows and jobs**
- frappe-gantt bars, one per record. A person can:
  - drag a bar to change its dates;
  - drag its progress;
  - double-click a bar to open the form;
  - switch the view mode, such as Day or Week (`js/views/gantt/gantt_view.js:198-265`).

**Stores**
- `user_settings.Gantt.gantt_view_mode` (`:240-242`), plus the inherited filters and sort.
- It has no DocType of its own.

**Reads from meta and hooks**
- Reads `frappe.views.calendar[doctype]` merged over defaults: start, end, progress, colour, is_milestone and depends_on (`gantt_view.js:3-11,21-25`).
- A `gantt` object in those settings overrides that (`:27-28`).
- The switcher does not check the `gantt: true` flag. Gantt is offered wherever Calendar is (`js/list/list_view_select.js:143-152`).
- `listview_settings.gantt_custom_popup_html` (`gantt_view.js:258`; used by `erpnext:erpnext/projects/doctype/task/task_list.js:36`).

**Writes**
- `frappe.db.set_value` of `field_map.start` and `field_map.end` on a date change (`:215-220`).
- `frappe.db.set_value` of `field_map.progress` on a progress change (`:222-236`).

**Size: 327 LOC.** `gantt_view.js` only.

## 5. Tree

**Shows and jobs**
- A nested-set hierarchy. A person can:
  - expand nodes;
  - add a child;
  - move a node to another parent;
  - rename, delete or edit a node (`js/views/treeview.js:559-645`);
  - sort, print, and rebuild the tree (`:526-527`).
- There is no drag and drop.

**Stores**
- `user_settings.Tree.sort_order` (`treeview.js:220,245-247`). No `last_view` is written.
- It has no DocType of its own.

**Reads from meta and hooks**
- The route refuses a doctype that has neither `frappe.treeview_settings[doctype]` nor an `is_group` field (`treeview.js:16-22`). The switcher instead checks `meta.is_tree`.
- `{doctype}_tree.js` and the `doctype_tree_js` hook (`frappe/desk/form/meta.py:111,120`) provide these keys, all read in `treeview.js:77-928`:
  - `get_tree_nodes`, `get_tree_root`, `add_tree_node` and `root_label`;
  - `fields`, `ignore_fields` and `filters`;
  - `toolbar`, `extend_toolbar`, `menu_items` and `disable_add_node`;
  - `onload` and `post_render`.
- `nsm_parent_field` (`treeview.js:686`, `frappe/desk/treeview.py:48`).
- `boot.treeviews` from the `treeviews` hook (`frappe/boot.py:124`).

**Writes**
- **Move**: `frappe.client.set_value` of the parent field (`treeview.js:714-721`).
- **Add**: `frappe.desk.treeview.add_node` (`:785`, `frappe/desk/treeview.py:71-82`).
- **Rename**: `frappe.model.rename_doc` (`treeview.js:609`). **Delete**: `frappe.model.delete_doc` (`:628`).

**Size: 1,743 LOC.** `treeview.js` 948, `js/ui/tree.js` 702 (used only here), `desk/treeview.py` 93. `utils/nestedset.py` 429 is the model layer and is not counted.

## 6. Image

**Shows and jobs**
- A grid of record thumbnails with a gallery of all attached images (`js/views/image/image_view.js:21-25,45-56`).
- A person can select, like and zoom.

**Stores**
- Only the inherited `user_settings.Image` keys (filters and sort).
- It has no DocType of its own.

**Reads**
- `meta.image_field`, `title_field` and the `in_list_view` fields (`image_view.js:27-34,75-95`).
- Attached File rows through `frappe.core.api.file.get_attached_images` (`:152-163`).

**Writes:** a like toggle only, through `frappe.desk.like.toggle_like` (`js/list/list_view.js:2367-2371`).

**Size: 371 LOC.** `image_view.js` 263 + 2 templates 108.

## 7. Inbox

**Shows and jobs**
- Email Communications for one email account. A person can:
  - read the All, Sent, Spam and Trash folders (`js/views/inbox/inbox_view.js:135-168`);
  - compose a message (`:201-210`);
  - mark a message read or unread (`frappe/core/doctype/communication/communication_list.js:16-24`).

**Stores**
- `user_settings.Inbox` keys: sort, and `last_email_account`.
- `last_email_account` is saved from `this.current_email_account` (`inbox_view.js:40-42`). Nothing assigns that property; the code uses `this.email_account` (`:52`). So the saved value is always undefined.
- It has no DocType of its own.

**Reads**
- `frappe.boot.email_accounts` (`frappe/boot.py:128`), built from the user's User Email rows (`frappe/email/inbox.py:9-39`).
- Communication fields: `sent_or_received`, `seen`, `status` and `email_status` (`inbox_view.js:76-85`).
- It is offered only for Communication.

**Writes**
- Read and unread go through `frappe.email.inbox.create_email_flag_queue`, which sets `seen` (`frappe/email/inbox.py:59-115`).
- Compose goes through `communication.email.make` (`js/views/communication.js:1724`).

**Size: 401 LOC.** `inbox_view.js` 211, `email/inbox.py` 160, `communication_list.js` 30. The composer (`communication.js`, 2,003) is shared with forms and is not counted.

## 8. Map

**Shows and jobs**
- Leaflet markers, one per record, with a popup that links to the form (`js/views/map/map_view.js:44-79,145-167`).
- It is read-only.

**Stores**
- Only the inherited `user_settings.Map` keys.
- It has no DocType of its own.

**Reads**
- A Geolocation field named `location` (GeoJSON), or `latitude` and `longitude` fields (`map_view.js:18-34,93-143`).
- `get_coords_method` is checked by the switcher (`js/list/list_view_select.js:174`), but `map_view.js` never reads it.

**Writes:** none.

**Size: 227 LOC** (`map_view.js`). Leaflet is shared with the Geolocation control and is not counted.

## 9. Dashboard view

**Shows and jobs**
- `/<doctype>/view/dashboard` opens `frappe.views.DashboardView`, a ListView subclass (`js/views/dashboard/dashboard_view.js:3-5`). It is offered for every doctype.
- It shows the doctype's Dashboard Charts and Number Cards. In Customize mode a person can add, sort, remove, hide and resize them (`:152-185`), or reset the layout (`:259-268`).
- It is not the form's connections dashboard (`__dashboard`, read only by `js/form/dashboard.js:249`).

**Stores**
- `user_settings.dashboard_settings = {charts, number_cards}` (`dashboard_view.js:13-14,239-248`).
- Per-chart config in the user's `Dashboard Settings.chart_config` (`:124-131`, `js/utils/dashboard_utils.js:86-100`).

**Reads**
- Public Dashboard Charts of type Count, Sum or Group By whose `document_type` is the doctype.
- Public Number Cards for the doctype (`dashboard_view.js:94-113`).

**Writes**
- A layout save writes user settings (`:244`).
- "New Chart" calls `create_dashboard_chart` (`:446-448`, `frappe/desk/doctype/dashboard_chart/dashboard_chart.py:144`).

**Size: 509 LOC** (`dashboard_view.js`). The widget code is shared with Workspace and is not counted.

---

## Shared CRM v1 base

**Types**
- `CRM View Settings.type` has three options: `list`, `group_by` and `kanban` (`crm:crm/fcrm/doctype/crm_view_settings/crm_view_settings.json:121-127`). The router knows only these three (`crm:frontend/src/router.js:251`).
- Calendar is a separate page. "Cards" is the Notes page showing a `list` row. Neither is a stored type.

**Routes**
- Each page has the form `/<page>/view/:viewType?` (`crm:frontend/src/router.js:41-102`).
- With no `viewType`, the route opens:
  1. the user's `is_default` row;
  2. else a standard `is_default` row;
  3. else `list` (`router.js:253-292`).
- A `viewType` that is not a type is looked up as a view name or label and becomes `?view=` (`router.js:293-312`).

**Switcher per page**

| Page | Types offered |
|---|---|
| Leads | list, group_by, kanban (`crm:frontend/src/pages/Leads.vue:28`) |
| Deals | list, group_by, kanban (`crm:frontend/src/pages/Deals.vue:27`) |
| Tasks | list, kanban (`crm:frontend/src/pages/Tasks.vue:27`) |
| Contacts, Organizations, Call Logs | list only. This is the default `['list']` (`crm:frontend/src/components/ViewControls.vue:362`). |
| Notes | list only, shown as cards |
| Calendar | its own page (`router.js:105-109`) |

**Fields** (in `crm_view_settings.json`)

| Group | Fields |
|---|---|
| Identity | `label` :65, `icon` :117, `type` :122, `dt` :76, `route_name` :100 |
| Scope | `user` :44, `is_standard` :178, `is_default` :184, `public` :112, `pinned` :95 |
| Query | `filters` :55, `order_by` :89 |
| List | `columns` :39, `rows` :50, `load_default_columns` :106 |
| Group by | `group_by_field` :134 |
| Kanban | `column_field` :147, `title_field` :172, `kanban_columns` :162, `kanban_fields` :167 |

**Reads**
- `crm.api.views.get_views` returns rows where `user` is blank or is the session user (`crm:crm/api/views.py:5-16`).
- `crm.api.doc.get_data` is the one data endpoint for all three types (`crm:crm/api/doc.py:256-545`). It replaces `@me` with the session user (`doc.py:283-293`).

**Writes** (in `crm_view_settings.py`)
- The plain view auto-saves into the user's `is_standard` row through `create_or_update_standard_view` (`:217-287`; `ViewControls.vue:1082-1111`).
- On a saved view, filter and sort changes set `viewUpdated` and wait for "Save Changes" (`ViewControls.vue:1325-1346`).
- `create` (`:46-84`) and `delete` (`:122-127`).
- `public`: allowed for Administrator or Sales Manager. It clears `user` (`:130-140`).
- `pin` (`:143-148`).
- `set_as_default`: clears the user's other defaults (`:200-214`).

**Other storage**
- Quick filters live in `CRM Global Settings` with `type = "Quick Filters"`, plus a Property Setter on `in_standard_filter` (`crm:crm/api/doc.py:168-170,227-253`).
- localStorage holds only the list scroll position (`crm:frontend/src/components/ListViews/ListRows.vue:74`).

**Size of the shared base**
- Frontend 3,132 LOC: `ViewControls.vue` 1,426, `Filter.vue` 759, `router.js` 321, `SortBy.vue` 277, `ViewModal.vue` 150, `stores/views.js` 83, `ViewBreadcrumbs.vue` 81, `utils/view.js` 35.
- Backend 595 LOC: `crm_view_settings` py, json and js, and `api/views.py`.
- Plus `get_data`, 290 LOC.

## 10. CRM list

**Jobs**
- Browse, sort, filter and use quick filters.
- Add, reorder and resize columns.
- Click a cell to filter on its value (`crm:frontend/src/pages/Leads.vue:251-253`).
- Select rows for bulk actions, load more, export and import.

**Stores:** `filters`, `order_by`, `columns` (`{label, type, key, width}`), `rows` and `load_default_columns`.

**Reads**
- Columns and rows come from the user's standard row, else from the controller's `default_list_data()` (`doc.py:324-338`).
- `default_list_data()` exists on seven controllers, for example `crm:crm/fcrm/doctype/crm_lead/crm_lead.py:447` and `crm_deal.py:302`.
- Columns on fields hidden in meta are dropped (`doc.py:350-352`).
- Each row passes through the controller's `parse_list_data` (`doc.py:548-552`).

**Writes**
- A column change or resize saves at once. On the plain view it saves the standard row. On a private saved view it calls `update` with no Save step (`ViewControls.vue:969-1013`).

**Size**
- Frontend about 2,488 LOC: `ColumnSettings` 312, six page `ListView` components 1,752, `ListRows` 113, `ListBulkActions` 252, `EmptyState` 59.
- Backend about 69 LOC, plus 351 in `default_list_data()` across seven controllers.

## 11. CRM group by

**Jobs**
- List rows under one header per value of a chosen field.
- Collapse or expand a group. The collapse state is not stored (`Leads.vue:389`).

**Stores:** `group_by_field` (default `owner`, `crm_view_settings.py:249,276`), plus all the list keys.

**Reads**
- Allowed fields: Check, Data, Float, Int, Currency, Dynamic Link, Link, Select, Duration, Date and Datetime, plus eight standard fields such as `owner`, `_assign` and `creation` (`doc.py:112-160`).
- Group values:
  - for a Select field, the meta options;
  - for any other field, the distinct values on the loaded page (`doc.py:492-524`).
- Grouping happens in the client (`Leads.vue:372-402`, `Deals.vue:341-371`).

**Writes**
- `updateGroupBy` saves the standard row on the plain view. On a saved view it waits for Save (`ViewControls.vue:954-967`).

**Size:** frontend about 185 LOC (`GroupBy.vue` 74 + page helpers); backend about 85.

## 12. CRM kanban

**Jobs**
- Drag a card to another column to change the record's field.
- Reorder cards within a column, and reorder columns.
- Set a column's colour, hide a column, add a hidden column back, or reload columns.
- Load more per column.
- Use "+" on a column to create a record with that column's value (`Leads.vue:522-530`).
- Use the card menu for Call, Note and Task (`Leads.vue:532-555`).
- Settings choose the column field, the title field and the card fields (`crm:frontend/src/components/Kanban/KanbanSettings.vue:225-233`).

**Stores**
- `column_field` (default `status`, `crm_view_settings.py:226`), `title_field`, `kanban_fields` (fieldnames) and `filters`.
- `kanban_columns`: a list of `{name, color, order: [names], delete, page_length}` (`crm:frontend/src/components/Kanban/KanbanView.vue:255-275`). `page_length` is stripped before save.

**Reads**
- The column field must be Link or Select (`KanbanSettings.vue:152-157`).
- Column values (`doc.py:377-386`):
  - for a Link field, the target doctype's rows by `modified asc`. This ignores `CRM Lead Status.position`;
  - for a Select field, the option lines.
- Default title and card fields come from `default_kanban_settings()` (`doc.py:388-399`; `crm_lead.py:514-519`, `crm_deal.py:369-374`, `crm_task.py:112-117`).
- Each column runs its own query with page length 20, plus a count (`doc.py:405-452`).
- A saved `order` is applied in `get_records_based_on_order` (`doc.py:564-590`).

**Writes**
- **Cross-column drop**: `frappe.client.set_value(doctype, name, column_field, to)`. The card's position in the new column is not saved (`ViewControls.vue:1015-1024`).
- **Reorder, colour, hide and add**: these change `kanban_columns`. The plain view saves the standard row; a saved view waits for Save (`ViewControls.vue:1031-1060`).
- **Reload Columns**: `fetch_and_update_kanban_columns` appends new options as hidden (`crm_view_settings.py:290-305`).

**Size**
- Frontend 1,102 LOC: `KanbanView.vue` 277, `KanbanSettings.vue` 235, card templates in the Leads, Deals and Tasks pages 512, `ViewControls` kanban functions 78.
- Backend about 163 LOC.

## 13. CRM calendar

The calendar is a separate page at `/calendar` (`crm:frontend/src/router.js:105-109`), not a stored view type. Only desktop shows its sidebar link (`crm:frontend/src/components/Layouts/AppSidebar.vue:291-296`).

**Jobs**
- A Day, Week or Month grid of a chosen user's events (`crm:frontend/src/pages/Calendar.vue:96-120`).
- Click a cell to create an event. Click an event to see its details, or double-click to edit it.
- Drag or resize an event to reschedule it.
- Delete or duplicate an event, and RSVP.

**Stores**
- Nothing in `CRM View Settings`.
- `FCRM Settings.default_calendar_view` holds Daily, Weekly or Monthly (default Weekly) (`crm:crm/fcrm/doctype/fcrm_settings/fcrm_settings.json:161-167`).
- The chosen user is not saved.

**Reads**
- Core `Event` rows with `status = Open` in the visible range, where the chosen user is the owner or a participant (`Calendar.vue:217-256`).

**Writes**
- `Event` insert, set_value and delete (`Calendar.vue:316-418`).
- `frappe.desk.doctype.event.event.update_attending_status` for RSVP (`crm:frontend/src/components/Calendar/CalendarEventPanel.vue:862`).
- It does not show CRM Task.

**Size**
- Frontend 2,309 LOC: `Calendar.vue` 627, `CalendarEventPanel` 1,035, `Attendee` 317, `CalendarSettings` 284, `utils.js` 46.
- Backend: no calendar-view code.

## 14. CRM cards (Notes page)

**Jobs**
- A 4-column grid of note cards (`crm:frontend/src/pages/Notes.vue:27-96`).
- Click a card to edit it in a modal. Delete a card. Load more.
- `?open=<name>` opens one note (`:171-185`).

**Stores:** a `list`-type `CRM View Settings` row for `FCRM Note`, with only `filters` and `order_by`. There is no column UI (`Notes.vue:22`).

**Reads:** the `get_data` list branch. Rows come from `FCRM Note.default_list_data()` with `columns: []` (`crm:crm/fcrm/doctype/fcrm_note/fcrm_note.py:24-34`).

**Writes**
- Delete calls `frappe.client.delete` (`Notes.vue:163-169`).
- Create and edit go through the modal (`:146-161`).

**Size:** 61 of the 186 LOC in `Notes.vue`; backend 11.

---

## Use on desk.localhost

Counted on 2026-10-30. `desk.localhost` is a development site with little real use, so these counts show what exists, not real-world use. `crm.localhost` could not be reached, so it has no counts.

| Storage | Rows |
|---|---|
| `Kanban Board` / `Kanban Board Column` | 0 / 0 |
| `Calendar View` | 0 |
| `List Filter` | 0 |
| `List View Settings` | 0 |
| `Report`, all types | 194 |
| `Report`, Report Builder type | 7 (all standard ERPNext or frappe; 0 user-saved) |
| `__UserSettings` | 33 rows; 9 doctypes carry `last_view`, all `"List"`; 0 rows hold a Report, Kanban, Calendar, Gantt or Image key |
| `Dashboard Chart` / `Dashboard` | 50 / 9 |
| `CRM View Settings` | 0 |
| `Doctype View` (desk v2) | 2 |

## Meta setups in ERPNext, frappe and CRM

**Calendar** (`frappe.views.calendar[...]` in `*_calendar.js`; each one also makes Gantt appear in the switcher)
- erpnext, 8 calendars:
  - Task (`erpnext:erpnext/projects/doctype/task/task_calendar.js:4`)
  - Timesheet (`erpnext:erpnext/projects/doctype/timesheet/timesheet_calendar.js:1`)
  - Work Order (`erpnext:erpnext/manufacturing/doctype/work_order/work_order_calendar.js:4`)
  - Job Card (`erpnext:erpnext/manufacturing/doctype/job_card/job_card_calendar.js:1`)
  - Production Plan Schedule (`erpnext:erpnext/manufacturing/doctype/production_plan_schedule/production_plan_schedule_calendar.js:4`)
  - Sales Order (`erpnext:erpnext/selling/doctype/sales_order/sales_order_calendar.js:4`)
  - Holiday List (`erpnext:erpnext/setup/doctype/holiday_list/holiday_list_calendar.js:4`)
  - Asset Maintenance Log (`erpnext:erpnext/assets/doctype/asset_maintenance_log/asset_maintenance_log_calendar.js:4`)
- frappe, 2 calendars: Event (`frappe/desk/doctype/event/event_calendar.js:1`) and ToDo (`frappe/desk/doctype/todo/todo_calendar.js:4`).
- No doctype JSON in the three apps sets `is_calendar_and_gantt: 1`.
- `calendars` hooks: erpnext `["Task", "Work Order", "Sales Order", "Holiday List", "ToDo"]` (`erpnext:erpnext/hooks.py:140`) and frappe `["Event"]` (`frappe/hooks.py:130`).

**Gantt flag**
- These calendars set `gantt`:
  - Task :13, Timesheet :16, Work Order :17 and Sales Order :13 (erpnext);
  - Job Card :11, as an object (erpnext);
  - ToDo :12 (frappe).
- The switcher ignores the flag (see [Gantt](#4-gantt)).

**Tree**
- erpnext, 14 doctypes with `"is_tree": 1`: Account, Cost Center, Location, Task, Quality Procedure, Company, Customer Group, Department, Employee, Item Group, Sales Person, Supplier Group, Territory and Warehouse.
- erpnext has 15 `*_tree.js` files. They include BOM, which is not `is_tree` and uses its own `get_children` (`erpnext:erpnext/manufacturing/doctype/bom/bom_tree.js:1-2`).
- The `treeviews` hook lists 9 doctypes (`erpnext:erpnext/hooks.py:106-116`).
- crm, 2 doctypes: CRM Territory and CRM Sales Hierarchy, each with a `*_tree.js`.
- frappe ships no `is_tree` doctype.

**Map**
- erpnext Location only. It has `latitude` :74, `longitude` :80 and a Geolocation field `location` :106 (`erpnext:erpnext/assets/doctype/location/location.json`).
- frappe and crm have none.

**Image:** 14 erpnext doctypes set `image_field`: Item, Batch, Customer, Workstation, Work Order, BOM, Lead, Supplier, Asset, Video, Company, Employee, Brand and Item Group.

**Inbox:** Communication only, by a hard-coded check.

---

## Summary table

LOC counts only the type's own code. The shared bases are counted once: desk v1 list base 4,991; CRM view base 3,132 frontend + 595 backend + `get_data` 290.

| Type | Stores | Reads (meta, hooks) | User's write | LOC | Rows (desk.localhost) |
|---|---|---|---|---|---|
| v1 Report | `Report` (`report_type` Report Builder, `json`); `user_settings.Report` | `in_list_view` / `in_standard_filter`, `title_field`, `image_field`, `allowed_reports` | `client.set_value` cell edit; `reportview.save_report` / `delete_report` | 2,742 | 7 (all standard) |
| v1 Kanban | `Kanban Board` + Column / Field / Group Field tables; app files; `user_settings.Kanban.last_kanban_board` | a Select `field_name`; Select or Link swimlanes; `{doctype}_kanban.js` | v2: `client.set_value(field_name)` / `bulk_update`. v1: column `order` + `set_value`, Customize Form options. Column order, colour, archive, `filters` on the board. | 9,604 (v1 3,684, v2 4,444, doctypes 1,476) | 0 |
| v1 Calendar | `Calendar View`; `user_settings.Calendar.last_calendar`; localStorage | `{doctype}_calendar.js` (`field_map`, `get_events_method`), `calendars` hook, `is_calendar_and_gantt` | `desk.calendar.update_event` (start and end) | 922 | 0 |
| v1 Gantt | `user_settings.Gantt.gantt_view_mode` | the calendar `field_map` (+ `gantt` override), `gantt_custom_popup_html` | `db.set_value` start, end, progress | 327 | — |
| v1 Tree | `user_settings.Tree.sort_order` | `treeview_settings` / `*_tree.js`, `is_tree`, `is_group`, `nsm_parent_field`, `treeviews` hook | `client.set_value` parent; `treeview.add_node`; rename; delete | 1,743 | — |
| v1 Image | `user_settings.Image` (filters and sort only) | `image_field`, `title_field`, attached Files | `like.toggle_like` | 371 | — |
| v1 Inbox | `user_settings.Inbox` (`last_email_account` always undefined) | User Email accounts; Communication fields | `inbox.create_email_flag_queue`; compose | 401 | — |
| v1 Map | `user_settings.Map` (filters and sort only) | a `location` Geolocation field, or `latitude` + `longitude` | none | 227 | — |
| v1 Dashboard | `user_settings.dashboard_settings`; `Dashboard Settings.chart_config` | public Dashboard Charts and Number Cards with `document_type` = doctype | layout to user settings; `create_dashboard_chart` | 509 | 50 charts |
| CRM list | `CRM View Settings` `columns`, `rows`, `load_default_columns`, `filters`, `order_by` | `default_list_data()`, meta hidden flag, `parse_list_data` | standard row auto-save, or `update` on Save | ~2,488 FE / ~420 BE | 0 here; crm.localhost not reachable |
| CRM group by | + `group_by_field` | 11 fieldtypes + 8 standard fields; Select options or values on the page | standard row, or Save | ~185 FE / ~85 BE | as above |
| CRM kanban | + `column_field`, `title_field`, `kanban_fields`, `kanban_columns` | a Link or Select field; Link rows by `modified asc`; `default_kanban_settings()` | `client.set_value(column_field)`; `kanban_columns` saved | ~1,102 FE / ~163 BE | as above |
| CRM calendar | none (`FCRM Settings.default_calendar_view`) | core `Event` (Open, in range, owner or participant) | `Event` insert, set_value, delete; RSVP | 2,309 FE / 0 BE | — |
| CRM cards (Notes) | a `list` row: `filters`, `order_by` | `FCRM Note.default_list_data()` | `client.delete`; modal save | 61 FE / 11 BE | as above |
