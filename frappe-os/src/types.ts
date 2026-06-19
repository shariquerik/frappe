// Shared domain types for the Frappe OS shell. Starts minimal — only what the first
// migrated modules need — and grows as more of `store/*` and `config/*` move to TS.
// `OsStore` (bottom of file) is now `ReturnType<typeof useOS>` — the real store surface,
// derived rather than hand-maintained. The import is type-only, so it is erased at
// runtime and the types.ts ⇄ store import cycle never materializes.
import type { Component } from 'vue'
import type { useOS } from '@/store'

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
// surface.ts `windowRole`); its `surface` describes the content. The two were the old
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

export type Theme = 'light' | 'dark'

// The shared reactive desktop state (store/state.ts). One module singleton that every
// store slice mutates; useOS() exposes it directly. `geo` is sparse — a per-window patch
// over the by-index defaults that geoMap merges in. `menu`/`dockMenu` hold the id of the
// open menu-bar / dock popover (null when closed); `split` is a [rightId, leftId] pair.
export interface OsState {
  windows: OsWindow[]
  geo: Record<string, Partial<Geo>>
  activeId: string | null
  menu: string | null
  split: [string, string] | null
  paletteOpen: boolean
  paletteQuery: string
  theme: Theme
  wallpaper: string | null
  wpPicker: boolean
  toggles: Record<string, boolean>
  sidebarHidden: Record<string, boolean>
  dockMenu: string | null
  // Logged-in display name for the dashboard greeting. Not seeded yet (the shell
  // hardcodes a fallback), so it stays optional until boot wires the real user.
  userName?: string
}

// The route's path params, as parsed by the router. Any segment may be absent
// (a bare desktop has none); dead doctype/record names degrade gracefully downstream.
export interface RouteParams {
  app?: string
  doctype?: string
  name?: string
}

// ── Curated config (config/apps.ts, config/doctypes.ts) ──────────────────────────
// Display + structure only; no records. List/count values come live from the records
// store, so nothing here holds data.

// A list filter value: either an equality (`'Open'`) or an operator tuple
// (`['in', ['Unpaid', 'Overdue']]`), matching Frappe's filter syntax.
export type FilterValue = string | [string, unknown[]]

// A dashboard card definition (the value is fetched live, not stored here).
export interface Card {
  label: string
  sub: string
  doctype: string
  filters?: Record<string, FilterValue>
  fieldname?: string
}

// A module groups doctypes under an app; the first module to list a doctype owns it.
export interface AppModule {
  name: string
  doctypes: string[]
}

export interface AppDef {
  id: string
  name: string
  glyph: string
  hex: string
  logo: string
  hasDashboard: boolean
  dashTitle: string
  recentDoctype: string
  cards: Card[]
  modules: AppModule[]
}

// A desktop wallpaper option (id + label + CSS background; `dark` flips chrome to the
// dark palette). The full set lives in store/windows.ts's wallpaperDefs().
export interface WallpaperDef {
  id: string
  label: string
  bg: string
  dark: boolean
}

// One command-palette result: a label/subtitle/icon row plus the action it runs when
// chosen. Built live in store/palette.ts from the curated apps + their doctypes.
export interface PaletteItem {
  label: string
  sub: string
  icon: string
  kindLabel: string
  run: () => void
}

// A themed pill's resolved CSS custom-property values.
export interface Pill {
  bg: string
  fg: string
}

export type ColumnType = 'status' | 'currency' | 'avatar' | 'int'

export interface ListColumn {
  key: string
  label: string
  primary?: boolean
  width?: string
  type?: ColumnType
}

// Curated per-doctype display config. Field schemas come live from get_doctype_meta;
// this is just labels, colors, the status palette, and the list column choice.
export interface DoctypeMeta {
  label: string
  color: string
  icon: string
  titleField: string
  // Authoring marker (config/doctypes.ts): true for the placeholder `defineGeneric`
  // metas, false/absent for hand-tuned bespoke ones. The Registry overlay reads it to
  // let generic doctypes defer listColumns/statusField to the live server projection
  // (ADR-0011), while bespoke columns still win. Offline it stays the column fallback.
  generic?: boolean
  statusField?: string
  statusThemes?: Record<string, string>
  listColumns?: ListColumn[]
  // Optional curated list "saved views" chips. None of the current curated metas
  // set this, so the list falls back to a single "All" chip; typed here so the
  // OSList projection that reads it stays checked.
  savedViews?: { label: string; count?: number }[]
}

// One way a doctype can be presented (list/form/report/kanban/…). A COLLECTION member
// per ADR-0007: ordered, labelled, and flagged builtin (generic renderer) vs
// applet-backed (resolves to an AppletSurface via `appletId`). The Registry's
// `views(doctype)` projection (surface-and-registry.md §2). `defaults` carries default
// filters/sort/group for the view.
export interface DoctypeViewPayload {
  view: BuiltinView
  label: string
  builtin?: boolean
  appletId?: string
  defaults?: Record<string, unknown>
}

// The uniform prop bundle every view component (builtin OSList/OSForm or an applet-backed
// custom view) receives from DoctypeView: the doctype + active view name + optional record,
// the curated display config, viewer presence, and the OS navigation callbacks. Assembled by
// OSWindow from the focused window's surface; `recordName` is absent/`'new'` for a blank
// create form. A view component declares the whole bundle and reads only what it needs.
export interface ViewProps {
  doctype: string
  view: BuiltinView
  recordName?: string | null
  meta: DoctypeMeta | null
  presence: { label: string }[]
  onOpen?: (doctype: string, name: string) => void // open a record (list → form)
  onNew?: (doctype: string) => void // start a blank create form
  onCreated?: (doctype: string, name: string) => void // after a create succeeds
}

// ── Data layer (api.ts) ────────────────────────────────────────────────────────
// A Frappe document as returned by the REST/whitelisted API: a free-form field bag
// that always carries at least `name`. Concrete doctypes aren't modeled — the shell
// reads fields dynamically via the curated config, not a per-doctype interface.
export interface FrappeDoc {
  name: string
  [field: string]: any
}

// One reactive cache slot in the records store: the load* actions flip `loading`,
// fill `data`, or set `error` (the caught message). `T` is the cached payload —
// a row array, a single doc, a card number, or the live field schema.
export interface CacheEntry<T> {
  loading: boolean
  data: T
  error: string | null
}

// Options for a list read (api.getList). All optional; the server applies defaults.
export interface GetListOptions {
  fields?: string[]
  limit?: number
  order_by?: string
  filters?: Record<string, FilterValue>
}

// ── Registry payload (surface-and-registry.md §2) ────────────────────────────────
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

// The server-merged, permission-filtered Registry the boot payload carries
// (ADR-0005/0010). `schemaVersion` is tolerant (ADR-0008): the client indexes the
// contribution types it knows and ignores the rest, so newer/older servers degrade.
export interface OsRegistryData {
  schemaVersion: number
  contributions: Contribution[]
}

// ── Boot payload (boot.ts) ───────────────────────────────────────────────────────
// What www/os.py injects (or the whitelisted boot() returns): the logged-in user, the
// CSRF token used to sign writes, the user's roles, the merged Registry, and the
// permission map. Read from untrusted globals / JSON, so everything is best-effort:
// `registry` may be a legacy bare array, so registry.ts guards the shape before use.
export interface BootData {
  user: string | null
  csrf_token: string
  roles: string[]
  registry: OsRegistryData | unknown[]
  permissions: Record<string, Record<string, boolean>>
}

// ── Store surface ────────────────────────────────────────────────────────────────
// `OsStore` is the *exact* surface useOS() returns — derived from the assembly in
// store/index.ts (see the type-only import at the top) rather than hand-maintained, so
// it can never drift from the real store. Consumers that take the store explicitly
// (route-map.ts, and later the typed components) annotate against this; a Vue
// computed/ref member is exposed as `{ value }`.
export type OsStore = ReturnType<typeof useOS>

// ── OS API seam (os-api.ts) ──────────────────────────────────────────────────────
// The single, narrow object every component & script receives to reach Frappe OS
// (ADR-0003) — the only seam; applets never touch the store, router, api.ts or
// records.ts directly. Additive-only (ADR-0008): grow these interfaces, never reshape.
// Built on top of api.ts (reads + the `call` escape hatch), the records store (writes,
// so the shared caches stay coherent), the window store actions, and curated config.

// Data access. Reads + `call` go straight to api.ts (they throw on error and never
// touch the shared list/doc caches, so a component's filtered read can't clobber what
// a built-in view shows); writes go through the records store so those caches refresh.
export interface OsData {
  getList(doctype: string, options?: GetListOptions): Promise<FrappeDoc[]>
  getDoc(doctype: string, name: string): Promise<FrappeDoc>
  saveDoc(doctype: string, name: string, changes: Record<string, unknown>): Promise<FrappeDoc>
  createDoc(doctype: string, values: Record<string, unknown>): Promise<FrappeDoc>
  call(method: string, params?: Record<string, unknown>): Promise<any>
}

// Window lifecycle. `open` dispatches any Surface to its owning app window;
// `focus` raises + un-minimizes; `close` disposes.
export interface OsWindows {
  open(surface: Surface): void
  close(id: string): void
  focus(id: string): void
}

// User feedback. `notify` is a transient toast; `confirm` resolves true/false.
export interface OsUi {
  notify(message: string): void
  confirm(message: string): Promise<boolean>
}

// A permission action. Open string (ADR-0004): the common four plus whatever the
// server-merged permission map carries.
export type PermissionType = 'read' | 'write' | 'create' | 'delete' | string

// Read-only session facts, projected from the resolved BootData. `hasPermission`
// reads BootData.permissions[doctype][ptype] (Frappe-style read/write/create/delete),
// defaulting to false; `roles` is the server-supplied role list (BootData.roles).
export interface OsSession {
  user: string | null
  roles: string[]
  hasPermission(doctype: string, ptype?: PermissionType): boolean
}

// Read-only registry projections (surface-and-registry.md §2). Step 3 backs these with
// useRegistry(); step 4 swaps useRegistry()'s source to the server-merged Registry with
// no change to this shape. `views` is the real DoctypeViewPayload collection (was a
// `string[]` placeholder in step 2).
export interface OsRegistry {
  displayConfig(doctype: string): DoctypeMeta | null
  views(doctype: string): DoctypeViewPayload[]
  // Resolve an applet contribution to its Vue component by id (ADR-0009, async-by-id).
  // First-party applets resolve from a local map; external ESM loading is deferred
  // behind this same seam, so the contract never changes when it lands.
  resolveApplet(appletId: string): Promise<Component>
}

export interface OsApi {
  data: OsData
  windows: OsWindows
  ui: OsUi
  session: OsSession
  registry: OsRegistry
  // Feature detection (ADR-0008): components test a capability before using it
  // instead of sniffing OS API versions. Additive — flip false→true as features land.
  capabilities: Record<string, boolean>
}
