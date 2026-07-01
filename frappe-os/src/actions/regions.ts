// The closed-but-data-driven Region set (ADR-0004): every named area — OS chrome AND surface-
// embedded — that hosts Actions. Chrome (the menu bar) and surface-embedded Regions (the list
// toolbar, the selection/bulk bar, the form toolbar) are ONE set, because Region is orthogonal to
// Scope (ADR-0032): a Doctype-scoped Action can target the global menu bar as readily as its own
// list toolbar. The OS owns these ids; apps place Actions into them, they don't invent new ones.
import type { Context } from './types'

// A named render area. `requires` is a Context key that must be PRESENT for the Region to render at
// all — the selection/bulk bar (`requires: 'selection'`) appears only when rows are selected, a gate
// the resolver's per-Action `when` cannot express: it needs the *existence* of a selection, not
// equality on a value, so a bulk Action stays free of a hand-written selection `when` (ADR-0032).
// An absent `requires` means the Region always renders whatever the resolver hands it.
export interface Region {
  id: string
  requires?: keyof Context
}

// Region ids follow the `area:slot` convention (`menubar:file`). The OS owns these strings.
export const FILE_REGION = 'menubar:file'
export const LIST_TOOLBAR = 'list:toolbar'
export const LIST_SELECTION = 'list:selection'
export const FORM_TOOLBAR = 'form:toolbar'

// The closed set. Surface-embedded Regions join the menu-bar chrome (ADR-0032). Only the
// selection/bulk bar is gated — it hangs off a live selection that may not exist.
export const REGIONS: readonly Region[] = [
  { id: FILE_REGION },
  { id: LIST_TOOLBAR },
  { id: LIST_SELECTION, requires: 'selection' },
  { id: FORM_TOOLBAR },
]

const BY_ID: ReadonlyMap<string, Region> = new Map(REGIONS.map((r) => [r.id, r]))

export function regionById(id: string): Region | undefined {
  return BY_ID.get(id)
}

// Does the Region render in this Context? True unless a gated Region's required Context key is
// absent (undefined) — the selection/bulk bar stays hidden until a selection exists. An unknown
// region id (outside the set) is ungated: it renders whatever resolves, which is nothing, since no
// Action targets an id the set does not name.
export function regionRenders(region: Region | undefined, context: Context): boolean {
  if (!region || !region.requires) return true
  return context[region.requires] !== undefined
}
