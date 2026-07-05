// usePlacements() — the client Placement seam (ADR-0023). The server resolves the three layers
// and delivers a flat, already-merged list in boot.placements; these tests pin that the client
// (1) reads the resolved list and partitions it per region (it never re-merges), (2) degrades to
// an empty desktop offline (no/legacy placements key), (3) projects a reference to its desktop
// presentation, and (4) resolves a reference to the Surface a click opens. The layered merge
// itself is the server's job (tested in the Python resolver suite) — never re-tested here.
import { afterEach, describe, expect, it } from 'vitest'
import { initPlacements, usePlacements, placementView, placementKey, defaultLabel, applyLocalOverride } from '../src/placements'
import { initRegistry } from '../src/registry'
import { placementSurface, isAppRef } from '../src/surface'
import { bootWith } from './fixtures/os-boot'

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

  it('sets a personal label on a matching pin (a rename) without disturbing its position', () => {
    initPlacements(boot([desktop({ app: 'frappe' }, { column: 0, row: 0 })]))
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, label: 'My Framework' })
    expect(usePlacements().desktop()[0]).toEqual({
      region: 'desktop', ref: { app: 'frappe' }, position: { column: 0, row: 0 }, label: 'My Framework',
    })
  })

  it('leaves a prior rename untouched when a later delta omits the label (a move after a rename)', () => {
    initPlacements(boot([desktop({ app: 'frappe' }, { column: 0, row: 0 })]))
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, label: 'My Framework' })
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, position: { column: 2, row: 1 } })
    const pin = usePlacements().desktop()[0]
    expect(pin.label).toBe('My Framework')
    expect(pin.position).toEqual({ column: 2, row: 1 })
  })

  it('clears a rename back to the derived name when the label is emptied', () => {
    initRegistry(null)
    initPlacements(boot([desktop({ app: 'frappe' }, { column: 0, row: 0 })]))
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, label: 'My Framework' })
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, label: '' })
    expect(placementView(usePlacements().desktop()[0]).label).toBe('Frappe')
  })

  // A drag (#02) is a position OverrideDelta funnelled through the same local-patch path. This pins
  // the write→read-back: a moved icon's new cell is visible through the resolver immediately (and so
  // survives a reload, since the server re-folds the persisted override into the next boot list).
  it('a desktop drag override reads back through the resolver as the new grid cell', () => {
    initPlacements(boot([desktop({ app: 'frappe' }, { column: 0, row: 0 }), desktop({ app: 'crm' }, { column: 0, row: 1 })]))
    applyLocalOverride({ region: 'desktop', ref: { app: 'frappe' }, position: { column: 3, row: 2 } })
    const moved = usePlacements().desktop().find((p) => p.ref.app === 'frappe')
    expect(moved.position).toEqual({ column: 3, row: 2 })
    // The OTHER pin (and its baseline cell) is untouched — a drag writes only the dragged pin's row.
    expect(usePlacements().desktop().find((p) => p.ref.app === 'crm').position).toEqual({ column: 0, row: 1 })
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

  it('overlays a personal rename on the label, keeping the reference-derived logo/icon', () => {
    initRegistry(null)
    const view = placementView({ region: 'desktop', ref: { app: 'frappe' }, label: 'My Framework' })
    expect(view.label).toBe('My Framework')
    expect(view.logo).toContain('frappe') // icon/logo stay derived — a rename changes only the name
  })

  it('defaultLabel ignores a personal rename — the reset target the rename input placeholders', () => {
    initRegistry(null)
    const renamed = { region: 'desktop', ref: { app: 'frappe' }, label: 'My Framework' }
    expect(defaultLabel(renamed)).toBe('Frappe') // the derived name, not the override
  })

  // issue #02 — new pinnable shapes. Settings shows a fixed label/glyph with no app logo (it's a
  // desktop-wide window, not an app surface); a workspace labels by its workspace name under the
  // layers glyph (NOT the app logo — every workspace of an app would otherwise look identical).
  it('renders a settings reference as "Settings" with the settings glyph and no logo', () => {
    initRegistry(null)
    const view = placementView(desktop({ app: 'frappe', view: 'settings' }))
    expect(view.label).toBe('Settings')
    expect(view.icon).toBe('lucide-settings')
    expect(view.logo).toBeUndefined()
  })

  it('renders a workspace reference by its workspace label under the layers glyph, no app logo', () => {
    initRegistry(bootWith()) // seeds crm's fcrm/fcrm_activity workspaces
    const view = placementView(desktop({ app: 'crm', workspace: 'fcrm_activity' }))
    expect(view.label).toBe('Activity') // the workspace's label, not the slug or the app name
    expect(view.icon).toBe('lucide-layers')
    expect(view.logo).toBeUndefined() // a workspace glyph, not the app logo — else all look identical
    initRegistry(null)
  })

  it('falls back to the workspace slug when the workspace is unknown', () => {
    initRegistry(bootWith())
    expect(placementView(desktop({ app: 'crm', workspace: 'ghost' })).label).toBe('ghost')
    initRegistry(null)
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
