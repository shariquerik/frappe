// useRegistry(): the client-side Registry seam (docs/design/surface-and-registry.md §2).
// The seeded RegistryIndex (index-builder) exposes the projections every generic renderer reads
// (apps / display config / views / cards) — the curated-config importer for those, via ./ingest
// (the icon atlas comes through the sibling ./icons; both keep config/* behind the seam). Boot
// seeds the index once (initRegistry), mirroring os-api's initOsApi/getOsApi, so useRegistry()
// stays synchronous for renderers (ADR-0008, additive — surface unchanged).
import { classifyApp } from './classify'
import { asServerRegistry, decorate, overlayServer, seedContributions } from './ingest'
import { addToIndex, indexContributions, rebuildScopedViews } from './index-builder'
import type { RegistryIndex } from './index-builder'
import { loadApplet } from './applets'
import type { AppletInfo, AppletKind } from './applets'
import { ACTION, APPLET, COMMAND, DISPLAY } from './extension-points'
import type { Component } from 'vue'
import type {
  Action, AppDef, AppKind, BootData, Card, Command, Contribution, DoctypeMeta, DoctypeViewPayload, SurfaceRef,
} from '@/types'

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

// Which app owns a doctype — a projection over the indexed app collection. Falls back to
// frappe when the doctype is unowned OR its owner isn't a known OS-app window (e.g. a doctype
// resolved on demand whose module ships in a non-OS app): the list still opens, under frappe.
export function appForDoctype(doctype: string): string {
  const ix = ensureIndex()
  const owner = ix.owner[doctype]
  return owner && ix.appById[owner] ? owner : 'frappe'
}

// Fold a server-resolved doctype (uncurated — absent from the boot registry) into the live
// index so getMeta/appForDoctype/views light up for it on demand (resolve_doctype). Mirrors
// overlayServer's per-contribution decoration, so a runtime doctype renders identically to a
// booted one — the OS-native overlay still applies when config/* curates the doctype.
export function registerDoctype(contribs: Contribution[]): void {
  const ix = ensureIndex()
  const docs = new Set(contribs.filter((c) => c.type === DISPLAY).map((c) => c.target))
  for (const c of contribs) addToIndex(ix, decorate(c, docs))
}

// Fold a doctype's live-meta scoped Actions/Commands (ADR-0032) into the registry, keyed by
// doctype for idempotent replace — re-opening a doctype refreshes its slice, never duplicates it.
// This is the Doctype/View half of delivery-by-scope (ADR-0028): the App/OS half rides boot, this
// arrives with get_doctype_meta when the doctype opens. Eligibility (the Scope auto-`when`) gates a
// slice out when its doctype isn't front, so the overlay accumulates opened doctypes with no removal
// step. A doctype that ships no scoped contributions never touches the overlay — no needless refold.
export function registerScopedContributions(doctype: string, contribs: Contribution[]): void {
  const ix = ensureIndex()
  const actions = contribs.filter((c) => c.type === ACTION).map((c) => c.payload as Action)
  const commands = contribs.filter((c) => c.type === COMMAND).map((c) => c.payload as Command)
  if (!actions.length && !commands.length && !(doctype in ix.liveActions)) return
  ix.liveActions[doctype] = actions
  ix.liveCommands[doctype] = commands
  rebuildScopedViews(ix)
}

// Synchronous display-config lookup — the merged singleton for a doctype (null if none).
export function getMeta(doctype: string): DoctypeMeta | null {
  return ensureIndex().display[doctype] || null
}

// ── applet resolution (ADR-0009) ───────────────────────────────────────────────
// Two seams over one source (the indexed `applets` map): sync knownApplet (routing/palette/
// persistence — "does this id exist?") and async resolveApplet (mount — "give me the Vue
// component"). The map is seeded FIRST_PARTY ⊕ server `applet` contributions (index-builder);
// the applet TYPES and the loader live in ./applets.
export function listApplets(): AppletInfo[] {
  return Object.entries(ensureIndex().applets).map(([appletId, c]) => ({ appletId, appId: c.appId, label: c.label }))
}

// The content-production kind of an applet (ADR-0020), looked up by id. An unknown or
// flag-less applet is native (the default kind) — so the surface dispatch treats only a
// declared `framed` applet as full-window, and the core never names a specific app.
export function appletKind(appletId: string): AppletKind {
  return ensureIndex().applets[appletId]?.kind ?? 'native'
}

// Whether an applet opts into the OS app nav rail (ADR-0026), looked up by id. Orthogonal to
// `appletKind`: a native applet may want no rail (ERPNext's erp-hello) and a framed applet may
// want one. An unknown or flag-less applet wants NO rail — the OS never defaults nav on.
export function appletWantsNav(appletId: string): boolean {
  return ensureIndex().applets[appletId]?.nav ?? false
}

// Sync existence check: an applet id known AND owned by the given app (the URL scheme
// is /<appId>/<appletId>, so the app must match for the path to be canonical).
export function knownApplet(appId: string, appletId: string): boolean {
  const c = ensureIndex().applets[appletId]
  return !!c && c.appId === appId
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
    appletKind,
    appletWantsNav,
    resolveApplet,
    listApplets,
    commands: (): Command[] => ix.commandsView,
    actions: (): Action[] => ix.actionsView,
    // The app's declared surface reference after the layered App<Site<User merge (ADR-0021),
    // or null if it declares none — the resolver (slice 05) then falls through to dashboard →
    // empty-app pane. A stable reference, never a Surface descriptor: the resolver parses it.
    defaultSurface: (appId: string): SurfaceRef | null => ix.defaultSurface[appId] ?? null,
    appKind: (appId: string): AppKind => classifyApp(ix.appKinds[appId] ?? []),
  }
}
