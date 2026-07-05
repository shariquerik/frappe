// The render projectors for the desktop and dock right-click menus — the projector half of the
// data/projector split (the data + Handlers live in context-menu-contributions.ts). Each projects
// its `*:context` Region through the shared projectRegion (like menubar.ts / toolbar.ts), so the
// two context menus dogfood contribution data → resolver → rendered Region → run Handler (ADR-0001).
// Both emit the shared `ContextMenuOption[]` shape (OSContextMenu), the single context-menu primitive.
import { invoke } from './contributions'
import {
  suppressedDockHidingCommands, selectedDockPositionCommands,
} from './context-menu-contributions'
import { projectRegion } from './project'
import { DESKTOP_CONTEXT_REGION, DOCK_CONTEXT_REGION } from './regions'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'
import type { ContextMenuOption } from '@/components/OSContextMenu.vue'

// The winning Action's commandPatch overrides the Command's presentation for this context (ADR-0007),
// without mutating the global Command Singleton.
const labelOf = (action: Action, command: Command): string => action.commandPatch?.title ?? command.title

// The desktop (wallpaper) menu: a flat list. No dividers or submenus today — the lone entry and any
// app contribution render as one ordered list.
export function desktopContextItems(os: OsStore): ContextMenuOption[] {
  return projectRegion(DESKTOP_CONTEXT_REGION, os).map(({ action, command }) => ({
    label: labelOf(action, command),
    onClick: () => invoke(command, os),
  }))
}

// The dock tray menu: one flat option list with a divider between Action groups, the live auto-hide
// toggle's dead half suppressed, the current position marked selected, and same-`submenu` siblings
// nested into one parent. The resolved winners arrive in ascending `order`, so groups and submenu
// items keep their order. `group` boundaries become `{ separator: true }` between the two sections.
export function dockContextOptions(os: OsStore): ContextMenuOption[] {
  const dead = suppressedDockHidingCommands(os)
  const selected = selectedDockPositionCommands(os)
  const live = projectRegion(DOCK_CONTEXT_REGION, os).filter((r) => !dead.has(r.action.command))
  const groups: { key: string; options: ContextMenuOption[] }[] = []
  const submenus = new Map<string, ContextMenuOption>() // "group submenuLabel" -> the parent item
  for (const { action, command } of live) {
    const key = action.group ?? ''
    let group = groups.find((g) => g.key === key)
    if (!group) { group = { key, options: [] }; groups.push(group) }
    const item: ContextMenuOption = { label: labelOf(action, command), onClick: () => invoke(command, os) }
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
  // Flatten the groups into one list, a divider between each — the dock's two sections
  // (position/hiding, then Settings) read as grouped without the OSDropdown group wrapper.
  return groups.flatMap((g, i) => (i === 0 ? g.options : [{ separator: true } as ContextMenuOption, ...g.options]))
}
