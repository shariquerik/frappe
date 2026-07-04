# The menu bar is earned: app-declared menus, no unbacked items

> **Status:** Accepted (2026-07-04, grilled). Rule 2 implemented in menubar-actions slice 06;
> rule 2 amended the same session — menu authorship is OPEN (any app may declare a menu into
> another real app's band), only the grammar stays closed (see rule 2). Amends ADR-0004 (Region
> set grows a parameterized form) and the first-party menu contributions of ADR-0001. Grounded in
> surveys of raven, crm, and erpnext — the installed apps this bench carries precisely to
> supply real use cases.

The menu bar shipped the Mac *template* (File/Edit/View/Window/Help) instead of the Mac
*contract* (the OS guarantees the frame; the app owns the middle). The result: an Edit menu of
`noop` handlers, an About and Lock that do nothing, and a whole-OS fullscreen sitting in a menu
that connotes per-window scope. A menu item that silently does nothing teaches users the whole
bar is decorative.

## Rule 1 — a menu is earned

A menu title renders only when at least one real, eligible Action resolves into its Region for
the current Context. Empty menu = no menu. The OS guarantees the frame: **System / App /
Window / Help**; the middle menus (File, Edit, View, and app-declared ones) appear and
disappear with focus. The `noop` handler pattern is banned — registering a ref asserts it does
something; the loud-throw guarantee in `invoke` must not be laundered by empty functions. The
stub Edit commands are deleted (they return when a real editing context earns them —
raven's message verbs will); About gets its real trivial dialog; Lock is deferred as a tracked
issue, not a dead item.

## Rule 2 — apps declare their own menus

ADR-0004's closed Region set gains one parameterized form, **`menubar:app:<appId>:<menuId>`** —
app-qualified so the id names the OWNING app (whose bar the menu joins, and while focused it
renders) as well as the menu, and two apps' like-named menus never collide. An app declares a menu
as manifest data — `{ id, title, order }` in `os/menus.json`, the OS stamps the owning app — and
Actions place *items* into it through the identical pipeline (identity, layers, patches, removals
all apply; the Customizations view catalogs them). A menu is the container; its items are Actions —
add/edit/remove/gate/layer/cross-app all ride the ONE Action pipeline, never a second per-menu one.
The surveys demand plural menus per app: raven needs Format / Message / Channel, crm needs Record /
Communicate, erpnext's Selling needs Create / Reports. An app-declared menu renders only while its
owning app is focused (the app-qualified Region + the items' Scope binding give this for free) and
is still subject to Rule 1.

**Authorship is open; the grammar is closed** (amended 2026-07-04, grilled). Any app may declare a
menu into any *real* app's band — a custom app extends erpnext by declaring `menubar:app:erpnext:…`
and shipping its items as Actions, exactly the no-privileged-core promise of ADR-0001. What stays
closed is the *grammar*: a menu's target must be a real OS app; an app cannot invent a region in the
OS frame (`menubar:file`, …) or name a non-existent app. A menu naming a non-app target is dropped
loudly — the parameterized instances live inside an OS-owned grammar, they do not open the frame.

## Rule 3 — scope honesty in placement

An `os`-scope command may not be placed in a menu that connotes app or window scope. The
concrete instance: whole-OS Enter Full Screen (browser chromeless mode,
`desktop/fullscreen.ts`) moves from View to the **System** menu. View keeps only
per-window/per-surface verbs. The rule is checked at projection time with a loud warning, not
silently reshuffled.

## Considered and rejected

- **Keep five fixed menus, prune dead items.** Stable muscle memory, but menus degrade to
  empty husks per focus; an always-visible empty "Edit" is the same decorative-bar lie, smaller.
- **Fully open Region set.** Apps inventing arbitrary extension points in shared chrome is the
  fragmentation ADR-0004 exists to prevent. Parameterized instances inside an OS-owned grammar
  give apps their menus without opening the frame.
- **Frappe-native menu vocabulary (Document/Go/…).** Renaming the shared menus doesn't fix
  unbacked items, and the surveys show apps genuinely populate File/Edit/View when the items
  are real. The vocabulary problem was honesty, not naming.
- **One app-owned menu (the App menu only).** raven alone needs three. The Mac contract is the
  app owns the *middle*, not one slot.
- **Owner-only menu declaration** (a menu is valid only when its author owns the bar). Grilled and
  rejected: it blocks the core custom-app case — an app adding a *new* menu (not just items) to
  erpnext's bar. The fragmentation ADR-0004 guards against is inventing new region *types* in shared
  chrome, not one app declaring inside another's *parameterized* band; app-qualifying the Region and
  requiring a real-OS-app target keeps the grammar closed while authorship stays open (ADR-0001).
- **Menu items declared in `os/menus.json` too** (edit/remove items there, not via Actions). Rejected:
  a menu item *is* an Action; add/edit/remove/gate/layer/cross-app/catalog all already live in the
  Action pipeline (ADR-0001/0007/0014). Declaring items in `menus.json` forks that one pipeline into a
  second, weaker one — no `when`, no App<Site<User layering, no attributed removal, absent from the
  Customizations view — and duplicates a Command's placement per region. `menus.json` stays
  container-only; one-file authoring convenience, if wanted, is build-time sugar over the same two
  contribution kinds, never a second runtime model.
- **erpnext modules as first-class OS apps.** Grilled and rejected: users install, update, and
  say "open ERPNext" — twenty peer launcher entries misrepresent the machine. The intra-app
  axis is the **workspace coordinate** (ADR-0040); app menus gate on it
  (`when: { workspace: 'selling' }`) instead of splitting identity.

## Relationship to prior ADRs

- **Amends ADR-0004.** The Region set stays closed in grammar, parameterized in instances.
- **Dogfoods ADR-0001.** App menus are declared and merged as ordinary contributions.
- **Extends ADR-0014/0007.** Removal/override/patch apply unchanged inside app menus.
- **Leans on ADR-0038.** Earned rendering is only honest if eligibility can express real
  conditions — the focus tier supplies them.
- **Composes with ADR-0040.** Workspace-gated menu content within one app identity.
