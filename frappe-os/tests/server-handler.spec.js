// The `server` Handler kind (ADR-0041 / slice 05): invoke calls a whitelisted method with the
// Invocation coordinate envelope, then runs a declared after-effect on success. This is the one
// api-touching, async corner of the actions engine, so it lives in its own spec with `@/data/api`
// mocked (the pure-data engine specs stay mock-free in actions.spec.js). No app client JS runs —
// the whole verb is data folded through the resolver and fired here.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({
  setCsrf: vi.fn(),
  call: vi.fn(async () => ({})),
  callPost: vi.fn(async () => ({})),
  getList: vi.fn(async () => []),
  getDoc: vi.fn(async (_dt, name) => ({ name })),
  saveDoc: vi.fn(),
  createDoc: vi.fn(),
  bulkUpdate: vi.fn(),
  getDoctypeMeta: vi.fn(async () => ({ fields: [], contributions: [] })),
  resolveDoctype: vi.fn(async () => null),
  cardValue: vi.fn(async () => 0),
}))
vi.mock('@/data/realtime', () => ({ watchTask: vi.fn(async () => ({ onComplete: vi.fn(), cancel: vi.fn() })) }))
vi.mock('@/data/notify', () => ({ notify: vi.fn(), setNotifier: vi.fn() }))

import * as api from '@/data/api'
import { notify } from '@/data/notify'
import { invoke } from '../src/actions/contributions'
import { contextForOS } from '../src/actions/context'
import { useOS } from '../src/desktop/index'

// A `server` Command shorthand — the placement/eligibility axes are irrelevant here (invoke fires an
// already-resolved Command), so only the handler shape varies.
const serverCmd = (method, opts = {}) => ({
  id: `t.${method}`, sourceApp: 'erpnext', title: method,
  handler: { kind: 'server', method, ...opts },
})

describe('server Handler kind (ADR-0041 — call a whitelisted method, declared after-effect)', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.selection = {}
    os.state.focusKind = {}
    os.state.activeId = null
    vi.clearAllMocks()
    api.callPost.mockResolvedValue({})
  })

  it('invokes the whitelisted method end-to-end from a Command — no app client JS', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0001')
    await invoke(serverCmd('erpnext.selling.make_delivery_note'), os)
    expect(api.callPost).toHaveBeenCalledWith('erpnext.selling.make_delivery_note', expect.any(Object))
  })

  it('reaches the method with the Invocation coordinates as arguments (doctype/name/selection)', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0002')
    os.setSelection(os.state.activeId, 'rows', ['SO-0002'])
    await invoke(serverCmd('m'), os)
    expect(api.callPost).toHaveBeenCalledWith('m', expect.objectContaining({
      doctype: 'Sales Order', name: 'SO-0002', docnames: ['SO-0002'],
    }))
  })

  it('merges the Handler static args, which win over the coordinate defaults on collision', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0003')
    await invoke(serverCmd('m', { args: { name: 'OVERRIDE', target: 'Delivery Note' } }), os)
    expect(api.callPost).toHaveBeenCalledWith('m', expect.objectContaining({ name: 'OVERRIDE', target: 'Delivery Note' }))
  })

  it('omits absent coordinates: a list surface sends docnames, no name', async () => {
    os.openListGlobal('Sales Order')
    os.setSelection(os.state.activeId, 'rows', ['SO-0004', 'SO-0005'])
    await invoke(serverCmd('bulk'), os)
    const params = api.callPost.mock.calls[0][1]
    expect(params).toMatchObject({ doctype: 'Sales Order', docnames: ['SO-0004', 'SO-0005'] })
    expect(params.name).toBeUndefined()
  })

  it('after-effect none (the default) fires nothing beyond the call', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0006')
    api.getDoc.mockClear()
    await invoke(serverCmd('m'), os) // no `then`
    expect(notify).not.toHaveBeenCalled()
    expect(api.getDoc).not.toHaveBeenCalled()
  })

  it('after-effect notify toasts the response message', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0007')
    api.callPost.mockResolvedValue({ message: 'Order closed.' })
    await invoke(serverCmd('m', { then: 'notify' }), os)
    expect(notify).toHaveBeenCalledWith('Order closed.')
  })

  it('after-effect refresh reloads the front record into the cache', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0008')
    api.getDoc.mockResolvedValue({ name: 'SO-0008', status: 'To Deliver' })
    await invoke(serverCmd('m', { then: 'refresh' }), os)
    expect(api.getDoc).toHaveBeenCalledWith('Sales Order', 'SO-0008')
    expect(os.recordObj('Sales Order', 'SO-0008')).toMatchObject({ status: 'To Deliver' })
  })

  it('after-effect open-doc opens the returned doc as a form surface in the invoking window', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0009')
    api.callPost.mockResolvedValue({ doctype: 'Delivery Note', name: 'DN-0001' })
    await invoke(serverCmd('erpnext.make_delivery_note', { then: 'open-doc' }), os)
    expect(contextForOS(os)).toMatchObject({ doctype: 'Delivery Note', recordName: 'DN-0001', view: 'form' })
  })

  it('open-doc is a clean no-op when the returned doc has no addressable name', async () => {
    os.openRecordGlobal('Sales Order', 'SO-0010')
    api.callPost.mockResolvedValue({ doctype: 'Delivery Note' }) // unsaved mapped doc, no name
    await invoke(serverCmd('m', { then: 'open-doc' }), os)
    expect(contextForOS(os)).toMatchObject({ doctype: 'Sales Order', recordName: 'SO-0010' }) // stayed put
  })

  it('a server error surfaces loudly (toast + console) and skips the after-effect', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    os.openRecordGlobal('Sales Order', 'SO-0011')
    api.callPost.mockRejectedValue(new Error('PermissionError'))
    await invoke(serverCmd('m', { then: 'open-doc' }), os)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('PermissionError'))
    expect(err).toHaveBeenCalled()
    expect(contextForOS(os)).toMatchObject({ doctype: 'Sales Order', recordName: 'SO-0011' }) // no after-effect
    err.mockRestore()
  })
})
