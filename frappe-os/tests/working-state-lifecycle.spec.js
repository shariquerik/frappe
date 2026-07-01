// Working-state lifecycle + unsaved-changes guards (ADR-0029, slice 04): the wiring that keeps the
// slab honest as windows navigate and close, and the close-confirm chokepoint. Drives the real
// store actions (useOS) against a seeded slab — no API, no component mount — asserting: nav prunes
// ephemeral entries that fall out of history, close drops ephemeral but keeps durable, and
// requestCloseWin gates on a dirty draft. The `dirtyWindows`/`windowIsDirty` signals that arm the
// browser-level guard are covered directly.
import { beforeEach, describe, expect, it } from 'vitest'
import { useOS } from '../src/desktop/index'
import { listSurface, formSurface } from '../src/surface'
import { dirtyWindows, windowIsDirty } from '../src/desktop/working-state'

const os = useOS()
const eph = (value, dirty) => ({ persist: 'ephemeral', value, dirty })
const dur = (value) => ({ persist: 'durable', value })
const win = (id, surface, back = [], fwd = []) => ({ id, surface, back, fwd })

function reset() {
  os.state.windows = []
  os.state.geo = {}
  os.state.workingState = {}
  os.state.activeId = null
  os.state.closeConfirm = null
}
beforeEach(reset)

describe('prune on in-window navigation', () => {
  it('drops ephemeral entries no longer reachable via history, keeps reachable + durable', () => {
    os.state.windows = [win('app:crm', formSurface('CRM Lead', 'R-2'), [listSurface('CRM Lead')])]
    os.state.workingState = {
      'app:crm': {
        'form:CRM Lead:R-2': eph({ title: 'draft 2' }, true), // current — reachable
        'form:CRM Lead:R-9': eph({ title: 'orphan' }, true), // not in history — unreachable
        'list:CRM Lead': dur({ sort: 'name' }), // durable — survives regardless
      },
    }

    os.winBack('app:crm') // surface -> list:CRM Lead, fwd -> [form:CRM Lead:R-2]

    const slab = os.state.workingState['app:crm']
    expect(slab['form:CRM Lead:R-9']).toBeUndefined()
    expect(slab['form:CRM Lead:R-2']).toBeDefined() // still reachable via fwd
    expect(slab['list:CRM Lead']).toBeDefined()
  })
})

describe('drop on window close', () => {
  it('drops ephemeral Working state but keeps durable', () => {
    os.state.windows = [win('app:crm', listSurface('CRM Lead'))]
    os.state.workingState = {
      'app:crm': {
        'form:CRM Lead:R-1': eph({ title: 'draft' }, true),
        'list:CRM Lead': dur({ sort: 'name' }),
      },
    }

    os.closeWin('app:crm')

    expect(os.state.workingState['app:crm']['form:CRM Lead:R-1']).toBeUndefined()
    expect(os.state.workingState['app:crm']['list:CRM Lead']).toBeDefined()
  })

  it('forgets the window map entirely once no durable entries remain', () => {
    os.state.windows = [win('app:crm', listSurface('CRM Lead'))]
    os.state.workingState = { 'app:crm': { 'form:CRM Lead:R-1': eph({ title: 'draft' }, true) } }

    os.closeWin('app:crm')

    expect(os.state.workingState['app:crm']).toBeUndefined()
  })
})

describe('unsaved-changes close confirm', () => {
  const dirtyWin = () => {
    os.state.windows = [win('app:crm', formSurface('CRM Lead', 'R-1'))]
    os.state.workingState = { 'app:crm': { 'form:CRM Lead:R-1': eph({ title: 'draft' }, true) } }
  }

  it('parks a dirty window for confirmation instead of closing', () => {
    dirtyWin()
    os.requestCloseWin('app:crm')
    expect(os.state.closeConfirm).toBe('app:crm')
    expect(os.state.windows).toHaveLength(1)
  })

  it('closes a clean window immediately, no prompt', () => {
    os.state.windows = [win('app:crm', listSurface('CRM Lead'))]
    os.requestCloseWin('app:crm')
    expect(os.state.closeConfirm).toBe(null)
    expect(os.state.windows).toHaveLength(0)
  })

  it('confirm discards the draft and closes the parked window', () => {
    dirtyWin()
    os.requestCloseWin('app:crm')
    os.confirmCloseWin()
    expect(os.state.closeConfirm).toBe(null)
    expect(os.state.windows).toHaveLength(0)
    expect(os.state.workingState['app:crm']).toBeUndefined()
  })

  it('cancel keeps the window and clears the prompt', () => {
    dirtyWin()
    os.requestCloseWin('app:crm')
    os.cancelCloseWin()
    expect(os.state.closeConfirm).toBe(null)
    expect(os.state.windows).toHaveLength(1)
  })
})

describe('dirty signals that arm the browser guard', () => {
  it('count only dirty ephemeral entries — clean ephemeral and durable never trip', () => {
    os.state.workingState = {
      'app:a': { 'form:X:1': eph({}, true) }, // dirty ephemeral -> counts
      'app:b': { 'form:X:2': eph({}, false) }, // clean ephemeral -> no
      'app:c': { 'list:X': dur({ sort: 'name' }) }, // durable -> no
    }
    expect(windowIsDirty('app:a')).toBe(true)
    expect(windowIsDirty('app:b')).toBe(false)
    expect(windowIsDirty('app:c')).toBe(false)
    expect(dirtyWindows()).toEqual(['app:a'])
  })
})
