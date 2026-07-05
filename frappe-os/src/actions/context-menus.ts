// The render projectors for the desktop and dock right-click menus — the projector half of the
// data/projector split (the data + Handlers live in context-menu-contributions.ts). Each projects
// its `*:context` Region through the shared projectRegion (like menubar.ts / toolbar.ts), so the
// two context menus dogfood contribution data → resolver → rendered Region → run Handler (ADR-0001).
import { invoke } from './contributions'
import {
  suppressedDockHidingCommands, selectedDockPositionCommands,
} from './context-menu-contributions'
import { projectRegion } from './project'
import { DESKTOP_CONTEXT_REGION, DOCK_CONTEXT_REGION } from './regions'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// One rendered menu item — a label + click, optionally selected (a checkmark) or a submenu parent
// (no click of its own, just a nested list). The OSDropdown option shape the dock renders.
export interface ContextMenuItem {
  label: string
  onClick?: () => void
  selected?: boolean
  submenu?: ContextMenuItem[]
}
export interface ContextMenuGroup {
  hideLabel: true
  group: string
  options: ContextMenuItem[]
}

// The winning Action's commandPatch overrides the Command's presentation for this context (ADR-0007),
// without mutating the global Command Singleton.
const labelOf = (action: Action, command: Command): string => action.commandPatch?.title ?? command.title

// The desktop menu: a flat, cursor-pinned list (OSCursorMenu). No dividers or submenus today — the
// lone entry and any app contribution render as one ordered list of buttons.
export function desktopContextItems(os: OsStore): { label: string; onClick: () => void }[] {
  return projectRegion(DESKTOP_CONTEXT_REGION, os).map(({ action, command }) => ({
    label: labelOf(action, command),
    onClick: () => invoke(command, os),
  }))
}

// The dock menu: OSDropdown groups, with the live auto-hide toggle's dead half suppressed, the
// current position marked selected, and same-`submenu` siblings nested into one parent item. The
// resolved winners already arrive in ascending `order`, so groups and submenu items keep their order.
export function dockContextOptions(os: OsStore): ContextMenuGroup[] {
  const dead = suppressedDockHidingCommands(os)
  const selected = selectedDockPositionCommands(os)
  const live = projectRegion(DOCK_CONTEXT_REGION, os).filter((r) => !dead.has(r.action.command))
  const groups: ContextMenuGroup[] = []
  const submenus = new Map<string, ContextMenuItem>() // "group submenuLabel" -> the parent item
  for (const { action, command } of live) {
    const key = action.group ?? ''
    let group = groups.find((g) => g.group === key)
    if (!group) { group = { hideLabel: true, group: key, options: [] }; groups.push(group) }
    const item: ContextMenuItem = { label: labelOf(action, command), onClick: () => invoke(command, os) }
    if (selected.has(action.command)) item.selected = true
    if (action.submenu) {
      const submenuKey = `${key} ${action.submenu}`
      let parent = submenus.get(submenuKey)
      if (!parent) { parent = { label: action.submenu, submenu: [] }; submenus.set(submenuKey, parent); group.options.push(parent) }
      parent.submenu!.push(item)
    } else {
      group.options.push(item)
    }
  }
  return groups
}
