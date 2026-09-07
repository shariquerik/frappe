# frappe-ui's shell components against the desk v2 shell

Research notes for frappe/frappe#42570, a child of #42569 (the shell and the list, first
version). Written 2026-09-07 by reading the code, not by running it.

## What was read, and from where

| Source | Ref | Cited as |
| --- | --- | --- |
| frappe-ui `DesktopShell`, `Rail`, `Sidebar` (source, `types.ts`, `.md`, `.api.md`, stories, Cypress specs) | `frappe-ui@1.0.0-beta.55`, the pin in `frontend/package.base.json:16`, read from `frontend/node_modules/frappe-ui/src/components/` | `ui:<Family>/<file>:<line>` |
| The desk v2 shell: `frontend/src/shell/` and `frontend/src/navigation/` | `upstream/desk-v2` at `5123c4a798` | `frappe:<path>:<line>` |
| CRM's reference shell: `frontend2/src/components/{AppShell,SidebarEdge,shellChrome,RailEditorDialog}` and `composables/useAppMenu.ts` | `frappe/crm` local branch `feat/crm-frontend2` at `9d064a58d`; these five files are byte-identical on the pushed `origin/feat/crm-frontend2` (`019643e63`) | `crm:<path>:<line>` |
| The sidebar body CRM composes, `NavigationSidebar.vue` and `NavigationSidebarItem.vue` | frappe branch `feat/saved-view-sidebar`, reference worktree at `80b878541f`, under `ui/src/experimental/Navigation/` | `svs:<file>:<line>` |

Two caveats on the CRM side. CRM's `frontend2/package.json:18` pins `frappe-ui@1.0.0-beta.24`,
not beta.55, so the components it composes are an older cut of the same family; every
claim below about what a prop or slot does is against beta.55. And `NavigationSidebar` is
not on `upstream/desk-v2` at all; it lives only on the saved-view branch, so it is cited
for what CRM chose, never as something the shell already has.

## The components, in one paragraph each

**`DesktopShell`** is a `flex h-full` row with three slots, `#rail`, `#sidebar` and the
default, and one prop, `scroll` (`ui:DesktopShell/DesktopShell.vue:2-4,18-31,52`). The
content column pins a `PageHeaderTarget` above the scroll region and registers that region
so `useShellScrolled()` finds it (`ui:DesktopShell/DesktopShell.vue:11,72-85`). The sidebar
slot is documented as "render it conditionally to hide it on routes that don't need it"
(`ui:DesktopShell/DesktopShell.vue:60`). There is no fourth slot; a right-hand pane has no
home.

**`Rail`** is a 50px column, `flex-col items-center`, with one default slot wrapped in a
`TooltipProvider` at zero hover delay (`ui:Rail/Rail.vue:4-8`). Its own doc says "no layout
slots and no built-in scrolling", and that a logo or user menu goes in as a direct child
(`ui:Rail/Rail.md:10-12`).

**`RailItem`** is a 28px cell (`size-7`) that renders a `RouterLink` when `to` is set and a
`<button>` otherwise (`ui:Rail/RailItem.vue:15,48`, `ui:Rail/types.ts:20-24`). It carries a
tooltip with `label` and an optional `description` line (`ui:Rail/RailItem.vue:81-88`), an
explicit `active` prop that draws the left indicator bar on the `tile` variant
(`ui:Rail/RailItem.vue:114`), a numeric `badge` as a pill or a dot
(`ui:Rail/RailItemBadge.vue:52-57`), and a default slot that replaces the icon
(`ui:Rail/RailItem.vue:108`). It has no label text in the cell and no notion of a group.

**`Sidebar`** is a fixed-width column that owns collapse: `v-model:collapsed`,
`width`/`collapsedWidth`, `disableCollapse`, and an automatic collapse below the `sm`
breakpoint when the model is left `null` (`ui:Sidebar/Sidebar.vue:20-23,39-47`). It provides
the collapsed state and a toggle to descendants by injection (`ui:Sidebar/Sidebar.vue:54-55`).
The body is entirely the app's (`ui:Sidebar/Sidebar.vue:8-11`).

**`SidebarSection`** is a label row plus a body that shows and hides. `collapsible` makes the
label a button with `aria-expanded`/`aria-controls`; `v-model:collapsed` lets the app own the
state, otherwise it starts expanded (`ui:Sidebar/SidebarSection.vue:26-42,110`,
`ui:Sidebar/types.ts:150-155`). The body is a `<nav>` and the open/close animation is a
`max-h-[200px]` transition (`ui:Sidebar/SidebarSection.vue:57-58,68-75`).

**`SidebarItem`** is a 28px row: a `RouterLink` (or `<a>` with no router) when `to` is set,
a `<button>` otherwise, with `#prefix`, default and `#suffix` slots; the suffix zone is a
sibling of the link so a menu can sit there (`ui:Sidebar/SidebarItem.vue:20-23,61,105-115`).
`active` is explicit when passed; when omitted it is inferred by exact route name or path
equality (`ui:Sidebar/SidebarItem.vue:180-189`). It takes an `accessKey`
(`ui:Sidebar/types.ts:36-37`).

**`SidebarHeader`** is a 48px row that is always a `Dropdown` trigger with a chevron, taking
`title`, `subtitle`, `logo`, `showLogo` and `menuItems` (`ui:Sidebar/SidebarHeader.vue:6-9,68`,
`ui:Sidebar/types.ts:72-93`). **`SidebarLabel`** is a plain `<h3>` heading that becomes a
divider while collapsed if `divider` is set (`ui:Sidebar/SidebarLabel.vue:2-20`).
**`SidebarCollapseToggle`** is a `SidebarItem` that flips the injected toggle
(`ui:Sidebar/SidebarCollapseToggle.vue:2-9`). **`SidebarCard`** is a footer card with a
title, description, themed icon and one action (`ui:Sidebar/types.ts:100-118`).

## Need by need

The shell's rail and panel share one row component, `NavigationRow`, which draws a
`RouterLink` for a route in this prefix, an `<a>` for a full document load, a `<button>` for
rows fetched on demand, and a `<p>` or `<button>` heading for a group, then recurses into
children in an indented `<ul>` (`frappe:frontend/src/navigation/NavigationRow.vue:8-69`).
Everything in the tables below is measured against that.

### 1. Rail items with sections

| | |
| --- | --- |
| Shell today | The rail is a 208px labelled column (`w-52`, `frappe:frontend/src/shell/AppRail.vue:6`) drawing a tree from `useItemTree`; a heading is a row with children under it, indented with a left border (`frappe:frontend/src/navigation/NavigationRow.vue:46-69`). `keep_closed` and `collapsible` apply to rail sections exactly as to sidebar ones (`AppShell.vue:88-91` builds a `Rail:<app>` section memory). |
| frappe-ui | Nothing. `Rail` is icon-only and 50px wide; `RailItem` has no label in the cell and no group form. The only grouping the family offers is spacing: the story puts the middle items in a `flex-1` div with `gap-3` (`ui:Rail/stories/Default.vue:19-31`). Nested children under a rail item cannot be drawn. |
| CRM instead | Flattened its sections into one list before rendering, keeping the section name only as a field on each item (`crm:frontend2/src/data/rail.ts:9-13`); the sections survive only inside the editor dialog (`crm:frontend2/src/components/RailEditorDialog.vue:2`, which passes `flat`). |

### 2. The current-item rule

| | |
| --- | --- |
| Shell today | `currentFrom` picks one row across rail and panel by deepest path coverage, with a preference list as tie-break (`frappe:frontend/src/navigation/current.ts:87-117`). `NavigationRow` binds `aria-current` itself so `RouterLink`'s own prefix matching is suppressed (`NavigationRow.vue:13,95-97`). |
| frappe-ui | `RailItem`'s `active` prop, explicit only (`ui:Rail/types.ts:26-27`). `SidebarItem`'s `active` prop; when it is *omitted*, the row lights itself up by exact route name or path equality (`ui:Sidebar/SidebarItem.vue:178-189`). Both fit: the shell keeps computing `current` and passes `:active` on every row. Passing `active` explicitly is required, because the inference is exact-match and would leave a record page's row dark. |
| CRM instead | The same shape: `isActiveRailItem` compares the active doctype (`crm:frontend2/src/data/rail.ts:19-26`) and is passed as `:active` (`crm:frontend2/src/components/AppShell.vue:21`). |

### 3. Sidebar sections that collapse, with disclosure memory

| | |
| --- | --- |
| Shell today | A heading is a button while `collapsible` and the address is not inside it; the section that holds the current row is open and offers no control (`NavigationRow.vue:133-136`). The resting state is `sectionMemory` (localStorage, keyed by user and container, pruned against what ships) or the item's `keep_closed` (`NavigationRow.vue:139-149`, `frappe:frontend/src/navigation/sectionMemory.ts:41-81`). |
| frappe-ui | `SidebarSection` with `collapsible` and `v-model:collapsed` (`ui:Sidebar/SidebarSection.vue:26-42,110`). The doc says bind the model "to own the state (start a section collapsed, persist the choice)" (`ui:Sidebar/Sidebar.md:61-63`), so `sectionMemory` plugs in as that model. "No control while the address is inside" is `:collapsible="!holdsCurrent"` with `collapsed` forced false, since a non-collapsible section renders the label as plain text (`SidebarSection.vue:43`). Three things it does not cover: depth (a `SidebarSection` does not indent, and nesting one inside another nests two `<nav>`s); a heading that is itself a destination or an expander (the section label is a string, `ui:Sidebar/types.ts:152`); and the `max-h-[200px]` animation clips a section taller than about seven rows while it opens (`SidebarSection.vue:57-58`). |
| CRM instead | No collapse at all. Each section is a plain `div` with a `SidebarLabel` heading and a `<nav>` of rows (`svs:NavigationSidebar.vue:22-60`); a section disappears by its `hidden` flag, not by a click. |

### 4. The sidebar title row

| | |
| --- | --- |
| Shell today | A `<p>` with the owning rail item's authored label, or nothing (`frappe:frontend/src/shell/AppSidebar.vue:7-9`, `AppShell.vue:189-190`). |
| frappe-ui | `SidebarHeader` is the nearest thing, but it is always a `Dropdown` trigger: the chevron and the button render whether or not `menuItems` is passed (`ui:Sidebar/SidebarHeader.vue:7-9,68`). `showLogo: false` gives a flush-left title (`ui:Sidebar/types.ts:80-86`). For a title with no menu, `SidebarLabel` is the plain heading (`ui:Sidebar/SidebarLabel.vue:2-10`); it is styled as a section label, not a title. |
| CRM instead | Neither. Its own `<button>` inside a `Dropdown` carrying the app menu, styled with `text-lg-medium` (`crm:frontend2/src/components/AppShell.vue:101-127`). |

### 5. Panel continuity

| | |
| --- | --- |
| Shell today | `resolve()` picks the open sidebar from `?sidebar=`, the history entry's stamp, the panel already open, then the tab's `sessionStorage` memory, and writes the answer back onto `history.state` (`frappe:frontend/src/shell/AppShell.vue:122-138`, `frappe:frontend/src/navigation/sidebarMemory.ts:22-47`). `AppSidebar` is keyed by address so a panel swap remounts it (`AppShell.vue:18`). |
| frappe-ui | Nothing, by design. `DesktopShell`'s sidebar slot is a hole the app fills conditionally (`ui:DesktopShell/DesktopShell.vue:60`), and `Sidebar` has no idea which panel it is. The whole rule stays in `AppShell.vue` unchanged. |
| CRM instead | No continuity to keep: the panel is always the active doctype's, shown when `deriveShellChrome` says the doctype is real (`crm:frontend2/src/components/shellChrome.ts:24`, `AppShell.vue:93,233`). |

### 6. The Arrange affordance

| | |
| --- | --- |
| Shell today | A text button at the foot of the rail and of the panel (`AppRail.vue:28-34`, `AppSidebar.vue:23-29`) opens `ArrangementEditor`, a 320px pane on the right edge of the shell (`frappe:frontend/src/shell/ArrangementEditor.vue:6`, `AppShell.vue:31-38`). |
| frappe-ui | Nothing for the control, and no slot for the pane. On the rail, a `ghost` `RailItem` with `@click` is the idiomatic control (`ui:Rail/types.ts:39-41`). In the sidebar, a ghost `Button` beside a `SidebarLabel`, as the story does for "Sort spaces" (`ui:Sidebar/stories/Default.vue:77-98`). The editor pane itself would have to live inside the default slot next to the routed view, or become a `Dialog`. |
| CRM instead | A ghost `RailItem` labelled "Customize sidebar" at the foot of the rail opens a `Dialog` (`crm:frontend2/src/components/AppShell.vue:56-61,156`); the sidebar's own customize control is a ghost `Button` on the first section's heading row (`svs:NavigationSidebar.vue:36-45`). |

### 7. The share link

| | |
| --- | --- |
| Shell today | A "Copy link" button in the rail writes `shareLink` to the clipboard and swaps its own label to "Link copied" for 1.5s, because "there is no toast in the shell to borrow" (`AppRail.vue:36-42,78-95`). |
| frappe-ui | Nothing on the rail or sidebar. The behaviour fits a `Dropdown` option's `onClick`, but the menu closes on the click, so the in-button confirmation is lost; frappe-ui exports a `toast` (`frappe-ui/src/index.ts:82`) that the shell has not adopted. |
| CRM instead | No share link. |

### 8. All apps

| | |
| --- | --- |
| Shell today | A literal `<a href="/apps">` (`AppRail.vue:44-49`), a full document load out of this prefix. |
| frappe-ui | Nothing direct. A `RailItem` with `to` renders a `RouterLink` (`ui:Rail/RailItem.vue:15-16`), which is wrong for an address outside this prefix's router; the button form with `@click` and `window.location.assign` is the only fit. `SidebarItem` has the same shape, and worse: with a router installed it always renders `RouterLink`, and the plain `<a>` branch is only for router-less mounts (`ui:Sidebar/SidebarItem.vue:167-172`). So every `href` rendering the shell has today (`frappe:frontend/src/navigation/types.ts:13-15`, `NavigationRow.vue:20-31`) becomes a button that assigns `location`, and middle-click and copy-link-address on those rows go away. |
| CRM instead | An "Apps" submenu in the app dropdown listing `installedApps` with their logos, each `window.location.assign(app.route)` (`crm:frontend2/src/composables/useAppMenu.ts:14-30`). The shell's boot carries that list only on the index (`frappe:frontend/src/boot.ts:68-75`), so on an app's prefix the item is a link to `/apps`, not a submenu, unless the payload grows. |

## What the components give for free that the shell lacks

| Free with frappe-ui | Where | The shell today | What CRM did |
| --- | --- | --- | --- |
| Sidebar collapse: `v-model:collapsed`, `collapsedWidth`, `SidebarCollapseToggle`, rows shrink to their icon with a right-side tooltip, `SidebarLabel divider` | `ui:Sidebar/Sidebar.vue:39-55`, `SidebarItem.vue:30-58`, `SidebarCollapseToggle.vue` | None; the panel is fixed at 224px (`AppSidebar.vue:6`) | `collapsedWidth="0px"` so the panel vanishes rather than shrinks, state in `localStorage`, and its own `SidebarEdge`: a drag seam plus a round chevron that appears on hover of the sidebar or, when closed, of the rail (`crm:AppShell.vue:94-97,140-145,220`, `crm:SidebarEdge.vue:1-31,43-66`) |
| Rail badges: `badge` count pill teleported to `<body>` or a `dot`, folded into the accessible name and the tooltip | `ui:Rail/RailItem.vue:131-142`, `RailItemBadge.vue:7-33` | None; `NavigationItem` carries no count | Not used |
| Sidebar row suffix: a sibling zone for a count or a `…` menu that fades in on hover via `group/sidebar-item` | `ui:Sidebar/SidebarItem.vue:100-115`, story `Default.vue:117-147` | None; rows are a link and a label | `NavigationSidebarItem` puts a default star, a count and an actions `Dropdown` there (`svs:NavigationSidebarItem.vue:7-41`) |
| `SidebarCard` for a footer notice with one action | `ui:Sidebar/types.ts:95-118` | None | Not used |
| Keyboard: `accessKey` on a row; the section trigger is a real button with `aria-expanded`/`aria-controls`; focus rings on every cell | `ui:Sidebar/types.ts:36-37`, `SidebarSection.vue:26-42`, `RailItem.vue:117` | Headings already carry `aria-expanded` (`NavigationRow.vue:52`); no access keys | No access keys; one global `Cmd+Shift+,` listener of its own for Settings (`crm:useAppMenu.ts:44-53`) and a `KeyboardShortcut` glyph component for menu rows |
| Mobile: `Sidebar` collapses itself below `sm` when the model is `null`; `MobileShell` is a separate family the app swaps in by viewport | `ui:Sidebar/Sidebar.vue:41-47`, `ui:MobileShell/MobileShell.md:3-9` | None; `h-screen w-screen` flex with no breakpoint (`AppShell.vue:6`) | `DesktopShell` only |
| Tooltips on every rail cell at zero delay, with a second `description` line | `ui:Rail/Rail.vue:6-8`, `RailItem.vue:81-88` | None (labels are visible text) | Used |
| A pinned `PageHeaderTarget` and a registered scroll region, `scroll=false` for pages that own their own scroll | `ui:DesktopShell/DesktopShell.vue:11-31` | `<main>` with a bare `RouterView` (`AppShell.vue:28-30`) | `:scroll="false"`, header teleported (`crm:AppShell.vue:2,149-151`) |
| `data-slot` and `data-state` hooks on every part for app CSS | `ui:Rail/RailItem.vue:18-20`, `Sidebar.vue:3-4`, `SidebarItem.vue:3-4` | Class strings inline | Dark-mode overrides through `:deep([data-slot='rail-item'])` (`crm:AppShell.vue:311-321`) |

## The rail's first item: the app logo opening a dropdown

`RailItem` renders `Tooltip` around a `RouterLink` or a `<button>`, and its default slot sits
*inside* that element (`ui:Rail/RailItem.vue:7,15,48,65`). So a `Dropdown` cannot go in the
slot: its trigger is itself a button, and a button may not contain another.

Wrapping is the other way round, `<Dropdown><RailItem …/></Dropdown>`, and it fails for a
documented reason. `Dropdown` renders its default slot under `DropdownMenuTrigger as-child`
(`ui:Dropdown/Dropdown.vue:3-16`), which needs to reach the trigger's DOM element and stamp
its attributes on it. `RailItem`'s root is `Tooltip`, which declares `inheritAttrs: false`
and forwards nothing (`ui:Tooltip/Tooltip.vue:12-14`), so `aria-haspopup`, `data-state` and
the trigger's click handler are dropped on the floor, and `RailItem`'s own comment records
that "reka's trigger can't forward its element ref through a functional wrapper"
(`ui:Rail/RailItem.vue:8-12`). The Rail story never combines the two either: its "You"
avatar is a `RailItem` with no menu (`ui:Rail/stories/Default.vue:35-37`).

CRM confirms the pattern from the other side. Both cells that open a menu or act as the logo
are raw `<button>`s, not `RailItem`s: the logo is a `size-7 rounded-[7px]` button with an
`<img>` and an `aria-label` (`crm:AppShell.vue:5-14`), and the user avatar is a raw button in
`Dropdown`'s default slot with `side="top"` (`crm:AppShell.vue:64-88`). Its "Customize
sidebar" is a `RailItem` only because it opens a dialog on `@click` rather than a menu
(`crm:AppShell.vue:56-61`).

So the shape that works today is:

```vue
<Rail>
  <Dropdown :options="logoMenu" side="right" align="start">
    <template #default="{ open }">
      <button
        type="button"
        class="relative flex size-7 items-center justify-center rounded-[7px] …"
        :aria-label="boot.app ?? 'Apps'"
      >
        <img :src="logo" alt="" class="size-7 rounded-[7px]" />
      </button>
    </template>
  </Dropdown>
  …
</Rail>
```

with `logoMenu` as three `Dropdown` options: *All apps* (`onClick: () =>
window.location.assign('/apps')`, a full document load as in need 8), *Customize sidebar*
(`onClick` emitting `arrange`, need 6) and *Copy link* (`onClick: copyLink`, need 7). The
option shape is the same `label` / `icon` / `onClick` list `SidebarHeader.menuItems` takes
(`ui:Sidebar/types.ts:88-92`), and `Dropdown` also accepts groups and a `submenu`
(`ui:Dropdown/types.ts:4-17`), which is how CRM listed apps under one entry.

Three consequences to accept:

1. The logo cell has no tooltip. `Rail`'s `TooltipProvider` is there, but putting `Tooltip`
   around the `Dropdown` or the `Dropdown` around a `Tooltip` runs into the same `as-child`
   forwarding problem in the other direction; CRM shipped the logo with an `aria-label` and no
   tooltip. Whether `<Tooltip><Dropdown><button/></Dropdown></Tooltip>` happens to work is a
   thing to try in the prototype, not something the sources settle.
2. The active indicator is gone from the logo. `RailItem`'s indicator bar is drawn only by
   `RailItem` (`ui:Rail/RailItem.vue:26-31`); CRM copies the bar by hand on its one non-`RailItem`
   cell that needed it (`crm:AppShell.vue:37-40`). The logo probably does not want one.
3. *Copy link* loses its in-place "Link copied" confirmation, because the menu closes on the
   click. That is where frappe-ui's `toast` comes in, or the item stays a rail button.

## What the prototype must decide

1. **Whether the rail keeps labels and sections.** `Rail` is a 50px icon column with no group
   form; the shell's rail is 208px with headings, nested children and a per-app section
   memory. Adopting `Rail` means flattening rail sections the way CRM did, or keeping the
   shell's own rail and taking only `Sidebar` from frappe-ui.
2. **Where headings that navigate go.** `SidebarSection`'s label is a string with a chevron;
   the shell's heading can be a destination or an expander with children under it
   (`NavigationRow.vue:46-57`). Either the tree is capped at one level of `SidebarSection`
   over `SidebarItem`s, or `NavigationRow` stays and only the frame around it changes.
3. **What happens to `href` rows.** Both `RailItem` and `SidebarItem` render `RouterLink` for
   `to` and a `<button>` otherwise; there is no anchor form when a router is installed. A
   full-document link (another app, `/apps`) becomes a button with `location.assign`, or the
   row is written by hand.
4. **Whether the panel collapses, and how it is controlled.** `Sidebar` gives collapse for
   free; the shell has never had it. CRM chose "collapse to zero" plus a drag seam of its
   own (`SidebarEdge.vue`) rather than the icon-only column and `SidebarCollapseToggle`. The
   `sm` auto-collapse also fires on a narrow desktop window unless the model is bound.
5. **Where the Arrange editor renders.** `DesktopShell` has rail, sidebar and content, and
   nothing on the right. The pane goes inside the content slot, becomes a `Dialog` as CRM
   did, or the shell keeps its own outer flex and uses `DesktopShell` only for the content
   column.
6. **Which of the three logo-menu items keep a visible confirmation.** *Copy link* needs a
   toast once it is a menu item; adopting `toast` is a shell-wide decision, not a rail one.
7. **The title row.** `SidebarHeader` is always a menu trigger and `SidebarLabel` is styled as
   a section heading; a plain panel title matches neither, so it stays hand-written or the
   panel title becomes a menu (of what?).
8. **The test surface.** The shell's tests select on `data-key`, `aria-current`,
   `aria-expanded` and `data-sidebar` (`frappe:frontend/src/shell/tests/sections.test.ts:75-80,145-177`);
   `SidebarItem` and `SidebarSection` set `aria-current` and `aria-expanded` on the inner
   link or trigger button, and neither declares `inheritAttrs: false`, so a `data-key` passed
   as an attr lands on the outer wrapper `div` (`ui:Sidebar/SidebarItem.vue:2-5`,
   `SidebarSection.vue:7-11`), one element above where the tests read the ARIA state today.
   The selectors move, or the rows stay hand-written.
