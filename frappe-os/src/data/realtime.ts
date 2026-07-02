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
// always emits `task_complete`. The room is task-keyed; the event is not. (The server still streams
// per-row `progress` ticks for a future progress bar — this seam just doesn't consume them yet.)
const TASK_COMPLETE = 'task_complete'
const TASK_SUBSCRIBE = 'task_subscribe'
const TASK_UNSUBSCRIBE = 'task_unsubscribe'

// The terminal message: the single publish `_bulk_action` fires when the job ends. `result` is the
// job's opaque payload (a bulk action puts `{ failed: [...] }` there) — this seam stays generic and
// hands it back untyped; the caller that knows the job knows the shape.
interface TaskComplete {
  task_id?: string
  result?: unknown
}

let socket: Socket | null = null

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

// The shared, lazily-connected client — one socket for the whole shell. Null when realtime is
// unconfigured (no sitename in boot), so callers fall back to their non-realtime path.
async function getSocket(): Promise<Socket | null> {
  if (socket) return socket
  const url = socketUrl(await getBoot())
  if (!url) return null
  socket = io(url, { withCredentials: true, reconnectionAttempts: 3 })
  return socket
}

// Run `onDone` once, when the background job named by `taskId` fires its terminal `task_complete`
// event, passing the job's `result` through untyped. Then unsubscribe. Fire-and-forget: errors (an
// unreachable socket, an unconfigured seam) are swallowed so a UI caller is never left with an
// unhandled rejection — the job still runs, the list just won't refresh on its own. Subscribes
// before returning so a caller that has already fired the write is listening for the tail of the job.
export function onTaskComplete(taskId: string, onDone: (result?: unknown) => void): void {
  void (async () => {
    try {
      const sock = await getSocket()
      if (!sock) return
      const handler = (data: TaskComplete) => {
        if (data.task_id !== taskId) return
        sock.off(TASK_COMPLETE, handler)
        sock.emit(TASK_UNSUBSCRIBE, taskId)
        onDone(data.result)
      }
      sock.on(TASK_COMPLETE, handler)
      sock.emit(TASK_SUBSCRIBE, taskId)
    } catch {
      // Realtime is best-effort feedback; never surface its failures into the write path.
    }
  })()
}
