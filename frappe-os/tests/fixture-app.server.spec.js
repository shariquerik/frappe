// The fixture app's `server` verb, end to end (issue 10). The server Handler is the one api-touching,
// async corner of the pipeline, so — like server-handler.spec.js — it lives in its own spec with
// @/data/api mocked, keeping the mock-free engine suite (fixture-app.spec.js) pure. This drives the
// WHOLE codeless path: Acme's manifest command (a whitelisted method + a declared after-effect) folded
// through the registry and fired by invoke, with no Acme client JS.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({
  setCsrf: vi.fn(), call: vi.fn(async () => ({})), callPost: vi.fn(async () => ({})),
  getList: vi.fn(async () => []), getDoc: vi.fn(async (_dt, name) => ({ name })),
  saveDoc: vi.fn(), createDoc: vi.fn(), bulkUpdate: vi.fn(),
  getDoctypeMeta: vi.fn(async () => ({ fields: [], contributions: [] })),
  resolveDoctype: vi.fn(async () => null), cardValue: vi.fn(async () => 0),
}))
vi.mock('@/data/realtime', () => ({ watchTask: vi.fn(async () => ({ onComplete: vi.fn(), cancel: vi.fn() })) }))
vi.mock('@/data/notify', () => ({ notify: vi.fn(), setNotifier: vi.fn() }))

import * as api from '@/data/api'
import { notify } from '@/data/notify'
import { invoke } from '../src/actions/contributions'
import { useOS } from '../src/desktop/index'
import { initRegistry, useRegistry } from '../src/registry'
import { ACME_TASK, fixtureBoot } from './fixtures/fixture-app/index.js'

const os = useOS()
const deliverVerb = () => useRegistry().commands().find((c) => c.id === 'acme.order.deliver')

describe('fixture app — server Handler end to end (ADR-0041, codeless verb)', () => {
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.selection = {}
    os.state.focusKind = {}; os.state.activeId = null
    vi.clearAllMocks()
    api.callPost.mockResolvedValue({})
    initRegistry(fixtureBoot())
  })

  it('carries the whitelisted method + after-effect as pure boot data', () => {
    expect(deliverVerb().handler).toEqual({ kind: 'server', method: 'acme.selling.make_delivery', then: 'notify' })
  })

  it('calls the whitelisted method with the Invocation coordinates when invoked', async () => {
    os.openRecordGlobal(ACME_TASK, 'TASK-0001')
    await invoke(deliverVerb(), os)
    expect(api.callPost).toHaveBeenCalledWith('acme.selling.make_delivery', expect.objectContaining({
      doctype: ACME_TASK, name: 'TASK-0001',
    }))
  })

  it('runs the declared notify after-effect on the response', async () => {
    os.openRecordGlobal(ACME_TASK, 'TASK-0002')
    api.callPost.mockResolvedValue({ message: 'Delivery created.' })
    await invoke(deliverVerb(), os)
    expect(notify).toHaveBeenCalledWith('Delivery created.')
  })
})
