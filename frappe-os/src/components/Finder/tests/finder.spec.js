// The Finder (ADR-0024): the OS's cross-app navigator + the principal drag-source for Placements.
// These specs pin (1) the singleton system-role window lifecycle (open focuses-or-spawns, retargets
// its Location, closes, and is excluded from persistence like Settings), (2) the Doctypes
// Location REPROJECTS the registry module→doctype catalog (no second store, de-duped), (3) Favorites
// MIRRORS the viewer's resolved desktop+dock Placements, and (4) a Location drag-out resolves to a
// User-layer desktop Placement override through the one write path. The layered placement merge and
// the URL bridge are tested elsewhere (placements.spec / route-map.spec) — not re-tested here.
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { useOS } from '@/desktop/index'
import { windowRole, placementSurface } from '@/surface'
import { serialize } from '@/desktop/persistence'
import { initRegistry } from '@/registry'
import { initPlacements, usePlacements, applyLocalOverride } from '@/placements'
import { initRecents } from '@/recents'
import { bootWith } from '../../../../tests/fixtures/os-boot'
import { applicationItems, doctypeItems, workspaceItems, favoritePlacements, itemsFor } from '../locations'

const os = useOS()

function reset() {
  os.state.windows = []
  os.state.geo = {}
  os.state.activeId = null
  os.state.split = null
  localStorage.clear()
  initRegistry(bootWith()) // fixture seeds apps + workspace doctypes (ADR-0042; AppDef.modules retired)
  initPlacements(null)
  initRecents(null)
}
beforeEach(reset)
afterEach(() => {
  initPlacements(null)
  initRecents(null)
})

describe('the Finder singleton system-role window (Settings precedent)', () => {
  it('opens a single system-role window and focuses it', () => {
    os.openFinder()
    expect(os.state.windows.map((w) => w.id)).toEqual(['finder'])
    expect(os.state.activeId).toBe('finder')
    expect(windowRole('finder')).toBe('system')
  })

  it('a second open focuses the existing window — never a duplicate (singleton)', () => {
    os.openFinder()
    os.openApp('crm') // steal focus
    os.openFinder('Doctypes') // re-open, retargeting the Location
    expect(os.state.windows.filter((w) => w.id === 'finder')).toHaveLength(1)
    expect(os.state.activeId).toBe('finder')
    expect(os.state.windows.find((w) => w.id === 'finder').surface.params.location).toBe('Doctypes')
  })

  it('setFinderLocation retargets the open window without spawning another', () => {
    os.openFinder('Applications')
    os.setFinderLocation('Favorites')
    expect(os.state.windows.find((w) => w.id === 'finder').surface.params.location).toBe('Favorites')
  })

  it('closeFinder removes the window', () => {
    os.openFinder()
    os.closeFinder()
    expect(os.state.windows.find((w) => w.id === 'finder')).toBeUndefined()
  })

  it('is excluded from persistence — a refresh never restores the Finder (transient)', () => {
    os.openApp('frappe')
    os.openFinder()
    const ids = serialize().windows.map((w) => w.id)
    expect(ids).toContain('app:frappe')
    expect(ids).not.toContain('finder')
  })
})

describe('Applications Location', () => {
  it('lists every app the viewer may see as a bare-app reference', () => {
    const apps = applicationItems()
    expect(apps.map((a) => a.ref)).toEqual([{ app: 'frappe' }, { app: 'crm' }, { app: 'erpnext' }])
    // A bare-app tile renders as the app's branded label/logo (reused placementView).
    expect(apps[0].label).toBe('Frappe')
    expect(apps[0].logo).toBeTruthy()
  })

  it('itemsFor returns the same set as applicationItems', () => {
    expect(itemsFor('Applications').map((a) => a.ref)).toEqual(applicationItems().map((a) => a.ref))
  })
})

describe('Doctypes Location — reprojects the boot workspace doctype catalog', () => {
  it('flattens every workspace doctype into a de-duped list of list references', () => {
    const items = doctypeItems()
    const doctypes = items.map((i) => i.ref.doctype)
    // Drawn from boot workspace data (ADR-0042), cross-app and flattened.
    expect(doctypes).toContain('ToDo') // frappe/core
    expect(doctypes).toContain('CRM Lead') // crm/fcrm
    expect(doctypes).toContain('Sales Invoice') // erpnext/selling
    // Every tile is a list reference (drag one out → a list Placement).
    expect(items.every((i) => i.ref.view === 'list')).toBe(true)
    // De-duped: no doctype appears twice even if several workspaces list it.
    expect(new Set(doctypes).size).toBe(doctypes.length)
  })
})

describe('Workspaces Location — reprojects each app\'s boot workspace catalog', () => {
  it('lists every app\'s workspaces as {app, workspace} references, app order then workspace order', () => {
    const items = workspaceItems()
    // Drawn from boot workspace data (ADR-0042), flattened across apps in registry order.
    expect(items.map((i) => i.ref)).toEqual([
      { app: 'frappe', workspace: 'core' }, { app: 'frappe', workspace: 'website' },
      { app: 'crm', workspace: 'fcrm' }, { app: 'crm', workspace: 'fcrm_activity' },
      { app: 'erpnext', workspace: 'selling' }, { app: 'erpnext', workspace: 'stock' },
    ])
    // A workspace tile labels by its workspace label (reused placementView, issue #02).
    expect(items[0].label).toBe('Core')
    expect(items.find((i) => i.ref.workspace === 'fcrm').label).toBe('CRM')
  })

  it('itemsFor returns the same set as workspaceItems', () => {
    expect(itemsFor('Workspaces').map((i) => i.ref)).toEqual(workspaceItems().map((i) => i.ref))
  })

  it('a dragged workspace reference reads back as a new desktop workspace Placement', () => {
    initPlacements({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements: [] })
    applyLocalOverride({ region: 'desktop', ref: { app: 'erpnext', workspace: 'selling' }, position: { column: 0, row: 0 } })
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ app: 'erpnext', workspace: 'selling' }])
  })
})

describe('Favorites Location — mirrors the viewer\'s resolved desktop + dock Placements', () => {
  it('reflects the live resolved placement list (desktop then dock), read-only', () => {
    initPlacements({
      user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {},
      placements: [
        { region: 'desktop', ref: { app: 'frappe' }, position: null },
        { region: 'dock', ref: { app: 'crm' }, position: { order: 0 } },
      ],
    })
    expect(favoritePlacements().map((p) => [p.region, p.ref])).toEqual([
      ['desktop', { app: 'frappe' }],
      ['dock', { app: 'crm' }],
    ])
  })

  it('reflects a pin added through the write path without a reload (live mirror)', () => {
    initPlacements({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements: [] })
    expect(favoritePlacements()).toEqual([])
    applyLocalOverride({ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 0, row: 0 } })
    expect(favoritePlacements().map((p) => p.ref)).toEqual([{ doctype: 'ToDo', view: 'list' }])
  })
})

describe('a Location drag-out → a desktop Placement (the User-layer write path)', () => {
  // The drag-out wiring (drag.ts) snaps the released pointer to a grid cell, then upserts a desktop
  // Placement override for the dragged reference. Here we drive the seam it funnels through (a brand-
  // new desktop override at a cell) and read it back through the resolver — the same contract App.vue
  // uses for an icon move. The pointer-snap math itself is covered in grid.spec.
  it('a dragged doctype reference reads back as a new desktop list Placement', () => {
    initPlacements({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements: [] })
    applyLocalOverride({ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 1, row: 0 } })
    const pin = usePlacements().desktop().find((p) => p.ref.doctype === 'ToDo')
    expect(pin).toBeTruthy()
    expect(pin.position).toEqual({ column: 1, row: 0 })
  })

  it('a dragged app reference reads back as a new desktop app Placement', () => {
    initPlacements({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements: [] })
    applyLocalOverride({ region: 'desktop', ref: { app: 'crm' }, position: { column: 0, row: 0 } })
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ app: 'crm' }])
  })
})

describe('Recents Location (ADR-0024) — renders the resolved log, drags out a form Placement', () => {
  const formRef = (name) => ({ doctype: 'ToDo', name, view: 'form' })

  it('itemsFor projects the recents store newest-first, each tile labeled by its record name', () => {
    initRecents({
      user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {},
      recents: [{ ref: formRef('task-1') }, { ref: formRef('task-2') }],
    })
    const items = itemsFor('Recents')
    expect(items.map((i) => i.ref)).toEqual([formRef('task-1'), formRef('task-2')])
    expect(items[0].label).toBe('task-1') // a form reference labels by its record name, not the doctype
  })

  it('a recent dragged out reads back as a form Placement that resolves to the record', () => {
    initPlacements({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements: [] })
    applyLocalOverride({ region: 'desktop', ref: formRef('task-1'), position: { column: 0, row: 0 } })
    const pin = usePlacements().desktop().find((p) => p.ref.name === 'task-1')
    expect(pin).toBeTruthy()
    expect(placementSurface(pin.ref)).toMatchObject({ kind: 'builtin', view: 'form', doctype: 'ToDo', recordName: 'task-1' })
  })
})
