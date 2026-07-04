// Surface + window shapes — the core descriptors the surface constructors (./index.ts)
// build and the chrome renders. Window chrome, geometry, focus, history and URL projection
// are agnostic to which kind of Surface a window hosts (ADR-0012). Re-exported via @/types.

// A built-in view name. OPEN string, not a closed union (ADR-0004): the OS has a generic
// renderer for some ('dashboard'|'list'|'form'|'settings'|'app-settings'); unknown ones fall through to
// a component or a fallback. New view kinds are additive, never a union edit.
export type BuiltinView = string

// A built-in view, rendered by generic OS machinery. `appId` is the owning app (always
// populated — chrome/asset scoping need it); `params` carries view-specific extras
// (e.g. the settings pane, later: filters/group-by).
export interface BuiltinSurface {
  kind: 'builtin'
  view: BuiltinView
  doctype?: string
  recordName?: string | null
  appId?: string
  // The selected Aspect of a form Surface (ADR-0018) — a coordinate on the form alongside
  // doctype + record, not a Surface kind of its own. URL-addressable (trailing path segment),
  // restored on reload and stepped by browser back/forward. Absent = the default ('details'),
  // which projects to the bare form path. Only meaningful when view === 'form'.
  aspect?: string
  params?: Record<string, unknown>
}

// An applet contribution, resolved by the runtime loader (ADR-0009). Referenced by id,
// never by import, so a Surface stays serializable.
export interface AppletSurface {
  kind: 'applet'
  appletId: string
  appId: string
  props?: Record<string, unknown>
}

// What a window hosts (ADR-0012): a built-in view or an applet contribution. Window
// chrome, geometry, focus, history and URL projection are agnostic to which kind it is.
// Must stay serializable (persistence + history + URL) — no functions/closures.
export type Surface = BuiltinSurface | AppletSurface

// A desktop window. Its `id` encodes the window IDENTITY: the role prefix (app/settings/system —
// see surface/index.ts `windowRole`) and, for an app window scoped to a workspace, the `(app,
// workspace)` pair (`app:<app>/<workspace>`, ADR-0042 — `windowWorkspace` reads it back). The
// `surface` describes only the CONTENT; the workspace is identity, not content, so it lives on the
// id and never on the surface. The two content fields were the old `type`/`view`/`doctype`/
// `recordName`, now unified (ADR-0012).
export interface OsWindow {
  id: string
  surface: Surface
  // Per-window nav history (app windows only): the chrome back/forward buttons pop these
  // Surfaces. Soft-capped at HIST_CAP and persisted; absent until the first navigation.
  back?: Surface[]
  fwd?: Surface[]
}

// One window's resolved geometry (geoMap merges per-index defaults with state.geo).
export interface Geo {
  x: number
  y: number
  w: number
  h: number
  z: number
  min?: boolean
  max?: boolean
}
