// usePlacements() — the client Placement seam (ADR-0023). The server resolves the three layers
// and delivers a flat, already-merged list in boot.placements; these tests pin that the client
// (1) reads the resolved list and partitions it per region (it never re-merges), (2) degrades to
// an empty desktop offline (no/legacy placements key), (3) projects a reference to its desktop
// presentation, and (4) resolves a reference to the Surface a click opens. The layered merge
// itself is the server's job (tested in the Python resolver suite) — never re-tested here.
import { afterEach, describe, expect, it } from 'vitest'
import { initPlacements, usePlacements, placementView, placementKey, applyLocalOverride } from '../src/placements'
import { initRegistry } from '../src/registry'
import { placementSurface, isAppRef } from '../src/surface'

const boot = (placements) =>
  ({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, placements })

const desktop = (ref, position) => ({ region: 'desktop', ref, position: position ?? null })

afterEach(() => initPlacements(null))

describe('the resolved placement list', () => {
  it('reads boot.placements and partitions by region (no client re-merge)', () => {
    initPlacements(boot([
      desktop({ app: 'frappe' }),
      { region: 'dock', ref: { app: 'crm' }, position: { order: 0 } },
    ]))
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ app: 'frappe' }])
    expect(usePlacements().dock().map((p) => p.ref)).toEqual([{ app: 'crm' }])
  })

  it('degrades to an empty desktop offline / with a legacy boot (ADR-0008 tolerance)', () => {
    initPlacements(null)
    expect(usePlacements().desktop()).toEqual([])
    initPlacements({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {} })
    expect(usePlacements().desktop()).toEqual([])
  })
})

describe('applyLocalOverride — the optimistic local patch of the write seam', () => {
  it('moves a matching pin in place (a position delta)', () => {
    initPlacements(boot([desktop({ app: 'frappe' }, { column: 0, row: 0 })]))
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, position: { column: 2, row: 1 } })
    expect(usePlacements().desktop()).toEqual([{ region: 'desktop', ref: { app: 'frappe' }, position: { column: 2, row: 1 } }])
  })

  it('drops a matching pin when hidden (tombstone)', () => {
    initPlacements(boot([desktop({ app: 'frappe' }), desktop({ app: 'erpnext' })]))
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, hidden: true })
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ app: 'erpnext' }])
  })

  it('appends an unseen reference as a brand-new pin', () => {
    initPlacements(boot([desktop({ app: 'frappe' })]))
    applyLocalOverride({ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: { column: 1, row: 0 } })
    expect(usePlacements().desktop().map((p) => p.ref)).toEqual([{ app: 'frappe' }, { doctype: 'ToDo', view: 'list' }])
  })
})

describe('placementView — a reference projected to its presentation', () => {
  it('renders an app reference as the app name + logo (from the Registry)', () => {
    initRegistry(null) // config seed → apps frappe/crm/erpnext present
    const view = placementView(desktop({ app: 'frappe' }))
    expect(view.label).toBe('Frappe')
    expect(view.logo).toContain('frappe')
  })

  it('renders a doctype reference as the doctype label + icon', () => {
    initRegistry(null)
    const view = placementView(desktop({ doctype: 'ToDo', view: 'list' }))
    expect(view.label).toBeTruthy()
    expect(view.logo).toBeUndefined() // non-app refs use an icon class, not a logo image
    expect(view.icon).toBeTruthy()
  })

  it('keys a pin by its (region, reference) identity', () => {
    expect(placementKey(desktop({ app: 'frappe' })))
      .not.toBe(placementKey({ region: 'dock', ref: { app: 'frappe' } }))
  })
})

describe('placementSurface — a reference resolved to the Surface a click opens', () => {
  it('resolves a doctype+list reference to a list surface', () => {
    initRegistry(null)
    expect(placementSurface({ doctype: 'ToDo', view: 'list' }))
      .toMatchObject({ kind: 'builtin', view: 'list', doctype: 'ToDo' })
  })

  it('resolves a dashboard reference to that app dashboard', () => {
    expect(placementSurface({ dashboard: true, app: 'crm' }))
      .toMatchObject({ kind: 'builtin', view: 'dashboard', appId: 'crm' })
  })

  it('resolves an applet reference to that applet surface', () => {
    expect(placementSurface({ applet: 'chat', app: 'raven' }))
      .toMatchObject({ kind: 'applet', appletId: 'chat', appId: 'raven' })
  })

  it('returns null for a bare-app reference (the caller opens the app instead)', () => {
    expect(placementSurface({ app: 'frappe' })).toBeNull()
    expect(isAppRef({ app: 'frappe' })).toBe(true)
    expect(isAppRef({ dashboard: true, app: 'frappe' })).toBe(false)
  })
})
