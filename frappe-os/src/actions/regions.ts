// The closed-but-data-driven Region set (ADR-0004): every named area — OS chrome AND surface-
// embedded — that hosts Actions. Chrome (the menu bar) and surface-embedded Regions (the list
// toolbar, the selection/bulk bar, the form toolbar) are ONE set, because Region is orthogonal to
// Scope (ADR-0032): a Doctype-scoped Action can target the global menu bar as readily as its own
// list toolbar. The OS owns these ids; apps place Actions into them, they don't invent new ones.
import type { Context, When } from './types'
import { isEligible, PRESENT } from './eligibility'

// A named render area. `when` is the same eligibility predicate an Action carries (ADR-0038): the
// Region renders only where it holds. The selection/bulk bar gates on `{ selection: PRESENT }` — it
// appears only when rows are selected — so a bulk Action stays free of a hand-written selection
// `when` (ADR-0032). An absent `when` means the Region always renders whatever the resolver hands it.
// This retires the old `requires` special case in favor of the general presence form.
export interface Region {
  id: string
  when?: When
}

// Region ids follow the `area:slot` convention (`menubar:file`). The OS owns these strings.
// Every top menu-bar dropdown is one `menubar:<menu>` Region — the whole bar resolves through
// the same engine, so an app customizes any menu the way it already customizes File (ADR-0001).
export const SYSTEM_REGION = 'menubar:system'
export const APP_REGION = 'menubar:app'
export const FILE_REGION = 'menubar:file'
export const EDIT_REGION = 'menubar:edit'
export const VIEW_REGION = 'menubar:view'
export const WINDOW_REGION = 'menubar:window'
export const HELP_REGION = 'menubar:help'
export const LIST_TOOLBAR = 'list:toolbar'
export const LIST_SELECTION = 'list:selection'
export const FORM_TOOLBAR = 'form:toolbar'

// The two desktop-chrome context menus (right-click the wallpaper / the dock). CONTEXT.md's Region
// entry already names them; they join the closed set so an app can contribute or customize their
// entries exactly as it does any menu-bar menu (ADR-0001). Ungated — they always render whatever
// the resolver hands them (the opener decides WHEN to pop the menu; the Region decides WHAT it holds).
export const DESKTOP_CONTEXT_REGION = 'desktop:context'
export const DOCK_CONTEXT_REGION = 'dock:context'

// The menu-bar Regions in left-to-right render order — the one place the bar's shape is declared.
// MenuBar.vue draws its dropdowns from this list; nothing else fixes the order.
export const MENUBAR_REGIONS: readonly string[] = [
  SYSTEM_REGION, APP_REGION, FILE_REGION, EDIT_REGION, VIEW_REGION, WINDOW_REGION, HELP_REGION,
]

// The closed set. Surface-embedded Regions join the menu-bar chrome (ADR-0032). Only the
// selection/bulk bar is gated — it hangs off a live selection that may not exist.
export const REGIONS: readonly Region[] = [
  ...MENUBAR_REGIONS.map((id) => ({ id })),
  { id: LIST_TOOLBAR },
  { id: LIST_SELECTION, when: { selection: PRESENT } },
  { id: FORM_TOOLBAR },
  { id: DESKTOP_CONTEXT_REGION },
  { id: DOCK_CONTEXT_REGION },
]

const BY_ID: ReadonlyMap<string, Region> = new Map(REGIONS.map((r) => [r.id, r]))

export function regionById(id: string): Region | undefined {
  return BY_ID.get(id)
}

// Does the Region render in this Context? Its `when` is judged by the same eligibility engine as an
// Action's — an absent `when` is global (always renders), `{ selection: PRESENT }` keeps the bulk bar
// hidden until a selection exists. An unknown region id (outside the set) is ungated: it renders
// whatever resolves, which is nothing, since no Action targets an id the set does not name.
export function regionRenders(region: Region | undefined, context: Context): boolean {
  if (!region) return true
  return isEligible(region.when, context)
}
