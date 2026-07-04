// The run-Handler mechanism (ADR-0008): the OPEN ref→fn map a Command's `run` Handler is
// resolved through, plus `invoke`, which reaches a Handler by id. The resolver never touches
// this — it competes pure data and only `invoke` fires a Handler, so eligibility never loads
// code (mirrors the registry's applet entries: no server round-trip for the OS's own defaults).
// The OS seeds its own handlers the SAME way an app does (registerRunHandlers) — the general
// seam, no privileged core (CONTEXT.md → App). Menu data lives in menu-contributions.ts;
// placement/bulk verbs self-register through this map too.
import { contextForOS } from './context'
import type { Command, Invocation } from './types'
import type { OsStore } from '@/types'

export type RunHandler = (invocation: Invocation) => void

// The ref→behavior map for run Handlers — OPEN, not a closed first-party constant. Seeded empty;
// the OS registers its own menu/placement/bulk handlers through registerRunHandlers, the same seam
// the (deferred) applet-style ESM loader that fetches an app's handler module will feed. Without a
// registration an app-contributed run Command folds through the whole pipeline but throws on invoke
// ("no run handler registered") — a first-party-only path masquerading as the general one.
const RUN_HANDLERS: Record<string, RunHandler> = {}

// Register run Handlers into the open map — how an app's (and the OS's own) run Commands become
// invocable, the same seam for both.
export function registerRunHandlers(handlers: Record<string, RunHandler>): void {
  Object.assign(RUN_HANDLERS, handlers)
}

// Invoke a resolved Command. A navigate Handler is pure data (open its Surface); a run Handler is
// resolved by ref through RUN_HANDLERS and fired (loud throw if the ref is unregistered — never a
// silent no-op). The Invocation is SNAPSHOTTED here, at click: the same contextForOS projection
// that gated the item plus the live selection, frozen once and passed through, so the handler acts
// on what the user saw and never re-derives focus state a later change could have moved (ADR-0037).
export function invoke(command: Command, os: OsStore): void {
  const handler = command.handler
  if (handler.kind === 'navigate') { os.openSurface(handler.surface); return }
  const run = RUN_HANDLERS[handler.ref]
  if (!run) throw new Error(`[actions] no run handler registered for ref "${handler.ref}" (command ${command.id})`)
  run({ context: contextForOS(os), selection: os.selectedRecords(), args: handler.args, os })
}
