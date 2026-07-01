// The shared Region projector: merged registry → scope-aware resolver → joined, gated
// ResolvedActions. Both render contracts — menubar.ts's fileMenuOptions and toolbar.ts's
// toolbarItems — build on this, so one resolve path, one Command join, one missing-Command warn,
// and one selection gate serve every Region. A new Region is a render-shape mapping over
// projectRegion, never a re-implementation of the fold.
import { useRegistry } from '@/registry'
import { contextForOS } from './context'
import { FILE_ACTIONS, FILE_COMMANDS } from './contributions'
import { PLACEMENT_ACTIONS, PLACEMENT_COMMANDS } from './placement-verbs'
import { regionById, regionRenders } from './regions'
import { warnFeatureAppRemovals } from './removals'
import { resolve } from './resolve'
import type { Action, Command, ResolvedAction } from './types'
import type { OsStore } from '@/types'

// Fold merged Commands into an id→Command map, FIRST-SEEN WINS (first-party defaults lead, so an
// app can never silently replace an OS verb's Handler or title). A colliding id is a Command-axis
// shadow, logged like the resolver's Action shadows, never a silent last-wins overwrite (ADR-0014).
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
// initRegistry), so a projector doesn't re-spread the arrays and rebuild the id map on every
// reactive tick — the per-render allocation the surface Regions would otherwise multiply.
interface Merged { byId: Map<string, Command>; actions: Action[] }
let cache: (Merged & { sourceCommands: Command[]; sourceActions: Action[] }) | null = null

export function merged(): Merged {
  const sourceCommands = useRegistry().commands()
  const sourceActions = useRegistry().actions()
  if (!cache || cache.sourceCommands !== sourceCommands || cache.sourceActions !== sourceActions) {
    const byId = commandsById([...FILE_COMMANDS, ...PLACEMENT_COMMANDS, ...sourceCommands])
    cache = { sourceCommands, sourceActions, byId, actions: [...FILE_ACTIONS, ...PLACEMENT_ACTIONS, ...sourceActions] }
  }
  return cache
}

// Resolve a Region against the live Context into ready-to-render winners: the scope-aware resolver
// picks each (region, command) winner, the merged map joins its verb, and the Region's gate hides a
// selection-less bulk bar. A winning Action whose Command id has no contribution can't render — it
// is warned and skipped, never silently dropped. Feature-app removals are warned here too (ADR-0014).
export function projectRegion(regionId: string, os: OsStore): ResolvedAction[] {
  const context = contextForOS(os)
  if (!regionRenders(regionById(regionId), context)) return []
  const { byId, actions } = merged()
  const { items, shadows } = resolve(actions, regionId, context)
  warnFeatureAppRemovals(shadows, useRegistry().appKind)
  const resolved: ResolvedAction[] = []
  for (const action of items) {
    const command = byId.get(action.command)
    if (!command) {
      console.warn(`[actions] dropped Action for "${action.command}" in ${action.region}: no such Command (from "${action.sourceApp}")`)
      continue
    }
    resolved.push({ action, command })
  }
  return resolved
}
