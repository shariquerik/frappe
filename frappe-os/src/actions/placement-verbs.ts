// The "Add to / Remove from Desktop / Dock" verbs (issue #04, ADR-0023) as first-party `frappe`
// contributions, surfaced through the SAME Action machinery every menu dogfoods (ADR-0001) — four
// Commands placed by Actions into the `menubar:window` Region, NOT bespoke menu wiring. They live in
// the Window menu because they pin WHATEVER the active window shows (its surface reference, ADR-0021):
// pinning the current window is a window verb, not a file one (the OS owns no File menu, ADR-0039).
//
// The resolver is equality-only (`when`), so it can't express "is this surface already pinned".
// That toggle (Add ↔ Remove) is a pure function of the current pin state, decided at PROJECTION
// time by suppressedPlacementCommands (which menuOptions in menubar.ts filters through for every
// menu) — so the verbs stay genuine resolved Actions while the inverse only appears when it applies.
import { surfaceAppId, windowRole } from '@/surface'
import { usePlacements, placementKey, writePlacementOverride, removeResolvedPlacement } from '@/placements'
import { nextDockOrder } from '@/desktop/dock-model'
import { nextFreeCell, layoutDesktop } from '@/desktop/grid'
import type { OsStore, Surface, SurfaceRef, PlacementRegion } from '@/types'
import type { Action, Command } from './types'
import { registerRunHandlers, type RunHandler } from './contributions'
import { WINDOW_REGION } from './regions'

// The surface reference (ADR-0021) a pin stores for what a window currently shows. Mirrors the
// pinnable shapes placementSurface resolves back (applet / dashboard / doctype-list), so a pin
// round-trips to the same Surface on open. A form (a record — not a placement shape) and every
// other surface (empty/settings) pin the BARE APP, the most honest reusable destination.
export function surfaceToRef(surface: Surface): SurfaceRef {
  if (surface.kind === 'applet') return { app: surface.appId, applet: surface.appletId }
  if (surface.view === 'dashboard') return { app: surface.appId, dashboard: true }
  if (surface.view === 'list' && surface.doctype) return { doctype: surface.doctype, view: 'list' }
  return { app: surfaceAppId(surface) }
}

// The active window's surface reference, or null when there is nothing to pin: a bare desktop (no
// window), or a non-`app` window — the Finder / Settings / an app-settings pane (windowRole !==
// 'app') are OS chrome, not a destination, so the verbs never offer to pin the bare framework app.
function activeRef(os: OsStore): SurfaceRef | null {
  const win = os.state.windows.find((w) => w.id === os.state.activeId)
  if (!win || windowRole(win.id) !== 'app') return null
  return surfaceToRef(win.surface)
}

// Is `ref` already pinned in `region`? Identity match on (region, surface-reference) — the same
// key the override seam dedups on — so the inverse "Remove…" verb appears only when it applies.
// Exported so a ref-targeted caller (the Finder tile menu) can toggle Add ↔ Remove per region.
export function isPinned(region: PlacementRegion, ref: SurfaceRef): boolean {
  const key = placementKey({ region, ref })
  const list = region === 'desktop' ? usePlacements().desktop() : usePlacements().dock()
  return list.some((p) => placementKey(p) === key)
}

// ── ref-targeted pin/unpin — the shared core (issue #03/#05) ─────────────────────
// These act on a GIVEN surface reference, so both the Window verbs (the active surface, below) and
// the Finder tile menu (a tile's ref) pin/unpin through ONE path — the free-cell / dock-order / own-
// vs-inherited logic lives here once, never copied per caller.

// Pin a reference to the desktop's next free grid cell (#02), so it never stacks on an existing icon.
// The free-cell math needs the live desktop height — the caller passes it (the store's desktopRef.h).
export function pinToDesktop(ref: SurfaceRef, desktopHeight: number): void {
  const taken = new Set(layoutDesktop(usePlacements().desktop(), desktopHeight).map((c) => c.column + ',' + c.row))
  const cell = nextFreeCell(taken, desktopHeight)
  void writePlacementOverride({ region: 'desktop', ref, position: cell })
}

// Pin a reference to the dock, appended past the current max order (#03), so it lands at the end
// rather than colliding with an existing pin.
export function pinToDock(ref: SurfaceRef): void {
  void writePlacementOverride({ region: 'dock', ref, position: { order: nextDockOrder(usePlacements().dock()) } })
}

// Unpin a reference from a region: find its resolved pin and hand it to the shared remove path, which
// clears an OWN row or tombstones an INHERITED pin off the server's `inherited` flag — never a row
// delete on a shared layer (ADR-0023). A no-op when the reference isn't pinned there.
export function unpinRef(region: PlacementRegion, ref: SurfaceRef): void {
  const list = region === 'desktop' ? usePlacements().desktop() : usePlacements().dock()
  const pin = list.find((p) => placementKey(p) === placementKey({ region, ref }))
  if (pin) void removeResolvedPlacement(pin)
}

// "Add to Desktop": pin the ACTIVE window's surface into the next free cell. The live desktop size is
// the store's desktopRef.
function addToDesktop(os: OsStore): void {
  const ref = activeRef(os)
  if (ref) pinToDesktop(ref, os.desktopRef.h)
}

// "Add to Dock": pin the ACTIVE window's surface, appended at the end of the dock.
function addToDock(os: OsStore): void {
  const ref = activeRef(os)
  if (ref) pinToDock(ref)
}

// "Remove from Desktop/Dock": a non-destructive personal removal of the ACTIVE surface's pin.
function removeFrom(os: OsStore, region: PlacementRegion): void {
  const ref = activeRef(os)
  if (ref) unpinRef(region, ref)
}

// The four verbs as run Handlers, registered into the OPEN RUN_HANDLERS map the same way the menu
// bar's own defaults are (registerRunHandlers) — no privileged core, the general app seam.
// Each verb acts on live pin state + the active window (not a Context coordinate), so it reaches
// the store through the Invocation's `os` escape hatch (ADR-0037 — chrome-verb territory).
export const PLACEMENT_RUN_HANDLERS: Record<string, RunHandler> = {
  'add-to-desktop': ({ os }) => addToDesktop(os),
  'add-to-dock': ({ os }) => addToDock(os),
  'remove-from-desktop': ({ os }) => removeFrom(os, 'desktop'),
  'remove-from-dock': ({ os }) => removeFrom(os, 'dock'),
}

// Wire the verbs into the open RUN_HANDLERS map on import (the same seam an app uses), so the
// Window-menu projector that imports these constants also makes their `run` refs invocable.
registerRunHandlers(PLACEMENT_RUN_HANDLERS)

// The verb Commands. Add and Remove share a (region, command) identity per region so the menu
// shows exactly ONE of each pair (decided by pin state in the projector below), competing in the
// `menubar:window` Region like every other Window item.
export const PLACEMENT_COMMANDS: Command[] = [
  { id: 'frappe.placement.add-desktop', sourceApp: 'frappe', title: 'Add to Desktop', handler: { kind: 'run', ref: 'add-to-desktop' } },
  { id: 'frappe.placement.remove-desktop', sourceApp: 'frappe', title: 'Remove from Desktop', handler: { kind: 'run', ref: 'remove-from-desktop' } },
  { id: 'frappe.placement.add-dock', sourceApp: 'frappe', title: 'Add to Dock', handler: { kind: 'run', ref: 'add-to-dock' } },
  { id: 'frappe.placement.remove-dock', sourceApp: 'frappe', title: 'Remove from Dock', handler: { kind: 'run', ref: 'remove-from-dock' } },
]

// Both Add and Remove are placed into the Window Region's pin group ('c', between Zoom and split);
// which of each pair renders is the projector's pin-state decision, so an inverse only shows when it
// applies. add/remove-desktop share order 4, add/remove-dock order 5 — each pair is one live slot.
export const PLACEMENT_ACTIONS: Action[] = [
  { command: 'frappe.placement.add-desktop', region: WINDOW_REGION, sourceApp: 'frappe', group: 'c', order: 4 },
  { command: 'frappe.placement.remove-desktop', region: WINDOW_REGION, sourceApp: 'frappe', group: 'c', order: 4 },
  { command: 'frappe.placement.add-dock', region: WINDOW_REGION, sourceApp: 'frappe', group: 'c', order: 5 },
  { command: 'frappe.placement.remove-dock', region: WINDOW_REGION, sourceApp: 'frappe', group: 'c', order: 5 },
]

// Which verb of a region's Add/Remove pair is live right now: Remove when the active surface is
// already pinned there, else Add. Returns the command id to keep (its inverse is dropped from the
// rendered menu). A bare desktop (no active surface) keeps Add — a harmless no-op verb, never a
// dangling Remove.
export function liveVerb(os: OsStore, region: PlacementRegion): string {
  const ref = activeRef(os)
  const pinned = !!ref && isPinned(region, ref)
  if (region === 'desktop') return pinned ? 'frappe.placement.remove-desktop' : 'frappe.placement.add-desktop'
  return pinned ? 'frappe.placement.remove-dock' : 'frappe.placement.add-dock'
}

// The set of placement command ids to DROP from a resolved Window menu: the dead half of each
// Add/Remove pair. The projector (menubar.ts) filters resolved items through this so exactly the
// live Add-or-Remove of each region renders. A bare desktop (no active surface to pin) drops ALL
// four — a verb that could only no-op never shows.
export function suppressedPlacementCommands(os: OsStore): Set<string> {
  const all = new Set(PLACEMENT_COMMANDS.map((c) => c.id))
  if (!activeRef(os)) return all
  const live = new Set([liveVerb(os, 'desktop'), liveVerb(os, 'dock')])
  return new Set([...all].filter((id) => !live.has(id)))
}
