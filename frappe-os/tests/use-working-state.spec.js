// The dogfooded Working-state seam (ADR-0029, slice 02): `useWorkingState` binds a mounted surface
// to its per-window×subject entry in the store slab. These specs drive the composable against the
// real slab (state.workingState) with a hand-provided context, covering: read never mints an
// entry, write creates + round-trips, the bound entry FOLLOWS the surface (record→record in-window
// nav that keeps the component mounted), the `dirty` signal mirrors into the entry, and a
// contextless (chromeless) mount degrades to a no-op instead of throwing.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, effectScope, nextTick, ref } from 'vue'
import { state } from '../src/desktop/state'
import { WORKING_STATE_CONTEXT, useWorkingState } from '../src/desktop/use-working-state'

// Run the composable inside an app context (so `inject` resolves the provided context, exactly as
// OSWindow provides it) AND an effectScope we own (so the composable's dirty watcher is disposed
// per test, mirroring the component unmount the shell gives it — otherwise leaked effects re-mint
// entries across tests).
const scopes = []
function mountWorkingState(context, opts) {
  const app = createApp({ render: () => null })
  if (context) app.provide(WORKING_STATE_CONTEXT, context)
  const scope = effectScope()
  scopes.push(scope)
  return app.runWithContext(() => scope.run(() => useWorkingState(opts)))
}
afterEach(() => {
  scopes.forEach((s) => s.stop())
  scopes.length = 0
})

const listSurface = (doctype) => ({ kind: 'builtin', view: 'list', doctype, recordName: null })
const formSurface = (doctype, recordName, aspect) => ({
  kind: 'builtin', view: 'form', doctype, recordName, ...(aspect ? { aspect } : {}),
})

describe('useWorkingState', () => {
  beforeEach(() => { state.workingState = {} })

  it('reading an untouched subject returns undefined and mints NO entry', () => {
    const ctx = { winId: 'app:crm', surface: ref(listSurface('CRM Lead')) }
    const ws = mountWorkingState(ctx, { persist: 'durable' })
    expect(ws.value).toBeUndefined()
    expect(state.workingState['app:crm']).toBeUndefined()
  })

  it('writing creates a durable entry bound to (winId, subjectKey) and round-trips', () => {
    const ctx = { winId: 'app:crm', surface: ref(listSurface('CRM Lead')) }
    const ws = mountWorkingState(ctx, { persist: 'durable' })

    ws.value = { sort: 'name' }

    expect(state.workingState['app:crm']['list:CRM Lead'])
      .toEqual({ persist: 'durable', value: { sort: 'name' } })
    expect(ws.value).toEqual({ sort: 'name' })
  })

  it('reflects a value written directly into the slab (the store is the source of truth)', () => {
    const ctx = { winId: 'app:crm', surface: ref(listSurface('CRM Lead')) }
    state.workingState = { 'app:crm': { 'list:CRM Lead': { persist: 'durable', value: { held: 1 } } } }
    const ws = mountWorkingState(ctx, { persist: 'durable' })
    expect(ws.value).toEqual({ held: 1 })
  })

  it('the bound entry FOLLOWS the surface — record→record in-window nav re-points it', async () => {
    const surface = ref(formSurface('CRM Lead', 'L-1'))
    const ctx = { winId: 'app:crm', surface }
    const ws = mountWorkingState(ctx, { persist: 'ephemeral' })

    ws.value = { title: 'draft for L-1' }
    surface.value = formSurface('CRM Lead', 'L-2')
    await nextTick()

    // L-2 has no draft yet; L-1's is untouched under its own subject.
    expect(ws.value).toBeUndefined()
    ws.value = { title: 'draft for L-2' }
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'].value).toEqual({ title: 'draft for L-1' })
    expect(state.workingState['app:crm']['form:CRM Lead:L-2'].value).toEqual({ title: 'draft for L-2' })
  })

  it('the same draft is shared across Aspects — the form subject excludes the Aspect', async () => {
    const surface = ref(formSurface('CRM Lead', 'L-1'))
    const ctx = { winId: 'app:crm', surface }
    const ws = mountWorkingState(ctx, { persist: 'ephemeral' })

    ws.value = { title: 'draft' }
    surface.value = formSurface('CRM Lead', 'L-1', 'activities')
    await nextTick()

    expect(ws.value).toEqual({ title: 'draft' })
    expect(Object.keys(state.workingState['app:crm'])).toEqual(['form:CRM Lead:L-1'])
  })

  it('mirrors the caller `dirty` getter into an existing entry, reactively both ways', async () => {
    const surface = ref(formSurface('CRM Lead', 'L-1'))
    const dirty = ref(true)
    const ctx = { winId: 'app:crm', surface }
    const ws = mountWorkingState(ctx, { persist: 'ephemeral', dirty: () => dirty.value })

    ws.value = { title: 'draft' } // mint the entry
    await nextTick()
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'].dirty).toBe(true)

    dirty.value = false
    await nextTick()
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'].dirty).toBe(false)
  })

  it('a clean (dirty:false) getter alone mints NO entry — only work-in-progress gets a slot', async () => {
    const ctx = { winId: 'app:crm', surface: ref(formSurface('CRM Lead', 'L-1')) }
    mountWorkingState(ctx, { persist: 'ephemeral', dirty: () => false })
    await nextTick()
    expect(state.workingState['app:crm']).toBeUndefined()
  })

  it('records dirty once a value write mints the entry (peek re-runs the dirty watcher)', async () => {
    const dirty = ref(false)
    const ctx = { winId: 'app:crm', surface: ref(formSurface('CRM Lead', 'L-1')) }
    const ws = mountWorkingState(ctx, { persist: 'ephemeral', dirty: () => dirty.value })
    await nextTick()
    expect(state.workingState['app:crm']).toBeUndefined()

    dirty.value = true
    ws.value = { title: 'draft' }
    await nextTick()
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'].dirty).toBe(true)
  })

  it('a facet keys a SECOND entry under the same subject, beside the primary', () => {
    const ctx = { winId: 'app:crm', surface: ref(listSurface('CRM Lead')) }
    const snapshot = mountWorkingState(ctx, { persist: 'durable' }) // primary (bare subject)
    const position = mountWorkingState(ctx, { persist: 'ephemeral', facet: 'position' })

    snapshot.value = { sort: 'name' }
    position.value = { scrollTop: 240, count: 40 }

    // Two distinct entries, distinct policies — the primary stays keyed by the bare subject.
    expect(state.workingState['app:crm']['list:CRM Lead'])
      .toEqual({ persist: 'durable', value: { sort: 'name' } })
    expect(Object.keys(state.workingState['app:crm'])).toHaveLength(2)
    // The facet neither reads nor clobbers the primary.
    expect(snapshot.value).toEqual({ sort: 'name' })
    expect(position.value).toEqual({ scrollTop: 240, count: 40 })
  })

  it('a contextless (chromeless) mount degrades to a no-op — undefined, no throw', () => {
    const ws = mountWorkingState(null, { persist: 'durable' })
    expect(ws.value).toBeUndefined()
    expect(() => { ws.value = { x: 1 } }).not.toThrow()
    expect(state.workingState).toEqual({})
  })
})
