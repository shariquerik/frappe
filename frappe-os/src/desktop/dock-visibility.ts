// Pure reveal/hide decision for the auto-hiding dock. Kept separate from the
// pointer loop in geometry.ts so the branchy, hysteretic logic is unit-testable
// (mirrors how routing/route-map.ts isolates its projection).
//
// Reveal is intent-based: the cursor must hit the true screen edge. Hide is more
// forgiving (rising above the bottom band) so the dock stays reachable once shown
// — the two thresholds form the hysteresis, resolved via `currentlyShown`.

export interface DockVisInput {
  windowCount: number
  dockMenu: string | null
  gestureActive: boolean
  clientY: number
  deskH: number
  currentlyShown: boolean
}

const HIDE_BAND = 90 // px from the bottom; ≈ the dock's own height
const REVEAL_EDGE = 1 // px from the true screen edge

export function shouldShowDock(i: DockVisInput): boolean {
  if (i.windowCount === 0 || i.dockMenu) return true // unconditional overrides
  if (i.gestureActive) return i.currentlyShown // freeze during drag/resize
  if (i.clientY >= i.deskH - REVEAL_EDGE) return true // deliberate edge push
  if (i.clientY < i.deskH - HIDE_BAND) return false // rose clear of the band
  return i.currentlyShown // in-band: hold (hysteresis)
}
