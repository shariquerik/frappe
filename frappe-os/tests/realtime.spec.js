// The realtime seam's ONE contract: watchTask lets a caller JOIN a background job's room *before*
// it fires the write, then either arm a completion callback (enqueued) or cancel the watch (the
// write ran inline). Completion keys off the terminal `task_complete` EVENT (frappe.publish_task_complete),
// NOT a `percent >= 100` `progress` tick — a job whose last row fails never emits 100 but always emits
// `task_complete`. This spec pins the socket protocol (subscribe/unsubscribe/reconnect/timeout) that
// every other spec mocks away.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A fake socket.io socket that records handlers/emits and can replay a server message. Modelled as a
// *warm* (already-connected) socket by default; a test flips `connected` + fires `connect` to exercise
// the reconnect path.
function makeSocket() {
  return {
    connected: true,
    handlers: {},
    emitted: [],
    on(event, fn) { this.handlers[event] = fn },
    off(event) { delete this.handlers[event] },
    emit(event, payload) { this.emitted.push([event, payload]) },
    deliver(event, data) { this.handlers[event]?.(data) },
    subscribes(taskId) { return this.emitted.filter(([e, id]) => e === 'task_subscribe' && id === taskId).length },
  }
}

let sock = makeSocket()
const io = vi.fn(() => sock)
vi.mock('socket.io-client', () => ({ io: (...args) => io(...args) }))
// A boot with realtime coordinates, so socketUrl resolves and the seam connects (not the dark no-op).
// A test overrides this to drop `sitename` (dark seam) or make it throw (a boot that failed to load).
let boot = { sitename: 'f2.localhost', socketio_port: 9016, developer_mode: 1 }
let bootError = null
vi.mock('../src/data/boot', () => ({ getBoot: async () => { if (bootError) throw bootError; return boot } }))

// Fresh module graph per test so the getSocket() singleton (deduped handshake) can't bleed across tests.
async function loadSeam() {
  vi.resetModules()
  return import('../src/data/realtime')
}

beforeEach(() => {
  sock = makeSocket()
  boot = { sitename: 'f2.localhost', socketio_port: 9016, developer_mode: 1 }
  bootError = null
  io.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('watchTask (background-job completion signal)', () => {
  it('joins the task room *before* returning, so a caller subscribes before firing its write', async () => {
    const { watchTask } = await loadSeam()
    await watchTask('task-1')
    expect(sock.subscribes('task-1')).toBe(1) // in the room the moment watchTask resolves
    expect(sock.handlers.task_complete).toBeUndefined() // not armed yet — that waits for onComplete
  })

  it('onComplete listens on `task_complete`, not the per-row `progress`/room stream', async () => {
    const { watchTask } = await loadSeam()
    const watch = await watchTask('task-1')
    watch.onComplete(() => {})
    expect(sock.handlers.task_complete).toBeTypeOf('function') // the terminal event Frappe emits
    expect(sock.handlers.progress).toBeUndefined() // NOT the per-row stream a failing tail never finishes
    expect(sock.handlers.task_progress).toBeUndefined() // NOT the room name
  })

  it('runs onComplete once for its task, passes the result, then unsubscribes + drops the handler', async () => {
    const { watchTask } = await loadSeam()
    const onDone = vi.fn()
    const watch = await watchTask('task-1')
    watch.onComplete(onDone)

    sock.deliver('task_complete', { task_id: 'other', result: { failed: [] } }) // another job → ignored
    expect(onDone).not.toHaveBeenCalled()

    sock.deliver('task_complete', { task_id: 'task-1', result: { failed: ['A-2'] } }) // our job finishes
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith({ failed: ['A-2'] }) // the opaque result, handed back untyped
    expect(sock.emitted).toContainEqual(['task_unsubscribe', 'task-1'])
    expect(sock.handlers.task_complete).toBeUndefined() // handler removed — no leak on the shared socket

    sock.deliver('task_complete', { task_id: 'task-1', result: { failed: ['late'] } }) // a stray replay
    expect(onDone).toHaveBeenCalledTimes(1) // still once — the watch is terminal
  })

  it('cancel() unsubscribes and never fires onComplete, even if the event later arrives (inline path)', async () => {
    const { watchTask } = await loadSeam()
    const onDone = vi.fn()
    const watch = await watchTask('task-1')
    watch.onComplete(onDone)
    watch.cancel()
    expect(sock.emitted).toContainEqual(['task_unsubscribe', 'task-1'])
    expect(sock.handlers.task_complete).toBeUndefined()

    sock.deliver('task_complete', { task_id: 'task-1', result: { failed: [] } }) // stray inline emit
    expect(onDone).not.toHaveBeenCalled()
  })

  it('re-emits task_subscribe on reconnect (rooms are per-connection and not restored)', async () => {
    const { watchTask } = await loadSeam()
    await watchTask('task-1')
    expect(sock.subscribes('task-1')).toBe(1)
    sock.deliver('connect') // socket dropped and reconnected
    expect(sock.subscribes('task-1')).toBe(2) // rejoined the room on the fresh connection
  })

  it('falls back after a timeout when the terminal event never arrives, then cleans up', async () => {
    vi.useFakeTimers()
    const { watchTask } = await loadSeam()
    const onDone = vi.fn()
    const watch = await watchTask('task-1')
    watch.onComplete(onDone)
    expect(onDone).not.toHaveBeenCalled()

    vi.advanceTimersByTime(120000) // the lost-event / dark-seam backstop elapses
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(undefined) // no result to itemize — the caller degrades softly
    expect(sock.emitted).toContainEqual(['task_unsubscribe', 'task-1']) // still cleans up the room

    sock.deliver('task_complete', { task_id: 'task-1', result: { failed: [] } }) // a very late event
    expect(onDone).toHaveBeenCalledTimes(1) // terminal — not fired twice
  })

  it('a completion clears the timeout, so the fallback does not fire afterwards', async () => {
    vi.useFakeTimers()
    const { watchTask } = await loadSeam()
    const onDone = vi.fn()
    const watch = await watchTask('task-1')
    watch.onComplete(onDone)
    sock.deliver('task_complete', { task_id: 'task-1', result: { failed: [] } })
    vi.advanceTimersByTime(120000)
    expect(onDone).toHaveBeenCalledTimes(1) // the timer was cleared on completion
  })

  it('dark seam (no sitename in boot): never connects, but onComplete still fires via the timeout', async () => {
    vi.useFakeTimers()
    boot = { sitename: undefined, socketio_port: 9016, developer_mode: 1 }
    const { watchTask } = await loadSeam()
    const onDone = vi.fn()
    const watch = await watchTask('task-1') // resolves without a socket
    expect(io).not.toHaveBeenCalled() // seam stays dark
    watch.onComplete(onDone)
    vi.advanceTimersByTime(120000)
    expect(onDone).toHaveBeenCalledWith(undefined) // enqueued caller still refreshes eventually
  })

  it('dedups the handshake: concurrent watchers share one io() connection', async () => {
    const { watchTask } = await loadSeam()
    await Promise.all([watchTask('task-1'), watchTask('task-2')])
    expect(io).toHaveBeenCalledTimes(1) // one socket for the whole shell, not one per caller
  })

  it('a failed handshake degrades to a dark watch but does not poison later retries', async () => {
    bootError = new Error('boot unavailable')
    const { watchTask } = await loadSeam()
    const watch = await watchTask('task-1') // must not reject the UI caller
    expect(watch).toHaveProperty('onComplete') // a usable (timeout-only) handle
    expect(io).not.toHaveBeenCalled()

    bootError = null // boot recovers
    await watchTask('task-2')
    expect(io).toHaveBeenCalledTimes(1) // the rejected promise was not cached — the retry connected
  })
})
