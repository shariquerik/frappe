# The dock's edge and reveal behaviour are configurable

The dock used to be hard-wired to the bottom-center of the screen and to always auto-hide
once a window was open. Two per-user preferences now make that configurable, mirroring
macOS's "Desktop & Dock" settings:

- **`state.dockPosition`** — `'left'` (default), `'right'`, or `'bottom'`. There is
  deliberately **no `'top'`**: the menu bar owns the top edge.
- **`state.dockAutoHide`** — on by default (the original behaviour). Off **pins** the dock so
  it stays visible — **except in fullscreen**: when the active window is maximized or split
  view is on, the dock auto-hides regardless of this setting (and reveals on edge-hover),
  matching macOS, where a fullscreen Space always hides the Dock. Fullscreen windows therefore
  use the whole desktop; the dock never reserves space.

Both live on `OsState`, are set via `useOS()` actions (`setDockPosition` / `setDockAutoHide`),
and are persisted and hydrated alongside `rememberWindowSize` (ADR-0019). They are surfaced in
two places that drive the same actions:

- **System Settings ▸ Dock** — a segmented position control and an auto-hide switch. The dock
  controls live in the desktop-wide System Settings window (`SystemSettings.vue`), not under a
  per-app (CRM/ERPNext) settings pane, since they are global preferences.
- **A right-click menu on the dock** (macOS-style): *Turn Hiding On/Off*, *Position on Screen ▸
  Left / Bottom / Right* (the current edge ticked), and *Dock Settings…* (opens System Settings
  straight to its Dock pane). It reuses `OSDropdown` (frappe-ui's submenu-capable, `#os-popover-layer`-portaled
  menu) driven open in controlled mode against a 1px anchor parked at the cursor — rather than
  hand-rolling a menu or using frappe-ui's `ContextMenu`, which only portals to `body` and so
  would not stack inside the desktop's isolated z-scale.

## How

The reveal/hide decision in `desktop/dock-visibility.ts` was already isolated and pure. It is
now **edge-agnostic**: the pointer loop in `geometry.ts` collapses the cursor position to a
single `distFromEdge` (px from the dock's own screen edge along its perpendicular axis —
`clientX` for left, `deskW - clientX` for right, `deskH - clientY` for bottom), so one
hysteresis table serves all three edges. `shouldShowDock` gained one override: with
`autoHide` off it returns `true` unconditionally (after the existing empty-desktop / open-menu
overrides). The hide transform is chosen per edge — `translateX(±155%)` for a vertical dock,
`translateY(155%)` for the bottom — applied to the inner tray while the outer wrapper keeps
owning the centering transform.

`Dock.vue` derives its whole layout from `state.dockPosition`: the wrapper anchor, the flex
axis (row for bottom, column for left/right), the hover-lift direction, the running-dot
placement (outer edge), the window-chooser popover side, and the divider orientation. The
adapt-behind tray detection generalised from a bottom band to a `dockBand(dw, dh)` rectangle
keyed off the edge, so the opaque tray still fades in only when a window actually sits under
the dock wherever it is.

## Why

Dock position and persistence are the two dock preferences real desktop users expect, and the
visibility logic was already factored to absorb them cheaply. Excluding `'top'` keeps the
single shared top edge unambiguous (menu bar). Collapsing position to `distFromEdge` keeps the
unit-tested decision table small and edge-independent rather than branching it three ways.

## Relationship to prior ADRs

- **Mirrors ADR-0018 / ADR-0019's preference pattern.** `dockPosition` / `dockAutoHide` are
  per-user fields on `OsState`, set via `useOS()` actions, persisted/hydrated the same way as
  `rowOpenTarget` and `rememberWindowSize` — but surfaced in the desktop-wide System Settings
  window (being global prefs) rather than the per-app Settings ▸ General section.
- **Independent of the Surface model (ADR-0012).** The dock reflects windows but the
  preference acts only on the dock's own placement and reveal, touching no Surface or geometry
  state.
