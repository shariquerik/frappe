// Derive the Context (CONTEXT.md → Context) from the OS's single focused window — the flat,
// depth-3 fact (global → active window → surface) the resolver judges Eligibility against.
// An absent coordinate stays undefined (a `when` scoping on it is then a clean non-match);
// null/'' record names are coerced away for the same reason.
import { surfaceAppId, windowRole } from '@/surface'
import type { BuiltinSurface, Context, OsStore } from '@/types'

// The surface-tier record-state markers (slice 04): `docstatus` + `status` of the front FORM
// record, read from the loaded record cache (`recordObj` — a pure read, no fetch). Published only
// for a form with a loaded record, so `when: { doctype, docstatus: '1' }` gates submitted-only
// verbs; a list carries neither (its recordName is null, nothing to read). `docstatus` is
// stringified (0/1/2 → '0'/'1'/'2') to meet equality `when`; `status` passes through verbatim.
function recordState(os: OsStore, surface: BuiltinSurface): Pick<Context, 'docstatus' | 'status'> {
  if (surface.view !== 'form' || !surface.doctype || !surface.recordName) return {}
  const record = os.recordObj(surface.doctype, surface.recordName)
  if (!record) return {}
  const state: Pick<Context, 'docstatus' | 'status'> = {}
  if (record.docstatus !== undefined) state.docstatus = String(record.docstatus)
  if (record.status) state.status = record.status
  return state
}

export function contextForOS(os: OsStore): Context {
  const win = os.state.windows.find((w) => w.id === os.state.activeId)
  if (!win) return {}
  const surface = win.surface
  const context: Context = { activeApp: surfaceAppId(surface), windowRole: windowRole(win.id) }
  if (surface.kind === 'applet') context.appletId = surface.appletId
  else {
    if (surface.view) context.view = surface.view
    if (surface.doctype) context.doctype = surface.doctype
    if (surface.recordName) context.recordName = surface.recordName
    // The surface-tier workspace coordinate (ADR-0040) — published only when present, so a
    // `when: { workspace: X }` is a clean non-match on a single-space surface.
    if (surface.workspace) context.workspace = surface.workspace
    Object.assign(context, recordState(os, surface))
  }
  // The focus-tier markers — KIND, never value (ADR-0038). `selection` is the kind of the front
  // window's selection (`'rows'`, `'message'`, …); the selection/bulk-bar Region gates on its
  // presence (regions.ts). `focusKind` is the kind of the widget holding keyboard focus. Both read
  // state.activeId, the same window this Context is derived from; both absent when the focus offers
  // none. The selected VALUES never live here — they travel via Invocation.selection (ADR-0037).
  const selectionKind = os.selectionKind()
  if (selectionKind) context.selection = selectionKind
  const focusKind = os.focusedKind()
  if (focusKind) context.focusKind = focusKind
  return context
}
