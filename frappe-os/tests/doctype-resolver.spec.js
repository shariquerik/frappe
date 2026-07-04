// ensureDoctype — on-demand resolution that folds an uncurated-but-real doctype into the
// registry so a deep link to ANY DocType opens its list. api.ts is mocked (no backend); these
// pin the contract main.ts's route wiring depends on: known → true without a fetch, uncurated →
// resolve + fold + true, missing → false, and the per-doctype dedupe/negative cache. Each test
// uses a DISTINCT doctype so the module-singleton resolve cache doesn't bleed between tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({
  resolveDoctype: vi.fn(),
}))

import * as api from '@/data/api'
import { ensureDoctype } from '../src/data/doctype-resolver'
import { getMeta, initRegistry } from '../src/registry'

const display = (dt, sourceApp = 'crm') =>
  ({ type: 'display-config', target: dt, name: 'display', sourceApp, payload: { label: dt, titleField: 'name' } })

// resolve_doctype returns the same {schemaVersion, contributions} envelope get_registry emits, so
// the resolver unwraps it through the shared tolerant parser (asServerRegistry, ADR-0008).
const envelope = (contributions, schemaVersion = 1) => ({ schemaVersion, contributions })

beforeEach(() => { vi.clearAllMocks(); initRegistry(null) }) // offline seed = the curated set
afterEach(() => initRegistry(null))

describe('ensureDoctype', () => {
  it('returns true without a server call for a doctype already in the index', async () => {
    expect(await ensureDoctype('User')).toBe(true) // User ships in the offline seed
    expect(api.resolveDoctype).not.toHaveBeenCalled()
  })

  it('unwraps the envelope, folds the contributions, and reports it known', async () => {
    api.resolveDoctype.mockResolvedValue(envelope([display('Ostrich Thing')]))
    expect(getMeta('Ostrich Thing')).toBeNull()
    expect(await ensureDoctype('Ostrich Thing')).toBe(true)
    expect(api.resolveDoctype).toHaveBeenCalledWith('Ostrich Thing')
    expect(getMeta('Ostrich Thing')?.label).toBe('Ostrich Thing') // now folded into the index
  })

  it('folds an unknown future schemaVersion tolerantly (ADR-0008 — index what you understand)', async () => {
    api.resolveDoctype.mockResolvedValue(envelope([display('Future Thing')], 99))
    expect(await ensureDoctype('Future Thing')).toBe(true)
    expect(getMeta('Future Thing')?.label).toBe('Future Thing')
  })

  it('degrades a legacy bare-array (no envelope) to false — same parser as boot', async () => {
    api.resolveDoctype.mockResolvedValue([display('Legacy Thing')]) // not a {schemaVersion, contributions}
    expect(await ensureDoctype('Legacy Thing')).toBe(false)
    expect(getMeta('Legacy Thing')).toBeNull() // route falls back to the app
  })

  it('reports false for a missing/forbidden doctype (server returns null)', async () => {
    api.resolveDoctype.mockResolvedValue(null)
    expect(await ensureDoctype('Ghost Thing')).toBe(false)
    expect(getMeta('Ghost Thing')).toBeNull() // index untouched → route falls back to the app
  })

  it('never throws — a rejected resolve degrades to false', async () => {
    api.resolveDoctype.mockRejectedValue(new Error('boom'))
    expect(await ensureDoctype('Broken Thing')).toBe(false)
  })

  it('caches the negative outcome so a missing doctype is resolved only once', async () => {
    api.resolveDoctype.mockResolvedValue(null)
    expect(await ensureDoctype('Phantom Thing')).toBe(false)
    expect(await ensureDoctype('Phantom Thing')).toBe(false)
    expect(api.resolveDoctype).toHaveBeenCalledTimes(1) // negative cache, no refetch storm
  })
})
