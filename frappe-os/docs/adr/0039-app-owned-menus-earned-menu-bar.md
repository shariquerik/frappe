# The menu bar is earned: app-declared menus, no unbacked items

> **Status:** Accepted (2026-07-04, grilled). Not yet implemented. Amends ADR-0004 (Region set
> grows a parameterized form) and the first-party menu contributions of ADR-0001. Grounded in
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

ADR-0004's closed Region set gains one parameterized form: **`menubar:app:<menuId>`**. An app
declares its menus as manifest data — `{ id, title, order }` — and places Actions into them
through the identical pipeline (identity, layers, patches, removals all apply; the
Customizations view catalogs them). The surveys demand plural menus per app: raven needs
Format / Message / Channel, crm needs Record / Communicate, erpnext's Selling needs Create /
Reports. An app-declared menu renders only while that app is focused (its Scope binding gives
this for free) and is still subject to Rule 1.

What stays closed: the *grammar*. An app declares menus only in its own `menubar:app:` space —
it cannot invent regions in the OS frame or in another app's chrome.

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
