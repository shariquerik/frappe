# Prior art for a visual layout editor, and the drag library to use

Ticket: frappe/frappe#45860, child of map #45858.
Sources: `desk-v2` at `4c5b0f3acd`, CRM at `79b984370` (2026-10-28), frappe-ui 1.0.2, SortableJS and vuedraggable as installed in `frontend/node_modules`, and the npm registry.
Paths without a prefix are in frappe. CRM paths start with `crm/`.

## Answer in short

- Use **vuedraggable 4.1.0** (on SortableJS 1.14.0). It is already a dependency of `ui` and `frontend`. Six desk v2 components, desk v1's Form Builder and both CRM editors use it.
- Copy the **ConditionBuilder drag bridge** pattern: bind `:model-value`, not `v-model`, and turn Sortable's `end` event into one tree edit. That edit is the act that ruling 8 asks for.
- SortableJS has no keyboard reorder. Give every move an act and a menu item, and bind Alt+Arrow keys to them, as `ArrangeApps.vue` does.
- The CRM layout JSON and the `Form Layout` tree have the same shape. CRM's editors are a good model for the canvas. They are not code to copy.
- Desk v1's Form Builder gives three ideas: a properties panel drawn from DocField meta, drag-to-new-tab, and undo with `useDebouncedRefHistory`. Its save flattens the tree into DocField breaks, which ruling 2 forbids for a v2 DocType.
- `FormLayout` has **no edit seam** today. Its sections and columns draw their lists in a plain `v-for`, and a column drops hidden fields. The canvas needs a seam in `FormLayout` before vuedraggable can sort inside it.
- The Side Panel does not render with `FormLayout`. It renders with `PanelLayout`, a flat list of sections.

## 1. CRM: `FieldLayoutEditor.vue`

Hosts: Quick Entry, Data Fields, Grid Row and Required Fields modals (`crm/frontend/src/components/Modals/QuickEntryModal.vue:34`, `DataFieldsModal.vue:34`, `crm/frontend/src/components/Controls/GridRowFieldsModal.vue:34`).

| Part | What it does | Reference |
|---|---|---|
| Field list | No palette. Each column has an "Add Field" `Combobox`. It lists meta fields that are not yet in the layout. Breaks and Signature are left out. | `crm/frontend/src/components/FieldLayoutEditor.vue:218-240`, `:313-352` |
| Canvas | Boxes, not the real form. A tab strip, then sections as gray cards, columns as dashed boxes, and fields as one-line chips with the label only. | `:3-74`, `:99-245` |
| Preview | A toggle swaps the editor for the real renderer (`FieldLayout`). The two never show together. | `crm/frontend/src/components/Modals/QuickEntryModal.vue:19-22`, `:34-40` |
| Properties panel | None. Section and column settings are items in a `Dropdown`: collapsible, hide label, hide border, add or remove a column (four at most), move to the next or previous section or tab. Fields have no properties. | `:450-676`, column limit `:571` |
| Drag model | vuedraggable, four nested lists: tabs (`:6-12`), sections (`group: "sections"`, `:81-98`), columns (`group: "columns"`, `:173-180`), fields (`group: "fields"`, `:185-193`). Sections and fields drag by a handle. An empty tab also takes a column or a field and wraps it in a new section (`:84-87`, `:388-409`). Hovering a tab during a drag switches to it (`:28`). | as listed |
| Keyboard | Only Enter or blur ends a label edit (`:37-38`, `:133-134`). Labels open for edit on double-click (`:30`, `:113`). No keyboard move. | as listed |

## 2. CRM: `SidePanelLayoutEditor.vue`

| Part | What it does | Reference |
|---|---|---|
| Field list | An "Add Field" `Combobox` per section. It also leaves out Table, Table MultiSelect and Image. | `crm/frontend/src/components/SidePanelLayoutEditor.vue:87-110`, `:156-164` |
| Canvas | A vertical list of collapsible sections. Each section has one column of field chips. | `:3-122` |
| Preview | The real `SidePanelLayout` beside the editor, behind a toggle. | `crm/frontend/src/components/Modals/SidePanelModal.vue:33-55` |
| Properties panel | None. Only edit label and remove. A section with `editable: false` cannot take fields or be removed. | `:38-54`, `:88`, `:111-118` |
| Drag model | vuedraggable. Sections reorder (`:3`). Fields sort inside `columns[0]` only (`:58-64`). | as listed |
| Keyboard | Enter ends a label edit (`:24`). Nothing else. | as listed |

## 3. The `CRM Fields Layout` shape

- A row has `dt`, `type` (Quick Entry, Side Panel, Data Fields, Grid Row, Required Fields) and `layout` (JSON) (`crm/crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.json:22-40`).
- `layout` is tabs → sections → columns → fields. Fields are saved as fieldname strings (`crm/frontend/src/components/Modals/QuickEntryModal.vue:99-121`).
- The Side Panel saves the sections of one tab only (`crm/frontend/src/components/Modals/SidePanelModal.vue:119-138`). The reader wraps a tabless list in `first_tab` (`crm/crm/fcrm/doctype/crm_fields_layout/crm_fields_layout.py:43-48`).
- With no row, the default layout is built from the DocType's breaks (`crm_fields_layout.py:216-259`).
- Container names are random (`"section_" + getRandom()`), made in the browser (`FieldLayoutEditor.vue:264-266`).
- UI state leaks into the saved JSON. `editingLabel` and `opened` sit on the tree objects, and the save clones the whole tree (`FieldLayoutEditor.vue:30`, `QuickEntryModal.vue:100`).

### How it maps to `Form Layout`

The shapes match. `Form Layout` stores tabs → sections → columns → fields, with fields as fieldname strings or inline DocField dicts (`frontend/src/recordPage/formLayoutSource/types.ts:7-35`). The section keys are the same: `name`, `label`, `hideLabel`, `hideBorder`, `collapsible`, `opened` (`types.ts:17-26`, CRM `FieldLayoutEditor.vue:462-475`). `Form Layout` also wraps a tabless tree in `first_tab` (`frappe/desk/doctype/form_layout/form_layout.py:244-248`).

Two differences matter:

1. `Form Layout` names containers at save, from the label slug (`form_layout.py:61-70`, `:251-274`). An editor must not invent random names. It needs a client-only key for vuedraggable's `item-key` until the save names the container.
2. `Form Layout` adds `dependsOn` on tabs and sections (`types.ts:24`, `:31`). CRM has nothing like it.

## 4. Desk v1: `frappe/public/js/form_builder/`

Hosts: the DocType form, Customize Form, DocType Layout and Web Form (`frappe/core/doctype/doctype/doctype.js:172-173`, `frappe/custom/doctype/customize_form/customize_form.js:527-528`, `frappe/core/doctype/doctype_layout/doctype_layout.js:154-155`, `frappe/website/doctype/web_form/web_form.js:888-890`).

| Part | What it does | Reference |
|---|---|---|
| Field list | No palette. An "Add field" button per column and after each field opens an autocomplete of **fieldtypes**. It makes a new field; it does not place an existing one. | `components/AddFieldButton.vue:1-25`, `components/Column.vue:41-46` |
| Canvas | Tabs → sections → columns → fields, drawn with v1's own mock controls, not the real v1 form. A field is selected by a click. Its label is edited in place. | `FormBuilder.vue:41-50`, `components/Field.vue:189-217`, `globals.js:1-10` |
| Properties panel | A right sidebar, resizable. It draws the selected field's properties from the **DocField (or Customize Form Field) meta**, as controls. It hides a property whose `depends_on` is false. In layout mode it shows only an allowed set of properties. | `components/Sidebar.vue:35-64`, `components/FieldProperties.vue:14-29`, `:42-70`, `:145-147`, `store.js:65-67` |
| Drag model | vuedraggable, four nested lists: tabs (`components/Tabs.vue:142-151`), sections (`Tabs.vue:203-213`), columns (`components/Section.vue:49-59`), fields (`components/Column.vue:21-31`). A 200 ms delay on touch screens (`Column.vue:25`). Dragging over "Add tab" opens a new tab for the item, and removes it again if the drop lands elsewhere (`Tabs.vue:180-184`, `store.js:741-787`). | as listed |
| Keyboard | Undo and redo with Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, over `useDebouncedRefHistory` (100 ms debounce, 50 steps). No keyboard move. | `store.js:400-421` |
| Save | Flattens the tree into one DocField list with Tab, Section and Column Breaks. | `store.js:625-694`, reader `utils.js:3` |

### How it maps to `Form Layout`

The in-memory tree is the same tree, but each container carries a full DocField `df` (`utils.js:3-40`). The save writes breaks, not a layout tree. Ruling 2 says a v2-built DocType stores no breaks, so this save path is not reused. The meta-driven properties panel and undo are ideas worth taking.

`frappe/public/js/layout_builder/` is a second, smaller v1 builder: a flat, draggable list of field rows with a properties panel (`components/LayoutBuilder.vue:3-64`). It adds nothing new.

## 5. Drag libraries in the tree

| Where | Library | Reference |
|---|---|---|
| frappe root (v1 bundles) | `vuedraggable ^4.1.0`, `sortablejs ^1.15.0` (resolved `^1.15.7`) | `package.json:80`, `:82`, `:91` |
| `ui` | `vuedraggable ^4.1.0` → `sortablejs 1.14.0` (exact pin) | `ui/package.json:159`, `ui/yarn.lock:540-560` |
| `frontend` | `vuedraggable ^4.1.0`, `frappe-ui 1.0.2` | `frontend/package.base.json:35`, `:45`, `frontend/yarn.lock.base:3019-3387` |
| CRM | `vuedraggable ^4.1.0`, `sortablejs ^1.15.0` | `crm/frontend/package.json:36`, `:41` |
| frappe-ui 1.0.2 | No drag dependency. Only `Tree` drags, with native HTML5 drag events. | `frappe-ui/package.json` dependencies, `src/components/Tree/TreeItem.vue:27-32` |

The `frontend` build already handles vuedraggable being CommonJS: `vue` is aliased to the runtime build so its `require("vue")` gets no template compiler (`frontend/CLAUDE.md:150-155`).

Desk v2 code that uses vuedraggable today:

- `ui/src/components/ConditionBuilder/ConditionGroup.vue:34-50`: nested groups, one Sortable group per builder, `:model-value`, and a drag bridge (`ui/src/components/ConditionBuilder/internal/dragBridge.ts:24-89`). The bridge refuses a bad drop during the drag (`put`), and on `end` calls one tree edit, `context.moveInto(from, to, index)`. Its menu also has Move up and Move down (`ConditionGroup.vue:317-330`).
- `frontend/src/pages/index/ArrangeApps.vue:17-27`: a grid, with Alt+ArrowLeft and Alt+ArrowRight to move an app and keep focus (`:44-47`, `:84-94`).
- `ui/src/components/ColumnSettings/ColumnSettings.vue:53-58`, `ui/src/components/SortBy/SortBy.vue:68-73`, `ui/src/components/QuickFilter/QuickFilterCustomize.vue:21-25`, `ui/src/components/Grid/Grid.vue:96-100`: flat lists with a handle.

Facts about the libraries:

- SortableJS reads the keyboard only for the MultiDrag plugin's selection modifier (`sortablejs/modular/sortable.esm.js:3166`, `:3182`). It has no keyboard reorder.
- vuedraggable 4.1.0 is the `next` tag. It was published on 2021-08-22. The `latest` tag is 2.24.3, the Vue 2 line (npm registry, `npm view vuedraggable dist-tags time`). The Vue 3 line has had no release since 2021. It works in the tree today.
- SortableJS 1.15.7 was published on 2026-02-11 (npm registry). The v2 lockfiles still resolve 1.14.0 through vuedraggable's exact pin.
- frappe-ui `Tree` drags one vertical tree. It drops before, inside or after a row by the cursor's height in that row (`src/components/Tree/useTreeDragDrop.ts:66-74`). It does not sort horizontal columns. Its keyboard moves focus only (`useTreeKeyboard.ts:73-100`). Two ideas are worth taking: the drag logic never changes the nodes and hands a `DropInfo` to the caller (`useTreeDragDrop.ts:36-40`), and it announces drag state in a live region (`Tree.vue:53`).

## 6. The v2 renderer and an editing canvas

Ruling 9 says the canvas renders with `FormLayout`. The code today:

- `FormLayoutSection` draws its columns in a plain `v-for` (`ui/src/components/FormLayout/FormLayoutSection.vue:41-47`). `FormLayoutColumn` draws its fields the same way (`ui/src/components/FormLayout/FormLayoutColumn.vue:6-9`). Neither has a slot or a hook for a list wrapper.
- vuedraggable must render the `v-for` of the list it sorts. So it cannot wrap these lists from outside.
- `FormLayoutColumn` drops hidden fields (`FormLayoutColumn.vue:37`). An editor must show them.
- Each field is a live control bound to `doc` (`ui/src/components/FormLayout/FormLayoutField.vue:13-22`). A canvas must stop clicks from reaching the inputs.
- The DOM carries `data-fieldname` on each field and the classes `section`, `section-body` and `column` (`FormLayoutField.vue:2-7`, `FormLayoutSection.vue:3`, `:32`, `FormLayoutColumn.vue:2`).
- The record page joins the stored tree with meta through `joinLayout` (`frontend/src/recordPage/formLayoutSource/joinLayout.ts:36-53`). An editor can reuse it to turn its tree into a `FormLayoutSchema`.
- The Side Panel type renders with `PanelLayout`, not `FormLayout`. It shows one flat list of sections (`frontend/src/pages/record/panel/PanelLayout.vue:1-27`, comment at `ui/src/components/FormLayout/types.ts:168-170`).

## Reuse and ideas

Reuse as code:

- vuedraggable, already installed.
- The drag-bridge pattern from `dragBridge.ts`: `:model-value`, a `put` check during the drag, one edit on `end`.
- `FormLayout` and `joinLayout` for the canvas; `PanelLayout` for the Side Panel canvas.
- `save_form_layout` and `get_form_layouts` (`frappe/desk/doctype/form_layout/form_layout.py:105-132`).

Take as ideas only:

- From CRM: the four nested vuedraggable lists with `group` names (tabs, sections, columns, fields); a drop on an empty tab makes a section; a hovered tab opens during a drag; an "Add Field" picker of unplaced fields per column; Side Panel sections with one column.
- From desk v1: the properties panel drawn from DocField or Customize Form Field meta, filtered by `depends_on` and by an allowed-property list per mode; drag onto "Add tab" makes a tab; undo over `useDebouncedRefHistory`.
- From frappe-ui `Tree`: drag logic that only reports a move and lets the caller commit it; a live region for drag state.

Do not take:

- CRM's random container names and UI state saved in the tree.
- CRM's editor-or-preview toggle. Ruling 9 makes the canvas the preview.
- v1's mock controls and its save into breaks.

## Recommendation

1. **Drag library: vuedraggable 4.1.0.** It is installed in `ui` and `frontend`, the build already handles it, and the team uses it in six v2 components. A new library would add a dependency and a second drag model for one screen. Its age is a risk to note, not a reason to switch now.
2. **Every drop is one act.** Bind lists with `:model-value`. On `end`, call one move act (for example "move field to column at index"), as `dragBridge.ts` calls `moveInto`. A script, the palette and a later LLM then run the same act with no mouse (ruling 8). Undo can record acts.
3. **Keyboard through acts.** Each movable item gets menu items for its moves, and Alt+Arrow keys bound to the same acts (`ArrangeApps.vue:44-47`). Focus stays on the moved item.
4. **Add an edit seam to `FormLayout`.** Sections and columns need a way to draw their lists through a sortable list, to show hidden fields, and to stop input clicks. The seam must leave the record page's render unchanged. The prototype ticket picks its form: an injected key that swaps the list component, or slots.
5. **Keep editor state off the tree.** Selection, label editing and open state live in the editor, not in the saved JSON. New containers get a client-only key and no `name`; the save names them.
6. **Two canvases.** Details, Quick Entry and New Record use `FormLayout`. Side Panel uses `PanelLayout`, with one column per section, as CRM's Side Panel editor does.

## Facts later tickets depend on

- The CRM layout JSON and the `Form Layout` tree have the same shape and section keys.
- `FormLayout` has no edit seam. Sections and columns render plain `v-for` lists, and columns drop hidden fields.
- The Side Panel renders with `PanelLayout`, not `FormLayout`.
- vuedraggable 4.1.0 on SortableJS 1.14.0 is installed in `ui` and `frontend`. frappe-ui 1.0.2 has no general drag list.
- SortableJS has no keyboard reorder. Keyboard moves must be acts.
- Desk v1 undo is `useDebouncedRefHistory` with 50 steps and a 100 ms debounce.
- Desk v1's properties panel is drawn from DocField meta, with a per-mode allow-list of properties.
