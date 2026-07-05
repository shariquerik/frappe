// ingest: config/* or the server payload → the Contribution[] the index-builder folds. Two modes
// (ADR-0005/0010/0011):
//   - SERVER PRESENT (boot.registry): index the server-projected payloads DIRECTLY (the doctype's
//     label from Desk meta), then OVERLAY the OS-native LOOK Desk can't express — app glyph/hex/
//     logo/modules/cards/dashboard prefs, doctype icon/color — keyed by id. Presentation semantics
//     (title/status/columns) come live, not here (ADR-0028). A doctype the server exposes but
//     config/* does not curate still lights up from its server payload: config is decoration now,
//     no longer the source of "what exists".
//   - OFFLINE (no/legacy/junk registry): index the full config/* SEED unchanged — the pure
//     offline / unit-test fallback (ADR-0008 tolerance).
import { APP, APP_ORDER } from '@/config/apps'
import { doctypes } from '@/config/doctypes'
import { APP_T, DISPLAY, VIEW, CARD } from './extension-points'
import type { AppDef, Contribution, DoctypeMeta, OsRegistryData } from '@/types'

// ── seed: config/* → the App-default Contribution[] (§2 shapes) ──────────────────
// The offline seed carries no doctype→app ownership: config/* is decoration (icons/colors), not the
// source of "who owns what". Curated DISPLAY/view contributions are attributed to `frappe`; real
// ownership rides boot workspace data (ADR-0042), and the server path carries `_app_of` per
// contribution. So an offline seed (unit tests, failed boot) owns every doctype under frappe until a
// test seeds workspaces.
const SEED_OWNER = 'frappe'

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
    out.push({ type: DISPLAY, target: doctype, name: 'display', sourceApp: SEED_OWNER, payload: doctypes[doctype] })
    out.push(viewContribution(doctype, 'list', 'List', SEED_OWNER, 0))
    out.push(viewContribution(doctype, 'form', 'Form', SEED_OWNER, 1))
  }
}

export function seedContributions(): Contribution[] {
  const out: Contribution[] = []
  appContributions(out)
  cardContributions(out)
  doctypeContributions(out)
  return out
}

// ── server overlay (ADR-0011): index server payloads, decorate with OS-native bits ──
// The ONE tolerant parser for a server registry envelope (ADR-0008), shared by both entry
// points: the boot `boot.registry` and the on-demand `resolve_doctype` response. A legacy bare
// array or junk → null (boot: the full config seed stands offline/tests; resolve: the deep link
// falls back to the app). An unknown future schemaVersion still parses — the client indexes the
// contributions it understands and ignores the version number, never a second parser to negotiate.
export function asServerRegistry(registry: unknown): OsRegistryData | null {
  const r = registry as OsRegistryData
  return r && typeof r.schemaVersion === 'number' && Array.isArray(r.contributions) ? r : null
}

function keysOf(reg: OsRegistryData, type: string, key: (c: Contribution) => string): Set<string> {
  return new Set(reg.contributions.filter((c) => c.type === type).map(key))
}

// OS-native LOOK Desk can't express (ADR-0011/0028): curated icons/colors kept client-side,
// keyed by doctype, shallow-merged OVER the server payload (curated wins). Presentation
// semantics (title/status/columns) are no longer here — they come live from get_doctype_meta.
const OS_NATIVE_META = ['color', 'icon', 'savedViews'] as const

function osNativeMeta(doctype: string): Partial<DoctypeMeta> {
  const meta = doctypes[doctype]
  if (!meta) return {}
  const out: Partial<DoctypeMeta> = {}
  for (const key of OS_NATIVE_META) {
    if (meta[key] === undefined) continue
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
export function decorate(c: Contribution, permitted: Set<string>): Contribution {
  if (c.type === APP_T) return { ...c, payload: appPayloadFor(c.payload as AppDef, permitted) }
  if (c.type === DISPLAY) return { ...c, payload: { ...(c.payload as DoctypeMeta), ...osNativeMeta(c.target) } }
  return c
}

// Index the server registry directly (ADR-0011): decorate each contribution with the
// OS-native overlay, then add the curated, visibility-filtered card collection.
export function overlayServer(server: OsRegistryData): Contribution[] {
  const docs = keysOf(server, DISPLAY, (c) => c.target)
  const apps = keysOf(server, APP_T, (c) => c.name)
  const out = server.contributions.map((c) => decorate(c, docs))
  out.push(...curatedCards(apps, docs))
  return out
}
