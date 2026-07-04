// The palette's live-search state machine (desktop/palette-search.ts): debounce, the
// min-chars gate, the two-leg fan-out (records + doctypes) landing together, hits stamped
// with the query they answered, the stale-response guard, and per-leg failure degrading
// to no rows. api.js is mocked; timers are faked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({ call: vi.fn() }))

import { call } from '@/data/api'
import {
  queueRecordSearch, recordHits, doctypeHits, resetRecordSearch,
  RECORD_SEARCH_DEBOUNCE_MS, RECORD_RESULT_CAP, DOCTYPE_RESULT_CAP,
} from '../src/desktop/palette-search'

const HIT = { doctype: 'ToDo', name: 'td-1', title: 'Ship the demo' }
const RECORDS = 'frappe.os_core.search.search_records'
const DOCTYPES = 'frappe.os_core.search.search_doctypes'

const answerWith = (records, doctypes) => (method) =>
  method === RECORDS ? Promise.resolve(records) : Promise.resolve(doctypes)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  resetRecordSearch()
})
afterEach(() => vi.useRealTimers())

async function settle() {
  vi.advanceTimersByTime(RECORD_SEARCH_DEBOUNCE_MS)
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('queueRecordSearch', () => {
  it('fans out both searches after the debounce and stamps hits with their query', async () => {
    call.mockImplementation(answerWith([HIT], ['ToDo Settings']))
    queueRecordSearch('demo')
    expect(call).not.toHaveBeenCalled()
    await settle()
    expect(call).toHaveBeenCalledWith(RECORDS, { text: 'demo', limit: RECORD_RESULT_CAP })
    expect(call).toHaveBeenCalledWith(DOCTYPES, { text: 'demo', limit: DOCTYPE_RESULT_CAP })
    expect(recordHits('demo')).toEqual([HIT])
    expect(doctypeHits('demo')).toEqual(['ToDo Settings'])
    expect(recordHits(' demo ')).toEqual([HIT]) // lookup trims like the queue does
    expect(recordHits('other')).toEqual([])
    expect(doctypeHits('other')).toEqual([])
  })

  it('coalesces rapid typing into one fan-out for the final query', async () => {
    call.mockImplementation(answerWith([HIT], []))
    queueRecordSearch('de')
    queueRecordSearch('dem')
    queueRecordSearch('demo')
    await settle()
    expect(call).toHaveBeenCalledTimes(2) // one records + one doctypes call
    expect(call.mock.calls.every(([, params]) => params.text === 'demo')).toBe(true)
  })

  it('below the min-chars gate it clears without querying', async () => {
    call.mockImplementation(answerWith([HIT], ['ToDo Settings']))
    queueRecordSearch('demo')
    await settle()
    queueRecordSearch('d')
    await settle()
    expect(recordHits('demo')).toEqual([])
    expect(doctypeHits('demo')).toEqual([])
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('drops a stale response that resolves after a newer query', async () => {
    let resolveOld
    call.mockImplementation((method) =>
      method === RECORDS ? new Promise((r) => { resolveOld = r }) : Promise.resolve([]),
    )
    queueRecordSearch('old')
    vi.advanceTimersByTime(RECORD_SEARCH_DEBOUNCE_MS)
    call.mockImplementation(answerWith([HIT], []))
    queueRecordSearch('new')
    await settle()
    resolveOld([{ doctype: 'ToDo', name: 'stale', title: 'stale' }])
    await Promise.resolve()
    await Promise.resolve()
    expect(recordHits('old')).toEqual([])
    expect(recordHits('new')).toEqual([HIT])
  })

  it("one leg failing never drops the other leg's results", async () => {
    call.mockImplementation((method) =>
      method === RECORDS ? Promise.reject(new Error('no index')) : Promise.resolve(['ToDo Settings']),
    )
    queueRecordSearch('demo')
    await settle()
    expect(recordHits('demo')).toEqual([])
    expect(doctypeHits('demo')).toEqual(['ToDo Settings'])
  })

  it('reset orphans an in-flight request', async () => {
    let resolveLate
    call.mockImplementation((method) =>
      method === RECORDS ? new Promise((r) => { resolveLate = r }) : Promise.resolve([]),
    )
    queueRecordSearch('demo')
    vi.advanceTimersByTime(RECORD_SEARCH_DEBOUNCE_MS)
    resetRecordSearch()
    resolveLate([HIT])
    await Promise.resolve()
    await Promise.resolve()
    expect(recordHits('demo')).toEqual([])
  })
})
