// The run-Handler mechanism (ADR-0008): the OPEN ref→fn map a Command's `run` Handler is
// resolved through, plus `invoke`, which reaches a Handler by id. The resolver never touches
// this — it competes pure data and only `invoke` fires a Handler, so eligibility never loads
// code (mirrors the registry's applet entries: no server round-trip for the OS's own defaults).
// The OS seeds its own handlers the SAME way an app does (registerRunHandlers) — the general
// seam, no privileged core (CONTEXT.md → App). Menu data lives in menu-contributions.ts;
// placement/bulk verbs self-register through this map too.
import { contextForOS } from './context'
import { callPost } from '@/data/api'
import { notify } from '@/data/notify'
import { formSurface } from '@/surface'
import type { AfterEffect, Command, Context, Invocation, JsonValue } from './types'
import type { FrappeDoc, OsStore } from '@/types'

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
export function invoke(command: Command, os: OsStore): void | Promise<void> {
  const handler = command.handler
  if (handler.kind === 'navigate') { os.openSurface(handler.surface); return }
  const context = contextForOS(os)
  const selection = os.selectedRecords()
  if (handler.kind === 'server') return invokeServer(handler, context, selection, os)
  const run = RUN_HANDLERS[handler.ref]
  if (!run) throw new Error(`[actions] no run handler registered for ref "${handler.ref}" (command ${command.id})`)
  run({ context, selection, args: handler.args, os })
}

// Fire a `server` Handler (ADR-0041): call the whitelisted `method` with the coordinate envelope,
// then run the declared after-effect on SUCCESS. Permissions are the server's (ADR-0010); a failure
// surfaces loudly (toast + console) and skips the after-effect — never a silent no-op. Pure data in,
// pure data out: no `eval`, no shipped code.
type ServerHandler = { kind: 'server'; method: string; args?: JsonValue; then?: AfterEffect }
async function invokeServer(handler: ServerHandler, context: Context, selection: string[], os: OsStore): Promise<void> {
  let response: unknown
  try {
    response = await callPost(handler.method, serverParams(context, selection, handler.args))
  } catch (error) {
    console.error(`[actions] server handler "${handler.method}" failed`, error)
    notify(`Couldn't run ${handler.method}: ${(error as Error).message}`)
    return
  }
  await runAfterEffect(handler.then ?? 'none', response, context, os)
}

// The coordinate envelope the method receives: the Frappe-native `doctype`/`name`/`docnames` read
// off the Invocation (snake_case by the casing boundary — these cross to a Frappe method), plus the
// Handler's own static `args`. Static args win on a key collision — the declaration is explicit,
// the coordinates are the ambient default. Absent coordinates are omitted (a list has no `name`).
function serverParams(context: Context, selection: string[], args?: JsonValue): Record<string, unknown> {
  const coords: Record<string, unknown> = {}
  if (context.doctype) coords.doctype = context.doctype
  if (context.recordName) coords.name = context.recordName
  if (selection.length) coords.docnames = selection
  return { ...coords, ...(args as Record<string, unknown> | undefined) }
}

// Run the declared after-effect on the method's response. `open-doc` reads the returned doc's
// doctype/name and opens it as a form surface in the invoking window; `refresh` reloads the front
// surface's records; `notify` toasts the response's message; `none` is fire-and-forget.
async function runAfterEffect(effect: AfterEffect, response: unknown, context: Context, os: OsStore): Promise<void> {
  if (effect === 'open-doc') openReturnedDoc(response, os)
  else if (effect === 'refresh') await os.refreshRecords(context.doctype!, context.recordName)
  else if (effect === 'notify') notify(responseMessage(response))
}

// Open the doc a mapper/transition method returned (erpnext's make_delivery_note → the mapped doc).
// Both coordinates must be present — an unsaved mapped doc with no name can't be addressed, so it is
// a clean no-op rather than a broken surface.
function openReturnedDoc(response: unknown, os: OsStore): void {
  const doc = response as FrappeDoc | null
  if (doc && doc.doctype && doc.name) os.openSurface(formSurface(doc.doctype, doc.name))
}

// The message a `notify` after-effect toasts: a plain string response verbatim, else the response's
// `message` field, else a soft generic — the method decides the words, the OS just surfaces them.
function responseMessage(response: unknown): string {
  if (typeof response === 'string') return response
  const message = (response as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : 'Done.'
}
