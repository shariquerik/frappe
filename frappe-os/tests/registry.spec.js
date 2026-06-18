// useRegistry() — the client-side Registry seam (store/registry.ts), the single
// projection layer over curated config. These tests pin the projections every generic
// renderer + os-api read: the ordered app collection, doctype→app ownership, the merged
// display-config singleton, the views collection, and the per-app dashboard-card
// collection. Backed by the real curated config (frappe/crm/erpnext) — no mocks.
import { afterEach, describe, expect, it } from 'vitest'
import {
  useRegistry, appForDoctype, getMeta, initRegistry, knownApplet, listApplets,
} from '../src/store/registry'

describe('apps', () => {
  it('returns the installed apps in registry order', () => {
    expect(useRegistry().apps().map((a) => a.id)).toEqual(['frappe', 'crm', 'erpnext'])
  })

  it('app(id) looks up one app, undefined for unknown', () => {
    expect(useRegistry().app('crm')?.name).toBe('CRM')
    expect(useRegistry().app('nope')).toBeUndefined()
  })
})

describe('appForDoctype', () => {
  it('resolves a doctype to the first app whose modules list it', () => {
    expect(appForDoctype('CRM Lead')).toBe('crm')
    expect(appForDoctype('Sales Invoice')).toBe('erpnext')
    expect(appForDoctype('User')).toBe('frappe')
  })

  it('falls back to frappe for an unowned doctype', () => {
    expect(appForDoctype('No Such Doctype')).toBe('frappe')
  })
})

describe('displayConfig', () => {
  it('returns the merged display singleton, null for unknown', () => {
    expect(useRegistry().displayConfig('User')).toBe(getMeta('User'))
    expect(useRegistry().displayConfig('User')?.label).toBe('User')
    expect(useRegistry().displayConfig('No Such Doctype')).toBeNull()
  })
})

describe('views', () => {
  it('projects the builtin list+form collection for a known doctype', () => {
    expect(useRegistry().views('User')).toEqual([
      { view: 'list', label: 'List', builtin: true },
      { view: 'form', label: 'Form', builtin: true },
    ])
  })

  it('is empty for an unknown doctype', () => {
    expect(useRegistry().views('No Such Doctype')).toEqual([])
  })
})

describe('cards', () => {
  it('returns the dashboard-card collection for an app', () => {
    const cards = useRegistry().cards('frappe')
    expect(cards.length).toBe(4)
    expect(cards[0].doctype).toBe('User')
  })

  it('is empty for an unknown app', () => {
    expect(useRegistry().cards('nope')).toEqual([])
  })
})

// Step 5 (ADR-0011): the registry is seeded at boot from the server-PROJECTED Registry —
// the server payloads (label/title/columns/status from Desk meta) are indexed DIRECTLY,
// and the client overlays OS-native presentation (branding/icons/status palettes/cards)
// keyed by id. config/* is decoration, not the source of "what exists". Each spec uses
// distinct doctypes/apps so the module-singleton index stays isolated; afterEach resets it.
describe('applet contributions', () => {
  it('lists the first-party applets with their owning app + label', () => {
    expect(listApplets()).toContainEqual({ appletId: 'my-todos', appId: 'frappe', label: 'My open ToDos' })
  })

  it('knownApplet is true only for a registered id under its owning app', () => {
    expect(knownApplet('frappe', 'my-todos')).toBe(true)
    expect(knownApplet('crm', 'my-todos')).toBe(false) // wrong app
    expect(knownApplet('frappe', 'ghost')).toBe(false) // unknown id
  })
})

describe('server-projected registry', () => {
  afterEach(() => initRegistry(null))

  const boot = (contributions, schemaVersion = 1) =>
    ({ user: 'a', csrf_token: 't', roles: [], registry: { schemaVersion, contributions }, permissions: {} })
  const app = (id, name) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order: 0 })
  const display = (dt, payload, sourceApp = 'frappe') =>
    ({ type: 'display-config', target: dt, name: 'display', sourceApp, payload })
  const view = (dt, name, order) =>
    ({ type: 'doctype-view', target: dt, name, sourceApp: 'frappe', payload: { view: name, label: name, builtin: true }, order })

  it('indexes the server payload directly for a doctype config does not curate', () => {
    // 'Widget' is absent from config/doctypes — it must still appear, from server meta.
    initRegistry(boot([app('frappe', 'Frappe'),
      display('Widget', { label: 'Widget', titleField: 'title', listColumns: [{ key: 'title', label: 'Name', primary: true }] })]))
    const reg = useRegistry()
    expect(reg.displayConfig('Widget')?.label).toBe('Widget')
    expect(reg.displayConfig('Widget')?.listColumns?.length).toBe(1)
    expect(appForDoctype('Widget')).toBe('frappe') // ownership from the display-config sourceApp
  })

  it('overlays OS-native presentation, bespoke columns winning over the server payload', () => {
    // User is a hand-tuned (bespoke) meta: its curated columns override the server's.
    initRegistry(boot([app('frappe', 'Frappe'),
      display('User', { label: 'Server User', titleField: 'name', listColumns: [{ key: 'name', label: 'ServerName', primary: true }] })]))
    const meta = useRegistry().displayConfig('User')
    expect(meta?.label).toBe('Server User') // server owns the textual fields
    expect(meta?.listColumns?.[0].key).toBe('full_name') // bespoke curated columns win
    expect(meta?.statusThemes).toBeDefined() // OS-native overlay from config
  })

  it('lets a generic doctype defer listColumns/statusField to the server projection', () => {
    // Warehouse is a generic placeholder meta — its real in_list_view columns come from the
    // server; only the OS-native color/icon/status palette stays curated (ADR-0011, step 5.1).
    initRegistry(boot([app('erpnext', 'ERPNext'),
      display('Warehouse', { label: 'Warehouse', titleField: 'name', listColumns: [{ key: 'name', label: 'Name', primary: true }, { key: 'company', label: 'Company' }] }, 'erpnext')]))
    const meta = useRegistry().displayConfig('Warehouse')
    expect(meta?.listColumns?.map((c) => c.key)).toEqual(['name', 'company']) // server wins
    expect(meta?.statusField).toBeUndefined() // generic 'status' not overlaid; server sent none
    expect(meta?.color).toBe('orange') // OS-native color still overlaid
  })

  it('patch-merges a later display-config over an app default (ADR-0007)', () => {
    // App default, then a Property-Setter-style site patch for the same doctype: shallow merge.
    initRegistry(boot([
      app('crm', 'CRM'),
      display('Lead Thing', { label: 'Lead Thing', titleField: 'name' }, 'crm'),
      { ...display('Lead Thing', { titleField: 'lead_name' }, '__site__'), name: 'patch', order: 1 },
    ]))
    const meta = useRegistry().displayConfig('Lead Thing')
    expect(meta?.label).toBe('Lead Thing') // kept from the app default
    expect(meta?.titleField).toBe('lead_name') // overridden by the site patch
  })

  it('enriches the app payload with curated branding + server identity', () => {
    initRegistry(boot([app('crm', 'CRM Live'), display('Contact', { label: 'Contact', titleField: 'name' }, 'crm')]))
    const crm = useRegistry().app('crm')
    expect(crm?.name).toBe('CRM Live') // server identity wins
    expect(crm?.hex).toBe('#0a9a8d') // curated branding overlaid
    expect((crm?.modules || []).length).toBeGreaterThan(0)
  })

  it('injects curated cards filtered to readable doctypes', () => {
    initRegistry(boot([app('frappe', 'Frappe'), display('User', { label: 'User', titleField: 'name' })]))
    const cards = useRegistry().cards('frappe')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => c.doctype === 'User')).toBe(true) // only the readable-doctype card
  })

  it('serves builtin views from the server doctype-view contributions', () => {
    initRegistry(boot([app('frappe', 'Frappe'),
      display('Gadget', { label: 'Gadget', titleField: 'name' }), view('Gadget', 'list', 0), view('Gadget', 'form', 1)]))
    expect(useRegistry().views('Gadget').map((v) => v.view)).toEqual(['list', 'form'])
  })

  it('tolerates an unknown (newer) schemaVersion — indexes the types it knows', () => {
    initRegistry(boot([app('frappe', 'Frappe'), display('User', { label: 'User', titleField: 'name' })], 99))
    expect(useRegistry().apps().map((a) => a.id)).toEqual(['frappe'])
    expect(useRegistry().displayConfig('User')?.label).toBe('User')
  })

  it('falls back to the full config seed for a legacy bare-array registry', () => {
    initRegistry({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {} })
    expect(useRegistry().apps().length).toBe(3)
    expect(appForDoctype('Sales Invoice')).toBe('erpnext')
  })

  it('treats a non-Registry object as offline — full seed', () => {
    initRegistry({ user: 'a', csrf_token: 't', roles: [], registry: { nonsense: true }, permissions: {} })
    expect(useRegistry().apps().length).toBe(3)
    expect(getMeta('User')).not.toBeNull()
  })
})
