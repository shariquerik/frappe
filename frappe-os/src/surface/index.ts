// Surface: the descriptor of what a window hosts — either a built-in view rendered by
// generic OS machinery, or a reference to an applet contribution resolved at runtime
// (ADR-0012). Window chrome, geometry, focus, history and URL projection are agnostic to
// which kind a Surface is. This module is the constructors plus the small pure helpers
// over them; see docs/design/surface-and-registry.md.
import { useRegistry, appForDoctype, appletKind } from '@/registry'
import type { Surface, BuiltinSurface, AppletSurface, SurfaceRef } from '@/types'

// The Aspect set + helpers live in a pure leaf module (no store/registry deps); re-export
// them through the surface barrel so consumers keep one import path.
export * from './aspects'
import { DEFAULT_ASPECT } from './aspects'

// ---- constructors ------------------------------------------------------------
// `appId` is always populated (chrome/asset scoping need it); for doctype-bound views
// it is derived from the doctype so the doctype stays authoritative over the app.
export const dashboardSurface = (appId: string): BuiltinSurface => ({ kind: 'builtin', view: 'dashboard', appId })
export const listSurface = (doctype: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'list', doctype, recordName: null, appId: appForDoctype(doctype) })
// `aspect` is the form's selected facet (ADR-0018); omitted/default ('details') stays off the
// descriptor so an existing form surface/URL is byte-for-byte unchanged.
export const formSurface = (doctype: string, recordName: string, aspect?: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'form', doctype, recordName, appId: appForDoctype(doctype),
     ...(aspect && aspect !== DEFAULT_ASPECT ? { aspect } : {}) })
export const settingsSurface = (appId: string, tab = 'General'): BuiltinSurface =>
  ({ kind: 'builtin', view: 'settings', appId, params: { tab } })
// The OS-owned placeholder a Window opens on when its app declares no default surface and has
// no dashboard (rung 4 of the resolver, ADR-0021) — keeps every declared OS app openable
// rather than blank. The terminal fallback the dormant rung-3 doctype-list will replace.
export const emptyAppSurface = (appId: string): BuiltinSurface => ({ kind: 'builtin', view: 'empty', appId })
// The wallpaper picker — a system (not app-scoped) pane. Owned by the framework app so
// chrome/asset scoping has a real app to resolve, but opened as its own singleton window.
export const wallpaperSurface = (): BuiltinSurface => ({ kind: 'builtin', view: 'wallpaper', appId: 'frappe' })
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

// The Surface a Window opens on (ADR-0021), resolved top-down, first match wins — the resolver
// that replaces the old hardcoded dashboard→modules→applet inference. Geometry/focus/URL stay
// surface-agnostic (ADR-0012); this only chooses WHICH Surface a Window opens on.
export function initialSurface(appId: string): Surface {
  const reg = useRegistry()
  // Rung 1 — declared custom default: the layered (App<Site<User) default-surface reference,
  // resolved (own- or cross-app, permission-gated) into a Surface; a cross-app ref the viewer
  // can't see returns null here and falls through to the next rung.
  const declared = resolveRef(appId, reg.defaultSurface(appId))
  if (declared) return declared
  // Rung 2 — the app's dashboard, if any (how frappe/crm/erpnext land — now via the resolver).
  if (reg.app(appId)?.hasDashboard) return dashboardSurface(appId)
  // Rung 3 — first doctype list: DORMANT. It needs the app's exposed-doctype / nav source, a
  // deferred decision (ADR-0021 open question), so it is intentionally a no-op here and slots in
  // additively ABOVE rung 4 once settled. Do NOT resolve modules here — that would pre-empt it.
  // Rung 4 — empty-app pane: the OS-owned terminal fallback, so every declared OS app stays
  // openable rather than blank.
  return emptyAppSurface(appId)
}

// The app a surface belongs to — explicit on every constructed surface; for a bare
// doctype-bound surface fall back to its owning app, and never null (chrome/asset
// scoping always need one). The generic `openSurface` action routes through here.
export function surfaceAppId(s: Surface): string {
  if (s.kind === 'applet') return s.appId
  return s.appId || (s.doctype ? appForDoctype(s.doctype) : 'frappe')
}

// ---- pure helpers ------------------------------------------------------------
export const isBuiltin = (s?: Surface | null): s is BuiltinSurface => !!s && s.kind === 'builtin'

// Which sidebar a window's Surface drives (ADR-0018, ADR-0020): a form shows the Aspect rail;
// a framed applet shows NO rail (full-window — the framed SPA owns its own chrome, so a second
// OS nav rail beside it would clash); every other surface (list/dashboard/settings/native
// applet) keeps the app nav rail. The sidebar is the one chrome element that follows the
// Surface — geometry, focus and URL-projection mechanics stay surface-agnostic (ADR-0012).
export function sidebarKind(s?: Surface | null): 'aspect' | 'nav' | 'none' {
  if (isBuiltin(s)) return s.view === 'form' ? 'aspect' : 'nav'
  if (s?.kind === 'applet') return appletKind(s.appletId) === 'framed' ? 'none' : 'nav'
  return 'nav'
}

// The settings tab a settings surface carries (defaults to General).
export const surfaceTab = (s: Surface): string => (isBuiltin(s) && (s.params?.tab as string)) || 'General'

// Window role is encoded by the id prefix (the id is built from the role at open time),
// so it is derived, never stored — the Surface describes the *content*, the id describes
// the window *instance*. 'settings' = a settings pane, 'wallpaper' = the singleton
// wallpaper picker, everything else is a navigable 'app' window (a record opened in a new
// window is an ordinary app Instance, ADR-0017 — there is no record-only window role).
export function windowRole(id: string): 'app' | 'settings' | 'wallpaper' {
  if (id.startsWith('settings:')) return 'settings'
  if (id === 'wallpaper') return 'wallpaper'
  return 'app'
}

// Two surfaces are "the same place" — used by per-window history to skip a no-op nav.
export function sameSurface(a?: Surface | null, b?: Surface | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'applet') return a.appletId === (b as typeof a).appletId
  const y = b as BuiltinSurface
  // The Aspect is part of a form's content address (ADR-0018), so two aspects of one record are
  // NOT the same place — per-window history then steps between them like any other navigation.
  return a.view === y.view && (a.doctype || '') === (y.doctype || '')
    && (a.recordName || '') === (y.recordName || '') && (a.aspect || '') === (y.aspect || '')
}
