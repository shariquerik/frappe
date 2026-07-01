// The one dogfooded Working-state seam (ADR-0029): the composable OSList, OSForm and (later)
// applets all bind to. It derives the subject from the host window's live surface — injected by
// OSWindow like TOOLBAR_SLOT / WINDOW_FOCUSED — and exposes a single writable reactive `value`
// bound to that window×subject entry in the store slab (`desktop/working-state.ts`).
//
// Reading never mints an entry (a window gets a slot only once it holds work-in-progress); the
// first write — or a mirrored `dirty` signal — creates it via `entryFor`. The subject follows
// in-window navigation that keeps the component mounted (record→record on one doctype, which
// DoctypeView does not remount), so the bound entry re-points as the surface changes.
import { computed, inject, watchEffect } from 'vue'
import type { InjectionKey, WritableComputedRef } from 'vue'
import { subjectKey } from '@/surface'
import { state } from './state'
import { entryFor, subjectFacet } from './working-state'
import type { WorkingEntry, WorkingStateContext, WorkingStateOptions } from '@/types'

// Provided by OSWindow (the common ancestor of every surface body) so any descendant surface can
// reach its window×subject Working state without threading winId/surface through props.
export const WORKING_STATE_CONTEXT: InjectionKey<WorkingStateContext> =
  Symbol('os-working-state-context')

// Returns the window×subject entry's value as a single writable ref (idiomatic Vue composable):
// reading returns undefined until the entry exists; writing creates the entry (with the caller's
// persist policy) on first assignment, and re-points as the surface changes. Callers bind to it as
// `slot.value` — assigning through the ref, never replacing it.
export function useWorkingState<T = unknown>(
  opts: WorkingStateOptions,
): WritableComputedRef<T | undefined> {
  const ctx = inject(WORKING_STATE_CONTEXT, null)
  // A facet namespaces a second entry within the subject (durable snapshot beside ephemeral scroll,
  // ADR-0029); omitted, the bare subjectKey is used so the primary entry stays byte-identical.
  const subject = computed(() => {
    if (!ctx) return null
    const base = subjectKey(ctx.surface.value)
    return opts.facet ? subjectFacet(base, opts.facet) : base
  })

  // Read side: peek the slab WITHOUT creating, so merely mounting a surface never mints an entry.
  // The reactive path is tracked, so the getter re-runs once the entry is created by a write.
  function peek(): WorkingEntry | undefined {
    return ctx && subject.value ? state.workingState[ctx.winId]?.[subject.value] : undefined
  }

  const value = computed<T | undefined>({
    get: () => peek()?.value as T | undefined,
    set: (v) => {
      if (ctx && subject.value) entryFor(ctx.winId, subject.value, opts.persist).value = v
    },
  })

  // Mirror the caller's dirty signal into the entry as stored DATA (not a live getter), so it
  // survives unmount for dirtyWindows() to read (ADR-0029). A merely-viewed (clean) surface still
  // mints nothing: only write `dirty` when the surface IS dirty, or an entry already exists (a
  // value write created it). peek() is tracked, so this re-runs and records `dirty` once that
  // write mints the entry, and re-applies when the subject (entry) changes.
  if (opts.dirty) {
    watchEffect(() => {
      if (!ctx || !subject.value) return
      const isDirty = opts.dirty!()
      if (isDirty || peek()) entryFor(ctx.winId, subject.value, opts.persist).dirty = isDirty
    })
  }

  return value
}
