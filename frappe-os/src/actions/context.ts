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
  }
  return context
}
