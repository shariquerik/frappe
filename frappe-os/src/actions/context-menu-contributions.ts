// The desktop and dock right-click menus as first-party `frappe` contributions — the two context
// menus CONTEXT.md's Region entry already names, now real Regions (desktop:context / dock:context)
// resolved through the ONE engine instead of literal arrays (ADR-0001 dogfooding, mirroring the
// menu-bar migration). Their state-toggling entries (dock auto-hide, position) are `run` Handlers
// over the OS API, exactly like the menu bar's — no imperative literal survives in the components.
// This is the DATA half (Commands + Actions + run Handlers + the live-state overlays), imported by
// project.ts into the merged set; the render projectors live in context-menus.ts (which imports
// project.ts), keeping the same data/projector split as menu-contributions.ts / menubar.ts.
import { registerRunHandlers } from './contributions'
import { DESKTOP_CONTEXT_REGION, DOCK_CONTEXT_REGION } from './regions'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// The "Position on Screen" submenu label — one shared string so the Actions that nest under it and
// the projector that reads it can never drift apart.
export const POSITION_SUBMENU = 'Position on Screen'

// ── run Handlers (the imperative half; registered through the same open seam an app uses) ──
// The desktop's "Change Wallpaper…" reuses the menu bar's `open-wallpaper` ref (same verb), so only
// the dock's state toggles need fresh Handlers. Each drives the OS API, never touches state directly.
registerRunHandlers({
  'dock-hiding-on': ({ os }) => os.setDockAutoHide(true),
  'dock-hiding-off': ({ os }) => os.setDockAutoHide(false),
  'dock-position-left': ({ os }) => os.setDockPosition('left'),
  'dock-position-bottom': ({ os }) => os.setDockPosition('bottom'),
  'dock-position-right': ({ os }) => os.setDockPosition('right'),
  'open-dock-settings': ({ os }) => os.openSettings('Dock'),
})

// ── the declarative half: one Command per verb, one Action placing it into its Region ──

const run = (id: string, title: string, ref: string): Command =>
  ({ id, sourceApp: 'frappe', title, handler: { kind: 'run', ref } })

export const CONTEXT_MENU_COMMANDS: Command[] = [
  // desktop (right-click the wallpaper)
  run('frappe.desktop.wallpaper', 'Change Wallpaper…', 'open-wallpaper'),
  // dock — the auto-hide toggle is a live-state PAIR (only one renders, see suppressedDockHidingCommands)
  run('frappe.dock.hiding-on', 'Turn Hiding On', 'dock-hiding-on'),
  run('frappe.dock.hiding-off', 'Turn Hiding Off', 'dock-hiding-off'),
  // dock — the position options; the current one is marked selected (selectedDockPositionCommands)
  run('frappe.dock.position-left', 'Left', 'dock-position-left'),
  run('frappe.dock.position-bottom', 'Bottom', 'dock-position-bottom'),
  run('frappe.dock.position-right', 'Right', 'dock-position-right'),
  run('frappe.dock.settings', 'Dock Settings…', 'open-dock-settings'),
]

const place = (command: string, region: string, group: string, order: number, over: Partial<Action> = {}): Action =>
  ({ command, region, sourceApp: 'frappe', group, order, ...over })

export const CONTEXT_MENU_ACTIONS: Action[] = [
  place('frappe.desktop.wallpaper', DESKTOP_CONTEXT_REGION, 'a', 0),
  // The hiding pair shares order 0 — only one ever survives suppression, so they never collide. The
  // three position verbs nest under one submenu; "Dock Settings…" sits below a divider (group 'b').
  place('frappe.dock.hiding-on', DOCK_CONTEXT_REGION, 'a', 0),
  place('frappe.dock.hiding-off', DOCK_CONTEXT_REGION, 'a', 0),
  place('frappe.dock.position-left', DOCK_CONTEXT_REGION, 'a', 1, { submenu: POSITION_SUBMENU }),
  place('frappe.dock.position-bottom', DOCK_CONTEXT_REGION, 'a', 2, { submenu: POSITION_SUBMENU }),
  place('frappe.dock.position-right', DOCK_CONTEXT_REGION, 'a', 3, { submenu: POSITION_SUBMENU }),
  place('frappe.dock.settings', DOCK_CONTEXT_REGION, 'b', 4),
]

// ── live-state overlays (the same shape the menu bar's fullscreen toggle uses) ──

// The auto-hide toggle's dead half: when hiding is ON, the "Turn Hiding On" verb is dropped (and
// vice-versa), so the menu shows one correctly-labelled toggle without a literal ternary in the view.
export function suppressedDockHidingCommands(os: OsStore): Set<string> {
  return new Set([os.state.dockAutoHide ? 'frappe.dock.hiding-on' : 'frappe.dock.hiding-off'])
}

const POSITION_COMMAND: Record<string, string> = {
  left: 'frappe.dock.position-left',
  bottom: 'frappe.dock.position-bottom',
  right: 'frappe.dock.position-right',
}

// The position command matching the dock's current side — marked with a checkmark in the submenu.
export function selectedDockPositionCommands(os: OsStore): Set<string> {
  const command = POSITION_COMMAND[os.state.dockPosition]
  return new Set(command ? [command] : [])
}
