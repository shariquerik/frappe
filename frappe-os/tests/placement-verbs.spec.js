// The "Add to / Remove from Desktop / Dock" verbs (issue #04, ADR-0023): first-party Commands
// surfaced through the Action machinery (ADR-0001), pinning whatever the active window shows. These
// specs pin the seam: surface→reference mapping, that Add upserts a User-layer pin for the active
// surface, that Remove appears only on an already-pinned surface, and that Remove clears an OWN pin
// but tombstones (hides) an INHERITED one — never a destructive delete on a shared layer. The store
// writes (callPost) are mocked away; the optimistic local list is the observable contract here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The override seam persists through callPost — mock it so a verb's optimistic local patch is what
// these specs observe (the server resolver is the Python suite's job, never re-tested here).
vi.mock('../src/data/api', () => ({ callPost: vi.fn(() => Promise.resolve()) }))
import { callPost } from '../src/data/api'

import {
  surfaceToRef, liveVerb, suppressedPlacementCommands, PLACEMENT_COMMANDS,
} from '../src/actions/placement-verbs'
import { invoke } from '../src/actions/contributions'
import { menuOptions } from '../src/actions/menubar'
import { WINDOW_REGION } from '../src/actions/regions'
import { initPlacements, usePlacements } from '../src/placements'
import { listSurface, dashboardSurface, appletSurface, formSurface, appSettingsSurface } from '../src/surface'
import { initRegistry } from '../src/registry'
import { bootWith } from './fixtures/os-boot'
import { useOS } from '../src/desktop/index'

const os = useOS()
const boot = (placements) => ({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements })

beforeEach(() => {
  os.state.windows = []
  os.state.geo = {}
  os.state.activeId = null
  os.state.paletteOpen = false
  initPlacements(boot([]))
  initRegistry(bootWith()) // fixture seeds apps + ownership (CRM Lead→crm) — AppDef.modules retired
  callPost.mockClear()
})
afterEach(() => { initPlacements(null); initRegistry(null) })

// surfaceToRef: a window's Surface → the pinnable reference (ADR-0021), round-tripping the shapes
// placementSurface resolves back. A form/settings surface (no placement shape) pins the bare app.
describe('surfaceToRef (the active surface → its pinnable reference)', () => {
  it('maps a list surface to its doctype-list reference', () => {
    expect(surfaceToRef(listSurface('ToDo'))).toEqual({ doctype: 'ToDo', view: 'list' })
  })
  it('maps a dashboard surface to its dashboard reference', () => {
    expect(surfaceToRef(dashboardSurface('crm'))).toEqual({ app: 'crm', dashboard: true })
  })
  it('maps an applet surface to its applet reference', () => {
    expect(surfaceToRef(appletSurface('frappe', 'my-todos'))).toEqual({ app: 'frappe', applet: 'my-todos' })
  })
  it('maps a saved form to its record reference (issue #02 — a record pins itself)', () => {
    expect(surfaceToRef(formSurface('CRM Lead', 'L-1'))).toEqual({ doctype: 'CRM Lead', view: 'form', name: 'L-1' })
  })
  it('falls back to the bare app for an UNSAVED (new) form — no record to pin yet', () => {
    expect(surfaceToRef(formSurface('CRM Lead', 'new'))).toEqual({ app: 'crm' })
  })
  it('falls back to the bare app for a settings surface', () => {
    expect(surfaceToRef(appSettingsSurface('crm'))).toEqual({ app: 'crm' })
  })
})

// activeRef isn't exported, so its workspace-vs-app decision is pinned through the observable verb:
// "Add to Desktop" on a workbench window pins that WORKSPACE (its window identity), not the app default.
describe('a workbench window pins its workspace (issue #02)', () => {
  it('Add to Desktop on a workbench upserts an {app, workspace} pin', () => {
    os.openWorkspace('crm', 'fcrm_activity')
    invoke(PLACEMENT_COMMANDS.find((c) => c.id === 'frappe.placement.add-desktop'), os)
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ app: 'crm', workspace: 'fcrm_activity' }])
  })

  it('an open saved record pins the record even from an app window', () => {
    os.openRecordGlobal('CRM Lead', 'L-9')
    invoke(PLACEMENT_COMMANDS.find((c) => c.id === 'frappe.placement.add-desktop'), os)
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ doctype: 'CRM Lead', view: 'form', name: 'L-9' }])
  })
})

// Add → a resolved User-layer placement for the active surface's reference, read straight back
// through usePlacements (the optimistic local patch; the persisted upsert is fired-and-forgotten).
describe('Add to Desktop / Add to Dock → a resolved placement for the active surface', () => {
  const run = (id) => invoke(PLACEMENT_COMMANDS.find((c) => c.id === id), os)

  it('Add to Desktop upserts a desktop pin for the active list surface, into a grid cell', () => {
    os.openListGlobal('ToDo')
    run('frappe.placement.add-desktop')
    const pins = usePlacements().desktop()
    expect(pins.map((p) => p.ref)).toEqual([{ doctype: 'ToDo', view: 'list' }])
    expect(pins[0].position).toMatchObject({ column: expect.any(Number), row: expect.any(Number) })
  })

  it('Add to Dock upserts a dock pin appended at the next order', () => {
    initPlacements(boot([{ region: 'dock', ref: { app: 'crm' }, position: { order: 0 } }]))
    os.openListGlobal('ToDo')
    run('frappe.placement.add-dock')
    const pin = usePlacements().dock().find((p) => p.ref.doctype === 'ToDo')
    expect(pin).toBeTruthy()
    expect(pin.position.order).toBe(1) // past the existing max
  })

  it('persists the Add as a User-layer override upsert (the only write path)', () => {
    os.openListGlobal('ToDo')
    run('frappe.placement.add-desktop')
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.placements.save_placement_override', expect.objectContaining({ region: 'desktop' }))
  })

  it('does nothing on a bare desktop (no active surface → nothing to pin)', () => {
    invoke(PLACEMENT_COMMANDS.find((c) => c.id === 'frappe.placement.add-desktop'), os)
    expect(usePlacements().desktop()).toEqual([])
  })
})

// Remove-own-pin: a pin the user created (no `inherited` flag) is their OWN row, so Remove DELETES the
// override row (delete_placement_override) — not a hide. The pin vanishes locally either way.
describe('Remove clears the user\'s OWN pin (a row delete, not a hide)', () => {
  it('Remove from Desktop deletes the own override row for an Add-ed pin', () => {
    initPlacements(boot([{ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 0, row: 0 } }]))
    os.openListGlobal('ToDo')
    invoke(PLACEMENT_COMMANDS.find((c) => c.id === 'frappe.placement.remove-desktop'), os)
    expect(usePlacements().desktop()).toEqual([])
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.placements.delete_placement_override', expect.objectContaining({ region: 'desktop' }))
  })
})

// Hide-inherited-pin: a baseline/Site pin (server-stamped `inherited`) is suppressed by a `hidden`
// TOMBSTONE delta, not a delete. It vanishes for THIS user; the shared row is never touched (ADR-0023
// "removing an inherited pin is a non-destructive personal hide"). Layer — NOT position — decides:
// the baseline ships positions too, so a positionless test would mask the real own-vs-inherited rule.
describe('Remove tombstones an INHERITED pin (a personal hide, never a delete)', () => {
  it('Remove from Dock writes a hidden tombstone for an inherited pin', () => {
    // crm lands on its dashboard, so the active surface's reference is {app:'crm',dashboard:true}.
    initPlacements(boot([{ region: 'dock', ref: { app: 'crm', dashboard: true }, position: { order: 0 }, inherited: true }]))
    os.openApp('crm')
    invoke(PLACEMENT_COMMANDS.find((c) => c.id === 'frappe.placement.remove-dock'), os)
    expect(usePlacements().dock()).toEqual([])
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.placements.save_placement_override', expect.objectContaining({ region: 'dock', hidden: 1 }))
    expect(callPost).not.toHaveBeenCalledWith('frappe.os_core.placements.delete_placement_override', expect.anything())
  })

  it('an inherited pin the user MOVED (carries a position) still tombstones, never deletes', () => {
    // Regression: keying on position misclassified this as an own pin and silently failed to hide it
    // (delete_placement_override no-ops server-side). The `inherited` flag is authoritative.
    initPlacements(boot([{ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 2, row: 1 }, inherited: true }]))
    os.openListGlobal('ToDo')
    invoke(PLACEMENT_COMMANDS.find((c) => c.id === 'frappe.placement.remove-desktop'), os)
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.placements.save_placement_override', expect.objectContaining({ region: 'desktop', hidden: 1 }))
    expect(callPost).not.toHaveBeenCalledWith('frappe.os_core.placements.delete_placement_override', expect.anything())
  })
})

// The verbs pin a destination, so OS chrome windows (the Finder / Settings — windowRole !==
// 'app') offer nothing: all four are suppressed rather than pinning the bare framework app.
describe('a non-app (system/chrome) window suppresses every placement verb', () => {
  it('focusing the Finder drops all four verbs (no bare-app pin)', () => {
    os.openFinder()
    expect(os.state.activeId).toBe('finder')
    const dead = suppressedPlacementCommands(os)
    expect(dead.size).toBe(PLACEMENT_COMMANDS.length)
    expect(menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).map((i) => i.label))
      .not.toContain('Add to Desktop')
  })
})

// The inverse verb is keyed on (region, surface-reference): Remove shows only when the active surface
// is already pinned there; otherwise Add shows. liveVerb is the projector's pin-state decision.
describe('liveVerb / suppressed half — the inverse appears only when already pinned', () => {
  it('an UNPINNED surface offers Add, suppressing Remove', () => {
    os.openListGlobal('ToDo')
    expect(liveVerb(os, 'desktop')).toBe('frappe.placement.add-desktop')
    const dead = suppressedPlacementCommands(os)
    expect(dead.has('frappe.placement.remove-desktop')).toBe(true)
    expect(dead.has('frappe.placement.add-desktop')).toBe(false)
  })

  it('a PINNED surface offers Remove, suppressing Add (identity match on region + reference)', () => {
    initPlacements(boot([{ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 0, row: 0 } }]))
    os.openListGlobal('ToDo')
    expect(liveVerb(os, 'desktop')).toBe('frappe.placement.remove-desktop')
    expect(suppressedPlacementCommands(os).has('frappe.placement.add-desktop')).toBe(true)
  })

  it('the active surface, not some other pin, decides the inverse (keyed on its own reference)', () => {
    initPlacements(boot([{ region: 'dock', ref: { app: 'erpnext' }, position: { order: 0 } }]))
    os.openApp('crm') // a DIFFERENT app is pinned → crm is not, so Add stays live
    expect(liveVerb(os, 'dock')).toBe('frappe.placement.add-dock')
  })
})

// End-to-end through the Window-menu projection (the seam MenuBar.vue renders): the live verbs show
// as resolved Action items, the dead half is filtered, and clicking actually mutates the placement list.
describe('the Window menu surfaces the pin verbs as resolved Actions', () => {
  const labels = () => menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).map((i) => i.label)

  it('an unpinned surface shows Add to Desktop + Add to Dock, not the Remove inverses', () => {
    os.openListGlobal('ToDo')
    expect(labels()).toContain('Add to Desktop')
    expect(labels()).toContain('Add to Dock')
    expect(labels()).not.toContain('Remove from Desktop')
  })

  it('clicking Add to Desktop pins the active surface through the resolver', () => {
    os.openListGlobal('ToDo')
    menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'Add to Desktop').onClick()
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ doctype: 'ToDo', view: 'list' }])
  })

  it('once pinned, the menu swaps Add to Desktop for Remove from Desktop', () => {
    initPlacements(boot([{ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 0, row: 0 } }]))
    os.openListGlobal('ToDo')
    expect(labels()).toContain('Remove from Desktop')
    expect(labels()).not.toContain('Add to Desktop')
  })
})
