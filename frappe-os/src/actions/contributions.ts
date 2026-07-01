// The OS's own File-menu items as first-party `frappe` contributions — dogfooding ADR-0001
// (MenuBar.vue is the standing violation we start migrating here). Each item is a Command (the
// verb) placed by an Action into the `menubar:file` Region. The run Handlers are resolved
// through RUN_HANDLERS, an OPEN ref→fn map (mirrors registry's applet entries — no server
// round-trip for the OS's own defaults). A run Handler is fire-and-forget (ADR: no
// lifecycle/teardown — deferred). Only the File region is migrated this slice; the other six
// menus stay literal in MenuBar.vue.
import { surfaceAppId } from '@/surface'
import type { OsStore } from '@/types'
import type { Action, Command } from './types'
import { FILE_REGION } from './regions'

// Open a new window of the active app (or the frappe home when the desktop is bare). Always
// mints a FRESH window instance — even when that app already has one open — so repeated "New
// window" stacks windows the way the menu label promises (openApp would just re-focus the one).
function newWindow(os: OsStore): void {
  const win = os.state.windows.find((w) => w.id === os.state.activeId)
  os.newAppWindow(win ? surfaceAppId(win.surface) : 'frappe')
}

function closeActiveWindow(os: OsStore): void {
  if (os.state.activeId) os.requestCloseWin(os.state.activeId)
}

// The ref→behavior map for run Handlers — OPEN, not a closed first-party constant. The OS seeds
// its OWN handlers here; an app ships its run handlers the SAME way through registerRunHandlers
// (the general mechanism — no privileged core, CONTEXT.md → App). The resolver never loads one to
// judge eligibility; a handler is reached only on invoke.
type RunHandler = (os: OsStore) => void
const RUN_HANDLERS: Record<string, RunHandler> = {
  'open-palette': (os) => os.openPalette(),
  'new-window': newWindow,
  'close-active-window': closeActiveWindow,
}

// Register run Handlers into the open map — how an app's run Commands become invocable, the same
// seam the (deferred) applet-style ESM loader that fetches an app's handler module will feed.
// Without this an app-contributed run Command folds through the whole pipeline but throws on
// invoke ("no run handler registered") — a first-party-only path masquerading as the general one.
export function registerRunHandlers(handlers: Record<string, RunHandler>): void {
  Object.assign(RUN_HANDLERS, handlers)
}

export const FILE_COMMANDS: Command[] = [
  { id: 'frappe.file.open', sourceApp: 'frappe', title: 'Open…', handler: { kind: 'run', ref: 'open-palette' } },
  { id: 'frappe.window.new', sourceApp: 'frappe', title: 'New window', handler: { kind: 'run', ref: 'new-window' } },
  { id: 'frappe.window.close', sourceApp: 'frappe', title: 'Close window', handler: { kind: 'run', ref: 'close-active-window' } },
]

// Placement of each File Command into the `menubar:file` Region. `group` carries the divider
// group the OS renderer draws (a / b → the two original File-menu sections); `order` is the
// ascending within-region position. All global (`when` absent) — File items always apply.
export const FILE_ACTIONS: Action[] = [
  { command: 'frappe.file.open', region: FILE_REGION, sourceApp: 'frappe', group: 'a', order: 0 },
  { command: 'frappe.window.new', region: FILE_REGION, sourceApp: 'frappe', group: 'a', order: 1 },
  { command: 'frappe.window.close', region: FILE_REGION, sourceApp: 'frappe', group: 'b', order: 2 },
]

// Invoke a resolved Command. A navigate Handler is pure data (open its Surface); a run Handler
// is resolved by ref through RUN_HANDLERS and fired (loud throw if the ref is unregistered —
// never a silent no-op, the bug this slice fixes).
export function invoke(command: Command, os: OsStore): void {
  const handler = command.handler
  if (handler.kind === 'navigate') { os.openSurface(handler.surface); return }
  const run = RUN_HANDLERS[handler.ref]
  if (!run) throw new Error(`[actions] no run handler registered for ref "${handler.ref}" (command ${command.id})`)
  run(os)
}
