// The Action/extension model vocabulary as types (CONTEXT.md → Command / Action / Region /
// Handler / Context / Eligibility). The resolver (./resolve.ts) is a pure-data engine over
// these; nothing here carries raw code — a run Handler is a reference resolved by id, the
// same way an Applet is (ADR-0008/0009). Re-exported via @/types.
import type { Surface } from '@/surface/types'

// The override layers, in increasing precedence (ADR-0007). An Action defaults to 'app'.
export type Layer = 'app' | 'site' | 'user'

// The OS's current focus situation — a flat, fixed-shape snapshot derived from the single
// focused window (CONTEXT.md → Context). `activeApp`/`windowRole` are the *window* tier;
// `doctype`/`recordName`/`view`/`appletId` are the *surface* tier. `selection` is excluded
// (no backing in the window model yet — additive later). A field is `undefined` when the
// focus offers no such coordinate (e.g. a list has no `recordName`).
export interface Context {
  activeApp?: string
  windowRole?: string
  doctype?: string
  recordName?: string
  view?: string
  appletId?: string
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

export interface Action {
  command: string
  region: string
  sourceApp: string
  when?: When
  order?: number
  priority?: number
  group?: string
  layer?: Layer
  commandPatch?: CommandPatch
}

// One resolved winner: the placement (Action) joined to its verb (Command), ready to render.
export interface ResolvedAction {
  action: Action
  command: Command
}

// A shadowed Action — never silently dropped (ADR-0007/0014). `reason` distinguishes a clean
// `override` (the winner strictly outranked it) from a `true-tie` (indistinguishable winner).
export interface ShadowEvent {
  region: string
  command: string
  winner: Action
  loser: Action
  reason: 'override' | 'true-tie'
}
