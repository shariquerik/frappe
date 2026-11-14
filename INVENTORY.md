# DocType editor: the ruled prototype against the build

Inventory for [#47432](https://github.com/frappe/frappe/issues/47432), part of map [#47431](https://github.com/frappe/frappe/issues/47431). Throwaway branch `research/47431-inventory`. Do not merge.

## How this was made

- **Prototype:** `proto/doctype-editor` at `82a28b9b1f`, walk vite on `desk.localhost:8094`. Shot with the ruled switches: `?search=one` (#47098 Q1), `&child=C` (#47099 amendment), `&fetch=B` (#47100 "Fetch a field…"), `&cond=B` (map ruling 8). Other switches stay at their defaults, which are the ruled variants (`variant=A`, `finder=A`, `header=A`, `settings=B`, new layout menu). The variant bar at the bottom of each prototype shot is not design (charter ruling 3).
- **Build:** `desk-v2` at `bd1b5ca786` on `desk.localhost:8000`. `upstream/desk-v2` is now `cdac4eef71`; nothing under `frontend/src/pages/doctypeEditor/` or `ui/src/components/FormLayout/` changed between the two.
- **Same state on both sides:** Administrator, developer mode on, 1440×900 at 2x. DocTypes: Sales Invoice (standard, 13 records), Contact (layouts), Store (custom, 2 records), Field Coverage (custom), Sales Invoice Item (child), Selling Settings (Single), and a new DocType "WF47432 Ticket" (never saved).
- **Classes:** **missing** = ruled, not built. **changed** = built, not as ruled. **build-only** = built, and the prototype never had it (the line says if a ruling asked for it anyway). **bug** = wrong behaviour or drawing, whatever the ruling.
- **Ruling wins:** a resolution or amendment comment wins over the prototype (charter ruling 3). Map rulings 8 (condition builder in a dialog) and 9 (canvas marks inline after the label) were added on 2026-11-14 and win over both.
- **Shots:** each group links its pairs; the left link is the prototype, the right one the build. Base URL: `https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/`.

## Counts

| Class | Lines |
|---|---|
| missing | 20 |
| changed | 61 |
| build-only | 13 (6 with no ruling, 7 that a later ruling asked for but no prototype drew) |
| bug | 4 |
| match (kept for the record) | 7 |
| not reached | 1 |

Ruling shorthand used in the tables:

| Key | Comment |
|---|---|
| R-look | [#45867 resolution](https://github.com/frappe/frappe/issues/45867#issuecomment-6819241789) (round 4 shots: [round 4](https://github.com/frappe/frappe/issues/45867#issuecomment-6819189858)) |
| R-flow | [#45867 creation flow direction](https://github.com/frappe/frappe/issues/45867#issuecomment-6767773108) and [its prototype](https://github.com/frappe/frappe/issues/45867#issuecomment-6768461553) |
| R-saved | [#47095 resolution](https://github.com/frappe/frappe/issues/47095#issuecomment-6819623553) |
| R-cust | [#47096 resolution](https://github.com/frappe/frappe/issues/47096#issuecomment-6820105079) |
| R-lay | [#47097 resolution](https://github.com/frappe/frappe/issues/47097#issuecomment-6821928896), [amended](https://github.com/frappe/frappe/issues/47097#issuecomment-6824211648) |
| R-set | [#47098 resolution](https://github.com/frappe/frappe/issues/47098#issuecomment-6826208612) ([round 1 questions](https://github.com/frappe/frappe/issues/47098#issuecomment-6826053615)) |
| R-tab | [#47099 resolution](https://github.com/frappe/frappe/issues/47099#issuecomment-6829274158), [Q1 amended to C](https://github.com/frappe/frappe/issues/47099#issuecomment-6830166138) |
| R-cond | [#47100 resolution](https://github.com/frappe/frappe/issues/47100#issuecomment-6845236643) |
| R-gaps | [#47262 resolution](https://github.com/frappe/frappe/issues/47262#issuecomment-6845473809) (E1–E7) |
| M2, M8, M9 | Map [#47431](https://github.com/frappe/frappe/issues/47431) Notes, rulings 2 (marks come back, never over a label), 8 (builder in a dialog), 9 (marks inline after the label) |
| — | No ruling names it |

Line IDs (H1, C3, …) are for the owner's answers.

---

## 1. Header and page frame

Shots: [Sales Invoice, Design](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-design-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-design-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| H1 | A search button in the header, "Search fields, settings, properties" with the `Ctrl+J` hint, before Design \| Customize, on every tab | No search button. ⌘J still works (see section 10) | R-lay amended ("Find a field" button), R-set Q1 (one ⌘J search in the header) | missing |
| H2 | Editor, Settings and Preview tabs each have an icon | Text-only tabs | R-look (round 4 shots) | missing |
| H3 | Design meta line: `Accounts · Standard · 13 records` | Design meta line: `Accounts · From ERPNext · 13 records` (the Customize wording, in Design too) | R-lay amended ("From ERPNext" in the meta line, said for Customize) | changed |
| H4 | Developer in Customize: crumbs stay `DocType / Sales Invoice / Details ▾` | Developer in Customize: `Sales Invoice / Customize / Details ▾` (the manager's crumbs) | R-lay amended (manager sees `… / Customize / …`; developer not stated) | changed |
| H5 | Customize keeps the description line under the title | Customize hides the description line | R-gaps E7 (description typed in place under the name; no mode named) | changed |
| H6 | Undo and Redo hidden on the Preview tab | Undo and Redo stay on Preview | — | changed |
| H7 | "Not saved" badge | "Not Saved" (capital S) | R-look | changed |
| H8 | Narrow window (<1024px): one-line notice | Same notice, same text ([proto](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-narrow-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-narrow-build.png)); only the tab icons differ (H2) | R-look | match |

## 2. Header ⋯ menu

Shots: [Design ⋯](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-more-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-more-build.png) · [Export](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-cust-more-export-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-cust-more-export-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| M1 | Design ⋯: "Open Sales Invoice list", a divider, "Rename DocType…", "Delete DocType…" | Design ⋯: "Rename DocType…" and "Delete DocType…" only. "Open list" exists only after a first save, in the save banner | R-set Q3 (Open list, Rename, Delete) | missing |
| M2 | "Delete DocType…" in gray, like the other rows | "Delete DocType…" in red | — | changed |
| M3 | Customize ⋯: "Reset all customizations", "Export to an app" | "Reset all customizations", "Export customizations" | R-cust v7 ("Export customizations to an app") | changed |
| M4 | Export dialog: Module with the hint "The app and the folder the file goes in", and the path of the file it writes once a module is picked ("No site changes yet" before) | No module hint, no file path. Adds a Cancel button | R-cust v7 ("and the file path it writes") | missing |
| M5 | Reset all dialog: "ERPNext made them, and they come back on every migrate" | "an app made them" | R-cust v5 | changed |

## 3. New DocType (`/doctype/new`)

Shots: [dialog](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-new-dialog-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-new-dialog-build.png) · [draft](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-new-draft-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-new-draft-build.png) · [Settings › Form](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-new-settings-form-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-new-settings-form-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| N1 | "New DocType" on the DocType list opens the dialog over the list | `/doctype/new` opens the dialog over an empty page | R-flow step 1 | changed |
| N2 | Dialog asks Name, Module, Kind (Regular, Child table, Single, Submittable). Hints under each: "Saved as …, at /apps/desk/…", "Where its files go.", the kind's one-liner. Footer: "Nothing is created until you save." and Continue. A × closes it | Dialog asks Name, Module, Kind (custom or standard: "Custom: kept on this site") and Naming rule. No hints, no footer line, no ×. Cancel and Create | R-flow step 1 (name, module, kind; "nothing else"); R-set Q14 (kind in Form › Record) | changed |
| N3 | Module is prefilled with the last one used | Module is empty | R-flow step 1 | missing |
| N4 | Kind lives in the dialog only | Kind (Regular, Child table, Single, Submittable, Tree) is in Settings › Form › Record, as R-set Q14 asks; the prototype never drew it there | R-set Q14 | build-only (ruled) |
| N5 | Draft starts with a section named "Details" holding "Title" with the "· Title field" mark | Draft starts with "Untitled section" holding "Title", no mark | R-flow step 2, M2 | changed |
| N6 | Meta line: `Custom · Regular` (module · kind) | `Custom · Custom` (module · custom/standard) | R-look (round 4 draft shot) | changed |
| N7 | Crumbs: `DocType / WF47432 Ticket` | `DocType / WF47432 Ticket / Details ▾` (layout crumb on an unsaved DocType) | R-lay amended (layout crumb; not said for a draft) | changed |
| N8 | One tab: "Add section" and "Add tab" side by side under the last section | "Add tab" alone at the top right of the form; "Add section" alone under the last section | R-look ("A one-tab form shows 'Add tab' beside 'Add section'") | changed |
| N9 | — | "Fields not on this layout 0 · Every field is on this layout." under the form, on a new DocType too | R-gaps E6 (tray on Details) | build-only (ruled) |

## 4. Canvas: fields, sections, tabs, marks

Shots: [Sales Invoice](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-design-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-design-build.png) · [hover](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-hover-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-hover-build.png) · [field selected](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-field-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-field-build.png) · [section with rules](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cond-section-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cond-section-build.png) · [custom DocType](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-custom-dt-field-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-custom-dt-field-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| C1 | Tab strip ends with a quiet `+` | Tab strip ends with `···` and `+ Add tab` | R-look (round 4 tab shots) | changed |
| C2 | — | A `···` menu at the end of the tab strip | — | build-only |
| C3 | First tab with no label reads "Untitled tab" | It reads "Details" on the canvas, but the panel title says "Untitled tab" when it is selected | — | changed |
| C4 | Fields are frappe-ui look-alikes "one size up": taller inputs, placeholders "Choose a Company", a Small Text as a tall textarea | Fields are the record page's real controls, inert (E4): smaller inputs, placeholders "Search company", Date and Time as dropdowns. Sales Invoice's Customer Name (Small Text) draws as a one-line box | R-look ("one size up"), R-gaps E4 (real controls) | changed |
| C5 | "· Title field" after the title field's label (Customer Name, Full Name, Title) | No "· Title field" mark anywhere | M2, M9, R-look | missing |
| C6 | Rule mark right after the label. On a Check field it is pinned to the far right of the column | Rule mark in an absolute cluster at the column's right edge (`CanvasField.vue`), left of the hidden ⋯ and grip, which keep their width; on sections the same (`CanvasSection.vue`). Neither side is the target: M9 puts it inline after the label's last word, wrapping with it, on fields, Check fields, sections and tabs | M9 | changed |
| C7 | Section rule mark sits at the right of the heading | Same right-edge cluster as C6 ("Payments", "Currency and Price List", "Changes") | M9 | changed |
| C8 | Hover: a ring and a grip at the top right | Hover: a ring, a ⋯ menu and a grip at the top right | M9 (⋯ and grip only on hover, over the corner, no space when hidden) | changed |
| C9 | — | A field's ⋯ menu on the canvas with keyboard moves (Move up/down/left/right, to another tab) | — | build-only |
| C10 | — | A column toolbar (grip and ⋯) at the top left of each column, shown when its section is hovered or selected | — | build-only |
| C11 | Selected tab gets a gray fill on the canvas | Selected tab shows no fill; only the panel changes | R-look (d-34 "Tab selected") | missing |
| C12 | Selecting a section keeps the canvas where it is | Selecting a section scrolls the canvas so the section's top is at the top of the view | — | changed |
| C13 | Drag: dragging a field shows a bin, "Drop here to remove", while a field is held | No bin. A drag shows the field's ghost and a drop line ([proto drag, round 4](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/45867-d-11-over-bin.png) · [build drag](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-drag-build.png)) | R-look (round 4 drag shots) | missing |
| C14 | Table field: the read-only grid with one empty row, "Add Row" and a `+` header cell | The grid with "No rows" and no Add Row | R-tab amended (parent canvas draws the grid read-only) | changed |
| C15 | Custom DocType tab strip: tabs and `+` | Tabs, `···` and `+ Add tab` (as C1) | R-look | changed |

**Bugs on the canvas**

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| B1 | Marks never cover a label | Rule marks cover long labels: "Edit Posting Date and Time", "Update Outstanding for Self", "Update Billed Amount in Sales Order", "Update Billed Amount in Delivery Note", "Is Rate Adjustment Entry (Debit Note)" | M2, M9 | bug |
| B2 | — | With the ⋯ and grip hidden (opacity 0, width kept), the mark floats left of an empty gap; on hover the cluster shifts. Seen on fields and on section headings ("Currency and Price List") | M9 | bug |

## 5. The properties panel

### 5a. Nothing selected (Details)

Shots: [Sales Invoice](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-design-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-design-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| P1 | Hint "Select a field or a section heading to edit it here.", then "Add a field" with a search box and every field type, A to Z, with icons (click adds, drag drops) | One line: "Select a field, section or tab to edit it." No type list, so a type cannot be dragged to an exact place | R-look Q1 ("Two ways to add a field stay") | missing |
| P2 | Same panel in Customize | Same one line in Customize | R-look, R-cust | missing |

### 5b. A field selected

Shots: [Customer](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-field-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-field-build.png) · [Fetch a field…](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-fetch-add-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-fetch-add-build.png)

The groups Display, List and search, Data and permissions hold the same rows on both sides.

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| F1 | "Tab" row (a second way to move a field to another tab) | No Tab row | R-look (round 4 "Field Tab row") | missing |
| F2 | "Title field" toggle, with "Lists and links show this instead of the ID." | No Title field row (only in Settings › Form) | R-flow (field popover: title field), R-look round 4 | missing |
| F3 | Link field: "Fetched fields" row with "Fetch a field…" and "Fetched now: Customer Name, Customer Name in Arabic, Tax Id and 4 more." | "Fetch a field…" under Fetch from; no "Fetched now" list | R-cond ("Fetch a field…"), [#47100 Q8](https://github.com/frappe/frappe/issues/47100#issuecomment-6830923132) ("listing 'Fetched now: …'") | changed |
| F4 | "Only when empty" with the hint "Copies from Customer on every save; a typed value is replaced." | Toggle with no hint | R-cond | missing |
| F5 | Group "Conditions" | Group "Rules" | R-cond (Conditions group) | changed |
| F6 | Link filters summary "All customers" | "Any Customer" | R-cond | changed |
| F7 | — | Fieldname row keeps the lock text in Customize; the prototype dims it with a lock in the lane | R-cust v2 | changed |

### 5c. A section selected

Shots: [section](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-section-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-section-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| S1 | Subtitle "Section · 25 fields" | Subtitle "Section" | R-look | missing |
| S2 | Rows: Heading ("Add heading…"), Columns `1 \| 2 \| 3`, Collapsible | Rows: Label ("None"), Description, Hide label, Hide border, Collapsible. No Columns control, so the column count cannot change from the panel | R-look ("A section shows its heading and its columns") | missing |
| S3 | — | Description, Hide label and Hide border rows (the set [#45863](https://github.com/frappe/frappe/issues/45863) ruled; never drawn in the prototype) | #45863 | build-only (ruled) |
| S4 | Group "Conditions": Visible if, Starts open if (when collapsible) | Group "Rules": the same two rows | R-cond | changed |

### 5d. A tab selected

Shots: [tab](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-tab-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-tab-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| T1 | Subtitle "Tab · 19 sections · 88 fields" | Subtitle "Tab" | R-look | missing |
| T2 | "Order" row with ← and → | No Order row (the tab strip's `···` moves tabs instead, C2) | R-look ("the panel shows its Label and its order") | missing |
| T3 | Hint "To move a field to this tab, drag it onto the tab's name, or pick the tab in the field's settings." | No hint | R-look | missing |
| T4 | Label placeholder "Add label…" | "None" | R-look | changed |

## 6. Adding a field

Shots: [Add field](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-addfield-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-addfield-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| A1 | "Add field" opens a popover below the button: the label box, a type chip ("Date ▾") with "Guessed from 'date'", and Done / Add | An inline row in the column: a wide label box with a small type chip at its right. No "Guessed from" reason, no Done or Add buttons | R-look Q1, Q2 ("The chip shows the guess and its reason") | changed |

## 7. Customize mode

Shots: [a standard field changed and hidden](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-cust-changed-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-cust-changed-build.png) · [reset arrow](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-cust-reset-hover-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-cust-reset-hover-build.png) · [new custom field](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cust-new-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cust-new-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| K1 | Hidden eye and changed dot right after the label ("Customer X * 👁 •") | Eye and dot in the right-edge cluster with ⋯ and grip | M9 | changed |
| K2 | "Custom" badge right after the new field's label | "Custom" badge at the far right, after ⋯ and grip | M9 | changed |
| K3 | Hide field button in the panel header shows a gray fill once the field is hidden | Same eye button, no fill | R-cust v4 | changed |
| K4 | Per-property dot that turns into a reset arrow on hover | Same, with the tooltip "Reset to ERPNext's value (Customer)" | R-cust v3 | match |
| K5 | Locks on Type, Links to, Required, Fieldname | Locks on Type, Links to, Required; Fieldname keeps its note (F7) | R-cust v2 | match |
| K6 | "Placed after: Payment Due Date" with `due_date` and "Drag it to move it. It keeps this place when ERPNext adds fields." | Same text, without the fieldname | R-cust | changed |
| K7 | An eye on every hidden field, the app's own hidden fields too ("Is created using POS", "POS Closing Entry", "Has Subcontracted") | Same set of eyes, placed as K1 | R-cust v2 | match |
| K8 | Customize panel with nothing selected: "Add a field" types list | One line (P2) | R-cust | missing |

## 8. Layout menu, "Add a layout", Side panel, Quick entry

Shots: [layout menu](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-layout-menu-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-layout-menu-build.png) · [Add a layout](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-layout-menu-add-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-layout-menu-add-build.png) · [Side panel](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-side-panel-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-side-panel-build.png) · [Quick entry](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-quick-entry-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-quick-entry-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| L1 | The #47098 menu: 320px, the source as small gray text in one column ("From fields", "App", "Not set up"), a gray fill on the open layout, no check | The round-1 menu: sources as gray pills ("From DocType fields", "App layout"), a check on the open layout | R-set ("The menu is the new design") | changed |
| L2 | Last row "+ Add layout…" | "+ Add a layout…" | R-set ("Add layout…") | changed |
| L3 | "Add a layout": Title (required), Based on, Show it when (required, "A JavaScript expression on doc. The first layout whose condition matches wins; otherwise the default one shows."), Start from (A copy of Details / Empty), Create | Type, Title (not required), Show it when (optional: "Empty: the type's default layout"), Start from (a copy only), Add layout | R-set ("Title, required; Based on; Show it when; Start from") | changed |
| L4 | Titled layouts as child rows with the condition in gray, and the open layout's acts (Rename…, Edit condition…, Reset to app layout, Delete layout) | Not compared: the site has no conditional layout and the prototype fakes its "Passive contacts" row in the browser | R-set | not reached |
| L5 | Side panel: "Pick fields from the panel on the right. Each one shows on every record's right side." and "Add a field →" | "Each field you add shows on every record's right side." and "+ Add a field" | R-lay v4 | changed |
| L6 | Panel outside Details opens with the hint line, then "Fields not on this layout", then "New field" with "Search field types" | No hint line; "Find a field type"; the type list adds "HTML Editor" and drops "Button" on the Side panel | R-lay v6 | changed |
| L7 | Quick entry dialog frame: "Add section" and "Add tab" at its foot | "Add section" only | R-lay v5 | changed |
| L8 | Quick entry "Fields not on this layout": 17 on Contact; Side panel 24 | 21 and 25: the lists count different fields | R-lay v6 | changed |

## 9. "Fields not on this layout" on Details

Shots: [foot of Sales Invoice](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-bottom-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-bottom-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| U1 | Details has no tray (the prototype predates E6). Outside Details the tray is the first group of the panel | A collapsible tray under the form's last section, shown even when it is empty ("0 · Every field is on this layout.") | R-gaps E6 (collapsible tray on Details; place not stated) | build-only (ruled) |
| U2 | Design shows the site's custom fields (prototype predates E3) | Design hides them and says "10 fields added on this site, edit them in Customize ↗" under the meta line | R-gaps E3 | build-only (ruled) |
| U3 | Room under the last section, so menus open below | Same | R-look | match |

## 10. ⌘J find

Shots: [Design, "name"](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-find-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-si-find-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| J1 | A popover below the header button, aligned to its right edge | The shell's command palette: a centred modal over a dimmed page, with a "Find a field or setting" chip and "↑ ↓ to move, ↵ to run, Esc back" | R-lay amended (popover below the button), R-set Q1 | changed |
| J2 | Groups "Fields" and "Settings" (and "Properties of <field>" when one is selected); each field shows its section on the right ("Taxes and Charges") | One flat group "Field or setting"; each field shows its type ("Data", "Link") | R-lay amended ("grouped by tab … with the section on the right"), R-set | changed |
| J3 | Empty query lists fields and settings | Empty query lists every field | R-set | match |

## 11. Settings tab

Shots: [Naming, Contact](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-naming-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-naming-build.png) · [Naming Series](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-si-naming-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-si-naming-build.png) · [By pattern](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-store-pattern-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-store-pattern-build.png) · [Form](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-form-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-form-build.png) · [List and search](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-list-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-list-build.png) · [More rights](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-si-more-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-si-more-build.png) · [site permissions](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-cust-permissions-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-settings-cust-permissions-build.png)

The section list, the five sections, their groups, the child-table and Single section sets, the permissions grid with its Level badges, and the Danger zone rows match. "Search settings" is absent on both sides: the ruled prototype (`?search=one`) has no Settings search box either, so the charter's "Search settings gone" is not a difference.

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| G1 | Naming on an app-coded DocType (Contact): each rule keeps its own hint, and a note says "Contact's code names its records; another rule would be ignored." | Every rule's hint is replaced by "The app's code names each record. Change it there."; no note | R-set (Naming) | changed |
| G2 | "Number in order" disabled: "Not while 13 records exist: their names are not numbers." | "Only while there are no records: this DocType has 13." | R-set Q6 | changed |
| G3 | Naming Series: the series and their next names; "The series are the options of the Naming Series field." | Adds an arrow between series and next name, a "Make default" button on each other series, an "Add a series, like ACC-SINV-.Y" input, and "A dot ends the text part; # marks the counter's digits." | R-set Q5 ("the series list (options and default) is edited in Naming"; the controls were never drawn) | build-only |
| G4 | By pattern: token chips `{YYYY}` `{MM}` `{DD}` `{#####}` `{field}` | Chips in v1 syntax: `.YYYY.` `.MM.` `.DD.` `.#####.` `.{store_name}.` | R-set Q4 ("By pattern … with token chips") | changed |
| G5 | Store's Naming Series row: "Add a Select field named naming_series first." | The generic hint | R-set | changed |
| G6 | Form › Attachments: Max attachments, Make attachments public | Adds "Keep attachments private" and "Protect attached files" (Regular, Single and new DocTypes) | R-set Q15 (the dropped-flag list; these two are not on it) | build-only |
| G7 | List and search › List: "Default view" row first | No Default view row | R-set (List group) | missing |
| G8 | "More" rights popover: plain names, and "Only if creator" among them | A one-line description under each right; no "Only if creator" (the All row counts +1, not +2) | R-set Q8 | changed |
| G9 | Customize, site permissions: rows in the app's order; "This site's rules replace Frappe's for Contact." | Rows in another order (Sales Manager first, System Manager seventh); "replace Frappe Framework's" | R-set Q9 | bug |
| G10 | Settings on a new DocType: Kind not in Form › Record | Kind in Form › Record (N4) | R-set Q14 | build-only (ruled) |

## 12. Danger zone and its dialogs

Shots: [Change kind](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-danger-d0-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-danger-d0-build.png) · [Rename](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-danger-d1-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-danger-d1-build.png)

Rows (Change kind, Rename, Move, Make it standard on a custom DocType, Delete) and the Delete dialog match.

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| D1 | Change kind: Regular, Submittable, Tree, Child table, Single | Regular, Child table, Single, Submittable, Tree (refused kinds mixed in) | R-set Q7 | changed |
| D2 | Rename: "The table tabStore becomes tab…, with its 2 records." and "0 Link and Table fields in other DocTypes point to Store." | "Its table tabStore becomes tab…, and every Link and Table field that points to it follows." No count. The name box starts filled with the old name | R-set | changed |
| D3 | Move: "The module, and with it the app it belongs to." | "Only the module changes: a custom DocType has no files." | R-set Q11 | changed |
| D4 | Make standard: "The module, and with it the app its files go in." | "Writes its files into the module's app, so the app ships it. It stops being custom; that cannot be undone here." | R-set Q13 | changed |
| D5 | Danger acts open their dialog at once | With unsaved edits, a "Save before you go on?" dialog (Cancel, Discard, Save first) comes first | R-set Q10 (Danger zone acts run at once; nothing about pending edits) | build-only |

## 13. Preview

Shots: [Sales Invoice](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-preview-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-preview-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| V1 | "Previewing T-SINV-00008 _Test Customer ▾" (name and title) | "Previewing T-SINV-00008 ▾" (no title) | [#47099 Preview note](https://github.com/frappe/frappe/issues/47099#issuecomment-6827711320) ("Previewing <name> <title> ▾") | changed |
| V2 | One frame, the record page's tabs, 728px | Same | R-lay amended Q17 | match |

## 14. Table field and the child editor

Shots: [Items selected](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-table-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-table-build.png) · [child editor](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-child-top-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-child-top-build.png)

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| E1 | Table panel: "Fields: Edit Sales Invoice Item ↗" with "Grid: Item, Quantity, Rate, Amount, Warehouse" under it, in one row | Two rows: "Fields: Edit Sales Invoice Item ↗" and "Grid: Item, Quantity, …" | R-tab amended | changed |
| E2 | Table panel has no Default or Placeholder | Table panel shows Default and Placeholder rows | — | changed |
| E3 | Child editor: crumbs `DocType / Sales Invoice / Items / Sales Invoice Item`, Editor tab only | Crumbs add a layout crumb (`… / Sales Invoice Item / Details ▾`); Settings and Preview tabs are there | R-tab ("Settings (Editable grid, Allow bulk edit) and a Preview of the row dialog are left for the build") | build-only (ruled, not prototyped) |
| E4 | Child editor opens at the top: title, "Add a description of what one row holds", meta "Accounts · Child table · This form is the row's dialog.", then the grid "Items in Sales Invoice" | Meta "Accounts · From ERPNext · 22 records" and the site-fields note; "what one record holds"; no grid at the top | R-tab amended | changed |
| E5 | Child panel with nothing selected: "Grid columns" (with the count "5"), then "Add a field" types | "Grid columns", then the one-line hint (P1) | R-tab amended | changed |
| E6 | Child editor: no "Add tab" | "+ Add tab" at the top right | — | changed |
| E7 | — | The child editor opens at the parent's scroll position, in the middle of the child's form | — | bug |

## 15. Condition builder, Fetch from and link filters

Shots: [Visible if, Return Against](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cond-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cond-build.png) · [mark tooltip](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cond-mark-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-cond-mark-build.png) · [Filters](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-filters-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-filters-build.png) · [Fetch a field…](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-fetch-add-proto.png) · [build](https://raw.githubusercontent.com/shariquerik/frappe/pr-screenshots/47432-fetch-add-build.png)

The builder's rows, the rule words in the panel ("Return Against is set or …"), the mark's tooltip text, the Fetch from two-step picker and the "Fetch a field…" menu match.

| ID | Prototype shows | Build shows | Ruling | Class |
|---|---|---|---|---|
| R1 | Builder in a 2xl dialog titled "Visible if · Return Against"; Rules \| Code at the footer's left; Clear condition and Done at its right | A popover below the row (`RuleRow.vue`), title "Visible if  Return Against", Rules \| Code at its top right | M8 | changed |
| R2 | Link filters in the same dialog, "Filters · Customer" | Link filters in the same popover as R1 | M8 | changed |
| R3 | Section and tab rules in the dialog | Section and tab rules in the popover | M8 | changed |

## 16. Not reached

- **Layout acts on a titled layout** (Rename…, Edit condition…, Reset to app layout, Delete layout) and the app-changed notice: no conditional layout and no stale site layout exist on desk.localhost; the prototype fakes them in the browser. Not compared.
- **Drag on the prototype:** the scripted drag selected text instead of lifting the field; the round 4 shot `45867-d-11-over-bin` stands in for it (C13).
- **Undo and redo across Editor and Settings (E5), the mode-switch prompt, the save toast counts, the remove-field confirm with value counts, type-change menus:** behaviour, not a screen; not walked here.
