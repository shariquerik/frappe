// The OS's own menu bar as first-party `frappe` contributions — every one of the seven menus is
// data (a Command placed by an Action into a `menubar:<menu>` Region), not a literal array
// (ADR-0001 dogfooding; MenuBar.vue was the standing violation). The run Handlers register through
// the OPEN RUN_HANDLERS map (contributions.ts) exactly as an app's would; the resolver competes
// this data with the folded app contributions, so an app customizes any menu the way it already
// customizes File. Every item is BACKED — the `noop` stubs (the Edit menu, the Help-as-palette
// placeholder) were deleted, not parked on a do-nothing ref (ADR-0039 rule 1). An empty menu earns
// no title (MenuBar.vue), so the deleted verbs simply return when a real context contributes them.
import { surfaceAppId, windowRole, isFinderWindow } from '@/surface'
import { logout, switchToDesk } from '@/data/session'
import { ICON } from '@/config/icons'
import { registerRunHandlers } from './contributions'
import {
  SYSTEM_REGION, APP_REGION, VIEW_REGION, WINDOW_REGION, HELP_REGION,
} from './regions'
import type { Action, Command, Invocation } from './types'
import type { OsStore } from '@/types'

// The System menu's Theme submenu label — one shared string so the Actions that nest under it and
// the selected-overlay that checkmarks the live option can never drift apart (like POSITION_SUBMENU).
export const THEME_SUBMENU = 'Theme'

// The Theme option command per appearance value — the data half of the radio, shared by the
// placements below and the appearance seam (@/appearance) that both SETS the theme (its run
// Handlers) and reads the live value to checkmark the matching option. Kept here, frappe-ui-free,
// so this unit-tested module stays pure; the frappe-ui useTheme wiring lives in the seam (boot-only).
export const THEME_COMMAND: Record<string, string> = {
  light: 'frappe.system.theme-light',
  dark: 'frappe.system.theme-dark',
  system: 'frappe.system.theme-system',
}

// ── run Handlers (the imperative half; the OS seeds them through the same open seam as an app) ──
// Each is a RunHandler — it takes the Invocation (ADR-0037) and reaches the store through its `os`
// escape hatch, the documented territory for OS chrome verbs (these act on windows/split/session).

const activeWindow = (os: OsStore) => os.state.windows.find((w) => w.id === os.state.activeId)
const activeAppId = (os: OsStore): string | null => {
  const win = activeWindow(os)
  return win ? surfaceAppId(win.surface) : null
}

// Is the front-most context the Finder shell — the Finder window, or the bare desktop (which IS the
// Finder)? Its app-menu / Window verbs act on the Finder, never on the host framework app.
const frontIsFinder = (os: OsStore): boolean => {
  const win = activeWindow(os)
  return !win || isFinderWindow(win)
}

// The Finder shell (the Finder window or the bare desktop) opens a Finder window — never the frappe
// hub. Otherwise mint a FRESH window (even when the app already has one open) so "New window" stacks
// the way the label promises — openApp would just re-focus the existing one.
function newWindow({ os }: Invocation): void {
  if (frontIsFinder(os)) { os.openFinder(); return }
  os.newAppWindow(activeAppId(os) ?? 'frappe')
}

function closeActiveWindow({ os }: Invocation): void {
  if (os.state.activeId) os.requestCloseWin(os.state.activeId)
}

function minimizeActive({ os }: Invocation): void {
  if (os.state.activeId) os.minimizeWin(os.state.activeId)
}

function zoomActive({ os }: Invocation): void {
  if (os.state.activeId) os.toggleZoom(os.state.activeId)
}

function openActiveAppSettings({ os }: Invocation): void {
  // The Finder's preferences are the desktop-wide Settings (wallpaper/dock/general); it has no
  // app-scoped settings pane of its own yet (deferred-hardcoded: 07-finder-settings-pane).
  if (frontIsFinder(os)) { os.openSettings(); return }
  const appId = activeAppId(os)
  if (appId) os.openAppSettings(appId)
}

// Quit the front-most subject. A system window (the Finder, the per-user Settings) closes just
// itself — it owns no fleet of app windows to drop. An app quits by dropping every window that
// belongs to it and clearing focus/split. No-op on a bare desktop (nothing to quit).
function quitActiveApp({ os }: Invocation): void {
  const win = activeWindow(os)
  if (!win) return
  if (windowRole(win.id) !== 'app') { os.requestCloseWin(win.id); return }
  const appId = surfaceAppId(win.surface)
  os.state.windows = os.state.windows.filter((w) => surfaceAppId(w.surface) !== appId)
  os.state.activeId = null
  os.state.split = null
}

// Show the front app's dashboard — only for an app window that actually has one (the eligibility
// `when` already gates on the app role; the dashboard check stays here as the app-data guard).
function showDashboard({ os }: Invocation): void {
  const win = activeWindow(os)
  if (!win || windowRole(win.id) !== 'app') return
  if (os.DATA.APP[surfaceAppId(win.surface)]?.hasDashboard) os.goHome(win.id)
}

function showAsList({ os }: Invocation): void {
  const win = activeWindow(os)
  if (!win || windowRole(win.id) !== 'app') return
  const doctype = os.defaultWorkspaceDoctypes(surfaceAppId(win.surface))[0]
  if (doctype) os.openList(win.id, doctype)
}

// The OS's own menu run Handlers, keyed by the refs the Commands below cite. Every ref does
// something real — there is no shared `noop` (ADR-0039 rule 1): registering a ref asserts behavior,
// and an empty function would launder invoke's loud-throw guarantee into a silent do-nothing. About
// opens its dialog; Frappe help opens the docs (it no longer just re-opens the palette).
registerRunHandlers({
  'open-palette': ({ os }) => os.openPalette(),
  'open-settings': ({ os }) => os.openSettings(),
  'open-wallpaper': ({ os }) => os.openSettings('Wallpaper'),
  'open-about': ({ os }) => os.openAbout(),
  'help-frappe': () => window.open('https://docs.frappe.io', '_blank', 'noopener,noreferrer'),
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
  'toggle-fullscreen': ({ os }) => os.toggleFullscreen(),
  'enter-split': ({ os }) => os.enterSplit(),
  'exit-split': ({ os }) => os.exitSplit(),
})

// ── the declarative half: one Command per verb, one Action placing it into its menu Region ──

// A `run` Command; the OS's are all runs (a menu item fires behavior, it doesn't navigate a Surface).
// An optional `shortcut` (ADR-0037) rides the verb, so its key works wherever it is placed — and, for
// a keyboard-only verb (the palette), even with no placement at all.
const run = (id: string, title: string, ref: string, shortcut?: string): Command =>
  ({ id, sourceApp: 'frappe', title, handler: { kind: 'run', ref }, ...(shortcut ? { shortcut } : {}) })

// A `run` Command that also carries a leading icon — the icon-bearing submenu items (Theme options).
const runIcon = (id: string, title: string, ref: string, icon: string): Command =>
  ({ id, sourceApp: 'frappe', title, handler: { kind: 'run', ref }, icon })

export const MENUBAR_COMMANDS: Command[] = [
  // The command palette is keyboard-only (⌘K): a Command with a shortcut and NO Action placement —
  // reached by the Spotlight button, never a dropdown item (ADR-0039). Its shortcut still fires
  // because a placement-less verb is globally eligible (shortcuts.ts).
  run('frappe.palette.open', 'Command palette', 'open-palette', 'mod+k'),
  // system (the Frappe-logo menu): workspace + session verbs, plus whole-OS full screen — an
  // OS-wide toggle belongs in the OS menu, not the per-surface View menu (ADR-0039 rule 3). The
  // fullscreen pair is a live-state toggle (see suppressedToggleCommands).
  run('frappe.system.about', 'About this workspace', 'open-about'),
  run('frappe.system.settings', 'Settings…', 'open-settings'),
  run('frappe.system.wallpaper', 'Change wallpaper…', 'open-wallpaper'),
  run('frappe.system.enter-fullscreen', 'Enter full screen', 'toggle-fullscreen'),
  run('frappe.system.exit-fullscreen', 'Exit full screen', 'toggle-fullscreen'),
  run('frappe.system.switch-desk', 'Switch to Desk…', 'switch-to-desk'),
  // The Theme submenu (radio): three appearance options, the active one checkmarked
  // (selectedThemeCommands). The flyout, the `>` chevron, the leading icons and the checkmark are all
  // the OSDropdown's native submenu/selected/icon rendering — the same the dock's position menu uses.
  runIcon('frappe.system.theme-light', 'Light Mode', 'set-theme-light', ICON.sun),
  runIcon('frappe.system.theme-dark', 'Dark Mode', 'set-theme-dark', ICON.moon),
  runIcon('frappe.system.theme-system', 'System Default', 'set-theme-system', ICON.monitor),
  run('frappe.system.logout', 'Log out…', 'logout'),
  // app (the front app's own menu; `{app}` interpolates to its name at render time)
  run('frappe.app.settings', '{app} settings…', 'app-settings'),
  run('frappe.app.hide', 'Hide {app}', 'minimize-active'),
  run('frappe.app.quit', 'Quit {app}', 'quit-active-app'),
  // The OS owns NO File menu — File is a middle menu apps earn (ADR-0039 rule 2). The palette is
  // reached through the Spotlight ⌘K button, and the pin verbs live in Window (placement-verbs.ts).
  // view — per-surface verbs only (full screen moved to System, ADR-0039 rule 3)
  run('frappe.view.dashboard', 'Show dashboard', 'show-dashboard'),
  run('frappe.view.list', 'Show as list', 'show-as-list'),
  // window — window management, including New/Close (moved out of File: they are window verbs, not
  // file verbs). enter/exit-split is a live-state toggle handled by the split state, not a pair here.
  run('frappe.window.new', 'New window', 'new-window', 'mod+n'),
  run('frappe.window.close', 'Close window', 'close-active-window'),
  run('frappe.window.minimize', 'Minimize', 'minimize-active'),
  run('frappe.window.zoom', 'Zoom', 'zoom-active'),
  run('frappe.window.enter-split', 'Enter split view', 'enter-split'),
  run('frappe.window.exit-split', 'Exit split view', 'exit-split'),
  // help — a real destination (the Frappe docs), not a palette placeholder
  run('frappe.help.frappe', 'Frappe help', 'help-frappe'),
]

// Placement of each Command into its menu Region. `group` is the divider section the renderer
// draws; `order` is the ascending within-region position. The fullscreen pair shares one order —
// only one ever renders (the dead half is dropped by live state), so they never collide. Full
// screen is marked `os` scope: it names the whole machine, so the projector's scope-honesty check
// (menubar.ts) keeps it out of app/surface-connoting menus.
const APP_WINDOW = { windowRole: 'app' } as const
const OS_SCOPE = { tier: 'os' } as const
const place = (command: string, region: string, group: string, order: number, over: Partial<Action> = {}): Action =>
  ({ command, region, sourceApp: 'frappe', group, order, ...over })

export const MENUBAR_ACTIONS: Action[] = [
  place('frappe.system.about', SYSTEM_REGION, 'a', 0),
  place('frappe.system.settings', SYSTEM_REGION, 'b', 1),
  place('frappe.system.wallpaper', SYSTEM_REGION, 'b', 2),
  place('frappe.system.enter-fullscreen', SYSTEM_REGION, 'c', 3, { scope: OS_SCOPE }),
  place('frappe.system.exit-fullscreen', SYSTEM_REGION, 'c', 3, { scope: OS_SCOPE }),
  place('frappe.system.switch-desk', SYSTEM_REGION, 'd', 4),
  // Theme + session share group 'e' (one divider above the pair, no divider between — matching the
  // reference). The three Theme options nest under one submenu, above Log out; Log out ends the session.
  place('frappe.system.theme-light', SYSTEM_REGION, 'e', 5, { submenu: THEME_SUBMENU }),
  place('frappe.system.theme-dark', SYSTEM_REGION, 'e', 6, { submenu: THEME_SUBMENU }),
  place('frappe.system.theme-system', SYSTEM_REGION, 'e', 7, { submenu: THEME_SUBMENU }),
  place('frappe.system.logout', SYSTEM_REGION, 'e', 8),
  place('frappe.app.settings', APP_REGION, 'a', 0),
  place('frappe.app.hide', APP_REGION, 'a', 1),
  place('frappe.app.quit', APP_REGION, 'b', 2),
  place('frappe.view.dashboard', VIEW_REGION, 'a', 0, { when: APP_WINDOW }),
  place('frappe.view.list', VIEW_REGION, 'a', 1, { when: APP_WINDOW }),
  // Window groups: a (new/close) · b (minimize/zoom) · c (the pin verbs — placement-verbs.ts) ·
  // d (split). The pin verbs slot between Zoom and split, so split moves to group 'd'.
  place('frappe.window.new', WINDOW_REGION, 'a', 0),
  place('frappe.window.close', WINDOW_REGION, 'a', 1),
  place('frappe.window.minimize', WINDOW_REGION, 'b', 2),
  place('frappe.window.zoom', WINDOW_REGION, 'b', 3),
  place('frappe.window.enter-split', WINDOW_REGION, 'd', 6),
  place('frappe.window.exit-split', WINDOW_REGION, 'd', 7),
  place('frappe.help.frappe', HELP_REGION, 'a', 0),
]

// The fullscreen menu item is a single toggle whose label flips with live OS state — modeled as a
// command PAIR (enter/exit) with the dead half suppressed at render, the same shape the File menu's
// Add/Remove placement verbs use (suppressedPlacementCommands). Exactly one of the pair survives, so
// the System menu shows one correctly-labelled item without any literal `os.isFullscreen ? …` in
// the component.
export function suppressedToggleCommands(os: OsStore): Set<string> {
  return new Set([
    os.isFullscreen.value ? 'frappe.system.enter-fullscreen' : 'frappe.system.exit-fullscreen',
  ])
}
