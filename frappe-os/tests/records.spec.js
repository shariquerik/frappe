// Live record store: the reactive caches over api.js. api.js itself is mocked, so
// these tests pin records.js's own contract — entry shape ({ loading, data, error }),
// the load* lifecycle, field-meta caching, and write-through refresh — without a
// backend. Each test uses a distinct doctype so the module-singleton caches don't
// bleed between tests.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({
  getList: vi.fn(),
  getDoc: vi.fn(),
  getDoctypeMeta: vi.fn(),
  saveDoc: vi.fn(),
  createDoc: vi.fn(),
  bulkUpdate: vi.fn(),
  cardValue: vi.fn(),
}))
// records.ts drives the realtime seam (bulk-update completion signal) and the notify port
// (enqueued/done feedback). Stub both — these specs pin records.ts's own branching, not the
// socket transport or the toast rendering (which stay out of the store's frappe-ui-free graph).
// watchTask hands back one shared handle so a test can inspect which outcome records.ts committed to
// (armed `onComplete` = enqueued; `cancel` = inline).
const mockWatch = { onComplete: vi.fn(), cancel: vi.fn() }
vi.mock('@/data/realtime', () => ({ watchTask: vi.fn(async () => mockWatch) }))
vi.mock('@/data/notify', () => ({ notify: vi.fn() }))

import * as api from '@/data/api'
import { watchTask } from '@/data/realtime'
import { notify } from '@/data/notify'
import {
  listFor, loadList, loadMore, docFor, loadDoc, countFor, loadCount,
  fieldMetaFor, loadFieldMeta, saveDoc, createDoc, bulkUpdate, recordObj,
} from '../src/data/records'

beforeEach(() => vi.clearAllMocks())

describe('list cache', () => {
  it('starts as an empty, not-loading entry (carrying its doctype + shape for refresh)', () => {
    const state = listFor('Apple')
    expect(state).toMatchObject({ loading: false, data: [], error: null })
  })

  it('loadList fills data and clears loading, fetching all fields', async () => {
    const rows = [{ name: 'a' }, { name: 'b' }]
    api.getList.mockResolvedValue(rows)
    const state = await loadList('Banana')
    expect(api.getList).toHaveBeenCalledWith('Banana', { fields: ['*'], limit: 100 })
    expect(state.data).toEqual(rows)
    expect(state.loading).toBe(false)
    expect(state.error).toBe(null)
  })

  it('loadList records the error message and stops loading on failure', async () => {
    api.getList.mockRejectedValue(new Error('boom'))
    const state = await loadList('Cherry')
    expect(state.error).toBe('boom')
    expect(state.loading).toBe(false)
  })

  it('listFor returns the same reactive entry loadList mutates', async () => {
    api.getList.mockResolvedValue([{ name: 'x' }])
    const handle = listFor('Date')
    await loadList('Date')
    expect(handle.data).toEqual([{ name: 'x' }])
  })

  it('keys rows by request shape, so two shapes of one doctype do not clobber each other', async () => {
    // A filtered/lean list window and an unfiltered context-free read of the SAME doctype.
    const windowShape = { fields: ['name', 'status'], filters: [['status', '=', 'Open']], order_by: 'modified desc' }
    api.getList.mockResolvedValue([{ name: 'open-1', status: 'Open' }])
    await loadList('Ugni', windowShape)
    api.getList.mockResolvedValue([{ name: 'a' }, { name: 'b' }, { name: 'c' }]) // dashboard's ['*'] read
    await loadList('Ugni')
    // The window keeps its own filtered rows; the context-free read has its own.
    expect(listFor('Ugni', windowShape).data).toEqual([{ name: 'open-1', status: 'Open' }])
    expect(listFor('Ugni').data).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
  })
})

describe('paging (loadMore appends, start offsets)', () => {
  it('loadList replaces on the first page (start 0 or omitted)', async () => {
    api.getList.mockResolvedValue([{ name: 'p1' }, { name: 'p2' }])
    await loadList('Papaya')
    api.getList.mockResolvedValue([{ name: 'p3' }])
    const state = await loadList('Papaya')
    expect(state.data).toEqual([{ name: 'p3' }])
  })

  it('loadList appends when start > 0', async () => {
    api.getList.mockResolvedValue([{ name: 'q1' }])
    await loadList('Quince')
    api.getList.mockResolvedValue([{ name: 'q2' }])
    const state = await loadList('Quince', { start: 1 })
    expect(state.data).toEqual([{ name: 'q1' }, { name: 'q2' }])
  })

  it('loadMore fetches from the current row count and appends the next page', async () => {
    api.getList.mockResolvedValue([{ name: 'r1' }, { name: 'r2' }])
    await loadList('Raspberry', { limit: 2 })
    api.getList.mockResolvedValue([{ name: 'r3' }, { name: 'r4' }])
    const state = await loadMore('Raspberry', { limit: 2 })
    expect(api.getList).toHaveBeenLastCalledWith('Raspberry', {
      fields: ['*'],
      limit: 2,
      start: 2,
    })
    expect(state.data).toEqual([{ name: 'r1' }, { name: 'r2' }, { name: 'r3' }, { name: 'r4' }])
  })
})

describe("wire-list filters (the list-view controls' shape)", () => {
  it('loadList forwards a wire-list filter array to getList unchanged', async () => {
    api.getList.mockResolvedValue([])
    const filters = [['status', '=', 'Open']]
    await loadList('Soursop', { filters })
    expect(api.getList).toHaveBeenCalledWith('Soursop', {
      fields: ['*'],
      limit: 100,
      filters,
    })
  })

  it('loadCount keys by a wire-list filter array and passes it to cardValue', async () => {
    api.cardValue.mockResolvedValue(7)
    const filters = [['status', '=', 'Open']]
    await loadCount('Tamarind', filters)
    expect(api.cardValue).toHaveBeenCalledWith('Tamarind', filters, undefined)
    expect(countFor('Tamarind', filters).data).toBe(7)
    // A different wire filter set is a distinct cache entry.
    expect(countFor('Tamarind', [['status', '=', 'Closed']]).data).toBe(null)
  })
})

describe('single-doc cache', () => {
  it('loadDoc fills the doc for the keyed entry', async () => {
    const doc = { name: 'ELDER-1', title: 'hi' }
    api.getDoc.mockResolvedValue(doc)
    await loadDoc('Elderberry', 'ELDER-1')
    expect(docFor('Elderberry', 'ELDER-1').data).toEqual(doc)
  })

  it('loadDoc captures a load error', async () => {
    api.getDoc.mockRejectedValue(new Error('404'))
    const state = await loadDoc('Fig', 'GONE')
    expect(state.error).toBe('404')
    expect(state.data).toBe(null)
  })
})

describe('card-value cache', () => {
  it('loadCount stores the value and keys by doctype+filters+fieldname', async () => {
    api.cardValue.mockResolvedValue(1200000)
    await loadCount('Grape', { status: 'Open' }, 'amount')
    expect(api.cardValue).toHaveBeenCalledWith('Grape', { status: 'Open' }, 'amount')
    expect(countFor('Grape', { status: 'Open' }, 'amount').data).toBe(1200000)
  })

  it('a different filter set is a different cache entry', () => {
    const open = countFor('Grape', { status: 'Open' }, 'amount')
    const closed = countFor('Grape', { status: 'Closed' }, 'amount')
    expect(closed).not.toBe(open)
    expect(closed.data).toBe(null)
  })
})

describe('field-meta cache', () => {
  it('loadFieldMeta fetches once and reuses the cached schema', async () => {
    api.getDoctypeMeta.mockResolvedValue({ fields: [{ fieldname: 'subject' }] })
    await loadFieldMeta('Honeydew')
    await loadFieldMeta('Honeydew')
    expect(api.getDoctypeMeta).toHaveBeenCalledTimes(1)
    expect(fieldMetaFor('Honeydew').data.fields).toHaveLength(1)
  })
})

// A context-free write holds no column shape, so it refreshes every OPEN list window of the
// doctype by replaying each window's remembered shape from page 1 — the filtered/paged lists
// on screen refill correctly instead of being replaced by one unfiltered read. Nothing open →
// nothing to refresh.
describe('writes refresh the open list windows through the live API', () => {
  it('saveDoc updates the doc entry and replays each open window shape', async () => {
    const shape = { fields: ['name', 'subject'], filters: [['status', '=', 'Open']], limit: 20 }
    api.getList.mockResolvedValue([])
    await loadList('Kiwi', shape) // an open, filtered, paged window
    api.getList.mockClear()

    const saved = { name: 'KIWI-1', subject: 'new' }
    api.saveDoc.mockResolvedValue(saved)
    api.getList.mockResolvedValue([saved])
    const result = await saveDoc('Kiwi', 'KIWI-1', { subject: 'new' })
    expect(api.saveDoc).toHaveBeenCalledWith('Kiwi', 'KIWI-1', { subject: 'new' })
    expect(result).toBe(saved)
    expect(docFor('Kiwi', 'KIWI-1').data).toEqual(saved)
    // The refresh preserves the window's fields/filters/limit and restarts at page 1.
    expect(api.getList).toHaveBeenCalledWith('Kiwi', {
      fields: ['name', 'subject'], filters: [['status', '=', 'Open']], limit: 20, start: 0,
    })
  })

  it('createDoc caches the new doc under its returned name and refreshes the open window', async () => {
    api.getList.mockResolvedValue([])
    await loadList('Lemon') // an open unfiltered window
    api.getList.mockClear()

    const created = { name: 'LEMON-9', subject: 'fresh' }
    api.createDoc.mockResolvedValue(created)
    api.getList.mockResolvedValue([created])
    const result = await createDoc('Lemon', { subject: 'fresh' })
    expect(result).toBe(created)
    expect(docFor('Lemon', 'LEMON-9').data).toEqual(created)
    expect(api.getList).toHaveBeenCalledWith('Lemon', { fields: ['*'], limit: 100, start: 0 })
  })

  it('a write with no open list window of the doctype fetches nothing', async () => {
    const saved = { name: 'PLUM-1', subject: 'x' }
    api.saveDoc.mockResolvedValue(saved)
    await saveDoc('Plum', 'PLUM-1', { subject: 'x' })
    expect(api.getList).not.toHaveBeenCalled() // no window to refill
  })
})

// The standard bulk method applies a small selection inline but ENQUEUES 20+ rows in the background,
// so bulkUpdate must not conflate them: an inline run mutated the rows (refresh + report failures),
// but an enqueued run (api → null) has changed nothing yet — refreshing would show stale rows under
// a false "done", and [] would read as full success. The two paths return distinct BulkUpdateResults.
describe('bulkUpdate (inline vs enqueued)', () => {
  it('inline: refreshes the open list windows and reports the failed docnames', async () => {
    api.getList.mockResolvedValue([]) // open a window so there is something to refresh
    await loadList('Mangosteen')
    api.getList.mockClear()

    api.bulkUpdate.mockResolvedValue(['MANGO-2']) // < 20 rows → runs inline, returns failures
    api.getList.mockResolvedValue([{ name: 'MANGO-1' }])
    const result = await bulkUpdate('Mangosteen', ['MANGO-1', 'MANGO-2'], { status: 'Open' })
    expect(result).toEqual({ enqueued: false, failed: ['MANGO-2'] })
    expect(api.getList).toHaveBeenCalledWith('Mangosteen', { fields: ['*'], limit: 100, start: 0 })
    expect(notify).toHaveBeenCalledWith('Updated 1 Mangosteen record; 1 failed.') // failures surfaced, not dropped
    expect(mockWatch.cancel).toHaveBeenCalled() // inline ran synchronously — drop the pre-joined watch
    expect(mockWatch.onComplete).not.toHaveBeenCalled() // no terminal event to wait on
  })

  it('inline full success: refreshes and confirms with a completion notify', async () => {
    api.getList.mockResolvedValue([])
    await loadList('Lychee')
    api.getList.mockClear()

    api.bulkUpdate.mockResolvedValue([]) // < 20 rows, no failures → applied inline
    api.getList.mockResolvedValue([{ name: 'LY-1' }])
    const result = await bulkUpdate('Lychee', ['LY-1', 'LY-2'], { status: 'Open' })
    expect(result).toEqual({ enqueued: false, failed: [] })
    expect(api.getList).toHaveBeenCalledWith('Lychee', { fields: ['*'], limit: 100, start: 0 })
    expect(notify).toHaveBeenCalledWith('Updated 2 Lychee records.') // the inline "done" confirmation
  })

  it('joins the job room on the same task_id it threads into the write, BEFORE firing it', async () => {
    api.bulkUpdate.mockResolvedValue(null)
    await bulkUpdate('Tangerine', Array.from({ length: 25 }, (_, i) => `T-${i}`), { status: 'Open' })
    const taskId = api.bulkUpdate.mock.calls[0][3] // (doctype, docnames, changes, taskId)
    expect(typeof taskId).toBe('string')
    expect(taskId.length).toBeGreaterThan(0)
    expect(watchTask).toHaveBeenCalledWith(taskId) // the room it joins is keyed by the id it threads
    // Pre-subscribe (review #2): the room must be joined before the write races to a fast completion.
    expect(watchTask.mock.invocationCallOrder[0]).toBeLessThan(api.bulkUpdate.mock.invocationCallOrder[0])
    expect(mockWatch.onComplete).toHaveBeenCalledWith(expect.any(Function)) // enqueued → armed, not cancelled
    expect(mockWatch.cancel).not.toHaveBeenCalled()
  })

  it('enqueued (null): acknowledges but does NOT refresh or claim success yet', async () => {
    api.bulkUpdate.mockResolvedValue(null) // 20+ rows → enqueued in background, nothing applied yet
    const result = await bulkUpdate('Rambutan', Array.from({ length: 25 }, (_, i) => `R-${i}`), { status: 'Open' })
    expect(result).toEqual({ enqueued: true, failed: [] })
    expect(notify).toHaveBeenCalledTimes(1) // the "enqueued" acknowledgement only — no "done" yet
    expect(api.getList).not.toHaveBeenCalled() // no stale refresh under a false "done"
  })

  it('on job completion: refreshes the open windows and confirms via notify', async () => {
    api.getList.mockResolvedValue([]) // open a Soursop window so completion has something to refresh
    await loadList('Soursop')
    api.getList.mockClear()

    api.bulkUpdate.mockResolvedValue(null)
    await bulkUpdate('Soursop', Array.from({ length: 25 }, (_, i) => `S-${i}`), { status: 'Open' })
    expect(api.getList).not.toHaveBeenCalled() // nothing refreshed until the job actually finishes
    notify.mockClear() // drop the "enqueued" ack; watch only what completion does

    const onDone = mockWatch.onComplete.mock.calls[0][0] // the completion callback records.ts registered
    api.getList.mockResolvedValue([{ name: 'S-0' }])
    await onDone({ failed: [] }) // the terminal event carries the job's result (no failures)
    expect(api.getList).toHaveBeenCalledWith('Soursop', { fields: ['*'], limit: 100, start: 0 })
    expect(notify).toHaveBeenCalledWith('Updated 25 Soursop records.') // same phrasing as the inline path
  })

  it('on job completion: surfaces the failed rows the terminal event carries', async () => {
    api.getList.mockResolvedValue([])
    api.bulkUpdate.mockResolvedValue(null)
    await bulkUpdate('Durian', Array.from({ length: 25 }, (_, i) => `D-${i}`), { status: 'Open' })
    notify.mockClear()

    const onDone = mockWatch.onComplete.mock.calls[0][0]
    await onDone({ failed: ['D-1', 'D-2', 'D-3'] }) // three rows the background job rejected
    expect(notify).toHaveBeenCalledWith('Updated 22 Durian records; 3 failed.') // failures reported, not swallowed
  })

  it('a rejected write cancels the pre-joined watch (no leaked room) and propagates the error', async () => {
    // watchTask joined the job room BEFORE the write. If the POST rejects, the job never ran and
    // its terminal event never comes — the watch must be cancelled so its room membership and
    // reconnect handler don't leak on the shared socket until the 120s timeout.
    api.bulkUpdate.mockRejectedValue(new Error('Network Error'))
    await expect(bulkUpdate('Kiwi', ['K-1', 'K-2'], { status: 'Open' })).rejects.toThrow('Network Error')
    expect(mockWatch.cancel).toHaveBeenCalledTimes(1) // watch dropped, not left armed
    expect(mockWatch.onComplete).not.toHaveBeenCalled() // never treated as enqueued
    expect(api.getList).not.toHaveBeenCalled() // nothing to refresh — the write didn't apply
  })

  it('on job completion with no result (dark seam fallback): confirms without claiming a false success', async () => {
    api.getList.mockResolvedValue([])
    api.bulkUpdate.mockResolvedValue(null)
    await bulkUpdate('Guava', Array.from({ length: 25 }, (_, i) => `G-${i}`), { status: 'Open' })
    notify.mockClear()

    const onDone = mockWatch.onComplete.mock.calls[0][0]
    await onDone() // the fallback fires without the terminal event's result — failures unknowable
    expect(notify).toHaveBeenCalledWith('Background update finished.') // honest, no fabricated counts
  })
})

describe('synchronous compat getter', () => {
  it('recordObj returns null for an unloaded record without creating an entry', () => {
    expect(recordObj('Nectarine', 'NONE')).toBe(null)
  })
})
