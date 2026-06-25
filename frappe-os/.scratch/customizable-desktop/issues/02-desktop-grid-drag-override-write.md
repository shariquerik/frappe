# Desktop grid cells + drag-to-rearrange + User-layer override write path

Status: ✅ DONE (2026-06-25)

Triage: ready-for-agent (AFK)

Implementation note: Desktop pins carry an edge-anchored `{column, row}` cell (column 0 =
rightmost, row 0 = top), never pixels. `src/desktop/grid.ts` holds the only pixel math —
`cellToPixel` projects a cell for render, `snapToCell` is its clamped inverse, `nextFreeCell` walks
the grid deterministically (rows within a column, then next column, wrapping at desktop height),
and `layoutDesktop` assigns every server-delivered pin a concrete cell (stored cell kept;
collisions / positionless pins flow to the next free cell) so the desktop reconstitutes identically
across reload/devices. Drag reuses the existing pointer loop in `geometry.ts` via a new `iconDrag`
state (`startIconDrag` / reactive `iconDragState`): the icon follows the cursor by a live offset; on
release `resolveDrop` snaps + flows off collisions and commits via `writePlacementOverride({region:
'desktop', ref, position:cell})` — the User-layer-only write seam. A <4px press is a click (opens).
Only the dragged pin's row is written; baseline/Site rows are untouched. Review fix: `deskRef` is now
a single **reactive** desktop-size source refreshed on mount + resize (`syncDeskSize`), so render,
the drag clamp, and the drop-snap can't drift after a window resize (App.vue's parallel `desk`
reactive was removed). Tests: `grid.spec.js` (snap, round-trip, next-free-cell, collision flow,
layout) + a drag-override→read-back-through-resolver case in `placements.spec.js`. Gates green:
typecheck / 274 unit / build / Cypress 20.

## What to build

Make the resolved desktop from #01 **arrangeable**. This slice adds positioning and establishes the
frontend's **only write path — its own User-layer override rows** (ADR-0023). A user drags a desktop
icon, it snaps to a cell, and the move roams across devices because it is stored server-side.

- **Edge-anchored grid cells.** Desktop placements carry a resolution-independent
  `(column, row)` cell, **never raw pixels** — pixels break cross-device roaming and can't be
  authored for unknown screens (ADR-0023 "Grid cells, not pixels"). A drop snaps to a cell;
  collisions **flow to the next free cell deterministically**.
- **Drag writes an override.** Dragging an icon upserts a User-layer `OS Placement Override`
  position delta for the current user. This is the write half of the seam #01 only read. Reuses the
  pointer-drag machinery already used for window move/resize (`src/desktop/geometry.ts`).
- **Resolver honours overrides.** The #01 resolver already folds User overrides; this slice makes
  position overrides real, so a moved icon reconstitutes on any screen.

The override is a per-member **delta**, not a snapshot: a user's customisation never detaches them
from later admin/baseline changes (ADR-0023 "Override layer, not a frozen snapshot"). A user's drag
only ever writes their **own** row — baseline and Site rows are untouched.

## Acceptance criteria

- [x] Desktop placements carry an edge-anchored grid cell `(column, row)`; no raw pixels are
      stored.
- [x] Dragging an icon snaps it to a grid cell and upserts an `OS Placement Override` position
      delta for the current user only.
- [x] Collisions flow to the next free cell deterministically.
- [x] A moved icon's position survives reload and appears on another device (server-side roam).
- [x] Baseline / Site rows are never mutated by a user drag.
- [x] Tests cover snap-to-cell, next-free-cell flow, and override upsert → read-back through the
      resolver.

## Blocked by

- #01 (Placement seam: DocTypes + resolver + read-only desktop)
