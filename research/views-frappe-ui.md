# Views: what frappe-ui offers for Kanban, drag and drop and a view switcher

Ticket [frappe/frappe#45849](https://github.com/frappe/frappe/issues/45849), map [#45846](https://github.com/frappe/frappe/issues/45846). Read on 2026-10-30.

Commits read:

- frappe `desk-v2` at `4c5b0f3acd`.
- frappe-ui `1.0.2`, the version desk v2 pins. Read from `apps/frappe/frontend/node_modules/frappe-ui`.
- frappe-ui `1.1.0`, the newest release (npm `latest`, published 2026-10-29). Read from the npm tarball. frappe-ui `main` was at `2ab1906587`.
- crm branch `desk-v2` at `79b984370`, read from `apps/crm`.
- gameplan branch `develop` at `c643ae8`, read from `apps/gameplan`.
- helpdesk `develop` at `055639395d` and insights `develop` at `0f01a00871`, read through `gh`.

Paths that start with `frappe-ui:` are relative to the frappe-ui package root. Paths with no prefix are in frappe at `desk-v2`.

## 1. The frappe-ui version in desk v2

- `frontend/package.base.json:35` pins `"frappe-ui": "1.0.2"`, and `frontend/yarn.lock.base:2092` locks `1.0.2`.
- `ui/package.json:183` declares `frappe-ui` as a peer dependency, `>=1.0.2`.
- The newest release is `1.1.0`, with dist-tag `latest`. The only component that 1.1.0 adds to 1.0.2 is `Stepper`, which is experimental.
- Between 1.0.2 and 1.1.0, `Tree`, `Dropdown`, `TabButtons`, `Breadcrumbs`, `frappe-ui/list` and `experimental/ListView` are the same. One file under `Menu` changed: `frappe-ui:src/components/Menu/utils.ts:19-21`. The menu now scrolls when it is taller than the space it has (`max-h-[--reka-popper-available-height] overflow-y-auto`), and its groups get a 1px gap.

## 2. A Kanban or board component

- **No version has one.** frappe-ui 1.0.2 and 1.1.0 have no Kanban, board or column-of-cards component, stable or experimental. Neither package contains `kanban`.
- The exported subpaths in 1.0.2 are `.`, `./experimental`, `./editor`, `./code-editor`, `./list`, `./charts`, `./icons`, `./tailwind`, `./vite` and `./vitepress` (the `exports` field of `frappe-ui:package.json`). The experimental barrel is `frappe-ui:experimental.ts`. It exports Accordion, FloatingWindow, MultiEmailInput, Calendar, Charts (v1), CommandPalette, DateCalendar, ListView, PickerShell, TextEditor (v0), ThemeSwitcher and SpriteIcons. Version 1.1.0 adds Stepper.
- frappe-ui `main` (`2ab1906587`) has no file whose path contains `kanban`. It also has no spec for one: `spec/` covers charts, code-editor, date-picker, dialog, dropdown, editor, hover-card, inputs, item-list-row, popover, selection, shortcuts, stepper and tabs. A search of frappe/frappe-ui issues and PRs for "kanban" returns nothing.
- The only mention of a board is in the shell's docs. `DesktopShell` takes `scroll: false` "for a multi-pane layout where the panes own their own overflow — a list-and-detail split, or a board whose columns scroll separately" (`frappe-ui:src/components/DesktopShell/types.ts:6`, `frappe-ui:src/components/DesktopShell/DesktopShell.md:53`).
- **Virtualisation.** frappe-ui virtualises only list rows. `ListRows` takes `virtual` (`frappe-ui:src/molecules/list/list.md:65`, `frappe-ui:src/molecules/list/ListRows.vue:80`). It uses `useVirtualRows`, a fixed-row-height window built on `@vueuse/core` (`frappe-ui:src/molecules/list/useVirtualRows.ts:1-40`). `frappe-ui/list` does not export `useVirtualRows` (`frappe-ui:src/molecules/list/index.ts`).
- Desk v2 has its own copy, `ui/src/experimental/List/useVirtualRows.ts:13-17`, which also uses a fixed row height. Its comment says that frappe-ui's `ListRows virtual` "reads its container once at mount and finds none inside a ScrollArea". `ui/src/experimental/List/List.vue:213` uses it.
- No component that frappe-ui or desk v2 ships virtualises a column of cards of varying height.

## 3. Drag and drop

### What frappe-ui uses

- frappe-ui depends on no drag library. Its dependency list (`npm view frappe-ui@1.1.0 dependencies`) has no `sortablejs`, `vuedraggable` or `@vueuse/integrations`.
- `Tree` has its own drag code on native HTML5 drag events. The props are `draggable` and `move: (ctx: MoveContext) => boolean` (`frappe-ui:src/components/Tree/types.ts:66-78`). The events are `drag-start` and `drag-end`, where `drag-end` carries `DropInfo | null` (`frappe-ui:src/components/Tree/Tree.vue:86-91`). The logic is in `frappe-ui:src/components/Tree/useTreeDragDrop.ts`, which imports only `vue`. It reorders and reparents inside one tree. It has no cross-container groups.
- The editor uses ProseMirror's own drag, and its image group uses native drag events (`frappe-ui:src/molecules/editor/extensions/image-group/ImageGroupGrid.vue:9-12`).
- `SidebarItem` forwards `@dragover` and `@drop` to its root wrapper, so an app can make a sidebar row a drop target (`frappe-ui:src/components/Sidebar/SidebarItem.vue:155-158`).
- Neither frappe-ui version has a drag primitive for lists of cards, such as a sortable list or a drop zone.

### What is in desk v2's dependency tree

| Package | Declared | Locked | Where |
|---|---|---|---|
| `vuedraggable` | `^4.1.0` | `4.1.0` | `frontend/package.base.json:45`, `ui/package.json:159`, `frontend/yarn.lock.base:3382` |
| `sortablejs` | none (comes in through vuedraggable) | `1.14.0` | `frontend/yarn.lock.base:3019`. vuedraggable 4.1.0 pins `sortablejs` at exactly `1.14.0`. |
| `@vueuse/core` | `^11.3.0` | `11.3.0`, plus `14.4.0` for frappe-ui, plus `10.11.1` | `frontend/package.base.json:32`, `frontend/yarn.lock.base:1432-1453`. frappe-ui has its own copy at `frappe-ui/node_modules/@vueuse/core`. |
| `@vueuse/integrations` | none | none | It is not in `frontend/yarn.lock.base` or in `ui/yarn.lock`. |

Desk v1 is separate. Its root `package.json:80-82` declares `sortablejs ^1.15.0` and `vuedraggable ^4.1.0`, and its resolution at `package.json:91` is `sortablejs ^1.15.7`.

Desk v2 code that uses `vuedraggable`:

| File | How it loads |
|---|---|
| `ui/src/components/ColumnSettings/ColumnSettings.vue:53-95` | Lazily, on the first open of the popover (`:171-177`). It uses `handle=".column-drag-handle"` (`:58`) and `item-key` = fieldname (`:57`). |
| `ui/src/components/SortBy/SortBy.vue:68-114` | Lazily, on the first open (`:167-173`) |
| `ui/src/components/QuickFilter/QuickFilterCustomize.vue:80` | Lazily, with the customize face (`ui/src/components/QuickFilter/QuickFilter.vue:69-77`) |
| `ui/src/components/ConditionBuilder/ConditionGroup.vue:34,174` | Statically. Cross-group moves go through `ui/src/components/ConditionBuilder/internal/dragBridge.ts:23-54`. |
| `ui/src/components/Grid/Grid.vue:96-200,266` | Statically |
| `frontend/src/pages/index/ArrangeApps.vue:64` | Lazily, through `defineAsyncComponent` (`frontend/src/pages/index/IndexPage.vue:155`) |

- `frontend/src/pages/record/composer/emailQuote.ts:37` notes that vuedraggable's core-js replaces `NodeList.forEach`.

### Bundle cost

- **In the bench build.** `sites/assets/frappe/frontend/assets/vuedraggable.umd-Dg5okgZa.js` is one chunk of **95,191 B raw and 32,357 B gzip**. This build is from 2026-10-30, of frappe at `4c5b0f3acd`. The chunk holds sortablejs 1.14.0 with its MultiDrag and Swap plugins, core-js polyfills and the vuedraggable wrapper. vuedraggable's `module` entry is a UMD build: `dist/vuedraggable.umd.js` has 39 `core-js` references.
- `List-*.js` loads the chunk lazily, through `import()`. `fieldTypes-*.js`, the Grid, imports it statically. `shell-*.js` lists it only in its preload map.

Each candidate below was bundled alone with rolldown (from `frontend/node_modules`), minified, ESM, with `vue` and `@vueuse/core` external. The desk already ships both of those. The sizes are in bytes.

| Candidate | Version | Min | Gzip | In the desk tree? |
|---|---|---|---|---|
| `vuedraggable` (with sortablejs 1.14.0 and core-js) | 4.1.0 | 96,465 | 32,852 | Yes, and it already ships |
| `sortablejs` full ESM (`sortablejs`) | 1.15.7 | 36,611 | 12,608 | No. 1.14.0 is only inside the vuedraggable chunk. |
| `sortablejs` core (`sortablejs/modular/sortable.core.esm.js`) | 1.15.7 | 33,425 | 11,657 | No |
| `@vueuse/integrations/useSortable` + sortablejs 1.15.7 | 14.4.0 | 37,587 | 13,039 | No. It also needs `@vueuse/core` 14. The desk's own copy is 11.3.0, and frappe-ui's nested copy is 14.4.0. |
| `vue-draggable-plus` (`VueDraggable` or `useDraggable`; vendors sortablejs) | 0.6.1 | 41,500 | 14,484 | No. This is a reference point only: no app read here uses it. |
| `@atlaskit/pragmatic-drag-and-drop` element adapter (`draggable`, `dropTargetForElements`, `monitorForElements`) | 4.0.0 | 20,464 | 6,230 | No. This is a reference point only: no app read here uses it. |
| Native HTML5 drag, as frappe-ui `Tree` does it | n/a | 0 (library) | 0 | Yes, in frappe-ui |

All the sortablejs-based candidates cost 12–15 KB gzip for one library. vuedraggable 4.1.0 costs about 33 KB gzip because it pins sortablejs at 1.14.0 and bundles core-js.

## 4. A view switcher and view controls

### What frappe-ui 1.0.2 offers

- frappe-ui has no saved-views control and no view-switcher component.
- **`Dropdown`** (`frappe-ui:src/components/Dropdown/Dropdown.api.md`):
  - Props: `button`, `options: MenuOptions`, `open` (v-model), `align`, `side`, `offset`, `matchTriggerWidth` and `portalTo`.
  - Slots: `item`, `item-prefix`, `item-label`, `item-suffix`, `group-label`, `empty`, `default` and `trigger`.
  - Event: `update:open`.
- **Menu items** (`frappe-ui:src/components/Menu/types.ts`):
  - An action item has `icon`, `description`, `selected` (`:32`), `disabled`, `theme`, `condition`, `route` and `onClick`.
  - A switch item has `switch: true`, `switchValue` and `onClick(value)` (`:70-80`). A submenu item has `submenu: MenuOptions` (`:91`).
  - A group is `{ group, options, hideLabel }` (`:100-115`). The old `{ group, items }` shape is now a type error, because `items?: never` (`:112`).
- **`TabButtons`** (`frappe-ui:src/components/TabButtons/TabButtons.api.md`):
  - Props: `options: TabButton[]`, `modelValue`, `variant`, `size`, `vertical`, `edge` and `fluid`.
  - Slots: `prefix` and `suffix`. Event: `update:modelValue`.
  - A `TabButton` has `value`, `label`, `icon` (icon only), `iconLeft`, `disabled`, `route` (it renders a `RouterLink`), `href` and `onClick` (`frappe-ui:src/components/TabButtons/types.ts:13-25`).
- **`Breadcrumbs`**: each item has `label`, `route`, `href` and `onClick`. An item cannot hold a menu (`frappe-ui:src/components/Breadcrumbs/types.ts:5-26`).

### What desk v2 has today

- The list page header renders `Breadcrumbs`, `FavouriteStar`, `QuickFilter`, `Filter`, `SortBy`, `ColumnSettings` and a "More" `Dropdown` (`frontend/src/pages/list/DoctypeList.vue:10-52`). The page imports from frappe-ui at `:100`.
- The "More" menu holds one act, the quick-filter act (`frontend/src/pages/list/DoctypeList.vue:211-214`).
- No view switcher or view menu exists in `frontend/src` or `ui/src`.

### What CRM v1 builds them from

- CRM pins `frappe-ui` `1.0.0-beta.29` (`crm:frontend/package.json:27`). It also declares `vuedraggable ^4.1.0`, `sortablejs ^1.15.0` and `@vueuse/integrations ^10.3.0` (`crm:frontend/package.json:25,36,41`).
- **The view switcher is a frappe-ui `Dropdown` inside the breadcrumb**, not a component of its own (`crm:frontend/src/components/ViewBreadcrumbs.vue:21-58`). Its parts:
  - The trigger is a ghost `Button` with the current view's icon and label.
  - The `#item-suffix` slot holds a nested `Dropdown` with the actions of each view, and a check mark on the selected view.
  - It imports only `Dropdown` from frappe-ui (`:65`).
- **The menu data is built in `ViewControls.vue`.**
  - `standardViews` holds list, kanban and group_by, and each one pushes the route param `viewType` (`crm:frontend/src/components/ViewControls.vue:657-690`).
  - `viewsDropdownOptions` groups the views into "Standard Views", "Saved Views", "Public Views" and "Pinned Views", and pushes `query.view` (`crm:frontend/src/components/ViewControls.vue:706-760`).
  - The groups use the `{ group, items }` shape. frappe-ui 1.0.2 types reject that shape (see above).
  - `viewActions` builds the menu of actions for each view (`:1134`).
- **The view controls bar** (`crm:frontend/src/components/ViewControls.vue:1-240`) is built from CRM's own components: `Filter`, `GroupBy`, `SortBy`, `ColumnSettings`, `KanbanSettings`, `QuickFilterField`, `FadedScrollableDiv` and `ViewModal`. Its imports are at `:303-321`.
  - From frappe-ui it uses `Button`, `Dropdown` (for "More Options", `:194-238`), `Combobox` and `Tooltip`, plus `createResource`, `call` and `toast` (`:329-338`).
  - It uses `vuedraggable` to reorder quick filters (`:69-94`, imported at `:350`).
  - It shows *Cancel* and *Save Changes* when the view is modified (`:52-58`, `:148-155`).
- **The Kanban board** (`crm:frontend/src/components/Kanban/KanbanView.vue`, 277 lines):
  - The columns are an outer `vuedraggable` (`:3-10`). The cards are an inner `vuedraggable` with `group="fields"` (`:73-81`), so a card can move between columns. Both use `delay` 200 ms on touch screens.
  - `@end` emits `update` with `{ item, to, kanban_columns }` for a move between columns, or with `{ kanban_columns }` for a reorder. `order` holds the card names of each column (`:255-276`).
  - Each column renders all its loaded cards, with a "Load More" button when `count < all_count` (`:139-147`). It does not virtualise.
  - The card slots are `title`, `fields` and `actions` (`:94-135`).
  - From frappe-ui it uses `Combobox`, `Dropdown` and `Popover` (`:183`), plus `Button`. A column's colour comes from a `Popover` of colour buttons (`:18-52`). "Add Column" is a `Combobox` (`:153-174`).
- `crm:frontend/src/components/Kanban/KanbanSettings.vue:49-73,113` also uses `vuedraggable`.

## 5. Gameplan, Helpdesk and Insights

- **Gameplan** (`develop` `c643ae8`) has no board or Kanban view. It pins `frappe-ui 1.0.2` (`gameplan:frontend/package.json:23`) and declares no drag library.
  - Its drag code is its own pointer-event composable, `gameplan:frontend/src/composables/usePointerSortableSections.ts` (234 lines). `gameplan:frontend/src/components/AppRail/CustomizeSidebarDialog.vue:168-171,258` uses it.
  - The profile bento grid (`gameplan:frontend/src/components/ProfileBento/`) has drag code of its own.
- **Helpdesk** (`develop` `055639395d`) has no board or Kanban view. A code search finds `kanban` only in locale `.po` files.
  - It pins `frappe-ui 1.0.0-rc.1` and declares `vuedraggable ^4.1.0` and `@vueuse/integrations ^14.1.0` (`helpdesk:desk/package.json:26,30,38`).
  - Its `SortBy` uses `useSortable` from `@vueuse/integrations` (`helpdesk:desk/src/components/view-controls/SortBy.vue:170,224`).
  - Its `ColumnSettings` uses `vuedraggable` (`helpdesk:desk/src/components/view-controls/ColumnSettings.vue:158`), and so does `helpdesk:shared/src/settings/PinnedCategoriesDialog.vue:191`.
  - Its view switcher is a frappe-ui `Dropdown` in `helpdesk:desk/src/components/ViewBreadcrumbs.vue:10,66`, the same pattern as CRM, with a nested `Dropdown` for the actions of each view. It imports `Badge` and `Dropdown` from frappe-ui (`:89`).
- **Insights** (`develop` `0f01a00871`) has no board or Kanban view. A code search for "kanban" returns nothing.
  - It pins frappe-ui to a git commit (`insights:frontend/package.json:37`) and declares `vuedraggable ^4.1.0` (`:47`).
  - `vuedraggable` is used in `insights:frontend/src2/components/DraggableList.vue:3` and `insights:frontend/src2/workbook/WorkbookSidebarFolders.vue:4`.
  - It has its own pointer-drag helper, `startDrag`, in `insights:frontend/src2/helpers/drag.ts:33`.
- None of the board or drag code of these apps lives in frappe-ui.

## 6. Data on this bench

All the queries below were reads only, on `desk.localhost`.

- `tabKanban Board`: 0 rows.
- `tabDoctype View`: 2 rows, both of type `List`.
- `tabCRM View Settings`: 0 rows, and 0 rows of type `kanban`.
- `crm.localhost` runs on the owner's laptop and cannot be reached from here, so its Kanban rows were not read.
