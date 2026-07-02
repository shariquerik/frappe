// The focused list's multi-row selection, keyed by winId like `geo` — two windows of the same
// doctype keep independent selections. This is the READ/WRITE model a bulk run Handler acts on
// (ADR-0032 slice 04): a Doctype/View-scoped bulk verb reads the front list's selected record
// names off `selectedRecords()` and drives the standard bulk-update method. Wiring the live WRITE
// (from OSListView's `update:selections`) and the `context.selection` presence gate is deferred
// (.scratch/deferred-hardcoded/issues/11-selection-backing-and-toolbar-wiring); this slice owns the
// state so the verb is testable now — its live positive selection lights up when #11 lands.
import { state } from './state'

// Record the focused-or-named window's selected record names. An empty selection clears the entry
// (sparse like `geo`), so `selectedRecords` reads [] rather than a stale set once rows are deselected.
export function setSelection(winId: string, names: string[]): void {
  if (names.length) state.selection[winId] = names
  else delete state.selection[winId]
}

// Drop a window's selection outright. The selected names belong to the surface currently shown, so
// any surface swap (in-window navigation, back/forward) or close must clear them — otherwise a stale
// selection carries onto the next surface and a bulk verb would act on the wrong doctype's records.
export function clearSelection(winId: string): void {
  delete state.selection[winId]
}

// The selected record names on the FRONT window's list, or [] when nothing is selected — the
// multi-row selection a bulk run Handler reads to act on (the Region gate already hid the verb
// when this is empty, so a handler seeing [] is a clean no-op, never a crash).
export function selectedRecords(): string[] {
  const id = state.activeId
  return id ? (state.selection[id] ?? []) : []
}
