// Project the `menubar:file` Region into the OSDropdown option shape MenuBar.vue renders — the
// File menu dogfoods contribution data → resolver → rendered Region → run Handler (ADR-0001). The
// resolve/join/gate/removal-warn is shared (project.ts); this file adds only the menu's divider
// grouping and the Add/Remove pin-state filter. Only the File menu is migrated this slice; the
// other six menus stay literal in MenuBar.vue pending later incremental migration.
import { invoke } from './contributions'
import { suppressedPlacementCommands } from './placement-verbs'
import { projectRegion } from './project'
import { FILE_REGION } from './regions'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// One rendered menu item (label + click) and one divider group — the OSDropdown options shape.
export interface MenuItem { label: string; onClick: () => void }
export interface MenuGroup { group: string; hideLabel: boolean; items: MenuItem[] }

function appendItem(groups: MenuGroup[], action: Action, command: Command, os: OsStore): void {
  const key = action.group ?? ''
  let group = groups.find((g) => g.group === key)
  if (!group) { group = { group: key, hideLabel: true, items: [] }; groups.push(group) }
  // The winning Action's commandPatch overrides the Command's presentation in this context
  // (ADR-0007 Patch), without mutating the global Command Singleton.
  const label = action.commandPatch?.title ?? command.title
  group.items.push({ label, onClick: () => invoke(command, os) })
}

// The File menu, resolved against the live Context and grouped into its divider sections. Each
// region's Add/Remove pair both resolve (distinct command ids never compete); the dead half — Add
// when already pinned, Remove when not — is dropped by pin state, so only the live verb of each
// pair renders. The inverse "Remove…" thus appears only on an already-pinned surface (#04).
export function fileMenuOptions(os: OsStore): MenuGroup[] {
  const dead = suppressedPlacementCommands(os)
  const live = projectRegion(FILE_REGION, os).filter((r) => !dead.has(r.action.command))
  const groups: MenuGroup[] = []
  for (const { action, command } of live) appendItem(groups, action, command, os)
  return groups
}
