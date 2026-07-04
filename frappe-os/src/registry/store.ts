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
  Action, AppDef, AppKind, BootData, Card, Command, Contribution, DoctypeMeta, DoctypeViewPayload, MenuDef, SurfaceRef, WorkspaceInfo,
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
  bootWorkspaces = boot?.workspaces ?? {}
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

// ── workspaces (ADR-0042) ───────────────────────────────────────────────────────
// The app-level axis (Selling, Stock). A window is identified by `(app, workspace_id)`, and the
// `workspace_id` is the immutable seeded slug the boot payload delivers (os_core/workspaces.py).
// The map is stashed at initRegistry; `appWorkspaces`/`workspaceForSlug` read it. An app the server
// shipped no workspace data for (offline boot, unit tests, an app without module data) falls back to
// the curated AppDef.modules — the fallback issue 06 retires once every first-party app ships data.
let bootWorkspaces: Record<string, WorkspaceInfo[]> = {}

// Fallback slug for an app with no seeded workspace data: the curated module name, slugified. Lossy
// (dash-style, collision-prone for multi-word names) — real ids ride the boot data above.
export const workspaceSlug = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, '-')

// The workspace ids an app declares — the seeded slugs from boot, or the curated-module slug
// fallback when the server shipped none. The whitelist a URL parser and window identity validate
// against.
export function appWorkspaces(appId: string): string[] {
  const seeded = bootWorkspaces[appId]
  if (seeded) return seeded.map((w) => w.id)
  return (ensureIndex().appById[appId]?.modules ?? []).map((m) => workspaceSlug(m.name))
}

// The menu-bar menus declared into an app's own bar (ADR-0039 rule 2), in render order. Each
// becomes a `menubar:app:<appId>:<id>` Region the MenuBar projects (earned — an empty one is not
// rendered). Menus are a Collection, so two apps may declare the same menu id into one bar (a custom
// app extending erpnext's "Reports"); deduped by id, FIRST-SEEN wins its title/order — the same
// first-wins rule the Command fold uses — then sorted by the declared `order`.
export function appMenus(appId: string): MenuDef[] {
  const seen = new Set<string>()
  const unique = (ensureIndex().menus[appId] || []).filter((m) => !seen.has(m.id) && seen.add(m.id))
  return [...unique].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// The app's sole workspace id when it has exactly one, else undefined (ADR-0042). A single-
// workspace app has nothing to choose, so opening it skips the hub and opens that workbench
// directly — the "the app is the window" case. More than one (or none) yields undefined, so the
// caller opens the plain app window (the hub, once slice 04 lands). Same backward-compatible-
// absence pattern the ADR names: one implicit workspace means the app itself is the window.
export function soleWorkspace(appId: string): string | undefined {
  const ids = appWorkspaces(appId)
  return ids.length === 1 ? ids[0] : undefined
}

// Resolve a URL workspace segment to a canonical workspace id for `app`, or undefined when it
// names none — the membership guard route-map uses to tell a workspace segment from a doctype
// (ADR-0040). Honest absence: an unrecognised segment is NOT a workspace, never a guess.
export function workspaceForSlug(appId: string, slug?: string | null): string | undefined {
  return slug && appWorkspaces(appId).includes(slug) ? slug : undefined
}

// The app's seeded workspaces as full rows (id + label + isDefault), already sequence-ordered by
// the server. The hub (ADR-0042) reads these to render its workspace rail — it needs the labels the
// id-only appWorkspaces throws away. Empty for an app the server shipped no data for (the hub then
// falls back to the curated module rail, retired by issue 06). Never touches the module fallback:
// the labels only exist in seeded data.
export function orderedWorkspaces(appId: string): WorkspaceInfo[] {
  return bootWorkspaces[appId] ?? []
}

// The workspace the hub opens onto (ADR-0042): the `is_default` row, falling back to the first
// (lowest sequence) when none is flagged, and undefined when the app has no seeded workspaces.
export function defaultWorkspace(appId: string): string | undefined {
  const rows = orderedWorkspaces(appId)
  return (rows.find((w) => w.isDefault) ?? rows[0])?.id
}

// The app's workspaces as doctype-bearing groups (ADR-0042, slice 05): the seeded boot rows, or —
// for an app the server shipped no data for — the curated `AppDef.modules` shaped as workspaces
// (slug id, module name label, first is default). THE one place `AppDef.modules` is read for
// doctype grouping; every consumer (Finder, palette, dashboard, settings, workbench sidebar) reads
// this or the derived accessors below, so the curated config is consulted only as a fallback.
export function workspaceGroups(appId: string): WorkspaceInfo[] {
  const seeded = bootWorkspaces[appId]
  if (seeded) return seeded
  return (ensureIndex().appById[appId]?.modules ?? []).map((m, i) => ({
    id: workspaceSlug(m.name), label: m.name, isDefault: i === 0, doctypes: m.doctypes,
  }))
}

// A single workspace's derived doctypes (ADR-0042) — the workbench sidebar's source, now read
// synchronously off boot. Empty for an unknown workspace id.
export function workspaceDoctypes(appId: string, workspaceId: string): string[] {
  return workspaceGroups(appId).find((w) => w.id === workspaceId)?.doctypes ?? []
}

// The app's whole doctype set — the deduped union across its workspaces, order preserved (ADR-0042).
// The catalog Finder locations and the command palette project over.
export function appDoctypes(appId: string): string[] {
  return [...new Set(workspaceGroups(appId).flatMap((w) => w.doctypes ?? []))]
}

// The default workspace's doctypes (ADR-0042): the `is_default` group's set, falling back to the
// first group's when none is flagged. The app dashboard's "Create" list and the menu-bar
// "show as list" target read this.
export function defaultWorkspaceDoctypes(appId: string): string[] {
  const groups = workspaceGroups(appId)
  return ((groups.find((w) => w.isDefault) ?? groups[0])?.doctypes) ?? []
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
    menus: appMenus,
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
