// The Action/extension model vocabulary as types (CONTEXT.md → Command / Action / Region /
// Handler / Context / Eligibility). The resolver (./resolve.ts) is a pure-data engine over
// these; nothing here carries raw code — a run Handler is a reference resolved by id, the
// same way an Applet is (ADR-0008/0009). Re-exported via @/types.
import type { Surface } from '@/surface/types'
import type { AppKind } from '@/registry/types'

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

// The OS's current focus situation — a flat, fixed-shape snapshot derived from the single
// focused window (CONTEXT.md → Context). `activeApp`/`windowRole` are the *window* tier;
// `doctype`/`recordName`/`view`/`appletId`/`selection` are the *surface* tier. `selection` marks
// that a multi-row selection EXISTS on the front list — the selection/bulk-bar Region gates on its
// presence (regions.ts), never on its value. A field is `undefined` when the focus offers no such
// coordinate (e.g. a list has no `recordName`, an empty list no `selection`). NOTE: contextForOS
// does not populate `selection` yet — the window model carries no selection backing
// (deferred-hardcoded: .scratch/deferred-hardcoded/issues/11-selection-backing-and-toolbar-wiring).
export interface Context {
  activeApp?: string
  windowRole?: string
  doctype?: string
  recordName?: string
  view?: string
  appletId?: string
  selection?: string
}

// Eligibility predicate — equality-only, evaluated as data, never `eval` (CONTEXT.md →
// Eligibility). An empty/absent predicate is *global*. Keys must be Context keys; an unknown
// key degrades to no-match plus a loud warn (forward-compat with additive Context fields).
export type When = Partial<Record<keyof Context, string>>

// What a Command does when invoked — a closed, additive kind set (ADR-0008). `navigate` is
// pure data (open a Surface); `run` is a reference resolved lazily by id and fire-and-forget.
export type Handler =
  | { kind: 'navigate'; surface: Surface }
  | { kind: 'run'; ref: string }

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
