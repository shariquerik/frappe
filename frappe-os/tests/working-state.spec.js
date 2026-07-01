// Working state (ADR-0029): the third per-window fact beside Surface and Geo. Two pure pieces
// under test — `subjectKey` (the coarsened surface identity that keys an entry within a window)
// and the `desktop/working-state` store ops (entryFor / prune / drop / dirtyWindows). No UI:
// this is the foundation every later slice consumes, verified in isolation.
import { beforeEach, describe, expect, it } from 'vitest'
import { subjectKey } from '../src/surface/index'
import { state } from '../src/desktop/state'
import {
  entryFor, pruneWindow, dropWindow, dirtyWindows, subjectFacet, baseSubject,
} from '../src/desktop/working-state'

// subjectKey is pure over the surface's own fields (no registry), so tests build plain surface
// literals rather than routing through the constructors (which resolve appId via the registry).
describe('subjectKey', () => {
  it('a list is keyed by its doctype', () => {
    expect(subjectKey({ kind: 'builtin', view: 'list', doctype: 'CRM Lead' })).toBe('list:CRM Lead')
  })

  it('a form is keyed by doctype + record', () => {
    expect(subjectKey({ kind: 'builtin', view: 'form', doctype: 'CRM Lead', recordName: 'L-1' }))
      .toBe('form:CRM Lead:L-1')
  })

  it('a form subject EXCLUDES the Aspect — a draft belongs to the record, not the tab', () => {
    const details = { kind: 'builtin', view: 'form', doctype: 'CRM Lead', recordName: 'L-1' }
    const activities = { ...details, aspect: 'activities' }
    expect(subjectKey(activities)).toBe(subjectKey(details))
  })

  it('a dashboard is keyed by its app', () => {
    expect(subjectKey({ kind: 'builtin', view: 'dashboard', appId: 'crm' })).toBe('dashboard:crm')
  })

  it('an applet is keyed by app + applet', () => {
    expect(subjectKey({ kind: 'applet', appletId: 'chat', appId: 'raven' })).toBe('applet:raven:chat')
  })

  it('system windows are keyed to mirror their own window id', () => {
    expect(subjectKey({ kind: 'builtin', view: 'settings', appId: 'frappe' })).toBe('settings')
    expect(subjectKey({ kind: 'builtin', view: 'finder', appId: 'frappe' })).toBe('finder')
    expect(subjectKey({ kind: 'builtin', view: 'app-settings', appId: 'crm' })).toBe('app-settings:crm')
  })

  it('any other built-in stays total via a per-app constant (e.g. the empty-app pane)', () => {
    expect(subjectKey({ kind: 'builtin', view: 'empty', appId: 'crm' })).toBe('empty:crm')
  })
})

// Facets (ADR-0029): a subject holds a primary entry (bare key) plus named facets, so a durable
// snapshot and an ephemeral scroll position coexist under one subject with independent policies.
describe('facets', () => {
  it('subjectFacet suffixes the subject; baseSubject recovers it', () => {
    const key = subjectFacet('list:CRM Lead', 'position')
    expect(key).not.toBe('list:CRM Lead') // a distinct entry key
    expect(baseSubject(key)).toBe('list:CRM Lead')
  })

  it('baseSubject is identity for a bare subject (no facet)', () => {
    expect(baseSubject('list:CRM Lead')).toBe('list:CRM Lead')
    // a doctype name with spaces/colons must survive untouched (separator is NUL, not space/colon)
    expect(baseSubject('form:CRM Lead:L-1')).toBe('form:CRM Lead:L-1')
  })
})

// The store slab: state.workingState[winId][subjectKey] -> { persist, value, dirty? }.
describe('working-state store', () => {
  beforeEach(() => { state.workingState = {} })

  describe('entryFor', () => {
    it('creates an empty entry with the given policy on first read', () => {
      const e = entryFor('app:crm', 'list:CRM Lead', 'durable')
      expect(e).toEqual({ persist: 'durable', value: undefined })
      expect(state.workingState['app:crm']['list:CRM Lead']).toEqual(e)
    })

    it('returns the SAME reactive entry on a repeat read (writes stick)', () => {
      entryFor('app:crm', 'list:CRM Lead', 'durable').value = { sort: 'name' }
      const again = entryFor('app:crm', 'list:CRM Lead', 'durable')
      expect(again.value).toEqual({ sort: 'name' })
    })
  })

  describe('pruneWindow', () => {
    it('drops ephemeral entries whose subject is no longer reachable, keeps durable', () => {
      entryFor('w1', 'list:CRM Lead', 'durable').value = { sort: 'name' }
      entryFor('w1', 'form:CRM Lead:L-1', 'ephemeral').value = { title: 'draft' }
      entryFor('w1', 'form:CRM Lead:L-9', 'ephemeral').value = { title: 'gone' }

      pruneWindow('w1', ['list:CRM Lead', 'form:CRM Lead:L-1'])

      expect(Object.keys(state.workingState.w1).sort())
        .toEqual(['form:CRM Lead:L-1', 'list:CRM Lead'])
    })

    it('keeps a durable entry even when its subject is unreachable', () => {
      entryFor('w1', 'list:CRM Lead', 'durable').value = { sort: 'name' }
      pruneWindow('w1', []) // nothing reachable
      expect(state.workingState.w1['list:CRM Lead']).toBeTruthy()
    })

    it('keeps an ephemeral facet while its BASE subject is reachable', () => {
      // reachable subjects are bare subjectKeys; prune must coarsen the facet back to its base
      entryFor('w1', subjectFacet('list:CRM Lead', 'position'), 'ephemeral').value = { scrollTop: 200 }
      pruneWindow('w1', ['list:CRM Lead']) // list still in history → its scroll facet survives
      expect(state.workingState.w1[subjectFacet('list:CRM Lead', 'position')]).toBeTruthy()
    })

    it('drops an ephemeral facet once its base subject is unreachable', () => {
      entryFor('w1', subjectFacet('list:CRM Lead', 'position'), 'ephemeral').value = { scrollTop: 200 }
      pruneWindow('w1', ['form:CRM Lead:L-1']) // list no longer reachable
      expect(state.workingState.w1?.[subjectFacet('list:CRM Lead', 'position')]).toBeUndefined()
    })

    it('is a no-op for an unknown window', () => {
      expect(() => pruneWindow('nope', [])).not.toThrow()
    })
  })

  describe('dropWindow', () => {
    it('drops ephemeral entries but keeps durable ones (durable survives close)', () => {
      entryFor('w1', 'list:CRM Lead', 'durable').value = { sort: 'name' }
      entryFor('w1', 'form:CRM Lead:L-1', 'ephemeral').value = { title: 'draft' }

      dropWindow('w1')

      expect(state.workingState.w1['form:CRM Lead:L-1']).toBeUndefined()
      expect(state.workingState.w1['list:CRM Lead']).toBeTruthy()
    })

    it('removes the window map entirely when no durable entries remain', () => {
      entryFor('w1', 'form:CRM Lead:L-1', 'ephemeral').value = { title: 'draft' }
      dropWindow('w1')
      expect(state.workingState.w1).toBeUndefined()
    })
  })

  describe('dirtyWindows', () => {
    it('lists windows holding a dirty ephemeral entry', () => {
      entryFor('clean', 'form:X:1', 'ephemeral').dirty = false
      const d = entryFor('dirty', 'form:X:2', 'ephemeral'); d.dirty = true
      entryFor('durable-dirty', 'list:X', 'durable').dirty = true // durable never guards
      expect(dirtyWindows()).toEqual(['dirty'])
    })

    it('is empty when nothing is dirty', () => {
      entryFor('w1', 'form:X:1', 'ephemeral').value = { title: 'clean' }
      expect(dirtyWindows()).toEqual([])
    })
  })
})
