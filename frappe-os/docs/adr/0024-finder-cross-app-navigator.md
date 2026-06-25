# The Finder: a cross-app navigator window, and the drag-source for Placements

> **Status:** Proposed (2026-06-25). Grilled, not implemented. Pairs with ADR-0023 (Placements):
> the Finder is where a user launches apps and **drags destinations out** onto the desktop/dock.

The dock's launcher button no longer opens the command palette. It opens the **Finder** — the
OS's **cross-app navigator**: a `system`-style singleton **Window** (like System Settings:
respawned-from-URL, not persisted, deep-linkable) hosting a new builtin `finder` Surface, whose
sidebar holds **Locations**. It is the one place to launch any app and to drag a destination onto
the desktop or dock, creating a **Placement** (ADR-0023).

Despite the macOS name, it is **not a file browser** — Frappe OS has no files. It navigates apps
and destinations, and every draggable item is expressed as the same app-qualified, permission-gated
**surface reference** used by Default surface (ADR-0021) and Placements (ADR-0023).

## Locations (the v1 sidebar)

- **Applications** — every app the viewer may see, plus a Settings entry. The launcher and the
  primary drag-source. (Subsumes the "App Launcher" idea — there is no separate launcher surface.)
- **Doctypes** — a cross-app catalog of doctypes. A **flattened projection of the same registry
  `module → doctype` data the per-app nav rail already uses** (`registry/index.ts`), not a second
  store. Deliberately overlaps the nav rail (which is *per-app, inside a window*); the Finder gives
  the *global, cross-app* view. Drag a doctype out → a list Placement.
- **Recents** — a per-user, time-ordered log of recently opened **surface references**, capped and
  de-duped by reference (newest wins). **OS-tracked** (see below). Drag a recent out → a form/list
  Placement.
- **Favorites** — a read-only **mirror/manager** of the viewer's existing desktop+dock Placements
  (see/remove what you've pinned). It is **not a third placement region** — the only placement
  regions remain desktop and dock. Drag-out still targets desktop/dock only.

## Recents is OS-tracked, not projected from Frappe

A "recent" is a **surface reference + timestamp**. The OS writes one whenever a record is opened,
into a per-user, server-side, capped, time-ordered log that **roams** like Placements. We chose
OS-tracked over projecting Frappe's existing navigation history because the OS owns the definition
of "recent" (which surfaces count, how they dedup/cap) rather than inheriting Desk's route log.

Resolved shape for v1:

- **What counts: record opens only** — the honest "recent *documents*" analog. Lists and apps are
  reachable via the Doctypes and Applications Locations, so they don't pollute Recents. Widening to
  lists/apps later is additive.
- **Storage: an `OS Recent` DocType, one row per open**, owner-scoped, **de-duped by surface
  reference** (a re-open updates the existing row's timestamp), **trimmed to ~50** newest. Mirrors
  the row-per-placement choice (ADR-0023) — no whole-blob rewrite per open.
- **Write seam: client-side on form-surface open** (`openRecordGlobal` / `openRecordInline`),
  debounced; the server trims. Reuses the surface-reference vocabulary — no new client concept.

The cost is a new subsystem (a write-on-open path + a per-user store + a trim policy). Accepted
deliberately for definitional control; the dashboard's existing "recents" is unrelated — it is
"newest records of one configured `recentDoctype`," not a per-user open-history, and stays as-is.

## Why a Window, not an overlay; why a Finder, not a focused App Launcher

- **Window, not overlay.** An overlay was considered (sibling to the Command Palette) and rejected
  once it became an OS-owned navigator with persistent Locations and deep-linking. A normal
  (non-full-screen) window leaves the desktop/dock exposed, so dragging a tile *out* onto them
  works — exactly the macOS "drag from Finder's Applications" gesture. Reuses the System Settings
  window precedent (singleton, `system` role, respawned-from-URL, excluded from persistence).
- **Finder, not a focused App Launcher.** A single-purpose app-grid (the recommended option) was
  rejected in favour of the multi-Location Finder by explicit choice. The collisions that argued
  against it are handled rather than ignored: Doctypes *reprojects* the nav rail's data (no second
  store), Favorites *mirrors* Placements (no third region), Recents is the only genuinely new store.

## Consequences

- **Launcher button is repurposed.** It opens the Finder; the command palette is now reached only
  by ⌘K. Finder = launch/browse, palette = command search (the macOS Launchpad-vs-Spotlight split).
- **New builtin Surface kind `finder`** joins dashboard/list/form/settings/system-settings. Its
  window is a singleton like system-settings — same hydrate/routing exclusions.
- **One drag system.** Dragging out of any Location, and rearranging desktop/dock icons, share the
  pointer-drag machinery already used for window move/resize (`geometry.ts`); every drop resolves
  to a User-layer `OS Placement Override` upsert (ADR-0023).

## Open questions (deferred)

- **Settings entry semantics** in Applications — opens System Settings vs. a settings Location —
  left to implementation; either is additive.

## Relationship to prior ADRs

- **Pairs with ADR-0023.** The Finder is the principal drag-source; every drag-out creates a
  Placement via the User-layer override write path. Favorites mirrors that same Placement set.
- **Reuses ADR-0021's surface reference** for every draggable item and every Recents entry.
- **Reuses the System Settings window pattern** (singleton `system`-role window, respawned from
  URL, not persisted) rather than inventing a new window kind.
