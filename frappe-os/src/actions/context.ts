// Derive the Context (CONTEXT.md → Context) from the OS's single focused window — the flat,
// depth-3 fact (global → active window → surface) the resolver judges Eligibility against.
// An absent coordinate stays undefined (a `when` scoping on it is then a clean non-match);
// null/'' record names are coerced away for the same reason.
import { surfaceAppId, windowRole } from '@/surface'
import type { Context, OsStore } from '@/types'

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
