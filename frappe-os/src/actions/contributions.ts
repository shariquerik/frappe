// The OS's own File-menu items as first-party `frappe` contributions — dogfooding ADR-0001
// (MenuBar.vue is the standing violation we start migrating here). Each item is a Command (the
// verb) placed by an Action into the `menubar:file` Region. The run Handlers are resolved
// through FIRST_PARTY_RUN, a static ref→fn map (mirrors registry's FIRST_PARTY applets — no
// server round-trip for the OS's own defaults). A run Handler is fire-and-forget (ADR: no
// lifecycle/teardown — deferred). Only the File region is migrated this slice; the other six
// menus stay literal in MenuBar.vue.
import { surfaceAppId } from '@/surface'
import type { OsStore } from '@/types'
import type { Action, Command } from './types'

export const FILE_REGION = 'menubar:file'

// Open a new window of the active app (or the frappe home when the desktop is bare). The OS
// window model is one window per app today, so this focuses-or-creates that app's window.
function newWindow(os: OsStore): void {
  const win = os.state.windows.find((w) => w.id === os.state.activeId)
  os.openApp(win ? surfaceAppId(win.surface) : 'frappe')
}

function closeActiveWindow(os: OsStore): void {
  if (os.state.activeId) os.closeWin(os.state.activeId)
}

// The closed ref→behavior map for the OS's own run Handlers. An app contributing its own run
// Command ships its handler the same way (its own map); the resolver never loads one to judge
// eligibility — it is reached only on invoke.
const FIRST_PARTY_RUN: Record<string, (os: OsStore) => void> = {
  'open-palette': (os) => os.openPalette(),
  'new-window': newWindow,
  'close-active-window': closeActiveWindow,
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
// is resolved by ref through FIRST_PARTY_RUN and fired (loud throw if the ref is unregistered —
// never a silent no-op, the bug this slice fixes).
export function invoke(command: Command, os: OsStore): void {
  const handler = command.handler
  if (handler.kind === 'navigate') { os.openSurface(handler.surface); return }
  const run = FIRST_PARTY_RUN[handler.ref]
  if (!run) throw new Error(`[actions] no run handler registered for ref "${handler.ref}" (command ${command.id})`)
  run(os)
}
