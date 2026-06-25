// Recents shapes (ADR-0024). A "recent" is a record open expressed as a surface reference +
// timestamp; the server owns the definition (record opens only, deduped by reference, capped) and
// delivers the ALREADY-RESOLVED list (newest-first, permission-gated) in the boot payload's
// `recents` key. The client only records an open and reads this list — it never merges or re-orders,
// so this is a flat list, NOT a registry Contribution[]. Re-exported via @/types.
import type { SurfaceRef } from '@/types'

// One resolved recent as the server delivers it: just the surface reference it points at (a form
// reference {doctype, name, view:'form'}). Presentation (label / icon) is NOT carried — the client
// derives it from the reference via placementView, exactly like a Placement.
export interface ResolvedRecent {
  ref: SurfaceRef
}
