// index: Contribution[] → the projections renderers read. Folds a flat, sorted Contribution[]
// into the RegistryIndex every accessor in ./store reads. Singletons shallow patch-merge
// (ADR-0007); collections accumulate in sorted order. The ingest path (./ingest) produces the
// Contribution[] this consumes — from the config seed offline, or the server overlay at boot.
import { APP_T, DISPLAY, VIEW, CARD, APPLET, COMMAND, ACTION, DEFAULT_SURFACE } from './extension-points'
import { FIRST_PARTY } from './applets'
import type { AppletEntry, AppletPayload } from './applets'
import type {
  Action, AppDef, Card, Command, Contribution, DoctypeMeta, DoctypeViewPayload, SurfaceRef,
} from '@/types'

export interface RegistryIndex {
  apps: AppDef[]
  appById: Record<string, AppDef>
  display: Record<string, DoctypeMeta>          // singleton per doctype (patch-merged)
  views: Record<string, DoctypeViewPayload[]>   // ordered collection per doctype
  cards: Record<string, Card[]>                 // ordered collection per app
  owner: Record<string, string>                 // doctype → owning app
  applets: Record<string, AppletEntry>          // appletId → resolvable entry (ADR-0009)
  commands: Command[]                           // Action-model verbs folded from boot (App/OS scope)
  actions: Action[]                             // Action-model placements folded from boot (App/OS scope)
  liveActions: Record<string, Action[]>         // doctype → its live-meta scoped Action slice (ADR-0032)
  liveCommands: Record<string, Command[]>       // doctype → its live-meta scoped Command slice (ADR-0032)
  actionsView: Action[]                         // boot ⊕ all live slices; stable identity between overlay changes
  commandsView: Command[]                       // boot ⊕ all live slices; stable identity between overlay changes
  defaultSurface: Record<string, SurfaceRef>    // app → merged surface reference (singleton, ADR-0021)
  appKinds: Record<string, Set<string>>         // sourceApp → contributed kinds (ADR-0014 item 4)
}

// Rebuild the combined boot ⊕ live-slice views with a FRESH array identity, so project.ts's
// merged() — memoized on the identity of actions()/commands() — refolds. Called only when a
// doctype's live slice is registered/replaced, never per render, so the projector cache stays warm.
export function rebuildScopedViews(ix: RegistryIndex): void {
  ix.actionsView = [...ix.actions, ...Object.values(ix.liveActions).flat()]
  ix.commandsView = [...ix.commands, ...Object.values(ix.liveCommands).flat()]
}

function ownerMap(apps: AppDef[]): Record<string, string> {
  const owner: Record<string, string> = {}
  for (const a of apps) for (const m of a.modules || []) for (const dt of m.doctypes) owner[dt] ??= a.id
  return owner
}

// Fold one contribution into the index: singletons shallow patch-merge (ADR-0007, so a
// later partial layer can add/override fields); collections accumulate in sorted order.
export function addToIndex(ix: RegistryIndex, c: Contribution): void {
  // Record every contribution's kind under its sourceApp first, so appKind() can classify the app
  // from the folded registry alone (ADR-0014 item 4) — feature vs pure-customization, no per-app config.
  (ix.appKinds[c.sourceApp] ??= new Set()).add(c.type)
  if (c.type === DISPLAY) {
    ix.display[c.target] = { ...ix.display[c.target], ...(c.payload as DoctypeMeta) }
    ix.owner[c.target] ??= c.sourceApp // server projects ownership via _app_of (fills uncurated)
  }
  else if (c.type === VIEW) (ix.views[c.target] ||= []).push(c.payload as DoctypeViewPayload)
  else if (c.type === CARD) (ix.cards[c.target] ||= []).push(c.payload as Card)
  else if (c.type === APPLET) {
    const p = c.payload as AppletPayload
    // `kind` is the ADR-0020 content-production flag (native | framed); a declaration that
    // omits it is a native applet (the default kind) — the core holds no per-app knowledge.
    // `nav` is the ADR-0026 nav-rail capability, orthogonal to `kind`: the applet opts in, and
    // an omitted flag means NO rail (the OS never defaults nav on for an applet).
    ix.applets[p.appletId] = {
      appId: p.appId, label: p.label, assetUrl: p.assetUrl, kind: p.kind ?? 'native', nav: p.nav ?? false,
    }
  }
  // Command/Action are Collections (ADR-0007): each app's manifest-declared contributions
  // accumulate here, then compete against the first-party OS defaults in the resolver
  // (the contextual override that lets erpnext re-title New window — Slice 2).
  else if (c.type === COMMAND) ix.commands.push(c.payload as Command)
  else if (c.type === ACTION) ix.actions.push(c.payload as Action)
  // default-surface is a Singleton per app (target=appId), layered App<Site<User: the SAME
  // shallow patch-merge as display-config (ADR-0007), so a higher-layer override (sorted later by
  // `order`) wins, and a partial User-layer patch touches only the surface reference — no new merge code.
  else if (c.type === DEFAULT_SURFACE) {
    ix.defaultSurface[c.target] = { ...ix.defaultSurface[c.target], ...(c.payload as SurfaceRef) }
  }
}

export function indexContributions(contribs: Contribution[]): RegistryIndex {
  const sorted = [...contribs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const apps = sorted.filter((c) => c.type === APP_T).map((c) => c.payload as AppDef)
  const ix: RegistryIndex = {
    apps, appById: Object.fromEntries(apps.map((a) => [a.id, a])),
    display: {}, views: {}, cards: {}, owner: ownerMap(apps),
    applets: { ...FIRST_PARTY }, // bundled first-party; server applet contributions fold in below
    commands: [], actions: [], // first-party File Commands/Actions live in @/actions; these fold the server's
    liveActions: {}, liveCommands: {}, // per-doctype live-meta slices (ADR-0032), filled by registerScopedContributions
    actionsView: [], commandsView: [], // boot ⊕ live views, set to the boot arrays after the fold
    defaultSurface: {}, // app → merged surface reference, filled per contribution by addToIndex
    appKinds: {}, // sourceApp → contributed kinds, filled per contribution by addToIndex
  }
  for (const c of sorted) addToIndex(ix, c)
  ix.actionsView = ix.actions
  ix.commandsView = ix.commands
  return ix
}
