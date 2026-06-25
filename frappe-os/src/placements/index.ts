// usePlacements(): the client Placement seam (ADR-0023). The server resolves the three layers
// (App-default baseline ∪ role-scoped Site ⊕ User overrides) and delivers the flat, already-merged
// list in boot.placements; this module just holds it and projects it per region. The frontend's
// ONLY write path is its own User-layer override rows (#02 onward) — there is no client-side merge
// here, by design ("the frontend sees only the resolved result, never the layers").
//
// Seeded once at boot (initPlacements), mirroring registry's initRegistry / os-api's initOsApi, so
// usePlacements() stays a synchronous lookup for renderers.
import { reactive } from 'vue'
import { useRegistry, getMeta, listApplets } from '@/registry'
import { callPost } from '@/data/api'
import type { BootData, ResolvedPlacement, PlacementRegion, SurfaceRef, PlacementPosition } from '@/types'

// The resolved list is reactive so a drag (#02) / reorder (#03) / add-remove (#04) optimistically
// mutates it and the desktop + dock re-render without a reload. Boot replaces it wholesale; the
// write seam below patches it per (region, reference) identity.
const store = reactive<{ list: ResolvedPlacement[] }>({ list: [] })

// Read the resolved list off the boot payload, tolerating a missing/legacy key (ADR-0008): an
// older server with no `placements` key, or junk, degrades to an empty desktop/dock rather than
// throwing — the baseline is a server concern, so offline/tests simply show no pins.
function readPlacements(boot?: BootData | null): ResolvedPlacement[] {
  const list = (boot as { placements?: unknown } | null | undefined)?.placements
  return Array.isArray(list) ? (list as ResolvedPlacement[]) : []
}

export function initPlacements(boot?: BootData | null): void {
  store.list = readPlacements(boot)
}

function inRegion(region: PlacementRegion): ResolvedPlacement[] {
  return store.list.filter((p) => p.region === region)
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

// ── the User-layer write seam (ADR-0023) ──────────────────────────────────────────
// The frontend's ONLY write path: its own User-layer OS Placement Override rows. A drag (#02),
// a dock reorder (#03), and the Add/Remove verbs (#04) all funnel through here, so the server
// upsert, the optimistic local patch, and the (region, reference) identity live in ONE place
// rather than once per consumer. Server-side the resolver re-folds these on the next boot.
export interface OverrideDelta {
  region: PlacementRegion
  ref: SurfaceRef
  position?: PlacementPosition | null
  hidden?: boolean
}

function sameIdentity(p: ResolvedPlacement, region: PlacementRegion, ref: SurfaceRef): boolean {
  return placementKey(p) === placementKey({ region, ref })
}

// Patch the reactive resolved list as the server resolver would fold this one User override:
// a hide drops the matching pin, a position delta moves it in place, an unseen reference is a
// brand-new pin appended. Exported pure-ish (mutates the reactive store) so it is unit-testable
// without the network — `writePlacementOverride` is just this plus the persisted upsert.
export function applyLocalOverride(delta: OverrideDelta): void {
  const i = store.list.findIndex((p) => sameIdentity(p, delta.region, delta.ref))
  if (delta.hidden) {
    if (i >= 0) store.list.splice(i, 1)
  } else if (i >= 0) {
    store.list[i] = { ...store.list[i], ...(delta.position !== undefined ? { position: delta.position } : {}) }
  } else {
    store.list.push({ region: delta.region, ref: delta.ref, position: delta.position ?? null })
  }
}

// Upsert the User-layer override: optimistically patch the local list, then persist. The position
// and reference cross the wire as JSON strings (the server stores them canonically). Fire-and-
// forget on the write; a rejection logs and the next boot reconciles from the server resolver.
export async function writePlacementOverride(delta: OverrideDelta): Promise<void> {
  applyLocalOverride(delta)
  await callPost('frappe.www.os.save_placement_override', {
    region: delta.region,
    surface_ref: JSON.stringify(delta.ref),
    position: delta.position != null ? JSON.stringify(delta.position) : undefined,
    hidden: delta.hidden ? 1 : 0,
  }).catch((error) => console.error('save_placement_override failed', error))
}

// Clear the caller's own override delta for a (region, reference): drops the pin locally (its own
// new pin disappears; an un-hidden inherited pin reconstitutes on the next boot) and deletes the
// row server-side. The inverse of an Add/hide for a user's OWN pins.
export async function removePlacementOverride(region: PlacementRegion, ref: SurfaceRef): Promise<void> {
  const i = store.list.findIndex((p) => sameIdentity(p, region, ref))
  if (i >= 0) store.list.splice(i, 1)
  await callPost('frappe.www.os.delete_placement_override', {
    region,
    surface_ref: JSON.stringify(ref),
  }).catch((error) => console.error('delete_placement_override failed', error))
}
