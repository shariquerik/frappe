// The realtime seam's ONE contract: onTaskComplete must speak the same protocol the Frappe
// realtime server does — join the task room by emitting `task_subscribe`, then key completion off
// the terminal `task_complete` EVENT (frappe.publish_task_complete), NOT a `percent >= 100`
// `progress` tick. A job whose last row fails never emits 100 but always emits `task_complete`, so
// this is the signal that fires on every outcome — pinned here where every other spec mocks realtime
// away. The event carries the job's opaque `result`, which the seam hands back untyped.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A fake socket.io socket that records handlers/emits and can replay a server message.
const sock = {
  handlers: {},
  emitted: [],
  on(event, fn) { this.handlers[event] = fn },
  off(event) { delete this.handlers[event] },
  emit(event, payload) { this.emitted.push([event, payload]) },
  deliver(event, data) { this.handlers[event]?.(data) },
}

vi.mock('socket.io-client', () => ({ io: () => sock }))
// A boot with realtime coordinates, so socketUrl resolves and the seam connects (not the dark no-op).
vi.mock('../src/data/boot', () => ({
  getBoot: async () => ({ sitename: 'f2.localhost', socketio_port: 9016, developer_mode: 1 }),
}))

import { onTaskComplete } from '../src/data/realtime'

describe('onTaskComplete (background-job completion signal)', () => {
  beforeEach(() => { sock.handlers = {}; sock.emitted = [] })

  it('subscribes to the task room and listens on `task_complete`, not `progress`', async () => {
    onTaskComplete('task-1', () => {})
    await vi.waitFor(() => expect(sock.emitted).toContainEqual(['task_subscribe', 'task-1']))
    expect(sock.handlers.task_complete).toBeTypeOf('function') // the terminal event Frappe emits
    expect(sock.handlers.progress).toBeUndefined() // NOT the per-row stream a failing tail never finishes
    expect(sock.handlers.task_progress).toBeUndefined() // NOT the room name
  })

  it('runs onDone once on `task_complete` for its task, passing the result, then unsubscribes', async () => {
    const onDone = vi.fn()
    onTaskComplete('task-1', onDone)
    await vi.waitFor(() => expect(sock.handlers.task_complete).toBeTypeOf('function'))

    sock.deliver('task_complete', { task_id: 'other', result: { failed: [] } }) // another job → ignored
    expect(onDone).not.toHaveBeenCalled()

    sock.deliver('task_complete', { task_id: 'task-1', result: { failed: ['A-2'] } }) // our job finishes
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith({ failed: ['A-2'] }) // the opaque result, handed back untyped
    expect(sock.emitted).toContainEqual(['task_unsubscribe', 'task-1'])
  })
})
