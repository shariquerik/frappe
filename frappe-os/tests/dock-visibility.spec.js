// Dock reveal/hide decision table: intent-based reveal at the screen edge,
// forgiving hide band, hysteresis hold in between, gesture freeze, and the
// unconditional overrides. Position is collapsed to `distFromEdge` by the caller,
// so the same table covers a bottom/left/right dock (ADR-0022).
import { describe, expect, it } from 'vitest'
import { shouldShowDock } from '../src/desktop/dock-visibility'

const base = {
  windowCount: 1,
  menuOpen: false,
  gestureActive: false,
  autoHide: true,
  distFromEdge: 400, // far from the edge
  currentlyShown: false,
}
const at = (overrides) => shouldShowDock({ ...base, ...overrides })

describe('shouldShowDock', () => {
  it('reveals on true screen-edge contact', () => {
    expect(at({ distFromEdge: 0 })).toBe(true)
    expect(at({ distFromEdge: 1 })).toBe(true)
  })

  it('hides when the cursor rises clear of the band', () => {
    expect(at({ distFromEdge: 91, currentlyShown: true })).toBe(false)
    expect(at({ distFromEdge: 800, currentlyShown: true })).toBe(false)
  })

  it('holds current state inside the hysteresis band', () => {
    const inBand = 45 // between REVEAL_EDGE (1) and HIDE_BAND (90)
    expect(at({ distFromEdge: inBand, currentlyShown: true })).toBe(true)
    expect(at({ distFromEdge: inBand, currentlyShown: false })).toBe(false)
  })

  it('stays pinned when auto-hide is off, even far from the edge', () => {
    expect(at({ autoHide: false, distFromEdge: 800, currentlyShown: false })).toBe(true)
    expect(at({ autoHide: false, distFromEdge: 800, gestureActive: true })).toBe(true)
  })

  it('freezes to current state during a drag/resize gesture', () => {
    expect(at({ gestureActive: true, distFromEdge: 0, currentlyShown: false })).toBe(false)
    expect(at({ gestureActive: true, distFromEdge: 800, currentlyShown: true })).toBe(true)
  })

  it('always shows with no windows open, even mid-screen or mid-gesture', () => {
    expect(at({ windowCount: 0 })).toBe(true)
    expect(at({ windowCount: 0, gestureActive: true, currentlyShown: false })).toBe(true)
  })

  it('always shows while a dock menu is open, even mid-screen', () => {
    expect(at({ menuOpen: true })).toBe(true)
    expect(at({ menuOpen: true, gestureActive: true, currentlyShown: false })).toBe(true)
  })
})
