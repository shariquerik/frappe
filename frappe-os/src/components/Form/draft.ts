// Form draft decisions (ADR-0029), pulled out of OSForm so they are unit-testable without mounting
// the form. A form's editable copy is EPHEMERAL working state, held per (window × record) in the
// OS store so an unsaved draft survives in-window navigation, Aspect switches and window unmount
// (but not reload — durable drafts are deferred). These two pure functions are the seed and the
// persist halves of that binding; OSForm wires them to its `formDoc` ref and the working-state slot.

// The formDoc to bind on (re)mount / record change: a HELD draft (from a prior mount, in-window
// nav or Aspect switch) is adopted as-is so edits survive; an empty slot seeds from the live record
// (a shallow copy so edits don't mutate the cached doc), or {} for a new record.
export function seedDraft(
  held: Record<string, any> | undefined,
  isNew: boolean,
  record: Record<string, any> | null,
): Record<string, any> {
  return held ?? (isNew ? {} : { ...(record || {}) })
}

// What to store back into the ephemeral slot for the current formDoc: only a DIRTY draft is worth
// holding — a clean form re-seeds from the record identically — so a dirty form stores its formDoc
// and a clean form stores nothing (undefined), keeping the slab free of no-op drafts for
// merely-viewed records.
export function draftToStore(
  isDirty: boolean,
  formDoc: Record<string, any>,
): Record<string, any> | undefined {
  return isDirty ? formDoc : undefined
}

// A value differs from its baseline (deep, via JSON) — the primitive the dirty diff is built on.
function changed(a: unknown, b: unknown): boolean {
  if (a === b) return false
  return JSON.stringify(a) !== JSON.stringify(b)
}

// The fields whose value diverged from the loaded record — the ONE definition both the dirty
// signal and the save payload derive from. For a NEW record every non-empty field counts (there
// is no baseline); for an existing one, only fields that changed against the record. Crucially the
// record IS the baseline, so a saved doc adopted as the new baseline (see OSForm.save) leaves the
// form clean — the server-managed `modified` never lingers as a phantom dirty field that would be
// resent and trip Frappe's optimistic lock (TimestampMismatchError).
export function changedFields(
  formDoc: Record<string, any>,
  record: Record<string, any> | null,
  isNew: boolean,
): string[] {
  if (isNew) return Object.keys(formDoc).filter((k) => formDoc[k] != null && formDoc[k] !== '')
  const orig = record || {}
  return Object.keys(formDoc).filter((k) => changed(formDoc[k], orig[k]))
}
