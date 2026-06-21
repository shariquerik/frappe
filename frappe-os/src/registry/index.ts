// useRegistry(): the client-side Registry seam (docs/design/surface-and-registry.md §2).
// registry.ts indexes a flat Contribution[] into the projections every generic renderer
// reads (apps / display config / views / cards) — the SINGLE config/* importer. Two modes
// (ADR-0005/0010/0011):
//   - SERVER PRESENT (boot.registry): index the server-projected payloads DIRECTLY
//     (label/titleField/listColumns/statusField from Desk meta), then OVERLAY the
//     OS-native presentation Desk can't express — app glyph/hex/logo/modules/cards/
//     dashboard prefs, doctype icon/color/statusThemes/curated columns — keyed by id.
//     A doctype the server exposes but config/* does not curate still lights up from its
//     server payload: config is decoration now, no longer the source of "what exists".
//   - OFFLINE (no/legacy/junk registry): index the full config/* SEED unchanged — the
//     pure offline / unit-test fallback (ADR-0008 tolerance).
// Boot seeds the index once (initRegistry), mirroring os-api's initOsApi/getOsApi, so
// useRegistry() stays synchronous for renderers (ADR-0008, additive — surface unchanged).
import type { Component } from 'vue'
import { APP, APP_ORDER } from '@/config/apps'
import { doctypes } from '@/config/doctypes'
import type {
  Action, AppDef, BootData, Card, Command, Contribution, DoctypeMeta, DoctypeViewPayload,
  OsRegistryData,
} from '@/types'

// Extension-point types this client understands (ADR-0004 closed-but-data-driven set).
const APP_T = 'app'
const DISPLAY = 'display-config'
const VIEW = 'doctype-view'
const CARD = 'dashboard-card'
const APPLET = 'applet'
const COMMAND = 'command'   // the Action model's verb (CONTEXT.md → Command)
const ACTION = 'action'     // a verb's placement into a Region (CONTEXT.md → Action)

// ── seed: config/* → the App-default Contribution[] (§2 shapes) ──────────────────
// First app whose modules list a doctype owns it (registry order); else frappe.
function seedOwner(doctype: string): string {
  for (const id of APP_ORDER) {
    if ((APP[id].modules || []).some((m) => m.doctypes.includes(doctype))) return id
  }
  return 'frappe'
}

function viewContribution(doctype: string, name: string, label: string, app: string, order: number): Contribution {
  return { type: VIEW, target: doctype, name, sourceApp: app, payload: { view: name, label, builtin: true }, order }
}

function appContributions(out: Contribution[]): void {
  APP_ORDER.forEach((id, order) => out.push({ type: APP_T, target: '', name: id, sourceApp: id, payload: APP[id], order }))
}

// Cards live nested in AppDef for authoring; the seed splits them into a real
// dashboard-card COLLECTION per app (ADR-0007), one source for useRegistry().cards.
function cardContributions(out: Contribution[]): void {
  for (const id of APP_ORDER) {
    APP[id].cards.forEach((card, order) =>
      out.push({ type: CARD, target: id, name: `${card.doctype}:${order}`, sourceApp: id, payload: card, order }))
  }
}

function doctypeContributions(out: Contribution[]): void {
  for (const doctype of Object.keys(doctypes)) {
    const app = seedOwner(doctype)
    out.push({ type: DISPLAY, target: doctype, name: 'display', sourceApp: app, payload: doctypes[doctype] })
    out.push(viewContribution(doctype, 'list', 'List', app, 0))
    out.push(viewContribution(doctype, 'form', 'Form', app, 1))
  }
}

function seedContributions(): Contribution[] {
  const out: Contribution[] = []
  appContributions(out)
  cardContributions(out)
  doctypeContributions(out)
  return out
}

// ── index: Contribution[] → the projections renderers read ───────────────────────
interface RegistryIndex {
  apps: AppDef[]
  appById: Record<string, AppDef>
  display: Record<string, DoctypeMeta>          // singleton per doctype (patch-merged)
  views: Record<string, DoctypeViewPayload[]>   // ordered collection per doctype
  cards: Record<string, Card[]>                 // ordered collection per app
  owner: Record<string, string>                 // doctype → owning app
  applets: Record<string, AppletEntry>          // appletId → resolvable entry (ADR-0009)
  commands: Command[]                           // Action-model verbs folded from app hooks
  actions: Action[]                             // Action-model placements folded from app hooks
}

function ownerMap(apps: AppDef[]): Record<string, string> {
  const owner: Record<string, string> = {}
  for (const a of apps) for (const m of a.modules || []) for (const dt of m.doctypes) owner[dt] ??= a.id
  return owner
}

// Fold one contribution into the index: singletons shallow patch-merge (ADR-0007, so a
// later partial layer can add/override fields); collections accumulate in sorted order.
function addToIndex(ix: RegistryIndex, c: Contribution): void {
  if (c.type === DISPLAY) {
    ix.display[c.target] = { ...ix.display[c.target], ...(c.payload as DoctypeMeta) }
    ix.owner[c.target] ??= c.sourceApp // server projects ownership via _app_of (fills uncurated)
  }
  else if (c.type === VIEW) (ix.views[c.target] ||= []).push(c.payload as DoctypeViewPayload)
  else if (c.type === CARD) (ix.cards[c.target] ||= []).push(c.payload as Card)
  else if (c.type === APPLET) {
    const p = c.payload as AppletPayload
    ix.applets[p.appletId] = { appId: p.appId, label: p.label, assetUrl: p.assetUrl }
  }
  // Command/Action are Collections (ADR-0007): each app's hook-declared contributions
  // accumulate here, then compete against the first-party OS defaults in the resolver
  // (the contextual override that lets erpnext re-title New window — Slice 2).
  else if (c.type === COMMAND) ix.commands.push(c.payload as Command)
  else if (c.type === ACTION) ix.actions.push(c.payload as Action)
}

function indexContributions(contribs: Contribution[]): RegistryIndex {
  const sorted = [...contribs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const apps = sorted.filter((c) => c.type === APP_T).map((c) => c.payload as AppDef)
  const ix: RegistryIndex = {
    apps, appById: Object.fromEntries(apps.map((a) => [a.id, a])),
    display: {}, views: {}, cards: {}, owner: ownerMap(apps),
    applets: { ...FIRST_PARTY }, // bundled first-party; server applet contributions fold in below
    commands: [], actions: [], // first-party File Commands/Actions live in @/actions; these fold the server's
  }
  for (const c of sorted) addToIndex(ix, c)
  return ix
}

// ── server overlay (ADR-0011): index server payloads, decorate with OS-native bits ──
// boot.registry only if it is a Registry object (ADR-0008 tolerance): a legacy bare
// array or junk → null, and the full config seed stands (offline / tests).
function asServerRegistry(registry: unknown): OsRegistryData | null {
  const r = registry as OsRegistryData
  return r && typeof r.schemaVersion === 'number' && Array.isArray(r.contributions) ? r : null
}

function keysOf(reg: OsRegistryData, type: string, key: (c: Contribution) => string): Set<string> {
  return new Set(reg.contributions.filter((c) => c.type === type).map(key))
}

// Presentation Desk can't express (ADR-0011): curated icons/colors/status palettes/columns
// kept client-side, keyed by doctype, shallow-merged OVER the server payload (curated wins).
const OS_NATIVE_META = ['color', 'icon', 'statusField', 'statusThemes', 'listColumns', 'savedViews'] as const
// Generic placeholder metas defer these to the live server projection (which reflects the
// doctype's real in_list_view / status fields); only hand-tuned bespoke columns override it.
const BESPOKE_ONLY = ['statusField', 'listColumns']

function osNativeMeta(doctype: string): Partial<DoctypeMeta> {
  const meta = doctypes[doctype]
  if (!meta) return {}
  const out: Partial<DoctypeMeta> = {}
  for (const key of OS_NATIVE_META) {
    if (meta[key] === undefined || (meta.generic && BESPOKE_ONLY.includes(key))) continue
    (out as Record<string, unknown>)[key] = meta[key]
  }
  return out
}

// App payload = curated branding (glyph/hex/logo/modules/dashboard prefs) ⊕ the server's
// identity (id/name), cards filtered to the doctypes the user may read (ADR-0010).
function appPayloadFor(server: AppDef, permitted: Set<string>): AppDef {
  const curated = APP[server.id]
  if (!curated) return server
  return { ...curated, ...server, cards: curated.cards.filter((c) => permitted.has(c.doctype)) }
}

// Cards are OS-native (no server projection) — inject the curated collection for each
// exposed app, dropping cards whose doctype the user may not read (ADR-0010 visibility).
function curatedCards(apps: Set<string>, permitted: Set<string>): Contribution[] {
  const out: Contribution[] = []
  for (const id of APP_ORDER) {
    if (!apps.has(id)) continue
    APP[id].cards.forEach((card, order) => {
      if (permitted.has(card.doctype))
        out.push({ type: CARD, target: id, name: `${card.doctype}:${order}`, sourceApp: id, payload: card, order })
    })
  }
  return out
}

// Decorate one server contribution with OS-native presentation; views/unknown pass through.
function decorate(c: Contribution, permitted: Set<string>): Contribution {
  if (c.type === APP_T) return { ...c, payload: appPayloadFor(c.payload as AppDef, permitted) }
  if (c.type === DISPLAY) return { ...c, payload: { ...(c.payload as DoctypeMeta), ...osNativeMeta(c.target) } }
  return c
}

// Index the server registry directly (ADR-0011): decorate each contribution with the
// OS-native overlay, then add the curated, visibility-filtered card collection.
function overlayServer(server: OsRegistryData): Contribution[] {
  const docs = keysOf(server, DISPLAY, (c) => c.target)
  const apps = keysOf(server, APP_T, (c) => c.name)
  const out = server.contributions.map((c) => decorate(c, docs))
  out.push(...curatedCards(apps, docs))
  return out
}

function buildIndex(boot?: BootData | null): RegistryIndex {
  const server = boot ? asServerRegistry(boot.registry) : null
  return indexContributions(server ? overlayServer(server) : seedContributions())
}

// ── boot seeding + the synchronous seam ──────────────────────────────────────────
let index: RegistryIndex | null = null

// Seed the effective registry once boot resolves (mirrors os-api's initOsApi). After
// this every useRegistry()/getMeta call is a synchronous index lookup for renderers.
export function initRegistry(boot?: BootData | null): void {
  index = buildIndex(boot)
}

// Lazily seed from config when initRegistry hasn't run (unit tests, pre-boot reads),
// so the seam stays synchronous without a boot dependency.
function ensureIndex(): RegistryIndex {
  if (!index) index = buildIndex(null)
  return index
}

// Which app owns a doctype — a projection over the indexed app collection.
export function appForDoctype(doctype: string): string {
  return ensureIndex().owner[doctype] || 'frappe'
}

// Synchronous display-config lookup — the merged singleton for a doctype (null if none).
export function getMeta(doctype: string): DoctypeMeta | null {
  return ensureIndex().display[doctype] || null
}

// ── applet contributions (ADR-0009) ───────────────────────────────────────────
// Two seams over one source (the indexed `applets` map): sync knownApplet
// (routing/palette/persistence — "does this id exist?") and async resolveApplet (mount —
// "give me the Vue component"). The map is seeded FIRST_PARTY ⊕ server `applet` contributions:
// FIRST_PARTY are bundled into the OS build (can't come from the server — they're static
// import()s the build code-splits); server contributions arrive from each app's `os_applets`
// hook (server emission A) and fold in at index time. Offline / unit-test = FIRST_PARTY only.
// An entry resolves a Vue component two ways (mutually exclusive): `load` for a FIRST-PARTY
// applet bundled into the OS (a static import the OS build code-splits), or `assetUrl` for a
// SEPARATELY-BUILT applet shipped in another app's public assets, loaded at runtime as native
// ESM (ADR-0009). The assetUrl path is the architecture's real promise — no OS rebuild when
// the app ships a new applet; the import map binds its externals to the host's singletons.
interface AppletEntry {
  appId: string
  label: string
  load?: () => Promise<{ default: Component }>
  assetUrl?: string
}

// The server `applet` contribution payload (ADR-0009, projected from the `os_applets` hook).
interface AppletPayload {
  appletId: string
  appId: string
  assetUrl: string
  label: string
}

const FIRST_PARTY: Record<string, AppletEntry> = {
  'my-todos': { appId: 'frappe', label: 'My open ToDos', load: () => import('@/applets/MyTodos') },
}

// One enumerable applet info row (palette entry points read this).
export interface AppletInfo { appletId: string; appId: string; label: string }

export function listApplets(): AppletInfo[] {
  return Object.entries(ensureIndex().applets).map(([appletId, c]) => ({ appletId, appId: c.appId, label: c.label }))
}

// Sync existence check: an applet id known AND owned by the given app (the URL scheme
// is /<appId>/<appletId>, so the app must match for the path to be canonical).
export function knownApplet(appId: string, appletId: string): boolean {
  const c = ensureIndex().applets[appletId]
  return !!c && c.appId === appId
}

// Load one entry to its Vue component (the loaded module's default export IS the SFC).
// `assetUrl` → native dynamic import of the separately-built artifact (ADR-0009; @vite-ignore
// keeps Vite from trying to bundle a runtime URL); else the first-party static `load`. The
// importer is injected so the assetUrl branch is unit-testable without a real network module.
type AppletImporter = (url: string) => Promise<{ default: Component }>
const importByUrl: AppletImporter = (url) => import(/* @vite-ignore */ url)

export async function loadApplet(entry: AppletEntry, importer: AppletImporter = importByUrl): Promise<Component> {
  const mod = entry.assetUrl ? await importer(entry.assetUrl) : await entry.load!()
  return mod.default
}

// Async resolution to the Vue component (the module's default export IS the SFC).
export async function resolveApplet(appletId: string): Promise<Component> {
  const c = ensureIndex().applets[appletId]
  if (!c) throw new Error(`Unknown applet contribution: ${appletId}`)
  return loadApplet(c)
}

// The merged, permission-filtered Registry seam (§2). Each accessor is a cheap lookup
// over the indexed contributions seeded at boot.
export function useRegistry() {
  const ix = ensureIndex()
  return {
    apps: (): AppDef[] => ix.apps,
    app: (id: string): AppDef | undefined => ix.appById[id],
    appForDoctype,
    displayConfig: getMeta,
    views: (doctype: string): DoctypeViewPayload[] => ix.views[doctype] || [],
    cards: (appId: string): Card[] => ix.cards[appId] || [],
    knownApplet,
    resolveApplet,
    listApplets,
    commands: (): Command[] => ix.commands,
    actions: (): Action[] => ix.actions,
  }
}
