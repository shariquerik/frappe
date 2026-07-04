// Registry contribution + boot payload shapes (surface-and-registry.md §2). The index
// logic lives in ./index.ts; the boot payload that seeds it is fetched in data/boot.ts.
// Re-exported via @/types.

// A single Registry contribution. Identity tuple (type,target,name,sourceApp) is unique
// across the merged registry (ADR-0007); `payload` is type-specific (AppDef for 'app',
// DoctypeMeta for 'display-config', DoctypeViewPayload for 'doctype-view', Card for
// 'dashboard-card'). `order` orders collections / breaks singleton patch ties.
export interface Contribution {
  type: string
  target: string
  name: string
  sourceApp: string
  payload: unknown
  order?: number
}

// A `default-surface` contribution's payload (ADR-0021): the stable, app-qualified surface
// REFERENCE an app/site/user declares as a Window's default surface — never the internal Surface
// descriptor, so the OS can refactor Surfaces beneath it. One of three shapes (an applet, a
// doctype list/view, or the dashboard), with an optional `app:` qualifier naming the OWNING app
// (defaults to the opened app). The server validates the shape and carries it through as data;
// the client resolver (slice 05) parses it into a Surface. It is a Singleton per app, layered
// App-default < Site < User via the existing shallow patch-merge (ADR-0005/0007) — a per-user
// default is just a User-layer override of this Singleton, touching only the surface reference.
export interface SurfaceRef {
  applet?: string
  doctype?: string
  view?: string
  // The record a form reference targets (ADR-0024): a Recents entry / form Placement pins a
  // {doctype, name, view:'form'}. Absent for the list/app/dashboard/applet shapes.
  name?: string
  dashboard?: boolean
  app?: string
}

// How the OS classifies a contributing app from its Registry contributions alone (ADR-0014
// item 4): a `feature` app ships a doctype/view/applet/card surface; a `pure-customization`
// app contributes only chrome (command/action/patch). Used to decide whether a chrome removal
// is the surprising case (warned loudly) or the everyday one (quiet).
export type AppKind = 'feature' | 'pure-customization'

// The server-merged, permission-filtered Registry the boot payload carries
// (ADR-0005/0010). `schemaVersion` is tolerant (ADR-0008): the client indexes the
// contribution types it knows and ignores the rest, so newer/older servers degrade.
export interface OsRegistryData {
  schemaVersion: number
  contributions: Contribution[]
}

// What www/os.py injects (or the whitelisted boot() returns): the logged-in user, the
// CSRF token used to sign writes, the user's roles, the merged Registry, and the
// permission map. Read from untrusted globals / JSON, so everything is best-effort:
// `registry` may be a legacy bare array, so registry/index.ts guards the shape before use.
export interface BootData {
  user: string | null
  // The logged-in user's display name (full name, falling back to the user id when the
  // user has none) — drives the menu-bar label and dashboard greeting. Optional so an
  // older server / offline boot degrades to a neutral state rather than demo data.
  user_fullname?: string
  csrf_token: string
  roles: string[]
  registry: OsRegistryData | unknown[]
  permissions: Record<string, Record<string, boolean>>
  // The server-resolved desktop/dock Placements (ADR-0023): App-default baseline ∪ role-scoped
  // Site ⊕ User overrides, already merged + permission-gated. Tolerant like `registry` (ADR-0008):
  // an older server omits it, so the placements seam guards the shape (→ empty desktop/dock).
  placements?: unknown[]
  // The server-resolved per-user Recents log (ADR-0024): record opens, newest-first, deduped +
  // permission-gated + capped. Tolerant like `placements` — an older server omits it (→ empty Recents).
  recents?: unknown[]
  // The server-resolved wallpaper catalog (ADR-0036): global defaults ∪ the caller's own uploads,
  // and their chosen wallpaper name (`wallpaper`, the selection roams per-user in frappe.defaults).
  // Tolerant like `placements` — an older server omits them, so the wallpaper seam falls back to
  // the built-in default (→ Duotone) with an empty catalog.
  wallpapers?: unknown[]
  wallpaper?: string | null
  // Realtime coordinates for the OS socket seam (data/realtime.ts). `sitename` names the per-site
  // Socket.IO namespace (`/{sitename}`); `socketio_port` is where the realtime process listens
  // (used only in dev); `developer_mode` picks the dev host (explicit port) over the production
  // same-origin path. All optional/tolerant (ADR-0008) — an older server omits them, so the
  // realtime seam simply degrades to no live refresh rather than throwing.
  sitename?: string
  socketio_port?: number
  developer_mode?: boolean
}
