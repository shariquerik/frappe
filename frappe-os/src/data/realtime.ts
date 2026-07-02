// The OS shell's realtime seam: one lazily-connected Socket.IO client to the Frappe realtime
// server (frappe/realtime — the per-site `/{sitename}` namespace), plus the single subscription
// the shell needs today — "tell me when this background job finishes". Additive-only (ADR-0008):
// grow this seam when a second realtime need lands (doc presence, notifications), don't reshape it.
//
// Reads its coordinates from the boot payload (sitename/socketio_port/developer_mode). When those
// are absent (older server, offline boot), the seam degrades to a no-op — the caller keeps working,
// just without the live refresh — never a thrown error in a UI path.

import { io, type Socket } from 'socket.io-client'
import { getBoot } from './boot'
import type { BootData } from '@/types'

// A background job finishing rides the `task_complete` event (frappe.publish_task_complete —
// frappe/realtime/__init__.py), scoped to the `task_progress:{taskId}` room a client joins by
// emitting `task_subscribe` (frappe/realtime/handlers.js). We key completion off this terminal
// event, NOT a `percent >= 100` progress tick: a job whose last row fails never emits 100, but it
// always emits `task_complete`. The room is task-keyed; the event is not (ADR-0034).
const TASK_COMPLETE = 'task_complete'
const TASK_SUBSCRIBE = 'task_subscribe'
const TASK_UNSUBSCRIBE = 'task_unsubscribe'
const CONNECT = 'connect'

// The socket only retries a lost connection a few times before giving up — bounded so a permanently
// dead realtime host can't spin forever. Hard-coded pending a boot-supplied policy (ADR-0035;
// deferred-hardcoded/issues/01).
const RECONNECTION_ATTEMPTS = 3

// The lost-event / dark-seam backstop: if `task_complete` never arrives (no socket in boot, a dropped
// connection reconnection can't recover, a crashed worker), fire the completion callback anyway after
// this window so the caller still refreshes — with no result, so it degrades softly rather than
// claiming a false success. A flat constant pending a size-scaled / job-status-polled bound (ADR-0035;
// deferred-hardcoded/issues/02).
const TASK_TIMEOUT_MS = 120000

// The terminal message: the single publish `_bulk_action` fires when the job ends. `result` is the
// job's opaque payload (a bulk action puts `{ failed: [...] }` there) — this seam stays generic and
// hands it back untyped; the caller that knows the job knows the shape.
interface TaskComplete {
  task_id?: string
  result?: unknown
}

// The handle watchTask hands back: the caller joins the room up front, then commits to ONE outcome —
// `onComplete` (the write enqueued; run `onDone` when the job's terminal event lands or the fallback
// fires) or `cancel` (the write ran inline; drop the watch so a stray terminal emit is ignored).
export interface TaskWatch {
  onComplete(onDone: (result?: unknown) => void): void
  cancel(): void
}

// ---- the shared, deduped connection ------------------------------------------
// The Socket.IO URL: the per-site namespace on the realtime host. In dev the shell reaches the
// realtime process directly on `socketio_port` (bench has no nginx); in production it rides the
// page's own origin, where nginx proxies /socket.io to that process. Null when boot carries no
// sitename — the seam then stays dark.
function socketUrl(boot: BootData): string | null {
  if (!boot.sitename) return null
  const base =
    boot.developer_mode && boot.socketio_port
      ? `${window.location.protocol}//${window.location.hostname}:${boot.socketio_port}`
      : window.location.origin
  return `${base}/${boot.sitename}`
}

// One socket for the whole shell. We cache the in-flight CONNECT PROMISE, not just the resolved
// socket, so concurrent first callers await a single `io()` handshake instead of each opening a
// duplicate connection (review #5). A null resolution (realtime unconfigured — no sitename) is cached
// too, so a dark seam stays a cheap no-op; but a REJECTION (e.g. boot failed to load) clears the
// cache, so the next caller retries rather than inheriting a permanently poisoned promise.
let socketPromise: Promise<Socket | null> | null = null
function getSocket(): Promise<Socket | null> {
  if (!socketPromise) socketPromise = connect().catch((error) => { socketPromise = null; throw error })
  return socketPromise
}
async function connect(): Promise<Socket | null> {
  const url = socketUrl(await getBoot())
  if (!url) return null
  return io(url, { withCredentials: true, reconnectionAttempts: RECONNECTION_ATTEMPTS })
}

// ---- watching one background job ---------------------------------------------
// Join the room for `taskId` NOW and return a handle. Await this BEFORE firing the write, so the
// client is already in the room when a fast enqueued job finishes — otherwise a job that completes
// during the write's round-trip fires its terminal event into a room no one has joined (review #2).
// A dark seam (no socket) still returns a handle whose completion rides the timeout fallback alone.
export async function watchTask(taskId: string): Promise<TaskWatch> {
  const sock = await getSocket().catch(() => null)
  if (!sock) return timeoutOnlyWatch()
  const subscribe = () => sock.emit(TASK_SUBSCRIBE, taskId)
  if (sock.connected) subscribe()
  sock.on(CONNECT, subscribe) // rooms are per-connection and NOT restored on reconnect — rejoin each time (review #6)
  return liveWatch(sock, taskId, subscribe)
}

// The live handle over a real socket. A single cleanup — run at most once, on completion, timeout, or
// cancel — removes the completion handler AND the reconnect resubscriber and leaves the room, so
// nothing leaks on the shared, process-lifetime socket (review #3).
function liveWatch(sock: Socket, taskId: string, subscribe: () => void): TaskWatch {
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let handler: ((data: TaskComplete) => void) | undefined
  const cleanup = () => {
    if (settled) return
    settled = true
    if (handler) sock.off(TASK_COMPLETE, handler)
    sock.off(CONNECT, subscribe)
    if (timer) clearTimeout(timer)
    sock.emit(TASK_UNSUBSCRIBE, taskId)
  }
  return {
    onComplete(onDone) {
      const finish = (result?: unknown) => { cleanup(); onDone(result) }
      handler = (data) => { if (data.task_id === taskId) finish(data.result) }
      sock.on(TASK_COMPLETE, handler)
      timer = setTimeout(() => finish(), TASK_TIMEOUT_MS)
    },
    cancel: cleanup,
  }
}

// The dark-seam handle: no socket to join, so completion can only ride the timeout — the enqueued
// caller still refreshes eventually, with no result to itemize. `cancel` just disarms the timer.
function timeoutOnlyWatch(): TaskWatch {
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    onComplete(onDone) {
      timer = setTimeout(() => { if (!settled) { settled = true; onDone(undefined) } }, TASK_TIMEOUT_MS)
    },
    cancel() { settled = true; if (timer) clearTimeout(timer) },
  }
}
