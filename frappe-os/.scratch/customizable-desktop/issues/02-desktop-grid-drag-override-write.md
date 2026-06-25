# Desktop grid cells + drag-to-rearrange + User-layer override write path

Status: 📋 Ready (2026-06-25)

Triage: ready-for-agent (AFK)

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

- [ ] Desktop placements carry an edge-anchored grid cell `(column, row)`; no raw pixels are
      stored.
- [ ] Dragging an icon snaps it to a grid cell and upserts an `OS Placement Override` position
      delta for the current user only.
- [ ] Collisions flow to the next free cell deterministically.
- [ ] A moved icon's position survives reload and appears on another device (server-side roam).
- [ ] Baseline / Site rows are never mutated by a user drag.
- [ ] Tests cover snap-to-cell, next-free-cell flow, and override upsert → read-back through the
      resolver.

## Blocked by

- #01 (Placement seam: DocTypes + resolver + read-only desktop)
