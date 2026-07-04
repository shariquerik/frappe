// The focused surface's selection, keyed by winId like `geo` — two windows of the same doctype keep
// independent selections. Generalized from bare record names to a KIND + values (ADR-0038): the kind
// (`'rows'`, `'message'`, an app-namespaced `<app>.<kind>`) marks Context — the selection/bulk-bar
// Region gates on its presence; the values are the READ model a bulk run Handler acts on, reaching it
// only via Invocation.selection (ADR-0037), never through Context. OSList is the first publisher, with
// kind `'rows'`; the write from its `update:selections` is wired in OSList.vue.
import { state } from './state'
import { isValidKind } from '@/actions/kinds'

// Record the focused-or-named window's selection as a { kind, values } entry. An empty selection
// clears the entry (sparse like `geo`), so the readers see nothing rather than a stale set once rows
// are deselected. A malformed kind is refused with a loud warn (kinds.ts) — it must never poison the
// focus tier with a marker no honest `when` can match.
export function setSelection(winId: string, kind: string, values: string[]): void {
  if (!values.length) { delete state.selection[winId]; return }
  if (!isValidKind(kind)) {
    console.warn(`[actions] ⚠ invalid selection kind "${kind}" — selection ignored (not a core or <app>.<kind> kind)`)
    return
  }
  state.selection[winId] = { kind, values }
}

// Drop a window's selection outright. The selection belongs to the surface currently shown, so any
// surface swap (in-window navigation, back/forward) or close must clear it — otherwise a stale
// selection carries onto the next surface and a bulk verb would act on the wrong doctype's records.
export function clearSelection(winId: string): void {
  delete state.selection[winId]
}

// The selected record names on the FRONT window's surface, or [] when nothing is selected — the
// values a bulk run Handler reads to act on (the Region gate already hid the verb when this is empty,
// so a handler seeing [] is a clean no-op, never a crash).
export function selectedRecords(): string[] {
  const id = state.activeId
  return (id && state.selection[id]?.values) || []
}

// The KIND of the FRONT window's selection (`'rows'`, `'message'`, …), or undefined when nothing is
// selected — the presence/kind marker `contextForOS` reads into `Context.selection`. The values stay
// out of Context; they reach a handler only via Invocation.selection (ADR-0037).
export function selectionKind(): string | undefined {
  const id = state.activeId
  return id ? state.selection[id]?.kind : undefined
}
