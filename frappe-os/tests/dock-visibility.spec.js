// Dock reveal/hide decision table: intent-based reveal at the screen edge,
// forgiving hide band, hysteresis hold in between, gesture freeze, and the two
// unconditional overrides.
import { describe, expect, it } from 'vitest'
import { shouldShowDock } from '../src/desktop/dock-visibility'

const DESK_H = 800
const base = {
  windowCount: 1,
  dockMenu: null,
  gestureActive: false,
  clientY: 400, // mid-screen
  deskH: DESK_H,
  currentlyShown: false,
}
const at = (overrides) => shouldShowDock({ ...base, ...overrides })

describe('shouldShowDock', () => {
  it('reveals on true screen-edge contact', () => {
    expect(at({ clientY: DESK_H })).toBe(true)
    expect(at({ clientY: DESK_H - 1 })).toBe(true)
  })

  it('hides when the cursor rises clear of the bottom band', () => {
    expect(at({ clientY: DESK_H - 91, currentlyShown: true })).toBe(false)
    expect(at({ clientY: 0, currentlyShown: true })).toBe(false)
  })

  it('holds current state inside the hysteresis band', () => {
    const inBand = DESK_H - 45 // between deskH-90 and deskH-1
    expect(at({ clientY: inBand, currentlyShown: true })).toBe(true)
    expect(at({ clientY: inBand, currentlyShown: false })).toBe(false)
  })

  it('freezes to current state during a drag/resize gesture', () => {
    expect(at({ gestureActive: true, clientY: DESK_H, currentlyShown: false })).toBe(false)
    expect(at({ gestureActive: true, clientY: 0, currentlyShown: true })).toBe(true)
  })

  it('always shows with no windows open, even mid-screen or mid-gesture', () => {
    expect(at({ windowCount: 0 })).toBe(true)
    expect(at({ windowCount: 0, gestureActive: true, currentlyShown: false })).toBe(true)
  })

  it('always shows while the dock menu is open, even mid-screen', () => {
    expect(at({ dockMenu: 'todo' })).toBe(true)
    expect(at({ dockMenu: 'todo', gestureActive: true, currentlyShown: false })).toBe(true)
  })
})
