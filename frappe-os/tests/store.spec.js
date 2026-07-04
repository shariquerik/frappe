// Store focus state machine: the invariants the URL bridge relies on. The store is
// a module singleton, so reset its reactive state before each test.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOS } from '../src/desktop/index'
import { initRegistry } from '../src/registry'

const os = useOS()

function reset() {
  os.state.windows = []
  os.state.geo = {}
  os.state.activeId = null
  os.state.split = null
  os.state.rowOpenTarget = 'inline'
  localStorage.clear()
}

beforeEach(reset)

describe('focus state machine', () => {
  it('minimizing the only window clears focus to the bare desktop', () => {
    os.openApp('frappe')
    expect(os.state.activeId).toBe('app:frappe')
    os.minimizeWin('app:frappe')
    expect(os.state.activeId).toBe(null)
  })

  it('minimizing the active window hands focus to the top-most visible window', () => {
    os.openApp('frappe')
    os.openApp('crm') // crm now active and on top
    os.minimizeWin('app:crm')
    expect(os.state.activeId).toBe('app:frappe')
  })

  it('closing the active window falls back to a visible window, never a minimized one', () => {
    os.openApp('frappe')
    os.openApp('crm')
    os.minimizeWin('app:frappe') // frappe hidden, crm active
    os.closeWin('app:crm')
    expect(os.state.activeId).toBe(null) // frappe is minimized, so focus clears
  })

  it('clearFocus minimizes every window and clears focus', () => {
    os.openApp('frappe')
    os.openApp('crm')
    os.clearFocus()
    expect(os.state.activeId).toBe(null)
    expect(os.geoMap.value['app:frappe'].min).toBe(true)
    expect(os.geoMap.value['app:crm'].min).toBe(true)
  })
})

describe('newAppWindow stacks multiple windows of one app', () => {
  it('first call uses the canonical id; a second call mints a distinct instance', () => {
    const a = os.newAppWindow('crm')
    const b = os.newAppWindow('crm')
    expect(a.id).toBe('app:crm')
    expect(b.id).toBe('app:crm#2')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm', 'app:crm#2'])
    expect(os.state.activeId).toBe('app:crm#2') // the new one is focused
  })

  it('windows open small by default — canonical and extras alike', () => {
    os.newAppWindow('crm')
    const b = os.newAppWindow('crm')
    expect(os.geoMap.value['app:crm'].max).toBe(false)
    expect(os.geoMap.value[b.id].max).toBe(false)
  })

  it('remembers a window size/position across close + reopen (default on)', () => {
    os.openApp('crm')
    os.state.geo['app:crm'] = { ...os.state.geo['app:crm'], w: 1280, h: 900, max: true } // simulate a user resize/maximize
    os.closeWin('app:crm')
    os.openApp('crm')
    expect(os.geoMap.value['app:crm'].max).toBe(true)
    expect(os.geoMap.value['app:crm'].w).toBe(1280)
  })

  it('with remember off, a window resets to the small default on reopen', () => {
    os.openApp('crm')
    os.state.geo['app:crm'] = { ...os.state.geo['app:crm'], w: 1280, h: 900, max: true }
    os.closeWin('app:crm')
    os.setRememberWindowSize(false)
    os.openApp('crm')
    expect(os.geoMap.value['app:crm'].max).toBe(false)
    expect(os.geoMap.value['app:crm'].w).toBe(1080)
  })

  it('extras always reset to small (distinct) even with a stale saved size', () => {
    os.openApp('crm')
    const b = os.newAppWindow('crm')
    os.state.geo[b.id] = { ...os.state.geo[b.id], w: 1280, max: true }
    os.closeWin(b.id)
    const b2 = os.newAppWindow('crm') // reuses the freed #2 id
    expect(os.geoMap.value[b2.id].max).toBe(false)
  })

  it('fills the lowest free suffix after a middle window closes', () => {
    os.newAppWindow('crm') // app:crm
    os.newAppWindow('crm') // app:crm#2
    os.newAppWindow('crm') // app:crm#3
    os.closeWin('app:crm#2')
    expect(os.newAppWindow('crm').id).toBe('app:crm#2')
  })

  it('unlike openApp, it never collapses into an existing window', () => {
    os.openApp('crm')
    os.newAppWindow('crm')
    expect(os.state.windows.length).toBe(2)
  })

  it('openApp focuses a surviving extra instance instead of spawning a blank canonical', () => {
    // Reload wart: close the canonical, keep app:crm#2, then a deep-link reopens 'crm'.
    os.newAppWindow('crm')   // app:crm
    os.newAppWindow('crm')   // app:crm#2
    os.closeWin('app:crm')   // canonical gone, only #2 survives
    os.clearFocus()
    os.openApp('crm')        // deep-link / app-icon re-open
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm#2'])
    expect(os.state.activeId).toBe('app:crm#2') // focused the survivor, minted nothing
  })

  it('a bare openApp focuses the canonical instance, not a more-recent instance', () => {
    os.newAppWindow('crm')           // app:crm (canonical)
    os.newAppWindow('crm')           // app:crm#2, now focused + on top
    os.openApp('crm')                // bare path = canonical's address
    expect(os.state.activeId).toBe('app:crm') // canonical wins; instance owns the URL only via ?instance
    expect(os.state.windows.length).toBe(2)   // no new window
  })

  it('openApp(appId, n) targets a specific instance, respawning it if closed', () => {
    os.openApp('crm')                // app:crm
    os.openApp('crm', 2)             // respawn/focus app:crm#2 from a ?instance=2 URL
    expect(os.state.activeId).toBe('app:crm#2')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm', 'app:crm#2'])
  })
})

describe('openAspect selects a form Aspect on the same window', () => {
  it('re-navigates the record form to the chosen Aspect and records history', () => {
    os.openRecordGlobal('CRM Lead', 'L-1') // app:crm on the bare (details) form
    os.openAspect('app:crm', 'activities')
    const w = os.state.windows.find((x) => x.id === 'app:crm')
    expect(w.surface).toMatchObject({ view: 'form', recordName: 'L-1', aspect: 'activities' })
    expect(w.back.length).toBe(1) // the details form is now back-navigable
  })

  it('is a no-op when the window does not host a form', () => {
    os.openApp('crm') // dashboard surface
    os.openAspect('app:crm', 'activities')
    const w = os.state.windows.find((x) => x.id === 'app:crm')
    expect(w.surface.view).toBe('dashboard')
  })
})

describe('workspace is window identity (ADR-0042)', () => {
  it('a workspace-scoped open lands in the (app, workspace) window, not the plain app window', () => {
    os.openListGlobal('CRM Lead', undefined, 'sales')
    expect(os.state.activeId).toBe('app:crm/sales')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm/sales'])
  })

  it('in-window navigation keeps the window identity — no per-surface workspace to carry', () => {
    os.openListGlobal('CRM Lead', undefined, 'sales') // app:crm/sales
    os.openList('app:crm/sales', 'CRM Deal') // sidebar click within the workbench
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm/sales']) // same window
    const w = os.state.windows.find((x) => x.id === 'app:crm/sales')
    expect(w.surface).toMatchObject({ view: 'list', doctype: 'CRM Deal' })
    expect(w.surface.workspace).toBeUndefined() // identity is on the id, never on the surface
  })

  it('opening a record inline stays in the same (app, workspace) window', () => {
    os.openListGlobal('CRM Lead', undefined, 'sales')
    os.openRecordInline('app:crm/sales', 'CRM Lead', 'L-1')
    const w = os.state.windows.find((x) => x.id === 'app:crm/sales')
    expect(w.surface).toMatchObject({ view: 'form', recordName: 'L-1' })
  })

  it('goHome stays in the workspace window and shows the app dashboard', () => {
    os.openListGlobal('CRM Lead', undefined, 'sales')
    os.goHome('app:crm/sales')
    expect(os.state.activeId).toBe('app:crm/sales')
    const w = os.state.windows.find((x) => x.id === 'app:crm/sales')
    expect(w.surface).toMatchObject({ view: 'dashboard', appId: 'crm' })
  })

  it('two workspaces of one app are two windows, open side by side', () => {
    os.openWorkspace('erpnext', 'selling')
    os.openWorkspace('erpnext', 'stock')
    expect(os.state.windows.map((w) => w.id).sort()).toEqual(['app:erpnext/selling', 'app:erpnext/stock'])
  })

  it('a global (Spotlight/Finder) open with no workspace yields the plain app window', () => {
    os.openListGlobal('CRM Lead') // no workspace passed
    expect(os.state.activeId).toBe('app:crm')
  })
})

describe('single-workspace apps skip the hub (ADR-0042)', () => {
  const bootWith = (workspaces) =>
    ({ user: 'a', csrf_token: 't', roles: [], registry: { schemaVersion: 1, contributions: [] }, permissions: {}, workspaces })
  afterEach(() => initRegistry(null))

  it('opening a single-workspace app opens its workbench directly — no plain app window', () => {
    initRegistry(bootWith({ demoday: [{ id: 'demo_day', label: 'Demo Day', isDefault: true }] }))
    os.openApp('demoday')
    expect(os.state.activeId).toBe('app:demoday/demo_day')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:demoday/demo_day'])
  })

  it('a multi-workspace app opens the plain app window (the hub earns its place)', () => {
    initRegistry(bootWith({ suite: [{ id: 'a', label: 'A', isDefault: true }, { id: 'b', label: 'B', isDefault: false }] }))
    os.openApp('suite')
    expect(os.state.activeId).toBe('app:suite')
  })
})

describe('openRow follows the row open-target preference (ADR-0018)', () => {
  it("defaults to 'inline' — left-click opens the record in the same window", () => {
    os.openListGlobal('CRM Lead') // app:crm on a list
    expect(os.state.rowOpenTarget).toBe('inline')
    os.openRow('app:crm', 'CRM Lead', 'L-1')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm']) // no new window
    const w = os.state.windows.find((x) => x.id === 'app:crm')
    expect(w.surface).toMatchObject({ view: 'form', recordName: 'L-1' })
  })

  it("with 'new-window', left-click mints a fresh app instance on the record's form", () => {
    os.openListGlobal('CRM Lead') // app:crm on a list
    os.setRowOpenTarget('new-window')
    os.openRow('app:crm', 'CRM Lead', 'L-1')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm', 'app:crm#2'])
    const instance = os.state.windows.find((x) => x.id === 'app:crm#2')
    expect(instance.surface).toMatchObject({ view: 'form', recordName: 'L-1' })
    const orig = os.state.windows.find((x) => x.id === 'app:crm')
    expect(orig.surface.view).toBe('list') // the original list window is untouched
  })

  it('restores the saved preference on hydrate', () => {
    localStorage.setItem('frappe-os:desktop', JSON.stringify({ version: 2, windows: [], geo: {}, rowOpenTarget: 'new-window' }))
    os.state.rowOpenTarget = 'inline' // simulate a fresh boot default
    os.hydrate()
    expect(os.state.rowOpenTarget).toBe('new-window')
  })

  it('falls back to inline when the blob has no saved preference', () => {
    localStorage.setItem('frappe-os:desktop', JSON.stringify({ version: 2, windows: [], geo: {} }))
    os.state.rowOpenTarget = 'new-window'
    os.hydrate()
    expect(os.state.rowOpenTarget).toBe('inline')
  })
})

describe('hydrate preserves "nothing focused"', () => {
  const seed = (activeId) =>
    localStorage.setItem(
      'frappe-os:desktop',
      JSON.stringify({
        version: 2,
        windows: [{ id: 'app:frappe', surface: { kind: 'builtin', view: 'dashboard', appId: 'frappe' } }],
        geo: { 'app:frappe': { z: 1 } },
        activeId,
      }),
    )

  it('keeps activeId null when the saved desktop was bare (no resurrected focus)', () => {
    seed(null)
    os.hydrate()
    expect(os.state.windows).toHaveLength(1)
    expect(os.state.activeId).toBe(null)
  })

  it('restores a valid saved focus', () => {
    seed('app:frappe')
    os.hydrate()
    expect(os.state.activeId).toBe('app:frappe')
  })

  it('drops focus that points at a window that no longer exists', () => {
    seed('app:ghost')
    os.hydrate()
    expect(os.state.activeId).toBe(null)
  })
})

describe('hydrate restores applet surfaces', () => {
  const seed = (appletId) =>
    localStorage.setItem(
      'frappe-os:desktop',
      JSON.stringify({
        version: 2,
        windows: [{ id: 'app:frappe', surface: { kind: 'applet', appletId, appId: 'frappe' } }],
        geo: { 'app:frappe': { z: 1 } },
        activeId: 'app:frappe',
      }),
    )

  it('keeps a known applet surface', () => {
    seed('my-todos')
    os.hydrate()
    const w = os.state.windows.find((x) => x.id === 'app:frappe')
    expect(w.surface).toMatchObject({ kind: 'applet', appletId: 'my-todos' })
  })

  it('falls a dead applet id back to the app initial surface', () => {
    seed('ghost-applet')
    os.hydrate()
    const w = os.state.windows.find((x) => x.id === 'app:frappe')
    expect(w.surface.kind).toBe('builtin') // initialSurface(frappe) -> dashboard
  })
})
