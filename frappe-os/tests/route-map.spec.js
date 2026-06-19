// route-map projection: focus -> URL path, and route params -> store action.
import { beforeEach, describe, expect, it } from 'vitest'
import { useOS } from '../src/desktop/index'
import { pathForFocus, applyRoute } from '../src/routing/route-map'

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
    expect(pathForFocus(os)).toBe('/')
  })

  it('an app home window projects to /<app>', () => {
    os.openApp('frappe')
    expect(pathForFocus(os)).toBe('/frappe')
  })

  it('a list view projects to /<app>/<doctype>', () => {
    os.openListGlobal('ToDo')
    expect(pathForFocus(os)).toBe('/frappe/ToDo')
  })

  it('a form view projects to /<app>/<doctype>/<name> (encoded)', () => {
    os.openRecordGlobal('CRM Lead', 'CRM-LEAD-2024-0042')
    expect(pathForFocus(os)).toBe('/crm/CRM%20Lead/CRM-LEAD-2024-0042')
  })

  it('a settings window projects to /<app>/settings', () => {
    os.openSettings('frappe')
    expect(pathForFocus(os)).toBe('/frappe/settings')
  })

  it('an applet window projects to /<app>/<appletId>', () => {
    os.openApplet('frappe', 'my-todos')
    expect(pathForFocus(os)).toBe('/frappe/my-todos')
  })

  it('a minimized active window projects to / (never owns the URL)', () => {
    os.openApp('frappe')
    os.state.geo['app:frappe'] = { ...os.state.geo['app:frappe'], min: true }
    expect(pathForFocus(os)).toBe('/')
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

  it('opens settings for a known app', () => {
    applyRoute(os, { app: 'frappe', doctype: 'settings' })
    expect(os.state.activeId).toBe('settings:frappe')
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
})
