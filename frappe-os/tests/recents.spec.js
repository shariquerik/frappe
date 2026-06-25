// Recents (ADR-0024): the per-user, server-resolved log of recently opened records and its client
// seam. These specs pin (1) the store seeds from boot.recents (tolerant of a missing key), (2) an
// open bumps a reference to the front, deduped (a re-open is one row, newest-wins) and capped, (3)
// the write is record-opens-only — openRecordGlobal records, a list/app open does not, and (4) the
// server write is debounced (rapid re-opens of one record coalesce). The server-side trim/dedup is
// covered by the Python test_os_recent; the Recents Finder Location render is in finder.spec.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// The debounced persist posts through callPost — stub it so the store logic runs without a network.
vi.mock('../src/data/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, callPost: vi.fn(() => Promise.resolve({})) }
})

import { useOS } from '../src/desktop/index'
import { initRegistry } from '../src/registry'
import { initRecents, useRecents, recordRecent } from '../src/recents'
import { recentItems } from '../src/components/Finder/locations'
import { callPost } from '../src/data/api'

const os = useOS()
const boot = (recents) => ({ user: 'a', csrf_token: 't', roles: [], registry: [], permissions: {}, recents })
const formRef = (name) => ({ doctype: 'ToDo', name, view: 'form' })

function reset() {
  os.state.windows = []
  os.state.geo = {}
  os.state.activeId = null
  os.state.split = null
  localStorage.clear()
  initRegistry(null) // config seed → frappe/crm/erpnext with ToDo in frappe/Core
  initRecents(null)
}
beforeEach(() => {
  vi.useFakeTimers()
  reset()
  callPost.mockClear()
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  initRecents(null)
})

describe('the recents store seeds from boot (tolerant)', () => {
  it('reads the resolved newest-first list off boot.recents', () => {
    initRecents(boot([{ ref: formRef('a') }, { ref: formRef('b') }]))
    expect(useRecents().map((r) => r.ref.name)).toEqual(['a', 'b'])
  })

  it('degrades to empty when the key is missing or boot is null (older server)', () => {
    initRecents(boot(undefined))
    expect(useRecents()).toEqual([])
    initRecents(null)
    expect(useRecents()).toEqual([])
  })
})

describe('recordRecent bumps a reference to the front (dedup + cap)', () => {
  it('unshifts newest-first and stores a form reference', () => {
    recordRecent('ToDo', 'a')
    expect(useRecents()[0].ref).toEqual(formRef('a'))
  })

  it('a re-open moves the reference to the front without duplicating it (dedup-by-reference)', () => {
    recordRecent('ToDo', 'a')
    recordRecent('ToDo', 'b')
    recordRecent('ToDo', 'a') // re-open the older one
    expect(useRecents().map((r) => r.ref.name)).toEqual(['a', 'b'])
  })

  it('caps the local list at 50 newest (mirrors the server trim)', () => {
    for (let i = 0; i < 60; i += 1) recordRecent('ToDo', String(i))
    expect(useRecents()).toHaveLength(50)
    expect(useRecents()[0].ref.name).toBe('59') // newest kept
    expect(useRecents().some((r) => r.ref.name === '0')).toBe(false) // oldest dropped
  })
})

describe('the server write is debounced', () => {
  it('coalesces rapid re-opens of ONE record into a single persisted write', () => {
    recordRecent('ToDo', 'a')
    recordRecent('ToDo', 'a')
    vi.runAllTimers()
    expect(callPost).toHaveBeenCalledTimes(1)
    expect(callPost).toHaveBeenCalledWith('frappe.www.os.record_recent', {
      surface_ref: JSON.stringify(formRef('a')),
    })
  })

  it('persists distinct records separately', () => {
    recordRecent('ToDo', 'a')
    recordRecent('ToDo', 'b')
    vi.runAllTimers()
    expect(callPost).toHaveBeenCalledTimes(2)
  })
})

describe('record-opens-only — only the form openers feed Recents', () => {
  it('openRecordGlobal records the open; a list / app open does not', () => {
    os.openRecordGlobal('ToDo', 'x')
    expect(useRecents().map((r) => r.ref.name)).toEqual(['x'])
    os.openListGlobal('ToDo')
    os.openApp('frappe')
    expect(useRecents().map((r) => r.ref.name)).toEqual(['x']) // unchanged
  })

  it('openRecordInline records the open in an existing window', () => {
    os.openApp('frappe')
    os.openRecordInline(os.state.activeId, 'ToDo', 'y')
    expect(useRecents().map((r) => r.ref.name)).toEqual(['y'])
  })

  it('openRecordNewWindow records the open (the "Open in New Window" path)', () => {
    os.openRecordNewWindow('ToDo', 'z')
    expect(useRecents().map((r) => r.ref.name)).toEqual(['z'])
  })
})

describe('recentItems projects the store to Finder tiles labeled by record name', () => {
  it('reuses placementView so a tile labels by its record name', () => {
    initRecents(boot([{ ref: formRef('My task') }]))
    const items = recentItems()
    expect(items.map((i) => i.ref)).toEqual([formRef('My task')])
    expect(items[0].label).toBe('My task')
  })
})
