// Store focus state machine: the invariants the URL bridge relies on. The store is
// a module singleton, so reset its reactive state before each test.
import { beforeEach, describe, expect, it } from 'vitest'
import { useOS } from '../src/desktop/index'

const os = useOS()

function reset() {
  os.state.windows = []
  os.state.geo = {}
  os.state.activeId = null
  os.state.split = null
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
