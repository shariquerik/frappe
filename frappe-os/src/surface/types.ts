// Surface + window shapes — the core descriptors the surface constructors (./index.ts)
// build and the chrome renders. Window chrome, geometry, focus, history and URL projection
// are agnostic to which kind of Surface a window hosts (ADR-0012). Re-exported via @/types.

// A built-in view name. OPEN string, not a closed union (ADR-0004): the OS has a generic
// renderer for some ('dashboard'|'list'|'form'|'settings'); unknown ones fall through to
// a component or a fallback. New view kinds are additive, never a union edit.
export type BuiltinView = string

// A built-in view, rendered by generic OS machinery. `appId` is the owning app (always
// populated — chrome/asset scoping need it); `params` carries view-specific extras
// (e.g. the settings tab, later: filters/group-by).
export interface BuiltinSurface {
  kind: 'builtin'
  view: BuiltinView
  doctype?: string
  recordName?: string | null
  appId?: string
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

// A desktop window. Its `id` prefix encodes the window role (app/record/settings — see
// surface/index.ts `windowRole`); its `surface` describes the content. The two were the old
// `type`/`view`/`doctype`/`recordName` fields, now unified (ADR-0012).
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
