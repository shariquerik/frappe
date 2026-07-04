// The OS API seam (ADR-0003). api.ts is mocked (the seam reads through it) and
// frappe-ui's toast is stubbed; the window/registry wiring runs against the real
// store + curated config. These tests pin the seam's contract: reads/writes delegate
// to the right backing, windows mutate observable store state, session projects boot,
// and the registry reads curated config. Each test uses distinct doctypes/apps so the
// module-singleton store state doesn't bleed between cases.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({
  getList: vi.fn(),
  getDoc: vi.fn(),
  call: vi.fn(),
  // records.ts (reached via os.saveDoc/createDoc) imports these from @/api too:
  getDoctypeMeta: vi.fn(),
  saveDoc: vi.fn(),
  createDoc: vi.fn(),
  cardValue: vi.fn(),
}))
vi.mock('frappe-ui', () => ({ toast: vi.fn() }))

import * as api from '@/data/api'
import { toast } from 'frappe-ui'
import { useOS } from '../src/desktop'
import { listSurface } from '../src/surface/index'
import { getMeta, initRegistry } from '../src/registry'
import { createOsApi, initOsApi, getOsApi } from '../src/data/os-api'

const boot = (over = {}) => ({ user: 'admin@example.com', csrf_token: 't', registry: [], permissions: {}, ...over })

beforeEach(() => vi.clearAllMocks())

describe('data', () => {
  it('getList reads straight through api.ts (not the shared records cache)', async () => {
    const rows = [{ name: 'a' }]
    api.getList.mockResolvedValue(rows)
    const os = createOsApi(boot())
    const result = await os.data.getList('Alpha', { limit: 5 })
    expect(api.getList).toHaveBeenCalledWith('Alpha', { limit: 5 })
    expect(result).toBe(rows)
  })

  it('getDoc reads straight through api.ts', async () => {
    const doc = { name: 'B-1' }
    api.getDoc.mockResolvedValue(doc)
    expect(await createOsApi(boot()).data.getDoc('Beta', 'B-1')).toBe(doc)
    expect(api.getDoc).toHaveBeenCalledWith('Beta', 'B-1')
  })

  it('call forwards method + params to api.ts', async () => {
    api.call.mockResolvedValue(42)
    expect(await createOsApi(boot()).data.call('m.x', { a: 1 })).toBe(42)
    expect(api.call).toHaveBeenCalledWith('m.x', { a: 1 })
  })

  it('saveDoc writes through the records store (api write + list refresh)', async () => {
    const data = createOsApi(boot()).data
    api.getList.mockResolvedValue([]) // an open list window (via the store), so the write has something to refresh
    await useOS().loadList('Gamma')
    api.getList.mockClear()

    const saved = { name: 'G-1', subject: 'x' }
    api.saveDoc.mockResolvedValue(saved)
    api.getList.mockResolvedValue([saved])
    const result = await data.saveDoc('Gamma', 'G-1', { subject: 'x' })
    expect(api.saveDoc).toHaveBeenCalledWith('Gamma', 'G-1', { subject: 'x' })
    expect(result).toBe(saved)
    expect(api.getList).toHaveBeenCalledWith('Gamma', { fields: ['*'], limit: 100, start: 0 })
  })

  it('createDoc writes through the records store', async () => {
    const created = { name: 'D-9' }
    api.createDoc.mockResolvedValue(created)
    api.getList.mockResolvedValue([created])
    expect(await createOsApi(boot()).data.createDoc('Delta', { x: 1 })).toBe(created)
    expect(api.createDoc).toHaveBeenCalledWith('Delta', { x: 1 })
  })
})

describe('windows', () => {
  it('open dispatches a surface into its owning app window', () => {
    const os = createOsApi(boot())
    os.windows.open(listSurface('User')) // User -> app:frappe
    const store = useOS()
    const win = store.state.windows.find((w) => w.id === 'app:frappe')
    expect(win).toBeTruthy()
    expect(win.surface.doctype).toBe('User')
    expect(store.state.activeId).toBe('app:frappe')
  })

  it('focus activates a window, close removes it', () => {
    const os = createOsApi(boot())
    os.windows.open(listSurface('CRM Lead')) // -> app:crm
    const store = useOS()
    store.state.activeId = null
    os.windows.focus('app:crm')
    expect(store.state.activeId).toBe('app:crm')
    os.windows.close('app:crm')
    expect(store.state.windows.some((w) => w.id === 'app:crm')).toBe(false)
  })
})

describe('ui', () => {
  it('notify raises a toast', () => {
    createOsApi(boot()).ui.notify('saved')
    expect(toast).toHaveBeenCalledWith('saved')
  })

  it('confirm resolves the native prompt result', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    expect(await createOsApi(boot()).ui.confirm('sure?')).toBe(true)
  })
})

describe('session', () => {
  it('projects user and defaults roles to [] when boot omits them', () => {
    const s = createOsApi(boot()).session
    expect(s.user).toBe('admin@example.com')
    expect(s.roles).toEqual([])
  })

  it('reads roles defensively when boot supplies them', () => {
    expect(createOsApi(boot({ roles: ['System Manager'] })).session.roles).toEqual(['System Manager'])
  })

  it('hasPermission reads the boot permission map, defaulting to false', () => {
    const s = createOsApi(boot({ permissions: { User: { read: true, write: false } } })).session
    expect(s.hasPermission('User')).toBe(true) // defaults to 'read'
    expect(s.hasPermission('User', 'write')).toBe(false)
    expect(s.hasPermission('Unknown')).toBe(false)
  })
})

describe('registry', () => {
  it('displayConfig returns the curated meta', () => {
    expect(createOsApi(boot()).registry.displayConfig('User')).toBe(getMeta('User'))
  })

  it('views projects the builtin view collection for known doctypes, none for unknown', () => {
    const r = createOsApi(boot()).registry
    expect(r.views('User')).toEqual([
      { view: 'list', label: 'List', builtin: true },
      { view: 'form', label: 'Form', builtin: true },
    ])
    expect(r.views('No Such Doctype')).toEqual([])
  })

  it('exposes resolveApplet on the seam; it rejects an unknown id', async () => {
    // The success path imports a .vue SFC, exercised in Cypress (the unit config skips
    // .vue on purpose); here we pin the seam + the unknown-id rejection (no import).
    const r = createOsApi(boot()).registry
    expect(typeof r.resolveApplet).toBe('function')
    await expect(r.resolveApplet('no-such-applet')).rejects.toThrow()
  })
})

// The COOKED customizations catalog (ADR-0015, issue 05): the seam computes groups carrying
// appKind and rows carrying the `unexpected` flag, so the applet only renders. The internal
// Action model stays private — no raw actions()/appKind() leak onto the seam.
describe('registry.customizations (cooked catalog projection)', () => {
  // erpnext is a FEATURE app (it also ships a display-config surface) that removes chrome — the
  // surprising case; cleaner is a PURE-CUSTOMIZATION app whose removal is its job (quiet).
  const action = (command, sourceApp, over = {}) =>
    ({ type: 'action', target: 'menubar:file', name: `${sourceApp}:${command}`, sourceApp,
       payload: { command, region: 'menubar:file', sourceApp, ...over } })
  const display = (sourceApp, doctype) =>
    ({ type: 'display-config', target: doctype, name: 'display', sourceApp, payload: {} })
  const serverBoot = (contributions) => boot({ registry: { schemaVersion: 1, contributions } })

  beforeEach(() => initRegistry(serverBoot([
    action('frappe.window.close', 'cleaner', { removed: true }),
    action('frappe.window.close', 'erpnext', { removed: true }),
    action('frappe.file.open', 'frappe'), // plain App-default placement — not a customization
    display('erpnext', 'ZZ Custom Doctype'), // makes erpnext classify as a feature app
  ])))
  afterEach(() => initRegistry(null))

  it('groups by app, sorted, dropping plain App-default placements', () => {
    const groups = createOsApi(boot()).registry.customizations()
    expect(groups.map((g) => g.appId)).toEqual(['cleaner', 'erpnext'])
  })

  it('bakes each group\'s appKind in — a chrome-only app is pure-customization, a surface app is feature', () => {
    const groups = createOsApi(boot()).registry.customizations()
    expect(groups.find((g) => g.appId === 'cleaner').appKind).toBe('pure-customization')
    expect(groups.find((g) => g.appId === 'erpnext').appKind).toBe('feature')
  })

  it('bakes the unexpected flag in with parity to the removals warning predicate', () => {
    const groups = createOsApi(boot()).registry.customizations()
    // A feature app removing chrome is the surprising case → flagged.
    expect(groups.find((g) => g.appId === 'erpnext').rows[0].unexpected).toBe(true)
    // A pure-customization app removing chrome is its job → not flagged.
    expect(groups.find((g) => g.appId === 'cleaner').rows[0].unexpected).toBe(false)
  })

  it('keeps the internal Action model private — no raw actions()/appKind() on the seam', () => {
    const r = createOsApi(boot()).registry
    expect(r.actions).toBeUndefined()
    expect(r.appKind).toBeUndefined()
  })

  it('advertises the projection in capabilities', () => {
    expect(createOsApi(boot()).capabilities['registry.customizations']).toBe(true)
  })
})

describe('capabilities + singleton', () => {
  it('advertises what the seam supports today', () => {
    const caps = createOsApi(boot()).capabilities
    expect(caps['data.write']).toBe(true)
    expect(caps.applets).toBe(true)
  })

  it('initOsApi sets the shared instance getOsApi returns', () => {
    const inst = initOsApi(boot())
    expect(getOsApi()).toBe(inst)
  })
})
