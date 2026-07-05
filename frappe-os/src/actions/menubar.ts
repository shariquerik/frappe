// Project a `menubar:<menu>` Region into the OSDropdown option shape MenuBar.vue renders — the
// menu bar dogfoods contribution data → resolver → rendered Region → run Handler (ADR-0001). The
// resolve/join/gate/removal-warn is shared (project.ts); this file adds only the menu's divider
// grouping, the live-state suppression of a toggle pair's dead half (fullscreen / the File menu's
// Add/Remove verbs), and the `{app}` presentation token. Every one of the seven menus flows through
// the ONE menuOptions path — no menu is special (File was the first migrated; now none are literal).
import { invoke } from './contributions'
import { formatShortcut } from './shortcuts'
import { suppressedToggleCommands } from './menu-contributions'
import { suppressedPlacementCommands } from './placement-verbs'
import { projectRegion } from './project'
import { FILE_REGION, APP_REGION, VIEW_REGION, WINDOW_REGION } from './regions'
import { surfaceAppId, isFinderWindow } from '@/surface'
import type { Action, Command, ResolvedAction } from './types'
import type { OsStore } from '@/types'

// One rendered menu item and one divider group — the OSDropdown options shape. `shortcut` is the
// command's binding as macOS glyphs (⌘N), drawn as a trailing chip (ADR-0037); `icon` is a leading
// `lucide-*` glyph; `selected` draws a checkmark (a radio option's live state). A `submenu` parent
// carries no `onClick` of its own — just its nested `items` (the OSDropdown renders the flyout +
// `>` chevron natively). Every field but `label` is optional: the norm is a bare label + click.
export interface MenuItem { label: string; onClick?: () => void; shortcut?: string; icon?: string; selected?: boolean; submenu?: MenuItem[] }
export interface MenuGroup { group: string; hideLabel: boolean; items: MenuItem[] }

// The live radio selection — the set of command ids to checkmark (currently the active Theme option).
// It rides frappe-ui's useTheme, which this unit-tested projector must not import, so the seam is
// INJECTED at boot (@/appearance calls registerMenuSelection) exactly like run Handlers are seeded
// through registerRunHandlers. The default returns none, so the pure test graph stays frappe-ui-free
// and every menu without a selection is unaffected — it is command-id-keyed, matching only its own.
let liveSelection: () => Set<string> = () => new Set()
export function registerMenuSelection(provider: () => Set<string>): void { liveSelection = provider }

// The front app's display name, or "Finder" for the bare desktop — the `{app}` token's value. The
// same name the app menu shows ("Quit CRM"); presentation only, so it lives in the projector.
function activeAppName(os: OsStore): string {
  const win = os.state.windows.find((w) => w.id === os.state.activeId)
  if (!win) return 'Finder'            // the bare desktop is the Finder shell
  if (isFinderWindow(win)) return 'Finder'  // the Finder names itself, not its host app ('frappe')
  const appId = surfaceAppId(win.surface)
  return os.DATA.APP[appId]?.name ?? appId
}

// Build one item and file it into its group — nested under a same-`submenu` parent when the Action
// names one (siblings collapse into one flyout parent, like the dock's Position menu), else flat.
// `submenus` keys a parent by "group submenuLabel" so two groups can host same-named submenus.
function appendItem(
  groups: MenuGroup[], submenus: Map<string, MenuItem>, action: Action, command: Command,
  os: OsStore, selected: Set<string>,
): void {
  const key = action.group ?? ''
  let group = groups.find((g) => g.group === key)
  if (!group) { group = { group: key, hideLabel: true, items: [] }; groups.push(group) }
  // The winning Action's commandPatch overrides the Command's presentation in this context
  // (ADR-0007 Patch), without mutating the global Command Singleton; then `{app}` interpolates.
  const raw = action.commandPatch?.title ?? command.title
  const label = raw.replace('{app}', activeAppName(os))
  const shortcut = command.shortcut ? formatShortcut(command.shortcut) : undefined
  const item: MenuItem = {
    label, onClick: () => invoke(command, os),
    ...(shortcut ? { shortcut } : {}), ...(command.icon ? { icon: command.icon } : {}),
    ...(selected.has(action.command) ? { selected: true } : {}),
  }
  if (action.submenu) {
    const submenuKey = `${key} ${action.submenu}`
    let parent = submenus.get(submenuKey)
    if (!parent) { parent = { label: action.submenu, submenu: [] }; submenus.set(submenuKey, parent); group.items.push(parent) }
    parent.submenu!.push(item)
  } else {
    group.items.push(item)
  }
}

// Menus that speak for the front app/window/surface, not the OS itself. An `os`-scope command in one
// of these is a scope lie (ADR-0039 rule 3) — full screen names the whole machine, so it lives in the
// System menu, never here. The System/File/Edit/Help menus are OS-neutral and carry no such rule.
const APP_CONNOTING_REGIONS = new Set<string>([APP_REGION, VIEW_REGION, WINDOW_REGION])

// Scope-honesty guard, checked at projection time (never a silent reshuffle): warn loudly if an
// os-scope command resolved into an app-connoting menu. A guard for future misplacements — the
// first-party set keeps full screen in System, so this fires only when a contribution breaks the rule.
function warnScopeDishonesty(regionId: string, live: ResolvedAction[]): void {
  if (!APP_CONNOTING_REGIONS.has(regionId)) return
  for (const { action, command } of live) {
    if (action.scope?.tier === 'os') {
      console.warn(`[actions] ⚠ scope-dishonesty: os-scope command "${command.id}" placed in app-connoting menu ${regionId} (ADR-0039 rule 3)`)
    }
  }
}

// A menu Region, resolved against the live Context and grouped into its divider sections. The dead
// half of every live-state toggle pair (fullscreen; the File menu's Add/Remove pin verbs) is dropped
// by state so only the live verb of each pair renders — a per-command suppression that only touches
// the commands it names, so passing the union to every menu is harmless.
export function menuOptions(regionId: string, os: OsStore): MenuGroup[] {
  const dead = new Set([...suppressedPlacementCommands(os), ...suppressedToggleCommands(os)])
  // The live-selected radio options (a checkmark). Command-id-keyed like `dead`, so passing it to
  // every menu is harmless — only the Theme options' ids ever match (the System menu).
  const selected = liveSelection()
  const live = projectRegion(regionId, os).filter((r) => !dead.has(r.action.command))
  warnScopeDishonesty(regionId, live)
  const groups: MenuGroup[] = []
  const submenus = new Map<string, MenuItem>() // "group submenuLabel" -> the parent item
  for (const { action, command } of live) appendItem(groups, submenus, action, command, os, selected)
  return groups
}

// The File menu, kept as a named alias — the extensive File-menu tests (competition, removal,
// carry-forward) read against it, and it reads clearest at the call site as one of the seven.
export function fileMenuOptions(os: OsStore): MenuGroup[] {
  return menuOptions(FILE_REGION, os)
}
