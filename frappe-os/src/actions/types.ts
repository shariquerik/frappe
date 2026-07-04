// The Action/extension model vocabulary as types (CONTEXT.md → Command / Action / Region /
// Handler / Context / Eligibility). The resolver (./resolve.ts) is a pure-data engine over
// these; nothing here carries raw code — a run Handler is a reference resolved by id, the
// same way an Applet is (ADR-0008/0009). Re-exported via @/types.
import type { Surface } from '@/surface/types'
import type { AppKind } from '@/registry/types'
import type { OsStore } from '@/data/types'

// A pure-data JSON value — what a `run` Handler's static `args` payload may hold (ADR-0037). No
// functions or class instances: an Action's declaration is data, folded through the registry.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// The override layers, in increasing precedence (ADR-0007). An Action defaults to 'app'.
export type Layer = 'app' | 'site' | 'user'

// The Scope tiers, broadest → narrowest (ADR-0032). Scope is *where an Action is declared* — the
// OS manifest tier it is co-located in — independent of Region (*where it renders*) and Layer
// (*who customizes it*). A broader tier carries forward into narrower ones (OS ⊕ App ⊕ Doctype ⊕
// View), composed additively and overridable/removable per Layer.
export type Scope = 'os' | 'app' | 'doctype' | 'view'

// An Action's Scope binding: the tier plus the context coordinate it is co-located with — the app
// (App/Doctype/View), doctype (Doctype/View), and view (View) whose manifest declares it. The tier
// auto-supplies Eligibility (see ./scope.ts — it turns this into the equality `when` the author
// would otherwise hand-write) and picks the delivery channel (OS/App → boot, Doctype/View → live
// meta; slice 03). An absent binding on an Action means OS scope (global) — the backward-compatible
// default for the chrome Actions authored before the Scope axis.
export interface ScopeBinding {
  tier: Scope
  app?: string
  doctype?: string
  view?: string
}

// The OS's current focus situation — a flat, fixed-shape snapshot derived from the single focused
// window (CONTEXT.md → Context), tiered window / surface / focus (ADR-0038). `activeApp`/
// `windowRole` are the *window* tier; `doctype`/`recordName`/`view`/`appletId`/`workspace` the
// *surface* tier; `selection`/`focusKind` the *focus* tier — what is selected inside the front
// window and which widget holds keyboard focus. A field is `undefined` when the focus offers no such
// coordinate (a list has no `recordName`, an empty list no `selection`). `selection`/`focusKind` are
// KIND markers (`'rows'`, `'composer'`, an app-namespaced `<app>.<kind>`; kinds.ts) — the actual
// selected ids never live here, they travel in Invocation.selection (ADR-0037).
export interface Context {
  activeApp?: string
  windowRole?: string
  doctype?: string
  recordName?: string
  view?: string
  appletId?: string
  // The focus-tier selection marker — the KIND of the front list's selection (presence, not the
  // ids): the selection/bulk-bar Region gates on it (regions.ts). Set only while a selection exists.
  selection?: string
  // The focus-tier keyboard-focus marker — the KIND of the widget that holds focus (ADR-0038).
  // Persists until another widget publishes / the surface swaps / the window closes (never cleared
  // on raw DOM blur), so `when: { focusKind: 'composer' }` stays live while the menu bar steals focus.
  focusKind?: string
  // The surface-tier workspace coordinate (ADR-0040) — published when the front window's surface
  // names one, so app menus can gate their content with `when: { workspace: 'selling' }`. Absent
  // for a single-space app or any surface with no workspace, a clean non-match for such a `when`.
  workspace?: string
  // The surface-tier record-state markers (slice 04) — the front FORM record's `docstatus` and
  // `status`, read from the loaded record cache. They let a doctype-scoped verb gate on record
  // state as plain equality: `when: { doctype: 'Sales Order', docstatus: '1' }` for submitted-only,
  // `when: { status: 'To Deliver' }` for a workflow verb. `docstatus` is stringified ('0'|'1'|'2')
  // to meet equality `when`. Absent on a list, or a form whose record has not loaded yet — a clean
  // non-match for such a `when`. Rich predicates (comparisons) stay server-side by design (ADR-0032).
  docstatus?: string
  status?: string
}

// Eligibility predicate — evaluated as data, never `eval` (CONTEXT.md → Eligibility). An
// empty/absent predicate is *global*. A value is either an exact match or the presence marker
// `PRESENT` ('*' = "this key is defined", any value), the one non-equality form (ADR-0038) — it
// replaces the Region `requires` special case. Keys must be Context keys; an unknown key degrades
// to no-match plus a loud warn (forward-compat with additive Context fields).
export type When = Partial<Record<keyof Context, string>>

// What runs after a `server` Handler's method returns (ADR-0041) — part of the DECLARATION, not
// code. A closed set, additive like Handler itself: `open-doc` opens the returned doc's
// doctype/name as a form surface; `refresh` reloads the front surface's records; `notify` toasts
// the response message; `none` is fire-and-forget (the default). A string union, matching the
// codebase's other closed sets (Layer/Scope) — these effects carry no payload.
export type AfterEffect = 'open-doc' | 'refresh' | 'notify' | 'none'

// What a Command does when invoked — a closed, additive kind set (ADR-0008). `navigate` is
// pure data (open a Surface); `run` is a reference resolved lazily by id and fire-and-forget.
// A `run` may carry static `args` (pure data, ADR-0037) so one handler ref serves many placements
// ("Position on Screen" → one set-position ref with `args:{side}`), instead of one ref per item.
// `server` (ADR-0041) is the codeless verb: call a whitelisted `method` with `args` merged with the
// Invocation coordinates (doctype/recordName/selection values), then run a declared after-effect —
// no `eval`, no shipped script, no client module. It covers the dominant app verbs (erpnext's
// Create/Status menus, raven's Create Document actions) as pure data.
export type Handler =
  | { kind: 'navigate'; surface: Surface }
  | { kind: 'run'; ref: string; args?: JsonValue }
  | { kind: 'server'; method: string; args?: JsonValue; then?: AfterEffect }

// What a `run` Handler receives when fired (ADR-0037): the eligibility `context` snapshot and the
// `selection` values, both frozen at CLICK time (invoke builds this from the same contextForOS
// projection that gated the item — the handler acts on what the user saw, never a re-derived state
// that focus changes could have moved). `args` is the Handler's own static payload; `os` is the
// escape hatch for OS chrome verbs (minimize/split/logout) — app handlers should rarely touch it.
export interface Invocation {
  context: Context
  selection: string[]
  args?: JsonValue
  os: OsStore
}

// The verb — identity-bearing, placement-agnostic (CONTEXT.md → Command). One Command is
// surfaced by one or more Actions.
export interface Command {
  id: string
  sourceApp: string
  title: string
  handler: Handler
}

// A placement of a Command into a Region, carrying the conditions under which it appears
// (`when`) and its placement within that Region (CONTEXT.md → Action). `group` is the divider
// group the Region's renderer draws; `layer` defaults to 'app'.
//
// `order` and `priority` are TWO SEPARATE axes (collapsing them onto one number makes a
// high-priority override land at the wrong menu position): `order` is the ascending within-region
// RENDER position; `priority` is the competition tiebreak (HIGHER wins) on equal specificity+layer.
//
// `commandPatch` is an ADR-0007 Patch of the placed Command's presentation, applied only when
// THIS Action wins its (region, command) competition — the contextual override an app makes
// without touching the global Command Singleton (e.g. erpnext re-titles New window only for an
// erpnext window). Shallow-merge over the resolved Command; presentation-only this slice.
export interface CommandPatch {
  title?: string
}

// `removed` makes a winning Action a SUPPRESSION instead of a render (ADR-0014): an app may
// *remove* shared chrome, not just override it. A removal still competes per (region, command);
// when it wins, the resolver omits it from the rendered items and logs a `reason:'removal'`
// shadow attributed to the removing app — never silent. Reversibility holds for free: the
// App < Site < User layer order lets a higher-layer Action without `removed` outrank it and
// re-render the item, so an app never has the final word over a person.
export interface Action {
  command: string
  region: string
  sourceApp: string
  scope?: ScopeBinding
  when?: When
  order?: number
  priority?: number
  group?: string
  // The label of a nested submenu this Action's Command renders under, WITHIN its `group` — the
  // one extra placement axis a context menu needs (the dock's "Position on Screen"). Pure render
  // metadata like `group`/`order`: the resolver carries it untouched and a Region's projector that
  // supports nesting collapses same-`submenu` siblings into one parent item. Absent = a flat item.
  submenu?: string
  layer?: Layer
  commandPatch?: CommandPatch
  removed?: boolean
}

// One resolved winner: the placement (Action) joined to its verb (Command), ready to render.
export interface ResolvedAction {
  action: Action
  command: Command
}

// A shadowed Action — never silently dropped (ADR-0007/0014). `reason` distinguishes a clean
// `override` (the winner strictly outranked it), a `true-tie` (indistinguishable winner), and a
// `removal` (the winner suppressed the slot via `removed`, ADR-0014 — the item renders nothing).
export interface ShadowEvent {
  region: string
  command: string
  winner: Action
  loser: Action
  reason: 'override' | 'true-tie' | 'removal'
}

// ── the Customizations catalog (ADR-0015; CONTEXT.md → "Customizations view") ─────────
// The COOKED, seam-published projection of the declared Action set: the OS computes it, the
// applet only renders it (issue 05). Reachable via @/types so the applet types against it
// without importing @/actions internals.

// Why an Action is a customizing contender, reusing the resolver's vocabulary (not its live
// output): 'removal' when it suppresses the slot (`removed`), else 'override'.
export type CustomizationReason = 'override' | 'removal'

// One described customization. Carries every field a later Restore affordance needs
// (sourceApp/region/command/layer/removed — ADR-0015 §1), the human-facing projection (the
// `reason` and the `when` scope it applies under), and the baked-in `unexpected` marker: a
// feature app removing shared chrome is the surprising case (ADR-0014 item 4 / ADR-0015 §5),
// computed OS-side from the same predicate as the removals warning.
export interface CustomizationRow {
  sourceApp: string
  region: string
  command: string
  layer: Layer
  removed: boolean
  reason: CustomizationReason
  whenScope: string
  unexpected: boolean
}

// Customizations grouped by the overriding app (ADR-0015 §5 — the primary axis is the human
// question "what has THIS app done to my OS?"), with the app's classification baked in
// (ADR-0014 item 4). Region and reason stay secondary (row columns / sort), not the top level.
export interface CustomizationGroup {
  appId: string
  appKind: AppKind
  rows: CustomizationRow[]
}
