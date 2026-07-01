// OSForm's ephemeral draft (ADR-0029, slice 03). Two layers:
//  1. the pure seed/persist helpers (`seedDraft` / `draftToStore`) in isolation, and
//  2. a slab-level integration that replays OSForm's exact wiring (useWorkingState + seedDraft +
//     the two watches) against a form surface ref — covering seed → edit(dirty) → nav-away →
//     nav-back(preserve) → save(clear) without mounting the real component (which would pull in
//     FormLayout + the full store, breaking the repo's pure-logic test convention).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, createApp, effectScope, nextTick, ref, watch } from 'vue'
import { state } from '../src/desktop/state'
import { WORKING_STATE_CONTEXT, useWorkingState } from '../src/desktop/use-working-state'
import { seedDraft, draftToStore, changedFields } from '../src/components/Form/draft'

describe('seedDraft', () => {
  it('adopts a held draft as-is (edits survive a remount)', () => {
    const held = { title: 'wip' }
    expect(seedDraft(held, false, { title: 'saved' })).toBe(held)
  })

  it('seeds a shallow copy of the record when no draft is held', () => {
    const record = { title: 'saved' }
    const seeded = seedDraft(undefined, false, record)
    expect(seeded).toEqual({ title: 'saved' })
    expect(seeded).not.toBe(record)
  })

  it('seeds an empty object for a new record', () => {
    expect(seedDraft(undefined, true, null)).toEqual({})
  })
})

describe('draftToStore', () => {
  it('stores a dirty formDoc', () => {
    const formDoc = { title: 'wip' }
    expect(draftToStore(true, formDoc)).toBe(formDoc)
  })

  it('stores nothing for a clean form (re-seeds from the record identically)', () => {
    expect(draftToStore(false, { title: 'saved' })).toBeUndefined()
  })
})

describe('changedFields', () => {
  it('new record: every non-empty field counts (no baseline)', () => {
    expect(changedFields({ title: 'x', status: '', owner: null }, null, true)).toEqual(['title'])
  })

  it('existing record: only fields that diverge from the loaded record', () => {
    expect(changedFields({ title: 'edited', status: 'Open' }, { title: 'saved', status: 'Open' }, false))
      .toEqual(['title'])
  })

  it('a saved doc adopted as the baseline leaves no phantom `modified` to resend', () => {
    // The bug: after a save the server bumps `modified`; if the baseline is not realigned the stale
    // timestamp reads as dirty and a second save resends it → Frappe TimestampMismatchError.
    const saved = { title: 'edited', modified: '2026-07-01 18:00:00' }
    expect(changedFields({ ...saved }, saved, false)).toEqual([])
  })
})

// ---------- slab-level integration: replay OSForm's wiring ----------

const formSurface = (recordName) => ({
  kind: 'builtin', view: 'form', doctype: 'CRM Lead', recordName,
})

const scopes = []
// Build OSForm's draft binding over a live surface + record ref, inside an app + effectScope (so
// inject resolves the context and the watchers dispose per test), and return the seams a test drives.
function mountForm(winId, surface, record) {
  const app = createApp({ render: () => null })
  app.provide(WORKING_STATE_CONTEXT, { winId, surface })
  const scope = effectScope()
  scopes.push(scope)
  return app.runWithContext(() =>
    scope.run(() => {
      const isNew = computed(() => !surface.value.recordName || surface.value.recordName === 'new')
      const formDoc = ref({})
      const dirtyFields = computed(() => changedFields(formDoc.value, record.value, isNew.value))
      const isDirty = computed(() => dirtyFields.value.length > 0)

      const draft = useWorkingState({ persist: 'ephemeral', dirty: () => isDirty.value })
      watch([record, isNew], () => {
        formDoc.value = seedDraft(draft.value, isNew.value, record.value)
      }, { immediate: true })
      watch(formDoc, () => {
        const next = draftToStore(isDirty.value, formDoc.value)
        if (next !== undefined || draft.value !== undefined) draft.value = next
      }, { deep: true })

      // Mirror OSForm.save for an existing record: the server applies the dirty fields and bumps
      // `modified`; the store adopts that saved doc as the record, the draft is dropped, and formDoc
      // is reseeded from `saved` so the refreshed `modified` realigns (no phantom dirty field).
      let bump = 0
      function save() {
        const saved = { ...record.value }
        dirtyFields.value.forEach((k) => { saved[k] = formDoc.value[k] })
        saved.modified = `2026-07-01 18:00:0${++bump}`
        record.value = saved
        draft.value = undefined
        formDoc.value = { ...saved }
      }
      return { formDoc, dirtyFields, isDirty, draft, save }
    }),
  )
}
afterEach(() => {
  scopes.forEach((s) => s.stop())
  scopes.length = 0
})

describe('OSForm ephemeral draft (slab integration)', () => {
  beforeEach(() => { state.workingState = {} })

  it('a merely-viewed (clean) form mints no entry', async () => {
    const surface = ref(formSurface('L-1'))
    mountForm('app:crm', surface, ref({ title: 'saved' }))
    await nextTick()
    expect(state.workingState['app:crm']).toBeUndefined()
  })

  it('editing mints a dirty draft under form:CRM Lead:L-1', async () => {
    const surface = ref(formSurface('L-1'))
    const form = mountForm('app:crm', surface, ref({ title: 'saved' }))
    await nextTick()

    form.formDoc.value = { title: 'edited' }
    await nextTick()

    expect(form.isDirty.value).toBe(true)
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'])
      .toMatchObject({ persist: 'ephemeral', value: { title: 'edited' }, dirty: true })
  })

  it('preserves an edited draft across record→record nav and back', async () => {
    const surface = ref(formSurface('L-1'))
    const record = ref({ title: 'saved L-1' })
    const form = mountForm('app:crm', surface, record)
    await nextTick()

    form.formDoc.value = { title: 'edited L-1' }
    await nextTick()

    // navigate to L-2 (component stays mounted; subject re-points) — a fresh, clean record
    surface.value = formSurface('L-2')
    record.value = { title: 'saved L-2' }
    await nextTick()
    expect(form.formDoc.value).toEqual({ title: 'saved L-2' })
    expect(form.isDirty.value).toBe(false)

    // navigate back to L-1 — the held draft is restored
    surface.value = formSurface('L-1')
    record.value = { title: 'saved L-1' }
    await nextTick()
    expect(form.formDoc.value).toEqual({ title: 'edited L-1' })
    expect(form.isDirty.value).toBe(true)
  })

  it('clears the draft on successful save', async () => {
    const surface = ref(formSurface('L-1'))
    const form = mountForm('app:crm', surface, ref({ title: 'saved' }))
    await nextTick()

    form.formDoc.value = { title: 'edited' }
    await nextTick()
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'].value).toEqual({ title: 'edited' })

    form.save()
    await nextTick()
    expect(form.draft.value).toBeUndefined()
    expect(state.workingState['app:crm']['form:CRM Lead:L-1'].value).toBeUndefined()
  })

  it('stays clean after save — no stale `modified` resent on a second save', async () => {
    const surface = ref(formSurface('L-1'))
    const record = ref({ title: 'saved', modified: '2026-07-01 17:58:37' })
    const form = mountForm('app:crm', surface, record)
    await nextTick()

    form.formDoc.value = { ...form.formDoc.value, title: 'edited' }
    await nextTick()
    expect(form.isDirty.value).toBe(true)

    form.save() // server bumps `modified`; baseline realigns
    await nextTick()
    expect(form.isDirty.value).toBe(false) // not falsely dirty on the stale timestamp
    expect(form.dirtyFields.value).toEqual([]) // a second save would send nothing (no TimestampMismatch)
    expect(form.formDoc.value.modified).toBe(record.value.modified) // reseeded from the saved doc
  })
})
