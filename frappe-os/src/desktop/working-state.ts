// Working state store ops (ADR-0029): the logic over the `state.workingState[winId][subjectKey]`
// slab — a family member of geometry, home in `desktop/`, not a server cache. The one seam that
// reads/writes an entry is `entryFor`; the rest is lifecycle (prune on nav, drop on close) and
// the `dirtyWindows` signal that arms the unsaved-changes guards. Kept pure over `state` so it is
// unit-testable in isolation; the `useWorkingState` composable and `windows.ts` are the callers.
import { state } from './state'
import type { Persist, WorkingEntry } from '@/types'

// A subject can hold more than one FACET (ADR-0029). The primary facet is the bare subjectKey — so
// the durable list snapshot stays keyed `list:<doctype>`, byte-identical for persistence — and a
// named facet (the list's ephemeral scroll/paging position) is the subject suffixed after a
// separator that cannot occur in a subjectKey (built from doctype/record/app names, never NUL).
// Two facets of one subject are two entries with independent persist policies, which a single
// entry cannot mix; they share the subject's lifecycle — prune/reachability coarsen back to the
// base subject, so a facet lives and dies with the surface it decorates, not on its own.
const FACET_SEP = '\u0000' // NUL — cannot appear in a subjectKey
export const subjectFacet = (subject: string, facet: string): string => `${subject}${FACET_SEP}${facet}`
export const baseSubject = (key: string): string => key.split(FACET_SEP)[0]

// Read (creating on first touch) the entry for a window×subject. Returns the LIVE reactive entry,
// so a caller writes by assigning `entryFor(...).value = x` (and `.dirty = b`) — no separate write
// path. A freshly-minted entry carries the caller's persist policy and an undefined value.
export function entryFor(winId: string, subject: string, persist: Persist): WorkingEntry {
  const win = state.workingState[winId] ?? (state.workingState[winId] = {})
  return win[subject] ?? (win[subject] = { persist, value: undefined })
}

// Prune on in-window navigation: drop ephemeral entries whose subject is no longer reachable via
// the window's history (bounded by HIST_CAP), keeping durable ones (they survive like `geo`).
export function pruneWindow(winId: string, reachable: Iterable<string>): void {
  const win = state.workingState[winId]
  if (!win) return
  const keep = new Set(reachable)
  for (const subject of Object.keys(win)) {
    // Coarsen to the base subject so a facet (e.g. a list's scroll position) survives as long as
    // its surface is reachable — reachable subjects are bare subjectKeys, never facet-suffixed.
    if (win[subject].persist === 'ephemeral' && !keep.has(baseSubject(subject))) delete win[subject]
  }
}

// Drop on window close: ephemeral entries die with the window; durable entries survive (a reopened
// window reuses its id and its durable state, mirroring how `closeWin` keeps `state.geo[id]`,
// ADR-0019). Once no durable entries remain, forget the window map so it does not leak.
export function dropWindow(winId: string): void {
  const win = state.workingState[winId]
  if (!win) return
  for (const subject of Object.keys(win)) {
    if (win[subject].persist === 'ephemeral') delete win[subject]
  }
  if (!Object.keys(win).length) delete state.workingState[winId]
}

// Whether a window holds unsaved work — a dirty ephemeral entry. Only ephemeral state is a
// data-loss risk; durable state is already safe on disk. Arms the in-app close confirm for one
// window; `dirtyWindows` is the fleet-wide roll-up the `beforeunload` guard reads.
export function windowIsDirty(winId: string): boolean {
  const win = state.workingState[winId]
  return !!win && Object.values(win).some((e) => e.persist === 'ephemeral' && e.dirty)
}

// The windows holding a dirty ephemeral entry — arms the `beforeunload` reload/tab-close guard.
export function dirtyWindows(): string[] {
  return Object.keys(state.workingState).filter(windowIsDirty)
}
