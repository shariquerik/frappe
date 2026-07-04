// The OS's own menu bar as first-party `frappe` contributions — every one of the seven menus is
// data (a Command placed by an Action into a `menubar:<menu>` Region), not a literal array
// (ADR-0001 dogfooding; MenuBar.vue was the standing violation). The run Handlers register through
// the OPEN RUN_HANDLERS map (contributions.ts) exactly as an app's would; the resolver competes
// this data with the folded app contributions, so an app customizes any menu the way it already
// customizes File. Stub items (Undo, Lock screen, …) point at the shared `noop` Handler — still
// declared as data, still resolved, just without behavior yet.
import { surfaceAppId, windowRole } from '@/surface'
import { logout, switchToDesk } from '@/data/session'
import { registerRunHandlers } from './contributions'
import {
  SYSTEM_REGION, APP_REGION, FILE_REGION, EDIT_REGION, VIEW_REGION, WINDOW_REGION, HELP_REGION,
} from './regions'
import type { Action, Command } from './types'
import type { OsStore } from '@/types'

// ── run Handlers (the imperative half; the OS seeds them through the same open seam as an app) ──

const activeWindow = (os: OsStore) => os.state.windows.find((w) => w.id === os.state.activeId)
const activeAppId = (os: OsStore): string | null => {
  const win = activeWindow(os)
  return win ? surfaceAppId(win.surface) : null
}

// Always mint a FRESH window (even when the app already has one open) so "New window" stacks the
// way the label promises — openApp would just re-focus the existing one. A bare desktop opens frappe.
function newWindow(os: OsStore): void {
  os.newAppWindow(activeAppId(os) ?? 'frappe')
}

function closeActiveWindow(os: OsStore): void {
  if (os.state.activeId) os.requestCloseWin(os.state.activeId)
}

function minimizeActive(os: OsStore): void {
  if (os.state.activeId) os.minimizeWin(os.state.activeId)
}

function zoomActive(os: OsStore): void {
  if (os.state.activeId) os.toggleZoom(os.state.activeId)
}

function openActiveAppSettings(os: OsStore): void {
  const appId = activeAppId(os)
  if (appId) os.openAppSettings(appId)
}

// Quit the front-most app: drop every window that belongs to it and clear focus/split. No-op on a
// bare desktop (no active app).
function quitActiveApp(os: OsStore): void {
  const appId = activeAppId(os)
  if (!appId) return
  os.state.windows = os.state.windows.filter((w) => surfaceAppId(w.surface) !== appId)
  os.state.activeId = null
  os.state.split = null
}

// Show the front app's dashboard — only for an app window that actually has one (the eligibility
// `when` already gates on the app role; the dashboard check stays here as the app-data guard).
function showDashboard(os: OsStore): void {
  const win = activeWindow(os)
  if (!win || windowRole(win.id) !== 'app') return
  if (os.DATA.APP[surfaceAppId(win.surface)]?.hasDashboard) os.goHome(win.id)
}

function showAsList(os: OsStore): void {
  const win = activeWindow(os)
  if (!win || windowRole(win.id) !== 'app') return
  os.openList(win.id, os.DATA.APP[surfaceAppId(win.surface)].modules[0].doctypes[0])
}

// The OS's own menu run Handlers, keyed by the refs the Commands below cite. `noop` backs every
// still-stubbed item (Undo/Redo/Cut/Copy/Paste, About, Lock screen) — one shared do-nothing, not a
// per-stub ref — so a stub is genuine data that simply has no behavior yet.
registerRunHandlers({
  noop: () => {},
  'open-palette': (os) => os.openPalette(),
  'open-settings': (os) => os.openSettings(),
  'open-wallpaper': (os) => os.openSettings('Wallpaper'),
  'switch-to-desk': () => switchToDesk(),
  logout: () => logout(),
  'new-window': newWindow,
  'close-active-window': closeActiveWindow,
  'app-settings': openActiveAppSettings,
  'minimize-active': minimizeActive,
  'zoom-active': zoomActive,
  'quit-active-app': quitActiveApp,
  'show-dashboard': showDashboard,
  'show-as-list': showAsList,
  'toggle-fullscreen': (os) => os.toggleFullscreen(),
  'enter-split': (os) => os.enterSplit(),
  'exit-split': (os) => os.exitSplit(),
})

// ── the declarative half: one Command per verb, one Action placing it into its menu Region ──

// A `run` Command; the OS's are all runs (a menu item fires behavior, it doesn't navigate a Surface).
const run = (id: string, title: string, ref: string): Command =>
  ({ id, sourceApp: 'frappe', title, handler: { kind: 'run', ref } })

export const MENUBAR_COMMANDS: Command[] = [
  // system (the Frappe-logo menu): workspace + session verbs
  run('frappe.system.about', 'About this workspace', 'noop'),
  run('frappe.system.settings', 'Settings…', 'open-settings'),
  run('frappe.system.wallpaper', 'Change wallpaper…', 'open-wallpaper'),
  run('frappe.system.switch-desk', 'Switch to Desk…', 'switch-to-desk'),
  run('frappe.system.lock', 'Lock screen', 'noop'),
  run('frappe.system.logout', 'Log out…', 'logout'),
  // app (the front app's own menu; `{app}` interpolates to its name at render time)
  run('frappe.app.settings', '{app} settings…', 'app-settings'),
  run('frappe.app.hide', 'Hide {app}', 'minimize-active'),
  run('frappe.app.quit', 'Quit {app}', 'quit-active-app'),
  // file
  run('frappe.file.open', 'Open…', 'open-palette'),
  run('frappe.window.new', 'New window', 'new-window'),
  run('frappe.window.close', 'Close window', 'close-active-window'),
  // edit (all stubs today)
  run('frappe.edit.undo', 'Undo', 'noop'),
  run('frappe.edit.redo', 'Redo', 'noop'),
  run('frappe.edit.cut', 'Cut', 'noop'),
  run('frappe.edit.copy', 'Copy', 'noop'),
  run('frappe.edit.paste', 'Paste', 'noop'),
  // view (the fullscreen pair is a live-state toggle — see suppressedToggleCommands)
  run('frappe.view.dashboard', 'Show dashboard', 'show-dashboard'),
  run('frappe.view.list', 'Show as list', 'show-as-list'),
  run('frappe.view.enter-fullscreen', 'Enter full screen', 'toggle-fullscreen'),
  run('frappe.view.exit-fullscreen', 'Exit full screen', 'toggle-fullscreen'),
  // window
  run('frappe.window.minimize', 'Minimize', 'minimize-active'),
  run('frappe.window.zoom', 'Zoom', 'zoom-active'),
  run('frappe.window.enter-split', 'Enter split view', 'enter-split'),
  run('frappe.window.exit-split', 'Exit split view', 'exit-split'),
  // help
  run('frappe.help.frappe', 'Frappe help', 'open-palette'),
]

// Placement of each Command into its Region. `group` is the divider section the renderer draws;
// `order` is the ascending within-region position. All global (`when` absent) EXCEPT the two View
// verbs that only make sense on an app window. The fullscreen pair shares order 2 — only one ever
// renders (the dead half is dropped by live state), so they never collide.
const APP_WINDOW = { windowRole: 'app' } as const
const place = (command: string, region: string, group: string, order: number, over: Partial<Action> = {}): Action =>
  ({ command, region, sourceApp: 'frappe', group, order, ...over })

export const MENUBAR_ACTIONS: Action[] = [
  place('frappe.system.about', SYSTEM_REGION, 'a', 0),
  place('frappe.system.settings', SYSTEM_REGION, 'b', 1),
  place('frappe.system.wallpaper', SYSTEM_REGION, 'b', 2),
  place('frappe.system.switch-desk', SYSTEM_REGION, 'c', 3),
  place('frappe.system.lock', SYSTEM_REGION, 'd', 4),
  place('frappe.system.logout', SYSTEM_REGION, 'd', 5),
  place('frappe.app.settings', APP_REGION, 'a', 0),
  place('frappe.app.hide', APP_REGION, 'a', 1),
  place('frappe.app.quit', APP_REGION, 'b', 2),
  place('frappe.file.open', FILE_REGION, 'a', 0),
  place('frappe.window.new', FILE_REGION, 'a', 1),
  place('frappe.window.close', FILE_REGION, 'b', 2),
  place('frappe.edit.undo', EDIT_REGION, 'a', 0),
  place('frappe.edit.redo', EDIT_REGION, 'a', 1),
  place('frappe.edit.cut', EDIT_REGION, 'b', 2),
  place('frappe.edit.copy', EDIT_REGION, 'b', 3),
  place('frappe.edit.paste', EDIT_REGION, 'b', 4),
  place('frappe.view.dashboard', VIEW_REGION, 'a', 0, { when: APP_WINDOW }),
  place('frappe.view.list', VIEW_REGION, 'a', 1, { when: APP_WINDOW }),
  place('frappe.view.enter-fullscreen', VIEW_REGION, 'b', 2),
  place('frappe.view.exit-fullscreen', VIEW_REGION, 'b', 2),
  place('frappe.window.minimize', WINDOW_REGION, 'a', 0),
  place('frappe.window.zoom', WINDOW_REGION, 'a', 1),
  place('frappe.window.enter-split', WINDOW_REGION, 'b', 2),
  place('frappe.window.exit-split', WINDOW_REGION, 'b', 3),
  place('frappe.help.frappe', HELP_REGION, 'a', 0),
]

// The fullscreen menu item is a single toggle whose label flips with live OS state — modeled as a
// command PAIR (enter/exit) with the dead half suppressed at render, the same shape the File menu's
// Add/Remove placement verbs use (suppressedPlacementCommands). Exactly one of the pair survives, so
// the View menu shows one correctly-labelled item without any literal `os.isFullscreen ? …` in the
// component.
export function suppressedToggleCommands(os: OsStore): Set<string> {
  return new Set([
    os.isFullscreen.value ? 'frappe.view.enter-fullscreen' : 'frappe.view.exit-fullscreen',
  ])
}
