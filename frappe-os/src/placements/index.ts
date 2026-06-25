// usePlacements(): the client Placement seam (ADR-0023). The server resolves the three layers
// (App-default baseline ∪ role-scoped Site ⊕ User overrides) and delivers the flat, already-merged
// list in boot.placements; this module just holds it and projects it per region. The frontend's
// ONLY write path is its own User-layer override rows (#02 onward) — there is no client-side merge
// here, by design ("the frontend sees only the resolved result, never the layers").
//
// Seeded once at boot (initPlacements), mirroring registry's initRegistry / os-api's initOsApi, so
// usePlacements() stays a synchronous lookup for renderers.
import { useRegistry, getMeta, listApplets } from '@/registry'
import type { BootData, ResolvedPlacement, PlacementRegion, SurfaceRef } from '@/types'

let resolved: ResolvedPlacement[] = []

// Read the resolved list off the boot payload, tolerating a missing/legacy key (ADR-0008): an
// older server with no `placements` key, or junk, degrades to an empty desktop/dock rather than
// throwing — the baseline is a server concern, so offline/tests simply show no pins.
function readPlacements(boot?: BootData | null): ResolvedPlacement[] {
  const list = (boot as { placements?: unknown } | null | undefined)?.placements
  return Array.isArray(list) ? (list as ResolvedPlacement[]) : []
}

export function initPlacements(boot?: BootData | null): void {
  resolved = readPlacements(boot)
}

function inRegion(region: PlacementRegion): ResolvedPlacement[] {
  return resolved.filter((p) => p.region === region)
}

// The resolved pins per region — the synchronous seam App.vue (desktop) and Dock.vue (#03) read.
export function usePlacements() {
  return {
    desktop: (): ResolvedPlacement[] => inRegion('desktop'),
    dock: (): ResolvedPlacement[] => inRegion('dock'),
  }
}

// ── presentation: a reference → its desktop/dock label + icon ─────────────────────
// Presentation is derived from the reference against the Registry (app name/logo, doctype
// label/icon, applet label), NOT carried in the placement — so the same OS-native presentation
// the rest of the shell uses lights a pin up, and a server payload never ships a CSS class.
export interface PlacementView {
  key: string
  ref: SurfaceRef
  label: string
  logo?: string // an app logo image (apps render as their branded icon, like the dock)
  icon?: string // a lucide class for non-app references
}

// A stable per-pin key (region + reference identity) for v-for and override targeting (ADR-0023
// identity = (region, surface-reference)). Mirrors the server's _ref_key.
export function placementKey(p: ResolvedPlacement): string {
  return p.region + ':' + JSON.stringify(p.ref, Object.keys(p.ref).sort())
}

export function placementView(p: ResolvedPlacement): PlacementView {
  const key = placementKey(p)
  const ref = p.ref
  if (ref.doctype) {
    const meta = getMeta(ref.doctype)
    return { key, ref, label: meta?.label || ref.doctype, icon: meta?.icon || 'lucide-table-2' }
  }
  const app = ref.app ? useRegistry().app(ref.app) : undefined
  if (ref.applet) {
    const info = listApplets().find((a) => a.appletId === ref.applet)
    return { key, ref, label: info?.label || ref.applet, logo: app?.logo, icon: 'lucide-layout-grid' }
  }
  // A bare-app or dashboard reference renders as the app's branded icon.
  return { key, ref, label: app?.name || ref.app || '', logo: app?.logo, icon: 'lucide-app-window' }
}
