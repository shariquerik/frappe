// Placement shapes (ADR-0023). A Placement is a user-arrangeable pin of a surface reference
// into a Region (desktop | dock). The frontend receives the ALREADY-RESOLVED list (App-default
// baseline ∪ role-scoped Site ⊕ User overrides, permission-gated) from the server in the boot
// payload's `placements` key — it never sees the three layers, and re-merging is the server's
// job, so this is a flat list, NOT a registry Contribution[]. Re-exported via @/types.
import type { SurfaceRef } from '@/types'

// A Region that hosts Placements (ADR-0004 broadened). Open string like BuiltinView, not a
// closed union — new placement regions would be additive.
export type PlacementRegion = 'desktop' | 'dock'

// A Placement's region-appropriate position (ADR-0023): an edge-anchored grid cell {column,row}
// on the desktop, a 1-D {order} in the dock. Never raw pixels. Naive/absent in this slice; #02
// (desktop grid) and #03 (dock order) make it real.
export interface PlacementPosition {
  column?: number
  row?: number
  order?: number
}

// One resolved Placement as the server delivers it: a region, the surface reference it pins, and
// its position. Presentation (label / icon) is NOT carried — the client derives it from the
// reference (placementView), keeping presentation client-side like the rest of the Registry.
export interface ResolvedPlacement {
  region: PlacementRegion
  ref: SurfaceRef
  position?: PlacementPosition | null
  // Server-stamped: true when an App-default/Site layer backs this pin (a pure User-created pin has
  // none). Removing it is a personal hide (tombstone), never a row delete on a shared layer — the
  // authoritative own-vs-inherited signal, since a baseline pin carries a position too (ADR-0023).
  inherited?: boolean
}
