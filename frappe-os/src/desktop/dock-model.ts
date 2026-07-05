// The dock's pinned/transient partition (ADR-0023, slice #03) as a pure function so vitest can
// cover it without a DOM. The dock renders, in order: the resolved `dock` Placements (pinned),
// a separator, then the running-but-unpinned apps (transient — they vanish when their last
// window closes), then the launcher. This module owns ONLY the partition decision; presentation
// (label/icon) is `placementView` (placements), and the running/window state is the store's.
import { isAppRef } from '@/surface'
import { placementKey } from '@/placements'
import type { ResolvedPlacement } from '@/types'

// A pinned bare-app reference ({app}) "covers" a running app of that id, so it isn't ALSO shown
// as a transient item. A non-app dock pin (a doctype/applet pin) covers nothing — its app may
// still run transiently. The covered set is the apps already represented by a bare-app dock pin.
function pinnedAppIds(pinned: ResolvedPlacement[]): Set<string> {
  const ids = new Set<string>()
  for (const placement of pinned) {
    if (isAppRef(placement.ref) && placement.ref.app) ids.add(placement.ref.app)
  }
  return ids
}

// The pinned dock placements in render order: ascending `position.order` (the dock's 1-D position
// shape), missing orders sorted last but stably. The server delivers them resolved; this only
// orders them for the row so a reorder override (a new `order`) re-sorts without a reload.
export function orderedDockPins(dock: ResolvedPlacement[]): ResolvedPlacement[] {
  const at = (p: ResolvedPlacement) => p.position?.order ?? Number.MAX_SAFE_INTEGER
  return [...dock].sort((a, b) => at(a) - at(b))
}

// The transient app ids: running apps with at least one open window that AREN'T already covered
// by a bare-app dock pin, in their first-opened order (the order their ids appear in `openAppIds`).
// De-duped — an app with several windows is ONE transient dock item.
export function transientAppIds(dock: ResolvedPlacement[], openAppIds: string[]): string[] {
  const covered = pinnedAppIds(dock)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of openAppIds) {
    if (covered.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

// The next free dock order — appended past the current max so a fresh pin/reorder lands at the end
// rather than colliding. Used when a reorder needs a concrete target order.
export function nextDockOrder(dock: ResolvedPlacement[]): number {
  let max = -1
  for (const placement of dock) {
    const order = placement.position?.order
    if (typeof order === 'number' && order > max) max = order
  }
  return max + 1
}

// Is a client-space point clear of a rectangle by more than `pad` px on any side? The dock uses it
// to tell a pin dragged OFF the dock (→ remove it) from one released over it (→ reorder / no-op).
// Pure and DOM-free (the rect is read from the live tray in the component), so it is unit-testable.
export function isPointOutside(
  rect: { left: number; top: number; right: number; bottom: number },
  x: number, y: number, pad = 0,
): boolean {
  return x < rect.left - pad || x > rect.right + pad || y < rect.top - pad || y > rect.bottom + pad
}

// Recompute every pin's `order` for a reordered list (the dragged pin moved to `toIndex`): the
// resolved row's new positional order. Returns the (ref → order) deltas a reorder persists — one
// override per pin whose order changed — so the User layer captures the whole new arrangement.
export function reorderDeltas(
  dock: ResolvedPlacement[],
  fromKey: string,
  toIndex: number,
): { placement: ResolvedPlacement; order: number }[] {
  const ordered = orderedDockPins(dock)
  const from = ordered.findIndex((p) => placementKey(p) === fromKey)
  if (from < 0) return []
  const moved = ordered.splice(from, 1)[0]
  const clamped = Math.max(0, Math.min(toIndex, ordered.length))
  ordered.splice(clamped, 0, moved)
  const deltas: { placement: ResolvedPlacement; order: number }[] = []
  ordered.forEach((placement, index) => {
    if ((placement.position?.order ?? -1) !== index) deltas.push({ placement, order: index })
  })
  return deltas
}
