// Surface-driven sidebar dispatch (ADR-0018): a form Surface drives the Aspect rail; every
// other Surface keeps the app nav rail. Pure decision, unit-tested in isolation.
import { afterEach, describe, expect, it } from 'vitest'
import {
  sidebarKind, dashboardSurface, listSurface, formSurface, settingsSurface, appletSurface,
  initialSurface, surfaceAppId, isAspectId, DEFAULT_ASPECT, FORM_ASPECTS,
} from '../src/surface/index'
import { initRegistry } from '../src/registry'
import { useOS } from '../src/desktop/index'

describe('sidebarKind', () => {
  it('a form Surface drives the Aspect rail', () => {
    expect(sidebarKind(formSurface('CRM Lead', 'L-1'))).toBe('aspect')
  })

  it('list / dashboard / settings / native-applet Surfaces keep the nav rail', () => {
    expect(sidebarKind(listSurface('CRM Lead'))).toBe('nav')
    expect(sidebarKind(dashboardSurface('crm'))).toBe('nav')
    expect(sidebarKind(settingsSurface('crm'))).toBe('nav')
    // my-todos is a first-party native applet (no `framed` flag) → keeps the nav rail.
    expect(sidebarKind(appletSurface('frappe', 'my-todos'))).toBe('nav')
  })

  it('a null/absent Surface falls back to the nav rail', () => {
    expect(sidebarKind(null)).toBe('nav')
    expect(sidebarKind(undefined)).toBe('nav')
  })
})

// ADR-0020: a framed applet is full-window (no nav rail — the framed SPA owns its chrome),
// driven purely by the applet declaration's `kind` flag, so the core names no specific app.
describe('sidebarKind for a framed applet (ADR-0020)', () => {
  afterEach(() => initRegistry(null))

  const bootWithApplet = (kind) => ({
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: {
      schemaVersion: 1,
      contributions: [{
        type: 'applet', target: '', name: 'demo.chat', sourceApp: 'demo',
        payload: { appletId: 'chat', appId: 'demo', assetUrl: '/chat.js', label: 'Chat', kind },
      }],
    },
  })

  it('a framed applet Surface renders NO rail (full-window)', () => {
    initRegistry(bootWithApplet('framed'))
    expect(sidebarKind(appletSurface('demo', 'chat'))).toBe('none')
  })

  it('an applet declared native keeps the nav rail', () => {
    initRegistry(bootWithApplet('native'))
    expect(sidebarKind(appletSurface('demo', 'chat'))).toBe('nav')
  })

  it('an applet with no kind flag defaults to native (nav rail)', () => {
    initRegistry(bootWithApplet(undefined))
    expect(sidebarKind(appletSurface('demo', 'chat'))).toBe('nav')
  })
})

// The default-surface resolver (ADR-0021, slice 05): the Surface a Window opens on is resolved
// top-down, first match wins — rung 1 declared default → rung 2 dashboard → (rung 3 DORMANT) →
// rung 4 empty-app pane. Own-app references here; cross-app + permission gating in slice 07 below.
describe('initialSurface — the default-surface resolver', () => {
  afterEach(() => initRegistry(null))

  // Seed a server registry of `app` identities + optional `default-surface` references.
  const boot = (apps, defaults = []) => ({
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: {
      schemaVersion: 1,
      contributions: [
        ...apps.map((a) => ({ type: 'app', target: '', name: a.id, sourceApp: a.id, payload: a, order: 0 })),
        ...defaults.map((d, i) => ({
          type: 'default-surface', target: d.app, name: 'default', sourceApp: d.app, payload: d.ref, order: i,
        })),
      ],
    },
  })

  it('rung 1: a declared own-app applet reference opens that applet', () => {
    initRegistry(boot([{ id: 'demo', name: 'Demo', hasDashboard: true }], [{ app: 'demo', ref: { applet: 'chat' } }]))
    expect(initialSurface('demo')).toEqual({ kind: 'applet', appletId: 'chat', appId: 'demo' })
  })

  it('rung 1: a declared dashboard reference opens the dashboard', () => {
    initRegistry(boot([{ id: 'demo', name: 'Demo', hasDashboard: false }], [{ app: 'demo', ref: { dashboard: true } }]))
    expect(initialSurface('demo')).toEqual({ kind: 'builtin', view: 'dashboard', appId: 'demo' })
  })

  it('rung 1: a declared own-app doctype-list reference opens that list', () => {
    // demo owns ToDo (via its modules), so the list surface is own-app and resolves ungated.
    initRegistry(boot([{ id: 'demo', name: 'Demo', hasDashboard: false, modules: [{ name: 'Demo', doctypes: ['ToDo'] }] }],
      [{ app: 'demo', ref: { doctype: 'ToDo', view: 'list' } }]))
    expect(initialSurface('demo')).toMatchObject({ kind: 'builtin', view: 'list', doctype: 'ToDo', appId: 'demo' })
  })

  it('rung 2: no declared default + a dashboard → the dashboard', () => {
    initRegistry(boot([{ id: 'demo', name: 'Demo', hasDashboard: true }]))
    expect(initialSurface('demo')).toEqual({ kind: 'builtin', view: 'dashboard', appId: 'demo' })
  })

  it('rung 4: no declared default + no dashboard → the empty-app pane', () => {
    initRegistry(boot([{ id: 'demo', name: 'Demo', hasDashboard: false }]))
    expect(initialSurface('demo')).toEqual({ kind: 'builtin', view: 'empty', appId: 'demo' })
  })
})

// Cross-app default-surface references (ADR-0021, slice 07): an `app:`-qualified reference
// resolves to a Surface owned by the REFERENCED app (not the opened app); it is permission-gated
// (ADR-0010) — falling through when the viewer can't see it; and window identity stays separate
// from surface ownership (ADR-0012/0016) — the Window keeps the opened app's id while the Surface
// is owned by its referenced app, so chrome/nav scope to the surface's app.
describe('initialSurface — cross-app references (slice 07)', () => {
  afterEach(() => initRegistry(null))

  // A server registry where each named app is visible (ships an `app` contribution); `applets`
  // are projected applet contributions, and `defaults` are layered default-surface references.
  const boot = (apps, applets = [], defaults = []) => ({
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: {
      schemaVersion: 1,
      contributions: [
        ...apps.map((a) => ({ type: 'app', target: '', name: a.id, sourceApp: a.id, payload: a, order: 0 })),
        ...applets.map((p) => ({ type: 'applet', target: '', name: `${p.appId}.${p.appletId}`, sourceApp: p.appId, payload: p, order: 0 })),
        ...defaults.map((d, i) => ({ type: 'default-surface', target: d.app, name: 'default', sourceApp: d.app, payload: d.ref, order: i })),
      ],
    },
  })
  const ravenChat = { appletId: 'chat', appId: 'raven', assetUrl: '/chat.js', label: 'Chat', kind: 'framed' }

  it('an app-qualified applet ref resolves to a Surface owned by the REFERENCED app', () => {
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: true }, { id: 'raven', name: 'Raven' }],
      [ravenChat],
      [{ app: 'demo', ref: { applet: 'chat', app: 'raven' } }],
    ))
    // Surface ownership follows `app: raven`, not the opened `demo`.
    expect(initialSurface('demo')).toEqual({ kind: 'applet', appletId: 'chat', appId: 'raven' })
  })

  it('an app-qualified dashboard ref resolves to the referenced app dashboard', () => {
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: false }, { id: 'crm', name: 'CRM', hasDashboard: true }],
      [],
      [{ app: 'demo', ref: { dashboard: true, app: 'crm' } }],
    ))
    expect(initialSurface('demo')).toEqual({ kind: 'builtin', view: 'dashboard', appId: 'crm' })
  })

  it('a cross-app doctype-list ref resolves to a Surface owned by the doctype’s app', () => {
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: false }, { id: 'crm', name: 'CRM', modules: [{ name: 'CRM', doctypes: ['CRM Lead'] }] }],
      [],
      [{ app: 'demo', ref: { doctype: 'CRM Lead', view: 'list' } }],
    ))
    // The doctype names its owning app, so the list surface is owned by crm even though demo opened.
    expect(initialSurface('demo')).toMatchObject({ kind: 'builtin', view: 'list', doctype: 'CRM Lead', appId: 'crm' })
  })

  it('a cross-app ref the viewer cannot see falls through to the next rung (permission gate)', () => {
    // raven ships no `app`/`applet` contribution → not visible → the ref is gated out and falls
    // through to demo's dashboard. A redirect never grants access (ADR-0010).
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: true }],
      [],
      [{ app: 'demo', ref: { applet: 'chat', app: 'raven' } }],
    ))
    expect(initialSurface('demo')).toEqual({ kind: 'builtin', view: 'dashboard', appId: 'demo' })
  })

  it('an invisible cross-app ref with no dashboard falls all the way to the empty-app pane', () => {
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: false }],
      [],
      [{ app: 'demo', ref: { dashboard: true, app: 'crm' } }],
    ))
    expect(initialSurface('demo')).toEqual({ kind: 'builtin', view: 'empty', appId: 'demo' })
  })

  it('a Site/User-layer override pointing cross-app is honoured (rides the App<Site<User merge)', () => {
    // Two default-surface contributions for demo: App-layer own-app applet, then a higher (Site/User)
    // layer override pointing cross-app to raven. The later layer wins the singleton patch-merge.
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: true }, { id: 'raven', name: 'Raven' }],
      [ravenChat],
      [{ app: 'demo', ref: { applet: 'home' } }, { app: 'demo', ref: { applet: 'chat', app: 'raven' } }],
    ))
    expect(initialSurface('demo')).toEqual({ kind: 'applet', appletId: 'chat', appId: 'raven' })
  })

  it('window identity ≠ surface ownership: the Window keeps the opened app, the Surface its referenced app', () => {
    const os = useOS()
    os.state.windows = []; os.state.geo = {}; os.state.activeId = null; os.state.split = null
    localStorage.clear()
    initRegistry(boot(
      [{ id: 'demo', name: 'Demo', hasDashboard: true }, { id: 'raven', name: 'Raven' }],
      [ravenChat],
      [{ app: 'demo', ref: { applet: 'chat', app: 'raven' } }],
    ))
    os.openApp('demo')
    const win = os.state.windows.find((w) => w.id === 'app:demo')
    expect(win).toBeTruthy()                          // window identity = the opened app (dock/icon/?instance)
    expect(surfaceAppId(win.surface)).toBe('raven')   // surface ownership = the referenced app (chrome/nav scope)
  })
})

describe('the Aspect set', () => {
  it('has stable ids with details as the default', () => {
    expect(FORM_ASPECTS.map((a) => a.id)).toEqual(['details', 'activities', 'email'])
    expect(DEFAULT_ASPECT).toBe('details')
  })

  it('isAspectId matches only the known ids', () => {
    expect(isAspectId('details')).toBe(true)
    expect(isAspectId('activities')).toBe(true)
    expect(isAspectId('email')).toBe(true)
    expect(isAspectId('L-1')).toBe(false)
    expect(isAspectId('')).toBe(false)
    expect(isAspectId(null)).toBe(false)
  })
})
