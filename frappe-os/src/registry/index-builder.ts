// index: Contribution[] → the projections renderers read. Folds a flat, sorted Contribution[]
// into the RegistryIndex every accessor in ./store reads. Singletons shallow patch-merge
// (ADR-0007); collections accumulate in sorted order. The ingest path (./ingest) produces the
// Contribution[] this consumes — from the config seed offline, or the server overlay at boot.
import { APP_T, DISPLAY, VIEW, CARD, APPLET, COMMAND, ACTION, DEFAULT_SURFACE, MENU } from './extension-points'
import { FIRST_PARTY } from './applets'
import type { AppletEntry, AppletPayload } from './applets'
import type {
  Action, AppDef, Card, Command, Contribution, DoctypeMeta, DoctypeViewPayload, MenuDef, SurfaceRef, WorkspaceInfo,
} from '@/types'

export interface RegistryIndex {
  apps: AppDef[]
  appById: Record<string, AppDef>
  display: Record<string, DoctypeMeta>          // singleton per doctype (patch-merged)
  views: Record<string, DoctypeViewPayload[]>   // ordered collection per doctype
  cards: Record<string, Card[]>                 // ordered collection per app
  menus: Record<string, MenuDef[]>              // owning app → its declared menu-bar menus (ADR-0039)
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

// Boot workspace data is the authoritative ownership source (ADR-0042): the server delivers each
// app's workspaces with their doctype sets, so a doctype listed under an app's workspace is owned by
// that app — even when it ships no curated display config. Fold it into the owner index with a
// first-wins `??=`, so a server DISPLAY `sourceApp` (`_app_of`, folded earlier in addToIndex) always
// wins and workspace data only fills the uncurated gaps. This is the sole doctype→app ownership
// source now that the curated AppDef.modules seed is retired.
function foldWorkspaceOwnership(ix: RegistryIndex, workspaces: Record<string, WorkspaceInfo[]>): void {
  for (const [appId, groups] of Object.entries(workspaces)) {
    if (!ix.appById[appId]) continue
    for (const group of groups) for (const doctype of group.doctypes ?? []) ix.owner[doctype] ??= appId
  }
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
  // An app-declared menu (ADR-0039 rule 2) joins its OWNING app's bar (target). Authorship is open —
  // any app may declare a menu into another app's band (a custom app extends erpnext, ADR-0001) — but
  // the grammar stays closed: the target must be a REAL OS app in the registry, else it is inventing
  // a menu in the OS frame or a non-existent app. That contribution is dropped LOUDLY, never rendered.
  else if (c.type === MENU) {
    if (!ix.appById[c.target]) {
      console.warn(`[registry] dropped app-menu "${(c.payload as MenuDef).id}" from "${c.sourceApp}": target "${c.target}" is not an OS app (ADR-0039)`)
    } else {
      (ix.menus[c.target] ||= []).push(c.payload as MenuDef)
    }
  }
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

export function indexContributions(contribs: Contribution[], workspaces: Record<string, WorkspaceInfo[]> = {}): RegistryIndex {
  const sorted = [...contribs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const apps = sorted.filter((c) => c.type === APP_T).map((c) => c.payload as AppDef)
  const ix: RegistryIndex = {
    apps, appById: Object.fromEntries(apps.map((a) => [a.id, a])),
    display: {}, views: {}, cards: {}, menus: {}, owner: {}, // owner filled from DISPLAY sourceApp then workspace data
    applets: { ...FIRST_PARTY }, // bundled first-party; server applet contributions fold in below
    commands: [], actions: [], // first-party File Commands/Actions live in @/actions; these fold the server's
    liveActions: {}, liveCommands: {}, // per-doctype live-meta slices (ADR-0032), filled by registerScopedContributions
    actionsView: [], commandsView: [], // boot ⊕ live views, set to the boot arrays after the fold
    defaultSurface: {}, // app → merged surface reference, filled per contribution by addToIndex
    appKinds: {}, // sourceApp → contributed kinds, filled per contribution by addToIndex
  }
  for (const c of sorted) addToIndex(ix, c)
  // Ownership: a curated/server DISPLAY sourceApp (folded above) wins; boot workspace data fills the
  // rest (ADR-0042). This is the single doctype→app source — the curated AppDef.modules seed is gone.
  foldWorkspaceOwnership(ix, workspaces)
  ix.actionsView = ix.actions
  ix.commandsView = ix.commands
  return ix
}
