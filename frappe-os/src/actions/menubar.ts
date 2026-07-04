// Project a `menubar:<menu>` Region into the OSDropdown option shape MenuBar.vue renders — the
// menu bar dogfoods contribution data → resolver → rendered Region → run Handler (ADR-0001). The
// resolve/join/gate/removal-warn is shared (project.ts); this file adds only the menu's divider
// grouping, the live-state suppression of a toggle pair's dead half (fullscreen / the File menu's
// Add/Remove verbs), and the `{app}` presentation token. Every one of the seven menus flows through
// the ONE menuOptions path — no menu is special (File was the first migrated; now none are literal).
import { invoke } from './contributions'
import { suppressedToggleCommands } from './menu-contributions'
import { suppressedPlacementCommands } from './placement-verbs'
import { projectRegion } from './project'
import { FILE_REGION } from './regions'
import { surfaceAppId } from '@/surface'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// One rendered menu item (label + click) and one divider group — the OSDropdown options shape.
export interface MenuItem { label: string; onClick: () => void }
export interface MenuGroup { group: string; hideLabel: boolean; items: MenuItem[] }

// The front app's display name, or "Finder" for the bare desktop — the `{app}` token's value. The
// same name the app menu shows ("Quit CRM"); presentation only, so it lives in the projector.
function activeAppName(os: OsStore): string {
  const win = os.state.windows.find((w) => w.id === os.state.activeId)
  const appId = win ? surfaceAppId(win.surface) : null
  return appId ? os.DATA.APP[appId]?.name ?? appId : 'Finder'
}

function appendItem(groups: MenuGroup[], action: Action, command: Command, os: OsStore): void {
  const key = action.group ?? ''
  let group = groups.find((g) => g.group === key)
  if (!group) { group = { group: key, hideLabel: true, items: [] }; groups.push(group) }
  // The winning Action's commandPatch overrides the Command's presentation in this context
  // (ADR-0007 Patch), without mutating the global Command Singleton; then `{app}` interpolates.
  const raw = action.commandPatch?.title ?? command.title
  const label = raw.replace('{app}', activeAppName(os))
  group.items.push({ label, onClick: () => invoke(command, os) })
}

// A menu Region, resolved against the live Context and grouped into its divider sections. The dead
// half of every live-state toggle pair (fullscreen; the File menu's Add/Remove pin verbs) is dropped
// by state so only the live verb of each pair renders — a per-command suppression that only touches
// the commands it names, so passing the union to every menu is harmless.
export function menuOptions(regionId: string, os: OsStore): MenuGroup[] {
  const dead = new Set([...suppressedPlacementCommands(os), ...suppressedToggleCommands(os)])
  const live = projectRegion(regionId, os).filter((r) => !dead.has(r.action.command))
  const groups: MenuGroup[] = []
  for (const { action, command } of live) appendItem(groups, action, command, os)
  return groups
}

// The File menu, kept as a named alias — the extensive File-menu tests (competition, removal,
// carry-forward) read against it, and it reads clearest at the call site as one of the seven.
export function fileMenuOptions(os: OsStore): MenuGroup[] {
  return menuOptions(FILE_REGION, os)
}
