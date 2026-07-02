// The realtime seam's ONE contract: onTaskComplete must speak the same protocol the Frappe
// realtime server does — join the task room by emitting `task_subscribe`, then listen for the
// `progress` EVENT (that is the name `frappe.publish_progress` emits — NOT `task_progress`; the
// room is task-keyed, the event is not). This is the exact wire mismatch that once let the bulk
// list refresh silently never fire, so it is pinned here where every other spec mocks realtime away.
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

  it('subscribes to the task room and listens on the `progress` event, not `task_progress`', async () => {
    onTaskComplete('task-1', () => {})
    await vi.waitFor(() => expect(sock.emitted).toContainEqual(['task_subscribe', 'task-1']))
    expect(sock.handlers.progress).toBeTypeOf('function') // the event Frappe actually emits
    expect(sock.handlers.task_progress).toBeUndefined() // the wrong name that never fires
  })

  it('runs onDone once at percent ≥ 100 for its task, then unsubscribes', async () => {
    const onDone = vi.fn()
    onTaskComplete('task-1', onDone)
    await vi.waitFor(() => expect(sock.handlers.progress).toBeTypeOf('function'))

    sock.deliver('progress', { task_id: 'other', percent: 100 }) // another job → ignored
    sock.deliver('progress', { task_id: 'task-1', percent: 40 }) // mid-progress → ignored
    expect(onDone).not.toHaveBeenCalled()

    sock.deliver('progress', { task_id: 'task-1', percent: 100 }) // our job finishes
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(sock.emitted).toContainEqual(['task_unsubscribe', 'task-1'])
  })
})
