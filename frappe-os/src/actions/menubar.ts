// Project the `menubar:file` Region into the OSDropdown option shape MenuBar.vue renders.
// This is the seam the File menu dogfoods: contribution data → resolver → rendered Region →
// run Handler. Only the File menu is migrated this slice; the other six menus stay literal.
//
// The action data is the merged registry: the bundled first-party `frappe` defaults
// (FILE_COMMANDS/FILE_ACTIONS — their run Handlers are compiled into the OS, so like the
// registry's FIRST_PARTY applets they can't arrive from the server) ⊕ the server-folded
// `command`/`action` contributions each app declares via its hook. That fold is what lets
// erpnext's override actually compete against the OS default (Slice 2).
import { useRegistry } from '@/registry'
import { contextForOS } from './context'
import { FILE_ACTIONS, FILE_COMMANDS, FILE_REGION, invoke } from './contributions'
import { resolve } from './resolve'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// One rendered menu item (label + click) and one divider group — the OSDropdown options shape.
export interface MenuItem { label: string; onClick: () => void }
export interface MenuGroup { group: string; hideLabel: boolean; items: MenuItem[] }

// First-party OS defaults ⊕ the server-folded app contributions, the data the resolver competes.
function mergedCommands(): Command[] { return [...FILE_COMMANDS, ...useRegistry().commands()] }
function mergedActions(): Action[] { return [...FILE_ACTIONS, ...useRegistry().actions()] }

function appendItem(groups: MenuGroup[], action: Action, command: Command, os: OsStore): void {
  const key = action.group ?? ''
  let group = groups.find((g) => g.group === key)
  if (!group) { group = { group: key, hideLabel: true, items: [] }; groups.push(group) }
  // The winning Action's commandPatch overrides the Command's presentation in this context
  // (ADR-0007 Patch), without mutating the global Command Singleton.
  const label = action.commandPatch?.title ?? command.title
  group.items.push({ label, onClick: () => invoke(command, os) })
}

// The File menu, resolved against the live Context and grouped into its divider sections.
export function fileMenuOptions(os: OsStore): MenuGroup[] {
  const byId = new Map(mergedCommands().map((c) => [c.id, c]))
  const { items } = resolve(mergedActions(), FILE_REGION, contextForOS(os))
  const groups: MenuGroup[] = []
  for (const action of items) {
    const command = byId.get(action.command)
    if (command) appendItem(groups, action, command, os)
  }
  return groups
}
