// Working state, slice 05 (ADR-0029): durable-only persistence + hydrate. Two pieces under test —
// the pure `durableWorkingState` reducer (what leaves the slab for localStorage) and the
// serialize→hydrate round-trip that lands durable entries back in `state.workingState` on boot.
// No UI: pure logic + the slab, mirroring the rest of the working-state specs.
import { beforeEach, describe, expect, it } from 'vitest'
import { state } from '../src/desktop/state'
import { durableWorkingState, serialize, hydrate } from '../src/desktop/persistence'
import { subjectFacet } from '../src/desktop/working-state'

const BLOB_KEY = 'frappe-os:desktop'

function reset() {
  state.windows = []
  state.geo = {}
  state.activeId = null
  state.split = null
  state.workingState = {}
  localStorage.clear()
}

beforeEach(reset)

// Simulate a fresh page load: drop the live desktop but KEEP the saved blob (unlike `reset`,
// which clears localStorage too), so hydrate has something to read.
function freshPage() {
  state.windows = []
  state.geo = {}
  state.workingState = {}
}

describe('durableWorkingState', () => {
  it('keeps durable entries and drops ephemeral ones', () => {
    const slab = {
      'app:frappe': {
        'list:CRM Lead': { persist: 'durable', value: { filters: [['CRM Lead', 'status', '=', 'Open']] } },
        'form:CRM Lead:L-1': { persist: 'ephemeral', value: { draft: 1 }, dirty: true },
      },
    }
    expect(durableWorkingState(slab)).toEqual({
      'app:frappe': { 'list:CRM Lead': { persist: 'durable', value: { filters: [['CRM Lead', 'status', '=', 'Open']] } } },
    })
  })

  it('drops a durable entry whose value is undefined (an empty slot left by save-clear)', () => {
    const slab = { 'app:frappe': { 'list:ToDo': { persist: 'durable', value: undefined } } }
    expect(durableWorkingState(slab)).toEqual({})
  })

  it('excludes system and settings windows — they respawn from the URL', () => {
    const slab = {
      settings: { settings: { persist: 'durable', value: { pane: 'General' } } },
      'app-settings:frappe': { 'app-settings:frappe': { persist: 'durable', value: { pane: 'General' } } },
      finder: { finder: { persist: 'durable', value: { location: 'Applications' } } },
    }
    expect(durableWorkingState(slab)).toEqual({})
  })

  it('omits a window whose only entries are non-durable', () => {
    const slab = { 'app:crm': { 'form:CRM Lead:L-2': { persist: 'ephemeral', value: {} } } }
    expect(durableWorkingState(slab)).toEqual({})
  })

  it('keeps the durable snapshot but drops the ephemeral position facet of one subject', () => {
    // The list holds two facets under one subject: a durable snapshot and an ephemeral scroll/paging
    // position (ADR-0029). Only the snapshot may reach localStorage — scroll never survives reload.
    const slab = {
      'app:crm': {
        'list:CRM Lead': { persist: 'durable', value: { sort: 'name' } },
        [subjectFacet('list:CRM Lead', 'position')]: { persist: 'ephemeral', value: { scrollTop: 300, count: 40 } },
      },
    }
    expect(durableWorkingState(slab)).toEqual({
      'app:crm': { 'list:CRM Lead': { persist: 'durable', value: { sort: 'name' } } },
    })
  })
})

describe('serialize → hydrate round-trip', () => {
  const seedDesktop = () => {
    state.windows = [{ id: 'app:frappe', surface: { kind: 'builtin', view: 'dashboard', appId: 'frappe' } }]
    state.geo = { 'app:frappe': { z: 1 } }
    state.activeId = 'app:frappe'
  }

  it('restores durable list state through a reload, dropping ephemeral', () => {
    seedDesktop()
    const snapshot = { filters: [['CRM Lead', 'status', '=', 'Open']], sort: 'modified desc' }
    state.workingState = {
      'app:frappe': {
        'list:CRM Lead': { persist: 'durable', value: snapshot },
        'form:CRM Lead:L-1': { persist: 'ephemeral', value: { draft: 1 }, dirty: true },
      },
    }
    localStorage.setItem(BLOB_KEY, JSON.stringify(serialize()))

    freshPage() // simulate a fresh page: hydrate rebuilds the slab from the saved blob
    hydrate()

    expect(state.workingState).toEqual({
      'app:frappe': { 'list:CRM Lead': { persist: 'durable', value: snapshot } },
    })
  })

  it('ignores a persisted slab for a window that did not survive hydrate', () => {
    seedDesktop()
    state.workingState = {
      'app:frappe': { 'list:CRM Lead': { persist: 'durable', value: { filters: [] } } },
      'app:ghost': { 'list:ToDo': { persist: 'durable', value: { filters: [] } } },
    }
    localStorage.setItem(BLOB_KEY, JSON.stringify(serialize()))

    freshPage()
    hydrate()

    expect(Object.keys(state.workingState)).toEqual(['app:frappe'])
  })

  it('leaves the slab empty when an old blob carries no workingState key', () => {
    localStorage.setItem(BLOB_KEY, JSON.stringify({
      version: 2,
      windows: [{ id: 'app:frappe', surface: { kind: 'builtin', view: 'dashboard', appId: 'frappe' } }],
      geo: {},
    }))
    hydrate()
    expect(state.workingState).toEqual({})
  })
})
