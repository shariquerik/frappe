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

// The realtime server publishes background-job progress on the `progress` event (that is the event
// name `frappe.publish_progress` emits — see frappe/realtime/__init__.py and Desk's own
// socketio_client.js `on("progress", …)`), scoped to the `task_progress:{taskId}` room a client joins
// by emitting `task_subscribe` (frappe/realtime/handlers.js). The room is task-keyed; the event is not.
const PROGRESS = 'progress'
const TASK_SUBSCRIBE = 'task_subscribe'
const TASK_UNSUBSCRIBE = 'task_unsubscribe'

// One progress message: the per-row publish from `_bulk_action`. `percent` reaches 100 on the last
// row, which is our completion signal (bulk_update.py). Free-form beyond these two fields.
interface TaskProgress {
  task_id?: string
  percent?: number
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

// Run `onDone` once, when the background job named by `taskId` reports completion (percent ≥ 100),
// then unsubscribe. Fire-and-forget: errors (an unreachable socket, an unconfigured seam) are
// swallowed so a UI caller is never left with an unhandled rejection — the job still runs, the list
// just won't refresh on its own. Subscribes before returning so a caller that has already fired the
// write is listening for the tail of the job.
export function onTaskComplete(taskId: string, onDone: () => void): void {
  void (async () => {
    try {
      const sock = await getSocket()
      if (!sock) return
      const handler = (data: TaskProgress) => {
        if (data.task_id !== taskId || (data.percent ?? 0) < 100) return
        sock.off(PROGRESS, handler)
        sock.emit(TASK_UNSUBSCRIBE, taskId)
        onDone()
      }
      sock.on(PROGRESS, handler)
      sock.emit(TASK_SUBSCRIBE, taskId)
    } catch {
      // Realtime is best-effort feedback; never surface its failures into the write path.
    }
  })()
}
