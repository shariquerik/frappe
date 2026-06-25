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
import { PLACEMENT_ACTIONS, PLACEMENT_COMMANDS, suppressedPlacementCommands } from './placement-verbs'
import { warnFeatureAppRemovals } from './removals'
import { resolve } from './resolve'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// One rendered menu item (label + click) and one divider group — the OSDropdown options shape.
export interface MenuItem { label: string; onClick: () => void }
export interface MenuGroup { group: string; hideLabel: boolean; items: MenuItem[] }

// Fold the merged Commands into an id→Command map, FIRST-SEEN WINS (first-party FILE_COMMANDS
// lead, so an app can never silently replace an OS default verb's run Handler or title). A
// colliding id is a shadow on the Command axis — attributed and logged like the resolver's
// Action shadows, never a silent last-wins overwrite (ADR-0014). Apps override a verb's
// presentation contextually through an Action's commandPatch, not by re-declaring the Command.
function commandsById(commands: Command[]): Map<string, Command> {
  const byId = new Map<string, Command>()
  for (const command of commands) {
    const winner = byId.get(command.id)
    if (winner) {
      console.warn(`[actions] command-collision: ${command.id} — "${winner.sourceApp}" shadows "${command.sourceApp}"`)
      continue
    }
    byId.set(command.id, command)
  }
  return byId
}

// First-party OS defaults ⊕ the server-folded app contributions — the data the resolver competes.
// Memoized on the registry's collection identity (a stable reference until the next boot /
// initRegistry), so the File-menu computed doesn't re-spread the arrays and rebuild the id map on
// every reactive tick — the per-render allocation the other six menus would multiply once migrated.
interface Merged { byId: Map<string, Command>; actions: Action[] }
let cache: (Merged & { sourceCommands: Command[]; sourceActions: Action[] }) | null = null

function merged(): Merged {
  const sourceCommands = useRegistry().commands()
  const sourceActions = useRegistry().actions()
  if (!cache || cache.sourceCommands !== sourceCommands || cache.sourceActions !== sourceActions) {
    const byId = commandsById([...FILE_COMMANDS, ...PLACEMENT_COMMANDS, ...sourceCommands])
    cache = { sourceCommands, sourceActions, byId, actions: [...FILE_ACTIONS, ...PLACEMENT_ACTIONS, ...sourceActions] }
  }
  return cache
}

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
  const { byId, actions } = merged()
  const { items, shadows } = resolve(actions, FILE_REGION, contextForOS(os))
  // Each region's Add/Remove pair both resolve (distinct command ids never compete); the dead half
  // — Add when already pinned, Remove when not — is dropped by pin state, so only the live verb of
  // each pair renders. The inverse "Remove…" thus appears only on an already-pinned surface (#04).
  const dead = suppressedPlacementCommands(os)
  const live = items.filter((a) => !dead.has(a.command))
  // ADR-0014 item 4: on top of the resolver's uniform removal log, warn loudly when the app that
  // stripped chrome is a feature app (the surprising case) — classified from the folded registry.
  warnFeatureAppRemovals(shadows, useRegistry().appKind)
  const groups: MenuGroup[] = []
  for (const action of live) {
    const command = byId.get(action.command)
    if (!command) {
      // An Action whose Command id has no contribution can't render — warn, never silently drop
      // (the slice's "never a silent drop" stance; an app likely shipped os_actions, not os_commands).
      console.warn(`[actions] dropped Action for "${action.command}" in ${action.region}: no such Command (from "${action.sourceApp}")`)
      continue
    }
    appendItem(groups, action, command, os)
  }
  return groups
}
