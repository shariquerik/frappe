// The dock's pinned/transient partition + reorder (ADR-0023, slice #03) as pure functions, plus
// baseline parity through the placement seam. These cover what the DOM-free model owns: (1) the
// pinned dock placements order by their 1-D `order`; (2) running-but-unpinned apps become transient
// items, de-duped and in first-opened order, while a bare-app dock pin SUPPRESSES its app's
// transient item; (3) a reorder yields the per-pin `order` deltas the User-layer write persists;
// (4) a fresh user's dock reproduces the App-default dock baseline (whatever the server ships).
import { afterEach, describe, expect, it } from 'vitest'
import { orderedDockPins, transientAppIds, reorderDeltas, nextDockOrder, isPointOutside, insertionIndex, dockInsertPlan } from '../src/desktop/dock-model'
import { placementKey, initPlacements, usePlacements } from '../src/placements'

const dock = (ref, order) => ({ region: 'dock', ref, position: order === undefined ? null : { order } })

afterEach(() => initPlacements(null))

describe('orderedDockPins — the pinned set in its 1-D dock order', () => {
  it('sorts pinned placements by ascending position.order', () => {
    const pins = [dock({ app: 'crm' }, 2), dock({ app: 'frappe' }, 0), dock({ app: 'erpnext' }, 1)]
    expect(orderedDockPins(pins).map((p) => p.ref.app)).toEqual(['frappe', 'erpnext', 'crm'])
  })

  it('sorts missing orders last, stably, and does not mutate the input', () => {
    const pins = [dock({ app: 'crm' }), dock({ app: 'frappe' }, 0)]
    expect(orderedDockPins(pins).map((p) => p.ref.app)).toEqual(['frappe', 'crm'])
    expect(pins.map((p) => p.ref.app)).toEqual(['crm', 'frappe']) // input untouched
  })
})

describe('transientAppIds — running-but-unpinned apps', () => {
  it('keeps a running app that has no bare-app dock pin', () => {
    expect(transientAppIds([dock({ app: 'frappe' }, 0)], ['frappe', 'crm'])).toEqual(['crm'])
  })

  it('suppresses an app already covered by a bare-app dock pin', () => {
    expect(transientAppIds([dock({ app: 'crm' }, 0)], ['crm'])).toEqual([])
  })

  it('does NOT let a doctype/applet dock pin suppress its app (only a bare-app pin covers)', () => {
    // a list pin to a frappe doctype is not a bare-app pin, so a running frappe app is still transient
    expect(transientAppIds([dock({ doctype: 'ToDo', view: 'list' }, 0)], ['frappe'])).toEqual(['frappe'])
  })

  it('de-dupes an app with several open windows into one transient item, in first-opened order', () => {
    expect(transientAppIds([], ['crm', 'frappe', 'crm'])).toEqual(['crm', 'frappe'])
  })
})

describe('reorderDeltas — moving a pin writes per-pin order deltas', () => {
  const pins = [dock({ app: 'frappe' }, 0), dock({ app: 'erpnext' }, 1), dock({ app: 'crm' }, 2)]

  it('moves a pin to a new slot and emits only the order deltas that changed', () => {
    const moved = reorderDeltas(pins, placementKey(dock({ app: 'crm' })), 0)
    // crm → slot 0; frappe/erpnext shift to 1/2
    expect(moved.map((d) => [d.placement.ref.app, d.order])).toEqual([
      ['crm', 0], ['frappe', 1], ['erpnext', 2],
    ])
  })

  it('returns no deltas for an unknown pin key', () => {
    expect(reorderDeltas(pins, placementKey(dock({ app: 'unknown' })), 0)).toEqual([])
  })

  it('nextDockOrder appends past the current max order', () => {
    expect(nextDockOrder(pins)).toBe(3)
    expect(nextDockOrder([])).toBe(0)
  })
})

describe('insertionIndex — the slot a drop at `cursor` lands in', () => {
  const mids = [120, 180, 240] // three tile midpoints along the axis

  it('is 0 when the cursor is before every midpoint', () => {
    expect(insertionIndex(100, mids)).toBe(0)
  })

  it('is the middle index when the cursor sits between two midpoints', () => {
    expect(insertionIndex(150, mids)).toBe(1) // past 120, before 180
    expect(insertionIndex(200, mids)).toBe(2) // past 120/180, before 240
  })

  it('is n when the cursor is past every midpoint', () => {
    expect(insertionIndex(300, mids)).toBe(3)
  })

  it('is 0 for an empty midpoints list', () => {
    expect(insertionIndex(150, [])).toBe(0)
  })
})

describe('dockInsertPlan — inserting a new pin at an index shifts the tail', () => {
  const pins = [dock({ app: 'frappe' }, 0), dock({ app: 'erpnext' }, 1), dock({ app: 'crm' }, 2)]

  it('insert at 0 shifts everything +1 and the new pin takes order 0', () => {
    const plan = dockInsertPlan(pins, 0)
    expect(plan.newOrder).toBe(0)
    expect(plan.moved.map((d) => [d.placement.ref.app, d.order])).toEqual([
      ['frappe', 1], ['erpnext', 2], ['crm', 3],
    ])
  })

  it('insert at end adds no shifts and newOrder === length', () => {
    const plan = dockInsertPlan(pins, 3)
    expect(plan.newOrder).toBe(3)
    expect(plan.moved).toEqual([])
  })

  it('insert in the middle shifts only the tail', () => {
    const plan = dockInsertPlan(pins, 1)
    expect(plan.newOrder).toBe(1)
    expect(plan.moved.map((d) => [d.placement.ref.app, d.order])).toEqual([
      ['erpnext', 2], ['crm', 3],
    ])
  })

  it('clamps an out-of-range index to the ordered length', () => {
    const plan = dockInsertPlan(pins, 99)
    expect(plan.newOrder).toBe(3)
    expect(plan.moved).toEqual([])
  })
})

describe('isPointOutside — the drag-off-the-dock hit-test (drives drag-out-to-remove)', () => {
  const rect = { left: 100, top: 700, right: 400, bottom: 760 }

  it('is false for a point inside the rect (a release still over the dock → no remove)', () => {
    expect(isPointOutside(rect, 250, 730)).toBe(false)
  })

  it('is true for a point clearly outside the rect (dragged off → remove)', () => {
    expect(isPointOutside(rect, 250, 500)).toBe(true) // well above the dock
    expect(isPointOutside(rect, 50, 730)).toBe(true) // left of the dock
  })

  it('pad keeps a near-edge release from counting as off (accidental-remove guard)', () => {
    expect(isPointOutside(rect, 250, 780, 30)).toBe(false) // 20px below, within the 30px pad
    expect(isPointOutside(rect, 250, 800, 30)).toBe(true) // 40px below, beyond the pad
  })
})

describe('baseline parity — a fresh user reads the App-default dock baseline through the seam', () => {
  const boot = (placements) => ({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements })

  it("reads the server's resolved dock placements (no client baseline, no re-merge)", () => {
    // A fresh user (no overrides) sees exactly the dock placements the server resolved + delivered.
    initPlacements(boot([dock({ app: 'frappe' }, 0), dock({ app: 'erpnext' }, 1), { region: 'desktop', ref: { app: 'frappe' }, position: null }]))
    expect(orderedDockPins(usePlacements().dock()).map((p) => p.ref.app)).toEqual(['frappe', 'erpnext'])
  })

  it('an empty/legacy boot yields an empty dock rather than throwing (ADR-0008 tolerance)', () => {
    initPlacements(null)
    expect(usePlacements().dock()).toEqual([])
  })
})
