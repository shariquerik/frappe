// route-map projection: focus -> URL path, and route params -> store action.
import { beforeEach, describe, expect, it } from 'vitest'
import { useOS } from '../src/desktop/index'
import { pathForFocus, applyRoute, focusSig } from '../src/routing/route-map'

const os = useOS()

beforeEach(() => {
  os.state.windows = []
  os.state.geo = {}
  os.state.activeId = null
  os.state.split = null
  localStorage.clear()
})

describe('pathForFocus', () => {
  it('bare desktop projects to /', () => {
    expect(pathForFocus(os)).toEqual({ path: '/', query: {} })
  })

  it('an app home window projects to /<app>', () => {
    os.openApp('frappe')
    expect(pathForFocus(os)).toEqual({ path: '/frappe', query: {} })
  })

  it('a list view projects to /<app>/<doctype>', () => {
    os.openListGlobal('ToDo')
    expect(pathForFocus(os)).toEqual({ path: '/frappe/ToDo', query: {} })
  })

  it('a form view projects to /<app>/<doctype>/<name> (encoded)', () => {
    os.openRecordGlobal('CRM Lead', 'CRM-LEAD-2024-0042')
    expect(pathForFocus(os)).toEqual({ path: '/crm/CRM%20Lead/CRM-LEAD-2024-0042', query: {} })
  })

  it('an app-settings window projects to /<app>/settings', () => {
    os.openAppSettings('frappe')
    expect(pathForFocus(os)).toEqual({ path: '/frappe/settings', query: {} })
  })

  it('the default (General) app-settings pane stays on the bare /<app>/settings path', () => {
    os.openAppSettings('frappe', 'General')
    expect(pathForFocus(os)).toEqual({ path: '/frappe/settings', query: {} })
  })

  it('a non-default app-settings pane projects to /<app>/settings/<slug>', () => {
    os.openAppSettings('frappe', 'Members')
    expect(pathForFocus(os)).toEqual({ path: '/frappe/settings/members', query: {} })
  })

  it('the per-user Settings window projects to a bare /settings', () => {
    os.openSettings()
    expect(pathForFocus(os)).toEqual({ path: '/settings', query: {} })
  })

  it('the default (General) Settings pane stays on the bare /settings path', () => {
    os.openSettings('General')
    expect(pathForFocus(os)).toEqual({ path: '/settings', query: {} })
  })

  it('a non-default Settings pane projects to /settings/<slug>', () => {
    os.openSettings('Account')
    expect(pathForFocus(os)).toEqual({ path: '/settings/account', query: {} })
    os.openSettings('Appearance')
    expect(pathForFocus(os)).toEqual({ path: '/settings/appearance', query: {} })
  })

  it('an applet window projects to /<app>/<appletId>', () => {
    os.openApplet('frappe', 'my-todos')
    expect(pathForFocus(os)).toEqual({ path: '/frappe/my-todos', query: {} })
  })

  it('a minimized active window projects to / (never owns the URL)', () => {
    os.openApp('frappe')
    os.state.geo['app:frappe'] = { ...os.state.geo['app:frappe'], min: true }
    expect(pathForFocus(os)).toEqual({ path: '/', query: {} })
  })

  it('the canonical instance carries no instance query; a #n twin carries ?instance=n', () => {
    os.newAppWindow('crm') // app:crm (canonical)
    expect(pathForFocus(os)).toEqual({ path: '/crm', query: {} })
    os.newAppWindow('crm') // app:crm#2, now focused
    expect(pathForFocus(os)).toEqual({ path: '/crm', query: { instance: '2' } })
  })

  it('the instance query rides alongside the twin’s own surface path', () => {
    os.newAppWindow('crm')                          // app:crm
    os.newAppWindow('crm')                          // app:crm#2 focused
    os.openRecordGlobal('CRM Lead', 'L-1', 2)       // navigate the twin to a form
    expect(pathForFocus(os)).toEqual({ path: '/crm/CRM%20Lead/L-1', query: { instance: '2' } })
  })

  it('the default Aspect (details) projects to the bare record path (URL unchanged)', () => {
    os.openRecordGlobal('CRM Lead', 'L-1', null, 'details')
    expect(pathForFocus(os)).toEqual({ path: '/crm/CRM%20Lead/L-1', query: {} })
  })

  it('a non-default Aspect projects to a trailing path segment', () => {
    os.openRecordGlobal('CRM Lead', 'L-1', null, 'activities')
    expect(pathForFocus(os)).toEqual({ path: '/crm/CRM%20Lead/L-1/activities', query: {} })
  })

  it('the Aspect segment composes with the ?instance=n query', () => {
    os.newAppWindow('crm')                          // app:crm
    os.newAppWindow('crm')                          // app:crm#2 focused
    os.openRecordGlobal('CRM Lead', 'L-1', 2, 'email')
    expect(pathForFocus(os)).toEqual({ path: '/crm/CRM%20Lead/L-1/email', query: { instance: '2' } })
  })
})

describe('applyRoute', () => {
  it('a bare route clears focus (path is authoritative)', () => {
    os.openApp('frappe') // pretend a hydrated session is focused
    applyRoute(os, {})
    expect(os.state.activeId).toBe(null)
  })

  it('opens a known app', () => {
    applyRoute(os, { app: 'frappe' })
    expect(os.state.activeId).toBe('app:frappe')
  })

  it('opens a list for a known doctype', () => {
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ view: 'list', doctype: 'CRM Lead' })
  })

  it('opens the record form for a doctype + name', () => {
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead', name: 'CRM-LEAD-2024-0042' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ view: 'form', recordName: 'CRM-LEAD-2024-0042' })
  })

  it('still opens the form for an unloaded record (records load live; the form handles 404)', () => {
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead', name: 'NOPE-404' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ view: 'form', doctype: 'CRM Lead', recordName: 'NOPE-404' })
  })

  it('derives the app from the doctype even when the app segment is wrong', () => {
    applyRoute(os, { app: 'frappe', doctype: 'CRM Lead' })
    expect(os.state.activeId).toBe('app:crm')
  })

  it('clears focus for an unknown app with no valid doctype', () => {
    os.openApp('frappe')
    applyRoute(os, { app: 'badapp' })
    expect(os.state.activeId).toBe(null)
  })

  it('clears focus when neither app nor doctype is real', () => {
    os.openApp('frappe')
    applyRoute(os, { app: 'badapp', doctype: 'Nonexistent' })
    expect(os.state.activeId).toBe(null)
  })

  it('opens app-settings for a known app from /<app>/settings', () => {
    applyRoute(os, { app: 'frappe', doctype: 'settings' })
    expect(os.state.activeId).toBe('app-settings:frappe')
    const w = os.state.windows.find((x) => x.id === 'app-settings:frappe')
    expect(w.surface.params?.pane).toBe('General')
  })

  it('opens the named app-settings pane from /<app>/settings/<slug>', () => {
    applyRoute(os, { app: 'frappe', doctype: 'settings', name: 'members' })
    const w = os.state.windows.find((x) => x.id === 'app-settings:frappe')
    expect(w.surface.params?.pane).toBe('Members')
  })

  it('degrades an unknown app-settings pane slug to the default (General)', () => {
    applyRoute(os, { app: 'frappe', doctype: 'settings', name: 'not-a-pane' })
    const w = os.state.windows.find((x) => x.id === 'app-settings:frappe')
    expect(w.surface.params?.pane).toBe('General')
  })

  it('opens the per-user Settings window from a bare /settings', () => {
    applyRoute(os, { app: 'settings' })
    expect(os.state.activeId).toBe('settings')
    const w = os.state.windows.find((x) => x.id === 'settings')
    expect(w.surface.params?.pane).toBe('General')
  })

  it('opens the named pane from /settings/<slug>', () => {
    applyRoute(os, { app: 'settings', doctype: 'account' })
    const w = os.state.windows.find((x) => x.id === 'settings')
    expect(os.state.activeId).toBe('settings')
    expect(w.surface.params?.pane).toBe('Account')
  })

  it('degrades an unknown Settings pane slug to the default (General)', () => {
    applyRoute(os, { app: 'settings', doctype: 'not-a-pane' })
    const w = os.state.windows.find((x) => x.id === 'settings')
    expect(w.surface.params?.pane).toBe('General')
  })

  it('opens an applet when the second segment is a known applet id', () => {
    applyRoute(os, { app: 'frappe', doctype: 'my-todos' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ kind: 'applet', appletId: 'my-todos', appId: 'frappe' })
  })

  it('doctype wins over a same-named would-be applet (doctype checked first)', () => {
    // A real doctype never falls into the applet branch — it opens its list.
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ kind: 'builtin', view: 'list', doctype: 'CRM Lead' })
  })

  it('falls back to the app for an unknown second segment that is neither doctype nor applet', () => {
    applyRoute(os, { app: 'frappe', doctype: 'not-a-thing' })
    expect(os.state.activeId).toBe('app:frappe')
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface.kind).toBe('builtin')
  })

  it('?instance=n targets the matching twin, respawning it if closed (reload addressability)', () => {
    applyRoute(os, { app: 'crm', instance: 2 }) // cold deep-link to a twin that isn't open yet
    expect(os.state.activeId).toBe('app:crm#2')
    expect(os.state.windows.map((w) => w.id)).toEqual(['app:crm#2'])
  })

  it('a form deep-link with ?instance=n opens the form in that twin', () => {
    os.openApp('crm') // canonical already open
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead', name: 'L-7', instance: 2 })
    expect(os.state.activeId).toBe('app:crm#2')
    const w = os.state.windows.find((x) => x.id === 'app:crm#2')
    expect(w.surface).toMatchObject({ view: 'form', doctype: 'CRM Lead', recordName: 'L-7' })
  })

  it('no instance query falls back to the canonical / any open instance', () => {
    applyRoute(os, { app: 'crm' })
    expect(os.state.activeId).toBe('app:crm')
  })

  it('a known trailing Aspect rides the opened form surface', () => {
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead', name: 'L-1', aspect: 'activities' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ view: 'form', recordName: 'L-1', aspect: 'activities' })
  })

  it('the default Aspect leaves the form surface bare (no aspect coordinate)', () => {
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead', name: 'L-1', aspect: 'details' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface.view).toBe('form')
    expect(w.surface.aspect).toBeUndefined()
  })

  it('an unknown trailing segment produces no phantom Aspect (still opens the form)', () => {
    applyRoute(os, { app: 'crm', doctype: 'CRM Lead', name: 'L-1', aspect: 'not-an-aspect' })
    const w = os.state.windows.find((x) => x.id === os.state.activeId)
    expect(w.surface).toMatchObject({ view: 'form', recordName: 'L-1' })
    expect(w.surface.aspect).toBeUndefined()
  })
})

describe('focusSig', () => {
  it('changes when the Settings pane switches, so the watcher pushes a new URL', () => {
    os.openSettings('General')
    const general = focusSig(os)
    os.setSettingsPane('Account')
    expect(focusSig(os)).not.toBe(general)
  })

  it('changes when the app-settings pane switches, so the watcher pushes a new URL', () => {
    os.openAppSettings('frappe', 'General')
    const general = focusSig(os)
    os.setAppSettingsPane('app-settings:frappe', 'Members')
    expect(focusSig(os)).not.toBe(general)
  })
})
