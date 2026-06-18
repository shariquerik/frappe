// Live record store: the reactive caches over api.js. api.js itself is mocked, so
// these tests pin records.js's own contract — entry shape ({ loading, data, error }),
// the load* lifecycle, field-meta caching, and write-through refresh — without a
// backend. Each test uses a distinct doctype so the module-singleton caches don't
// bleed between tests.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  getList: vi.fn(),
  getDoc: vi.fn(),
  getDoctypeMeta: vi.fn(),
  saveDoc: vi.fn(),
  createDoc: vi.fn(),
  cardValue: vi.fn(),
}))

import * as api from '@/api'
import {
  listFor, loadList, docFor, loadDoc, countFor, loadCount,
  fieldMetaFor, loadFieldMeta, saveDoc, createDoc, recordsFor, recordObj,
} from '../src/store/records'

beforeEach(() => vi.clearAllMocks())

describe('list cache', () => {
  it('starts as an empty, not-loading entry', () => {
    const state = listFor('Apple')
    expect(state).toEqual({ loading: false, data: [], error: null })
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

describe('writes refresh the cache through the live API', () => {
  it('saveDoc updates the doc entry and reloads the list', async () => {
    const saved = { name: 'KIWI-1', subject: 'new' }
    api.saveDoc.mockResolvedValue(saved)
    api.getList.mockResolvedValue([saved])
    const result = await saveDoc('Kiwi', 'KIWI-1', { subject: 'new' })
    expect(api.saveDoc).toHaveBeenCalledWith('Kiwi', 'KIWI-1', { subject: 'new' })
    expect(result).toBe(saved)
    expect(docFor('Kiwi', 'KIWI-1').data).toEqual(saved)
    expect(api.getList).toHaveBeenCalledWith('Kiwi', { fields: ['*'], limit: 100 })
  })

  it('createDoc caches the new doc under its returned name and reloads the list', async () => {
    const created = { name: 'LEMON-9', subject: 'fresh' }
    api.createDoc.mockResolvedValue(created)
    api.getList.mockResolvedValue([created])
    const result = await createDoc('Lemon', { subject: 'fresh' })
    expect(result).toBe(created)
    expect(docFor('Lemon', 'LEMON-9').data).toEqual(created)
    expect(api.getList).toHaveBeenCalledWith('Lemon', { fields: ['*'], limit: 100 })
  })
})

describe('synchronous compat getters', () => {
  it('recordsFor returns [] before any load, then the loaded rows', async () => {
    expect(recordsFor('Mango')).toEqual([])
    api.getList.mockResolvedValue([{ name: 'm1' }])
    await loadList('Mango')
    expect(recordsFor('Mango')).toEqual([{ name: 'm1' }])
  })

  it('recordObj returns null for an unloaded record without creating an entry', () => {
    expect(recordObj('Nectarine', 'NONE')).toBe(null)
  })
})
