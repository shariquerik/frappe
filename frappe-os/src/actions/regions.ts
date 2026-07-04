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

// The one PARAMETERIZED Region form (ADR-0039 rule 2): an app-declared menu-bar menu. The App slot
// grows sub-coordinates — `menubar:app:<appId>:<menuId>` — so the id names both the OWNING app (whose
// bar the menu joins, and while focused it renders) and the app's own menu. App-qualified, so two
// apps' like-named menus never collide and ownership is structural. The bare App menu (`menubar:app`,
// no tail) stays OS-owned and is NOT one of these. Authorship is open (ADR-0001): any app may declare
// a menu into any REAL app's band (a custom app extends erpnext); only the grammar stays closed.
export const APP_MENU_PREFIX = `${APP_REGION}:` // 'menubar:app:'

// Build the Region an app-declared menu resolves through, from its owning app + menu id.
export function appMenuRegion(appId: string, menuId: string): string {
  return `${APP_MENU_PREFIX}${appId}:${menuId}`
}

// Parse an app-menu Region back into its (appId, menuId), or null if it is not the parameterized
// form — the bare App menu `menubar:app` and every OS-frame region (`menubar:file`, …) yield null,
// as does a malformed tail (missing segment or a colon inside the menu id).
export function parseAppMenuRegion(region: string): { appId: string; menuId: string } | null {
  if (!region.startsWith(APP_MENU_PREFIX)) return null
  const [appId, menuId, ...rest] = region.slice(APP_MENU_PREFIX.length).split(':')
  if (!appId || !menuId || rest.length) return null
  return { appId, menuId }
}

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
