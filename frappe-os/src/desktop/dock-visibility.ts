// Pure reveal/hide decision for the auto-hiding dock. Kept separate from the
// pointer loop in geometry.ts so the branchy, hysteretic logic is unit-testable
// (mirrors how routing/route-map.ts isolates its projection).
//
// Reveal is intent-based: the cursor must hit the true screen edge. Hide is more
// forgiving (rising clear of the band) so the dock stays reachable once shown
// — the two thresholds form the hysteresis, resolved via `currentlyShown`.
//
// The decision is edge-agnostic: the caller collapses the cursor's position to a single
// `distFromEdge` (px from the dock's own screen edge along its perpendicular axis), so the
// same logic serves a bottom, left, or right dock (ADR-0022).

export interface DockVisInput {
  windowCount: number
  menuOpen: boolean // any dock menu open (window chooser or the right-click settings menu)
  gestureActive: boolean
  autoHide: boolean
  distFromEdge: number // px from the dock's screen edge to the cursor (perpendicular axis)
  currentlyShown: boolean
}

const HIDE_BAND = 90 // px from the edge; ≈ the dock's own depth
const REVEAL_EDGE = 1 // px from the true screen edge

export function shouldShowDock(i: DockVisInput): boolean {
  if (i.windowCount === 0 || i.menuOpen) return true // unconditional overrides
  if (!i.autoHide) return true // pinned dock: always shown
  if (i.gestureActive) return i.currentlyShown // freeze during drag/resize
  if (i.distFromEdge <= REVEAL_EDGE) return true // deliberate edge push
  if (i.distFromEdge > HIDE_BAND) return false // rose clear of the band
  return i.currentlyShown // in-band: hold (hysteresis)
}
