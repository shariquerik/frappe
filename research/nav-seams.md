# Desk v2 navigation: the seams for added rows, new types, a depth cap and layout settings

Research for [frappe/frappe#47372](https://github.com/frappe/frappe/issues/47372), part of the map
[frappe/frappe#47369](https://github.com/frappe/frappe/issues/47369). Facts only, with no design
recommendation.

Sources, read on 2026-11-14:

- frappe `desk-v2` at `2dbf7bfdff`. Paths without a repo prefix are in this repo.
- erpnext `desk-v2` at `3c1fbcd174`. These paths start with `erpnext/`.
- frappe-ui at `fa69f53219da81368845db20b1ac0ad3a8ae62fe`, the commit that `frontend/package.base.json:35`
  pins. These paths start with `frappe-ui/`.
- Measurements on `desk.localhost`. They are read-only, and `frappe.log_error` was stubbed out.

---

## 1. The layer merge (app → site → user)

### How it stacks

- **Rail.** `resolve_rail` (`frappe/shell/navigation.py:72-100`) works in three steps:
  1. It takes the `standard` layer as the base. When there is none, it derives the base from the
     app's readable doctypes (`_derive_rail`, `navigation.py:478-493`).
  2. It runs `extend()` with other apps' contributed rows (`navigation.py:93`).
  3. It folds in `site`, then `user` (`LAYERS_UPTO`, `navigation.py:157-161`).
- **Sidebars.** `resolve_sidebars` (`navigation.py:103-128`) does the same, but with no extension step.
- **The merge.** Both go through `_merge` (`navigation.py:172-193`). It runs four steps in this order:
  1. `resolve_layers(..., anchored=True)` (`frappe/desk/layers.py:45-102`)
  2. `_drop_hidden`
  3. `filter_items` (the permission filter)
  4. `_promote_orphans`, then `on_the_wire`
- **How a layer is stored.** One record per `(app, extends, user, standard)` for `Rail`
  (`frappe/desk/doctype/rail/rail.py:124-131`). One record per
  `(link_doctype, link_to, user, standard)` for `Sidebar`
  (`frappe/desk/doctype/sidebar/sidebar.py:726-750`). The site layer is `user = ""`
  (`navigation.py:52-53`, `rail.py:10-12`).

### The resolver already understands an added row. The editor's reducer drops it.

- **The resolver.** `apply_item_row` (`navigation.py:235-248`) handles each layer row this way:
  - A row with `added = 1` *is* the item: `{field: row.get(field) for field in ITEM_FIELDS}`.
    This happens whether or not an entry with that key exists (`navigation.py:242-243`).
  - A delta row (`added = 0`) whose key the list does not hold is inert (`navigation.py:245-246`).
  - In `anchor_layer`, an added key that the base does not hold is appended, then moved by its
    anchors (`layers.py:200-213`).
  - Tests cover this:
    - an added row on a shipped rail (`frappe/tests/test_shell_navigation.py:191-197`)
    - an added row on a derived rail (`test_shell_navigation.py:130-134`)
    - a keyless added row is dropped (`test_shell_navigation.py:199-203`)
- **The reducer.** `reduce_arrangement` (`frappe/shell/arrangement.py:211-219`) calls `_known`
  (`arrangement.py:222-233`). `_known` keeps only the keys that the list *below the scope* holds:
  - `BELOW = {"user": "site", "site": "base"}` (`arrangement.py:28`).
  - The test is `test_a_key_the_base_does_not_hold_is_dropped`
    (`frappe/tests/test_navigation_arrangement.py:125-128`).
- **What `_delta` writes.** Only `key`, `hidden`, `overrides` plus the overridden values, and
  `anchors` (`arrangement.py:236-255`). It never writes `added`, `item_type`, `link_*`, `url` or
  `payload`. `OVERRIDABLE` is `label, icon, collapsible, keep_closed` (`arrangement.py:32`).
- **What happens to a layer's own added rows today.**
  - `get_arrangement` resolves *up to and including* the scope (`arrangement.py:35-40`), so the
    dialog shows that layer's added rows.
  - `save_arrangement` reduces against the list *below* the scope (`arrangement.py:47-51`), so
    those rows are dropped.
  - `_write` then replaces the whole child table (`doc.set(...)`, `arrangement.py:341-356`).
  - So a save through the current dialog erases any added row that layer held. If every row
    reduces away and the submission names every row below, the layer is deleted
    (`arrangement.py:53-63`).

### Other places that assume a key comes from an app

| Place | What it assumes | Ref |
|---|---|---|
| Sidebar addresses | A sidebar resolves only at an address an app ships as a `standard` record. A layer cannot create a sidebar. | `navigation.py:416-428`; test `test_shell_navigation.py:321-324`; editor gate `arrangement.py:150-161` |
| Extension | Only apps contribute, through `Rail` records with `extends = host, standard = 1`. Keys are namespaced `<app>:<key>`, and host keys are left as they are. | `navigation.py:390-407`; `frappe/shell/extensions.py:3-16`, `45-59` |
| Anchorable targets | Contributed anchors may name base keys only when the base is shipped. A derived base's doctype-name keys are not anchorable. | `navigation.py:88-93`; `extensions.py:37-40` |
| Key validation | `validate_item_keys` (type set, key set, unique) runs on `standard` records only. Site and user layers are not checked. | `navigation_item.py:55-82`; `rail.py:104-109`; `sidebar.py:496-509` |
| Layer-row validation | The only check on a layer row is "an added row names its `item_type`". | `frappe/desk/doctype/navigation_item/navigation_item.py:41-52` |
| Duplicate key in one layer | The first row wins, and later ones are skipped. | `layers.py:132-137` |
| Keyless row | It names nothing and is dropped. | `navigation.py:229-240` |
| Key collision | An added row whose key equals a base key replaces that entry outright and keeps the base's position (`apply_item_row` ignores `entry` when `added`). An app shipping key K later is shadowed by a layer that already added K. | `navigation.py:242-243`; `layers.py:202` |
| `switches_app` | `_switching_url` needs `item["app"]`, which only contributed rows carry. On a layer-added row the flag does nothing. | `navigation.py:283-298` |
| Filters | They are keyed by `item_type`, not by origin. Added rows are filtered like shipped ones, because filtering runs after the merge. | `navigation.py:188-191`; `navigation_filter.py:23-56` |
| Hidden cascade | Hiding drops the row and its subtree. There is a cycle guard on the authored `parent_key`. This does not depend on origin. | `navigation.py:196-216` |
| Orphan lift | A row whose `parent_key` is missing goes to the top level. This does not depend on origin. | `navigation.py:264-271` |
| Client cycle lift | A cycle row is drawn at the top level and logged once. | `frontend/src/navigation/tree.ts:11-41`; `useItemTree.ts:76-93` |
| Section memory | Pruned against the *resolved* list, so it does not depend on origin. | `frontend/src/navigation/sectionMemory.ts:114-129` |

### Who may read or write a layer

- **Reading during resolution.** Resolution reads the layers with `frappe.get_all`, which applies no
  permissions (`navigation.py:360-363`).
- **`Rail` permissions.**
  - The JSON gives System Manager read, write, create and delete. Desk User gets read only.
  - `has_permission` shows a non-System Manager only their own user layer (`rail.py:134-149`).
- **`Sidebar` permissions.**
  - The JSON is the same as `Rail`.
  - `has_permission` shows anyone the shared layers (`user` blank) and their own
    (`sidebar.py:753-785`).
- **The editor endpoints.**
  - The user scope is always the session user.
  - The site scope needs Administrator or System Manager (`arrangement.py:92-147`, `164-165`).
  - The site scope also skips the permission filter, the only bypass (`arrangement.py:110-112`).
- **The client.** `frontend/src/arrangement.ts:19-48` hard-codes `scope: "user"`. No client code
  calls the site scope.

## 2. The `added` and `overrides` columns on `Navigation Item`

Schema (`frappe/desk/doctype/navigation_item/navigation_item.json`, section `customization_section`):

- `hidden` (Check)
- `added` (Check). "1: an item this layer added outright."
- `overrides` (Code JSON). "JSON list of fieldnames this delta has an opinion about."

| Column | Written by | Read by |
|---|---|---|
| `added` | **Nothing in desk v2.** Only tests write it, for example `test_shell_navigation.py:131`, `193` and `321`. | `ITEM_FIELDS` (`navigation.py:30`); `apply_item_row` (`navigation.py:242`); `NavigationItem.validate_type_on_an_item` (`navigation_item.py:44-52`). It is stripped before the wire, because it is not in `WIRE_FIELDS` (`navigation.py:37-50`). |
| `overrides` | `arrangement._delta`, as the JSON list of changed `OVERRIDABLE` fields (`arrangement.py:246-250`) | `_overridden` (`navigation.py:251-261`). It is limited to `ITEM_FIELDS`, and unparsable input means no opinion. Not on the wire. |

Desk v1 has look-alike columns on other tables. They are not the `Navigation Item` column:

- `Custom Sidebar` → `Sidebar Item.added` (`frappe/desk/doctype/custom_sidebar/custom_sidebar.py:348-382`, `592-613`, `808-830`)
- v1 dock preferences (`frappe/tests/test_dock_preferences.py`)
- v16 patches (`frappe/patches/v16_0/sidebar_archive.py:292`, `remove_modules_made_from_generated_sidebars.py:125`)

The "append, not arrangement" rule in `layers.py:172-187` exists for v1's `add_site_sidebar_item`. That
is the `keep_unnamed` path. Desk v2 takes the `anchored` path instead (`layers.py:157-158`).

## 3. Adding a type

### The files and registrations

The pattern is the 8 framework kinds in `frappe/desk/navigation_item_type/*/` plus ERPNext's
`Default Company`.

1. **Record.** `<module>/navigation_item_type/<scrubbed>/<scrubbed>.json` is a `Navigation Item Type`
   with these fields:
   - `type_name`, which is the name (`autoname: field:type_name`)
   - `module`
   - `target_doctype`. It is copied onto an item's blank `link_doctype` through
     `fetch_from: item_type.target_doctype` and `fetch_if_empty`.
   - `permission_rule`

   Supporting code:
   - The doctype controller is `frappe/desk/doctype/navigation_item_type/navigation_item_type.py:12-65`.
   - It is imported at migrate by the `("desk", "navigation_item_type")` walk (`frappe/model/sync.py:37-38`).
   - It is reaped when its file goes (`ORPHANABLE_ENTITIES`, `sync.py:253-263`).
   - It is exported on save in developer mode (`navigation_item_type.py:55-65`).
2. **Renderer.** `<module>/navigation_item_type/<scrubbed>/frontend/item.js`.
   - The Vite plugin finds it and reads the type's name from the JSON beside it
     (`frontend/plugin/contributions.js:147-165`). With no JSON, the renderer is ignored with a warning.
   - It is in the rebuild globs (`frappe/shell/manifest.py:77-78`).
   - It is registered in `frontend/src/contributions/registry.ts:190-202`. On a collision the
     **first** app in `app_order` wins, and the clash is logged.
   - Contract (`frontend/src/navigation/types.ts:150-159`): `render(item, ctx) → Rendering | null`,
     optional `label(item, ctx)`, and optional `icon`.
   - `Rendering` has exactly four variants (`types.ts:116-121`): `{to}`, `{href}`, `{group: true}` and
     `{expand}`.
   - A type with no renderer is skipped and logged once (`frontend/src/navigation/registry.ts:24-38`).
3. **Permission rule.** The type picks one of six buckets (`frappe/shell/navigation_filter.py:14-20`):
   - `Readable DocType`
   - `Module Contents`
   - `Derived From Children`
   - `Permitted Page`
   - `Always Visible`
   - `Custom`

   `Custom` needs a `navigation_item_resolvers = {"<Type>": "<dotted.module>"}` hook. The framework
   appends `.can_see` and calls it once with every item of that type (`navigation_filter.py:80-99`,
   `234-258`). On a collision the **last** app wins and logs. Note that this is the opposite of the
   renderer order. An unknown type or bucket, a missing `can_see`, or a `can_see` that raises all
   fail closed and log once per resolution (`navigation_filter.py:45-48`, `86-97`, `300-315`).
4. **Boot payload.** Nothing is registered per type.
   - Items ride the one `navigation` key (`frappe/shell/boot.py:313-315`).
   - Only `WIRE_FIELDS` reach the browser (`navigation.py:38-50`): `key`, `parent_key`, `item_type`,
     `link_doctype`, `link_to`, `url`, `payload`, `label`, `icon`, `collapsible` and `keep_closed`.
   - `payload` is the type-specific JSON. The server parses it (`navigation.py:274-286`, `344-357`).
   - Other data must come from existing boot keys. ERPNext's renderer reads `boot.sysdefaults.company`
     (`erpnext/setup/navigation_item_type/default_company/frontend/item.js:17-34`).
5. **Type-name switches outside the record.**
   - `_switching_url` handles `Module`, `DocType`, `Record` and `Link` only. Any other type that a
     contributed row marks `switches_app` logs `_no_address` (`navigation.py:304-315`).
   - `report_overlaps._destination_of` treats `Link` and `Section` as going nowhere (`navigation.py:548-557`).
   - `test_rail.py:48-55` asserts the eight shipped types, and asserts that `View` is absent.

ERPNext's kind, as a worked example:

- `default_company.json`: module `Setup`, rule `Custom`, target `Company`.
- `frontend/item.js`: it renders `routeFor("Company", boot.sysdefaults.company)`.
- `default_company.py`: `can_see` makes one `has_permission` call for the batch (`:29-67`).
- `erpnext/hooks.py:23-33`: `navigation_item_resolvers`.

### Facts for `Act` and `View`

- **`Act`.** No `Rendering` variant runs an act. `SidebarRow.vue` draws:
  - `to` as a `SidebarItem` (`frontend/src/shell/SidebarRow.vue:30-38`)
  - `href` as an `<a>` (`:41-48`)
  - `expand` as a button (`:51-58`)
  - `group` as a `SidebarSection` (`:7-25`)

  `RailColumn.vue` draws only `to` and `href` (`frontend/src/shell/RailColumn.vue:170-178`). Acts run
  through `acts.perform(name, value?)` (`frontend/src/acts/dispatcher.ts:159`). The sidebar's
  collapse seam already calls it (`SidebarPanel.vue:51`). An app's acts join the dispatcher as
  `shell.<app>.<item>` (`frontend/src/shell/appActs.ts:1-2`).
- **`View`.** Boot already carries `view_types` and `default_views` (`boot.py:316-323`). There is
  no `View` type record (`test_rail.py:55`).

### Can a type, or a row of a type, be authored in the browser?

- **A type: no.**
  - The `Navigation Item Type` JSON gives System Manager and Desk User **read only**.
  - `validate_app_content` refuses any write outside developer mode or a system flag
    (`navigation_item_type.py:8-9`, `39-53`; test `test_rail.py:75-90`).
- **A row: only through the generic doctype form or REST, not through any desk v2 UI.**
  - System Manager has write and create on `Rail` and `Sidebar`. A non-standard record can hold
    `Navigation Item` rows with `added = 1`.
  - The validation on such a row is small:
    - `added` needs `item_type` (`navigation_item.py:44-52`).
    - `Rail.validate` blanks `extends` and checks `standard` only (`rail.py:47-109`).
    - Keys are not checked off the app layer.
    - Normal Link and Dynamic Link checks run on `item_type`, `link_doctype` and `link_to`.
  - The editable fields are every column in `ITEM_FIELDS` (`navigation.py:17-35`).
  - The v2 editor (`CustomizeSidebarDialog.vue`, `frontend/src/shell/CustomizeSidebarDialog.vue:30-75`)
    edits only label, order (siblings only) and hidden. Section 1 says why it cannot keep an added row.

## 4. Nesting: every place depth matters

Nothing caps depth anywhere. Rows nest by `parent_key` alone.

| Place | Depth behaviour | Ref |
|---|---|---|
| Stored row validation | No depth check, on any layer | `navigation_item.py:41-82` |
| Merge and anchors | `_place` sets `parent_key` to any anchor target. `_subtree`, `_end_of` and `_beneath` walk to a fixpoint at any depth. | `layers.py:327-387` |
| Extension | A contributed `parent_key` names the contributor's own sibling, and anchors place roots only | `extensions.py:54-70` |
| Hide, orphan and cycle | Chain walks at any depth | `navigation.py:196-216`, `264-271` |
| `Derived From Children` cascade | Emptiness propagates to a fixpoint, so a Section holding only an emptied Section is empty | `navigation_filter.py:102-142` |
| Reducer | Order is compared per parent group. A changed parent becomes an anchor (`after`, `before` or `parent_key`). `parent_key` is not overridable. | `arrangement.py:30-32`, `269-307` |
| `buildTree` | Any depth. The last duplicate key wins, and cycles are lifted. | `frontend/src/navigation/tree.ts:15-41` |
| `SidebarRow.vue` | Recursive with two child branches. (a) A row with children and no destination is a `SidebarSection`, and its children mount only while it is open (`:7-25`). (b) A row with a destination *and* children draws its children in a hand-indented `ml-3 border-l` block (`:60-73`), and that indent stacks per level. A `heading` is a `group` rendering **or** any row with children (`:132-134`). `expand` rows land at the expander's own level (`:84-90`). | `SidebarRow.vue` |
| `RailColumn.vue` | Flattens depth-first. A heading contributes only its children. `group` and `expand` rows are not drawn. | `RailColumn.vue:154-168` |
| Customize dialog | Any `parent_key` gets one `ml-4`, so depth 2 and deeper look like depth 1 (`CustomizeSidebarDialog.vue:37`). Drag refuses to reparent (`frontend/src/arrangement.ts:70-79`). `move` works within siblings (`arrangement.ts:54-68`). `flatten` walks depth-first (`arrangement.ts:114-132`). | |
| Disclosure memory | `sectionMemory` keys a flat `{key: open}` map per container (`Sidebar:<address>`) with no depth. `SidebarRow` reads and writes it at every level. | `sectionMemory.ts:100-151`; `SidebarRow.vue:145-161`; `AppShell.vue:169-177` |
| Current row | `navigationDestinations` walks a sidebar's flat list, so a row at any depth can be current. `holdsCurrent` opens every ancestor that contains it (`containsKey`, any depth). | `frontend/src/navigation/current.ts:49-81`; `SidebarRow.vue:139-143`; `tree.ts:61-64` |
| `MAX_DEPTH = 8` in the registry | This is **render recursion** (a `Sidebar` item rendering its sidebar's first row through `renderingOf`), not nesting depth | `frontend/src/navigation/registry.ts:12-17`, `40-60` |
| frappe-ui | `SidebarSection` and `SidebarItem` have no depth or indent prop. Indentation is the shell's own markup. | `frappe-ui/src/components/Sidebar/SidebarSection.vue`, `SidebarItem.vue` |

What "section → item → one child" maps to in today's renderer:

- The section is branch (a).
- The item is a `to` or `href` row inside it.
- The child is branch (b), one `ml-3 border-l` level.

A cap would decide what branch (b) does below one level, and what (a) does inside (a). It would
also decide where the refusal lives:

- `NavigationItem.validate`
- `validate_item_keys`
- `_known` / `anchors_for` in the reducer
- the client's `dropOn`

**Shipped data today on `desk.localhost`** (all `standard` Rail and Sidebar rows; frappe, erpnext,
crm, gameplan, helpdesk, telephony and whatsapp installed):

- Rails: 28 rows, all at depth 0.
- Sidebars: 118 rows at depth 0 (69 DocType, 49 Section) and 224 at depth 1 (222 DocType, 1 Page,
  1 Default Company).
- **No row is at depth 2 or deeper.**
- No non-standard (site or user) layer holds rows.

## 5. Shell layout

### What `AppShell.vue` and frappe-ui assume

- **`DesktopShell`.** It is a `flex` row with fixed slot order: `rail`, `sidebar`, then content
  (`frappe-ui/src/components/DesktopShell/DesktopShell.vue:2-33`). Its only prop is `scroll`
  (`DesktopShell/types.ts`). There is no side, order or direction prop.
- **`AppShell.vue`.** It fills `#rail` and `#sidebar` only when `boot.app` is set
  (`frontend/src/shell/AppShell.vue:13-34`). The index (`/apps`) has neither, and draws the user menu
  pinned at `absolute bottom-3 left-[11px]` (`AppShell.vue:40-47`).
- **Physical left assumptions:**
  - `SidebarRail` is a fixed `w-[50px]` column (`frappe-ui/src/components/SidebarRail/SidebarRail.vue:2-4`).
  - `SidebarRailItem`'s tooltip is `side="right"` and its active bar is `-left-[11px] rounded-r-4`
    (`SidebarRailItem.vue:7`, `35`, `57`).
  - `RailColumn.vue` uses `side="right"` on the app-menu dropdown and the tooltips (`:9`, `:31`, `:75`).
  - `UserMenu.vue:3` uses `side="right"`.
  - The content edge is `border-l` (`AppShell.vue:345-349`), and so is the panel
    (`SidebarPanel.vue:13`). The child indent is also `border-l` (`SidebarRow.vue:63`).
  - The collapse seam is `left-full` with a `chevron-left` icon (`SidebarEdge.vue:7`, `15`, `23`). Its
    drag closes on a leftward `clientX` delta (`SidebarEdge.vue:59-61`).
- **`Sidebar` (frappe-ui).** It collapses by itself below `sm` when `collapsed` is unset
  (`Sidebar/Sidebar.vue:45-52`). `SidebarPanel` always binds it (`SidebarPanel.vue:7-15`).
- **The glossary.** The **Rail** entry says the rail "never disappears" (`frontend/CONTEXT.md:99-109`).
- **RTL.** The v2 page has no `dir` handling: `frontend/index.html:18` is a bare `<html>`, and
  nothing in `frontend/src` or `frappe/shell` sets a direction. Desk v1 sets
  `dir={{ layout_direction }}` (`frappe/www/desk.html:2`, `frappe/www/desk.py:82`).
- **Existing per-person layout state.** Only the sidebar's collapsed flag, kept in `localStorage`
  per user (`AppShell.vue:316-323`). There is no site or user setting for the layout, the side or
  the utility placement.
- **The settings dialog.** frappe's `Settings Dialog` has an `Appearance` block (component `theme`)
  in the Profile pane, and a System pane built from System Settings fields
  (`frappe/settings_dialog/frappe/frappe.json:77-80`).

### Where the utility items are drawn today

All of them are inside `RailColumn.vue` except on the index.

| Item | Where | Ref |
|---|---|---|
| Logo / app tile, which opens the app menu (other apps + `all_apps`, `open_settings`, `customize_sidebar`, `copy_link`, `about`) | Top of the rail | `RailColumn.vue:7-27`, `180-193` |
| Search (palette trigger, Mod+K) | Under the tile, between dividers | `RailColumn.vue:29-49` |
| Rail items | Scroll area, `flex-1` | `RailColumn.vue:52-90` |
| User menu (avatar) | Rail foot | `RailColumn.vue:92-96` |
| User menu on `/apps` | Absolute bottom-left | `AppShell.vue:40-47` |
| Quick app switcher | A full-screen overlay opened by a key, not a slot | `frontend/src/shell/AppSwitcher.vue:1-8`; `appSwitcherKey.ts:11` |
| Panel title + customize button | Panel header | `SidebarPanel.vue:17-29` |

There is no notifications slot.

## 6. Boot cost

- **The budget.**
  - `KEY_BUDGET = 100_000` bytes per top-level boot key (`frappe/shell/boot.py:36-37`).
  - It is measured as `orjson_dumps` bytes.
  - It is **reported, not enforced**. One deferred Error Log is written per key per prefix per day
    (`boot.py:240-276`).
- **What reaches the payload.**
  - Only the current prefix's app is resolved into `navigation` (`boot.py:313-315`).
  - Blank fields are omitted on the wire. The code notes that "navigation is most of the boot
    budget" (`navigation.py:274-286`).
  - Navigation is not cached. It is resolved on every `get_boot`, with a per-resolution
    `NavigationContext` (`navigation_filter.py:145-161`).

Measured on `desk.localhost`, 2026-11-14:

| Prefix | Size of `navigation` | Rail rows | Sidebars / rows |
|---|---:|---:|---:|
| erpnext | **48,724 B** | 20 (2,769 B) | 18 / 318 |
| desk (frappe, derived rail) | 26,767 B (Administrator) / 26,480 B (`shariq@frappe.io`) | 269 / 266 | 0 |
| crm | 4,101 B | 8 | 1 / 24 |
| helpdesk | 2,755 B | 27 | 0 |
| gameplan | 2,332 B | 24 | 0 |
| telephony | 713 B | 7 | 0 |
| whatsapp | 659 B | 7 | 0 |

- **The largest key.** ERPNext's sidebar rows average about 144 B each, so `navigation` is at about
  49% of the per-key budget. That leaves about 51 KB of headroom, which is roughly 350 more rows of
  today's shape.
- **The derived rail.** frappe's derived rail averages about 99 B per row.
- **Resolve time.** 11–86 ms per prefix, a noisy single run.
- **Caveat.** `shariq@frappe.io` is a System Manager, so these are close to the unfiltered sizes.
