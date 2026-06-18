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
  AppDef, BootData, Card, Contribution, DoctypeMeta, DoctypeViewPayload, OsRegistryData,
} from '@/types'

// Extension-point types this client understands (ADR-0004 closed-but-data-driven set).
const APP_T = 'app'
const DISPLAY = 'display-config'
const VIEW = 'doctype-view'
const CARD = 'dashboard-card'

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
}

function indexContributions(contribs: Contribution[]): RegistryIndex {
  const sorted = [...contribs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const apps = sorted.filter((c) => c.type === APP_T).map((c) => c.payload as AppDef)
  const ix: RegistryIndex = {
    apps, appById: Object.fromEntries(apps.map((a) => [a.id, a])),
    display: {}, views: {}, cards: {}, owner: ownerMap(apps),
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
// Two seams over one source: sync knownApplet (routing/palette/persistence — "does
// this id exist?") and async resolveApplet (mount — "give me the Vue component").
// Today the OS ships a LOCAL map of FIRST-PARTY applets; the server `applet`
// emission and the external ESM / import-map loader are deferred BEHIND resolveApplet
// (its async-by-id contract is exactly what a dynamic import() will satisfy), so this map
// is the only thing that grows when they land — callers never change.
interface AppletEntry {
  appId: string
  label: string
  load: () => Promise<{ default: Component }>
}
const APPLETS: Record<string, AppletEntry> = {
  'my-todos': { appId: 'frappe', label: 'My open ToDos', load: () => import('@/components/MyTodos.vue') },
}

// One enumerable applet info row (palette entry points read this).
export interface AppletInfo { appletId: string; appId: string; label: string }

export function listApplets(): AppletInfo[] {
  return Object.entries(APPLETS).map(([appletId, c]) => ({ appletId, appId: c.appId, label: c.label }))
}

// Sync existence check: an applet id known AND owned by the given app (the URL scheme
// is /<appId>/<appletId>, so the app must match for the path to be canonical).
export function knownApplet(appId: string, appletId: string): boolean {
  const c = APPLETS[appletId]
  return !!c && c.appId === appId
}

// Async resolution to the Vue component (the module's default export IS the SFC).
export async function resolveApplet(appletId: string): Promise<Component> {
  const c = APPLETS[appletId]
  if (!c) throw new Error(`Unknown applet contribution: ${appletId}`)
  return (await c.load()).default
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
  }
}
