// The Finder's drag-out (ADR-0024): dragging a Location item onto the desktop creates a Placement.
// It shares the ONE pointer-drag machinery (desktop/geometry.ts `startIconDrag`) the desktop icons
// use to move — so a Finder drag-out and an icon move snap to the same grid and land deterministically
// — and the ONE write path (placements `writePlacementOverride`), the frontend's only User-layer seam.
//
// The pure decision (which cell, whether it counts as a drop) lives in geometry/grid; this module is
// the thin wiring that turns a released drag into a brand-new desktop Placement. A bare-app or
// doctype/applet reference all pin the same way — the reference is opaque to the placement write.
import { occupiedDesktopCells, startIconDrag, desktopRef } from '@/desktop/geometry'
import { writePlacementOverride } from '@/placements'
import type { FinderItem } from './locations'

// Begin dragging a Finder tile out onto the desktop. The drag starts from the tile's own on-screen
// position (so it follows the cursor from where it is), expressed in desktop-local pixels; on release
// the pointer loop snaps to a grid cell, flowing off any occupied cell, and we persist a NEW desktop
// Placement at that cell. A press that didn't move is a click (handled by the caller's @click), so we
// only write on a real move — never on a tap. Unlike a desktop-icon move, the Finder tile has no
// element on the desktop, so we hand its presentation to startIconDrag as the floating drag ghost
// (#04) — otherwise the drag would look like nothing is being held.
export function startFinderDrag(item: FinderItem, tileRect: DOMRect, e: PointerEvent): void {
  const desktop = desktopRef.el?.getBoundingClientRect()
  const ox = tileRect.left - (desktop?.left ?? 0)
  const oy = tileRect.top - (desktop?.top ?? 0)
  const occupied = occupiedDesktopCells()
  startIconDrag(`finder:${JSON.stringify(item.ref)}`, ox, oy, occupied, (cell, moved, drop) => {
    // Pin only when the tile was actually dragged AND released over the free wallpaper — a release
    // back over a window (the Finder itself, or any other) is not a desktop drop, so it creates no pin.
    if (moved && droppedOnDesktop(drop)) writePlacementOverride({ region: 'desktop', ref: item.ref, position: cell })
  }, e, { label: item.label, logo: item.logo, icon: item.icon })
}

// Did the drag release over the bare desktop? The floating ghost is click-through (pointer-events:none),
// so the element under the release point is the real drop target: every OS window carries `data-win-id`,
// so a point inside one (dropped back into the Finder) is NOT a desktop drop.
function droppedOnDesktop(drop: { x: number; y: number }): boolean {
  const el = document.elementFromPoint(drop.x, drop.y)
  return !(el as HTMLElement | null)?.closest('[data-win-id]')
}
