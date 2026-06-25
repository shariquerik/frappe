# Finder window + Locations (Applications, Doctypes, Favorites) as Placement drag-source

Status: 📋 Ready (2026-06-25)

Triage: ready-for-agent (AFK)

## What to build

The **Finder** — the OS's cross-app navigator and the principal drag-source for Placements
(ADR-0024). It is **not** a file browser; it navigates apps and destinations, every draggable item
expressed as the ADR-0021 surface reference.

- **A `finder` builtin Surface in a singleton Window**, mirroring the **System Settings** precedent:
  a `system`-style window, respawned-from-URL, **not persisted**, deep-linkable, with the same
  hydrate/routing exclusions. `finder` joins dashboard/list/form/settings/system-settings as a
  builtin Surface kind.
- **Locations** in the sidebar (v1, minus Recents which lands in #06):
  - **Applications** — every app the viewer may see, plus a Settings entry. The launcher and the
    primary drag-source. (Subsumes the App-Launcher idea; there is no separate launcher surface.)
  - **Doctypes** — a flattened cross-app catalog that **reprojects the same registry
    `module → doctype` data** the per-app nav rail already uses (`src/registry/index.ts`) — **not a
    second store**. Deliberately overlaps the (per-app, in-window) nav rail; the Finder gives the
    global view. Drag a doctype out → a list Placement.
  - **Favorites** — a **read-only mirror/manager** of the viewer's existing desktop + dock
    Placements (see / remove what you've pinned). It is **not a third placement region**; the only
    regions remain desktop and dock, and drag-out still targets those only.
- **Repurpose the dock launcher button** (`Dock.vue`) to open the Finder; **⌘K stays** the command
  palette (the Launchpad-vs-Spotlight split).
- **One drag system.** Dragging out of a Location, like rearranging desktop/dock icons, shares the
  pointer-drag machinery (`geometry.ts`); every drop resolves to a User-layer `OS Placement
  Override` upsert via the #02 / #03 write path.

## Acceptance criteria

- [ ] A `finder` builtin Surface opens in a singleton `system`-role window (System Settings
      precedent — not persisted, respawned from URL, deep-linkable).
- [ ] Applications lists every app the viewer may see plus a Settings entry and launches them.
- [ ] Doctypes renders a cross-app catalog reprojected from the registry `module → doctype` data
      (no second store).
- [ ] Favorites read-only-mirrors the viewer's current desktop + dock Placements and can remove one
      (personal hide).
- [ ] The dock launcher button opens the Finder; ⌘K still opens the command palette.
- [ ] Dragging an item from a Location onto the desktop / dock creates a Placement (User-layer
      override upsert).
- [ ] Tests cover the singleton-window lifecycle, the Doctypes reprojection, the Favorites mirror,
      and a Location drag-out → placement.

## Blocked by

- #02 (Desktop grid + drag + override write path)
- #03 (Dock pinned/transient split)
