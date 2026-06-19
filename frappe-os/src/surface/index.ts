// Surface: the descriptor of what a window hosts — either a built-in view rendered by
// generic OS machinery, or a reference to an applet contribution resolved at runtime
// (ADR-0012). Window chrome, geometry, focus, history and URL projection are agnostic to
// which kind a Surface is. This module is the constructors plus the small pure helpers
// over them; see docs/design/surface-and-registry.md.
import { useRegistry, appForDoctype } from '@/registry'
import type { Surface, BuiltinSurface, AppletSurface } from '@/types'

// ---- constructors ------------------------------------------------------------
// `appId` is always populated (chrome/asset scoping need it); for doctype-bound views
// it is derived from the doctype so the doctype stays authoritative over the app.
export const dashboardSurface = (appId: string): BuiltinSurface => ({ kind: 'builtin', view: 'dashboard', appId })
export const listSurface = (doctype: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'list', doctype, recordName: null, appId: appForDoctype(doctype) })
export const formSurface = (doctype: string, recordName: string): BuiltinSurface =>
  ({ kind: 'builtin', view: 'form', doctype, recordName, appId: appForDoctype(doctype) })
export const settingsSurface = (appId: string, tab = 'General'): BuiltinSurface =>
  ({ kind: 'builtin', view: 'settings', appId, params: { tab } })
// An applet surface (ADR-0012): `appletId` resolves to a Vue component at
// mount; `props` are the serializable view-params handed to it via v-bind (os is never one).
export const appletSurface = (appId: string, appletId: string, props?: Record<string, unknown>): AppletSurface =>
  ({ kind: 'applet', appletId, appId, ...(props ? { props } : {}) })

// An app's landing surface: its dashboard, or the first module's first list.
export function initialSurface(appId: string): Surface {
  const a = useRegistry().app(appId)!
  return a.hasDashboard ? dashboardSurface(appId) : listSurface(a.modules[0].doctypes[0])
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

// The settings tab a settings surface carries (defaults to General).
export const surfaceTab = (s: Surface): string => (isBuiltin(s) && (s.params?.tab as string)) || 'General'

// Window role is encoded by the id prefix (the id is built from the role at open time),
// so it is derived, never stored — the Surface describes the *content*, the id describes
// the window *instance*. 'record' = a pinned form pop-out, 'settings' = a settings pane,
// everything else is a navigable 'app' window.
export function windowRole(id: string): 'app' | 'record' | 'settings' {
  if (id.startsWith('rec:')) return 'record'
  if (id.startsWith('settings:')) return 'settings'
  return 'app'
}

// Two surfaces are "the same place" — used by per-window history to skip a no-op nav.
export function sameSurface(a?: Surface | null, b?: Surface | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'applet') return a.appletId === (b as typeof a).appletId
  const y = b as BuiltinSurface
  return a.view === y.view && (a.doctype || '') === (y.doctype || '') && (a.recordName || '') === (y.recordName || '')
}
