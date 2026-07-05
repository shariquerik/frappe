// Surface: the descriptor of what a window hosts — either a built-in view rendered by
// generic OS machinery, or a reference to an applet contribution resolved at runtime
// (ADR-0012). Window chrome, geometry, focus, history and URL projection are agnostic to
// which kind a Surface is. This module is the constructors plus the small pure helpers
// over them; see docs/design/surface-and-registry.md.
import { useRegistry, appForDoctype, appletWantsNav } from '@/registry'
import type { Surface, BuiltinSurface, AppletSurface, SurfaceRef } from '@/types'

// The Aspect set + helpers live in a pure leaf module (no store/registry deps); re-export
// them through the surface barrel so consumers keep one import path.
export * from './aspects'
export * from './panes'
import { DEFAULT_ASPECT } from './aspects'

// ---- constructors ------------------------------------------------------------
// `appId` is always populated (chrome/asset scoping need it); for doctype-bound views
// it is derived from the doctype so the doctype stays authoritative over the app. A surface
// describes only CONTENT — the workspace it is scoped to is window identity (ADR-0042), carried on
// the window id (`windowWorkspace`), never on the descriptor.
export const dashboardSurface = (appId: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'dashboard', appId })
export const listSurface = (doctype: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'list', doctype, recordName: null, appId: appForDoctype(doctype) })
// `aspect` is the form's selected facet (ADR-0018); omitted/default ('details') stays off the
// descriptor so an existing form surface/URL is byte-for-byte unchanged.
export const formSurface = (doctype: string, recordName: string, aspect?: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'form', doctype, recordName, appId: appForDoctype(doctype),
     ...(aspect && aspect !== DEFAULT_ASPECT ? { aspect } : {}) })
export const appSettingsSurface = (appId: string, pane = 'General'): BuiltinSurface =>
  ({ kind: 'builtin', view: 'app-settings', appId, params: { pane } })
// The OS-owned placeholder a Window opens on when its app declares no default surface and has
// no dashboard (rung 4 of the resolver, ADR-0021) — keeps every declared OS app openable
// rather than blank. The terminal fallback the dormant rung-3 doctype-list will replace.
export const emptyAppSurface = (appId: string): BuiltinSurface => ({ kind: 'builtin', view: 'empty', appId })
// Settings — the per-user, desktop-wide (not app-scoped) singleton pane holding the user's
// Account plus the global preferences (General/window behavior, Appearance/theme, Wallpaper,
// Dock). Owned by the framework app so chrome/asset scoping has a real app to resolve, but
// opened as its own singleton window. `pane` selects which pane shows. (Renamed from "System
// Settings" — that name is reserved for a future site-wide surface, ADR-0027.)
export const settingsSurface = (pane = 'General'): BuiltinSurface =>
  ({ kind: 'builtin', view: 'settings', appId: 'frappe', params: { pane } })
// The Finder (ADR-0024) — the OS's cross-app navigator and the principal drag-source for
// Placements. Like Settings it is a desktop-wide singleton `system`-role window owned
// by the framework app (so chrome/asset scoping resolves), respawned-from-URL and never
// persisted. `location` selects the sidebar Location (Applications / Doctypes / Favorites).
export const finderSurface = (location = 'Applications'): BuiltinSurface =>
  ({ kind: 'builtin', view: 'finder', appId: 'frappe', params: { location } })
// An applet surface (ADR-0012): `appletId` resolves to a Vue component at
// mount; `props` are the serializable view-params handed to it via v-bind (os is never one).
export const appletSurface = (appId: string, appletId: string, props?: Record<string, unknown>): AppletSurface =>
  ({ kind: 'applet', appletId, appId, ...(props ? { props } : {}) })

// May the viewer see a surface owned by `app`? (ADR-0010.) The Registry is already
// permission-filtered server-side — an app the viewer can't access ships no `app`
// contribution, and an applet they can't see isn't projected — so presence in the Registry
// IS the client permission signal. A redirect never grants access (ADR-0021): a cross-app
// reference the viewer lacks permission for must fall through, never open.
const appVisible = (app: string): boolean => !!useRegistry().app(app)

// Resolve a declared default-surface REFERENCE (ADR-0021) into a Surface — rung 1 of the
// resolver. The reference is app-qualified and may point into ANOTHER app: the returned
// Surface is owned by the REFERENCED app (`ref.app`, defaulting to the opened app; a doctype
// names its own app), while the Window keeps the opened app's identity — surface ownership
// rides the per-surface `appId`, window identity rides the window id, so chrome/nav scope to
// the surface's app while the dock/icon stay the opened app's (ADR-0012/0016). A CROSS-APP
// reference is PERMISSION-GATED (ADR-0010): honoured only if the viewer may see that surface,
// else null so the resolver falls through to the next rung. Own-app references need no extra
// gate — the viewer opened the app. Returns null for an absent / unrecognised reference.
function resolveRef(openedApp: string, ref: SurfaceRef | null): Surface | null {
  if (!ref) return null
  const refApp = ref.app || openedApp
  const crossApp = refApp !== openedApp
  if (ref.applet) {
    if (crossApp && !(appVisible(refApp) && useRegistry().knownApplet(refApp, ref.applet))) return null
    return appletSurface(refApp, ref.applet)
  }
  if (ref.dashboard) {
    if (crossApp && !appVisible(refApp)) return null
    return dashboardSurface(refApp)
  }
  // A doctype names its own app, so listSurface already scopes the surface to that app — the
  // reference is inherently cross-app-capable, no `ref.app` needed. Only the trivially-
  // constructible list view resolves; other doctype views (form needs a record, report/kanban
  // are applet-backed) fall through. Gated when the doctype's app isn't the opened one.
  if (ref.doctype && ref.view === 'list') {
    if (appForDoctype(ref.doctype) !== openedApp && !appVisible(appForDoctype(ref.doctype))) return null
    return listSurface(ref.doctype)
  }
  return null
}

// The Surface a Window opens on when the APP is opened — dock click, palette, a bare `/os/<app>`
// deep link (ADR-0021), resolved top-down, first match wins. It layers the app's declared
// default-surface (rung 1) on top of the workspace body (rungs 2-4). Geometry/focus/URL stay
// surface-agnostic (ADR-0012); this only chooses WHICH Surface a Window opens on.
export function initialSurface(appId: string): Surface {
  // Rung 1 — declared custom default: the layered (App<Site<User) default-surface reference,
  // resolved (own- or cross-app, permission-gated) into a Surface; a cross-app ref the viewer
  // can't see returns null and falls through to the workspace body below.
  return resolveRef(appId, useRegistry().defaultSurface(appId)) ?? workspaceBodySurface(appId)
}

// The Surface a WORKSPACE window opens its BODY on (ADR-0042) — the app's default-surface (rung 1)
// is deliberately EXCLUDED. A directly-opened workspace is a workbench: its sidebar is the
// workspace's doctypes, its body the app's dashboard if it has one, else the empty pane. It must
// NOT inherit an app whose default surface is a full-window applet (e.g. raven's chat), which would
// hide the workbench. `initialSurface` layers rung 1 back on for app-level opens; `openWorkspace`
// (a tile-menu entry, a `/os/<app>/<workspace>` URL) opens on this so a workspace is always a workbench.
export function workspaceBodySurface(appId: string): Surface {
  const reg = useRegistry()
  // Rung 2 — the app's dashboard, if any (how frappe/crm/erpnext land).
  if (reg.app(appId)?.hasDashboard) return dashboardSurface(appId)
  // Rung 3 — first doctype list: DORMANT. It needs the app's exposed-doctype / nav source, a
  // deferred decision (ADR-0021 open question), so it is intentionally a no-op here and slots in
  // additively ABOVE rung 4 once settled. Do NOT resolve modules here — that would pre-empt it.
  // Rung 4 — empty-app pane: the OS-owned terminal fallback, so every declared OS app stays
  // openable rather than blank.
  return emptyAppSurface(appId)
}

// Does opening the APP (a tile click) land on a full-window applet instead of a workbench? True only
// when the app's default surface is an applet (raven's chat) — the case where the workbench can't be
// reached by clicking, so a tile's context menu needs its own "Open Workspaces" entry. A normal app
// already opens its workbench on click, so it gets no such entry.
export const opensAppletOnClick = (appId: string): boolean => initialSurface(appId).kind === 'applet'

// Resolve a Placement's surface reference (ADR-0023) into the Surface to open. Unlike resolveRef
// (the default-surface rung-1 resolver) this does NO permission gating: a resolved placement is
// ALREADY permission-filtered server-side, so re-gating here would be redundant and could only
// wrongly drop a pin the server already cleared. A bare-app reference ({app}) has no Surface of
// its own — it means "open the app's default surface" — so it returns null and the caller routes
// it through openApp instead (see App.vue's openPlacement).
export function placementSurface(ref: SurfaceRef): Surface | null {
  if (ref.applet && ref.app) return appletSurface(ref.app, ref.applet)
  if (ref.dashboard && ref.app) return dashboardSurface(ref.app)
  // A form reference (a Recents entry dragged out to a Placement, ADR-0024) reopens the record;
  // a list reference opens the list.
  if (ref.doctype && ref.view === 'form' && ref.name) return formSurface(ref.doctype, ref.name)
  if (ref.doctype && ref.view === 'list') return listSurface(ref.doctype)
  return null
}

// A bare-app reference ({app:'frappe'}, no applet/doctype/dashboard) — pin/open the app itself
// (its default surface), the desktop analog of clicking the dock icon (ADR-0023).
export const isAppRef = (ref: SurfaceRef): boolean =>
  !!ref.app && !ref.applet && !ref.doctype && !ref.dashboard

// The app a surface belongs to — explicit on every constructed surface; for a bare
// doctype-bound surface fall back to its owning app, and never null (chrome/asset
// scoping always need one). The generic `openSurface` action routes through here.
export function surfaceAppId(s: Surface): string {
  if (s.kind === 'applet') return s.appId
  return s.appId || (s.doctype ? appForDoctype(s.doctype) : 'frappe')
}

// ---- pure helpers ------------------------------------------------------------
export const isBuiltin = (s?: Surface | null): s is BuiltinSurface => !!s && s.kind === 'builtin'

// Which sidebar a window's Surface drives (ADR-0018, ADR-0026): a built-in form shows the Aspect
// rail and every other built-in (list/dashboard/settings) keeps the app nav rail. An applet's rail
// is its OWN explicit choice (ADR-0026 `nav` capability) — orthogonal to how it renders (`kind`):
// it gets the nav rail only when it opts in, otherwise none (full-window). So a native applet like
// ERPNext's erp-hello shows no rail by default, and a framed applet may still ask for one. The
// sidebar is the one chrome element that follows the Surface — geometry, focus and URL-projection
// mechanics stay surface-agnostic (ADR-0012).
export function sidebarKind(s?: Surface | null): 'aspect' | 'nav' | 'none' {
  if (isBuiltin(s)) return s.view === 'form' ? 'aspect' : 'nav'
  if (s?.kind === 'applet') return appletWantsNav(s.appletId) ? 'nav' : 'none'
  return 'nav'
}

// The settings pane a settings surface carries (defaults to General).
export const surfacePane = (s: Surface): string => (isBuiltin(s) && (s.params?.pane as string)) || 'General'

// Window role is encoded by the id prefix (the id is built from the role at open time),
// so it is derived, never stored — the Surface describes the *content*, the id describes
// the window *instance*. 'settings' = a per-app settings pane (id `app-settings:<app>`),
// 'system' = a singleton system-wide window (the per-user Settings window or the Finder,
// ADR-0024 — both share the system role's chrome and the hydrate/routing/persistence
// exclusions), everything else is a navigable 'app' window (a record opened in a new window
// is an ordinary app Instance, ADR-0017).
export function windowRole(id: string): 'app' | 'settings' | 'system' {
  if (id.startsWith('app-settings:')) return 'settings'
  if (id === 'settings' || id === 'finder') return 'system'
  return 'app'
}

// The workspace an app window is scoped to (ADR-0042), read from its id — the second half of the
// `(app, workspace)` identity a workbench window keys on (`app:<app>/<workspace>[#n]`). Undefined
// for a plain app window (`app:<app>`, the hub / single-workspace case) and for any non-app window,
// so a window that names no workspace projects to today's URL/Context unchanged. Pure id parse: the
// id is the sole home of the workspace, so this and `windowRole` derive it, never store it.
export function windowWorkspace(id: string): string | undefined {
  if (windowRole(id) !== 'app') return undefined
  const body = id.slice('app:'.length).replace(/#\d+$/, '')
  const slash = body.indexOf('/')
  return slash === -1 ? undefined : body.slice(slash + 1)
}

// The chrome/dock/menu-bar title for a non-app window, so all three name it identically: an app's
// settings pane reads "<App> settings", the per-user Settings window "Settings", the Finder
// "Finder". Returns null for an ordinary app window, whose title each surface derives itself (a
// record's title, a doctype's list, or the app name). `appName` is the resolved app display name,
// `view` the built-in surface view (only 'finder' is distinguished among system windows).
export function systemWindowTitle(role: ReturnType<typeof windowRole>, view: string | undefined, appName: string): string | null {
  if (role === 'settings') return appName + ' settings'
  if (role === 'system') return view === 'finder' ? 'Finder' : 'Settings'
  return null
}

// Is this window the Finder — the OS's desktop-shell navigator (ADR-0024)? True for the singleton
// `finder` system window. The Finder carries its host app's id ('frappe') only for chrome/asset
// scoping; the menu bar and its verbs name and route it by THIS, never by that id, so "Quit Finder"
// acts on the Finder and not the framework app. The bare desktop is the Finder shell too, but that
// (no-window) case is the caller's to handle — this takes a real window.
export function isFinderWindow(win: { id: string; surface: Surface }): boolean {
  return windowRole(win.id) === 'system' && isBuiltin(win.surface) && win.surface.view === 'finder'
}

// The Working-state SUBJECT of a surface (ADR-0029): a coarsened surface identity — not the full
// addressable coordinate `sameSurface` keys on — that scopes a window's work-in-progress within
// that window (`state.workingState[winId][subjectKey]`). Total: every surface has a subject.
// Crucially the form subject EXCLUDES the Aspect (unlike sameSurface): a draft belongs to the
// record, not the record-at-a-tab, so edits survive Details↔Activities. System/settings windows
// each host one content, so their subject mirrors their own window id (surface/index.ts
// `windowRole`): the per-user Settings and Finder by their bare id, an app's settings pane by
// `app-settings:<app>`. Any other built-in stays total via a per-app constant.
export function subjectKey(s: Surface): string {
  if (s.kind === 'applet') return `applet:${s.appId}:${s.appletId}`
  switch (s.view) {
    case 'list': return `list:${s.doctype}`
    case 'form': return `form:${s.doctype}:${s.recordName}`
    case 'dashboard': return `dashboard:${s.appId}`
    case 'settings': return 'settings'
    case 'finder': return 'finder'
    case 'app-settings': return `app-settings:${s.appId}`
    default: return `${s.view}:${s.appId ?? ''}`
  }
}

// Two surfaces are "the same place" — used by per-window history to skip a no-op nav.
export function sameSurface(a?: Surface | null, b?: Surface | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'applet') return a.appletId === (b as typeof a).appletId
  const y = b as BuiltinSurface
  // The Aspect is part of a form's content address (ADR-0018), so two aspects of one record are
  // NOT the same place — per-window history then steps between them like any other navigation. The
  // workspace is not compared: it is window identity (ADR-0042), fixed for the window's lifetime, so
  // two surfaces in one window always share it — it can never distinguish two places within a window.
  return a.view === y.view && (a.doctype || '') === (y.doctype || '')
    && (a.recordName || '') === (y.recordName || '') && (a.aspect || '') === (y.aspect || '')
}
