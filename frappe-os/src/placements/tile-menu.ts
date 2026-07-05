// tileMenuOptions(pin, opts): the right-click menu for a placed tile — a desktop or dock pin. EVERY
// tile shows "Open" (the tile-click action, openRef) — a doctype/record shortcut included, so all
// tiles share one open path — then, only for an app whose click opens a full-window applet (raven's
// chat), "Open Workspaces" to reach its workbench hub; then the management group: "Rename" (desktop
// only, when the caller wires `onRename`) and "Remove". Remove funnels through removeResolvedPlacement, so a tile
// reuses the exact remove path the Window-menu verbs and Favorites share (ADR-0023): an INHERITED pin
// is tombstoned with a hidden override, an OWN pin's row is deleted — never a shared-layer row delete.
// The labels stay bare — the menu is already contextual (it opened on this tile), so it needs no
// "…from Desktop" / "…from Dock" qualifier; the pin carries its region, so the same builder serves
// both surfaces (desktop icons and dock tiles). Rename is a desktop-only gesture (dock tiles show no
// text label), so it appears only when a desktop caller passes the `onRename` starter.
import { removeResolvedPlacement } from '@/placements'
import { opensAppletOnClick } from '@/surface'
import { openRef, openAppWorkbench } from '@/desktop/windows'
import type { ResolvedPlacement, SurfaceRef } from '@/types'
import type { ContextMenuOption } from '@/components/OSContextMenu.vue'

// Caller-supplied hooks for actions the menu can't run on its own — `onRename` starts the desktop's
// inline label edit for this pin (App.vue owns that transient UI state; the dock passes nothing).
export interface TileMenuHooks {
  onRename?: () => void
}

export function tileMenuOptions(pin: ResolvedPlacement, hooks: TileMenuHooks = {}): ContextMenuOption[] {
  return [...openItems(pin), ...renameItem(pin, hooks), removeItem(pin)]
}

// "Rename" — a desktop-only management verb that starts the inline label edit. Present only when the
// pin lives on the desktop AND the caller wired an `onRename` starter, so a dock tile (no visible
// label) and a hookless caller both skip it. The label override itself persists via the shared
// writePlacementOverride path (ADR-0023); this entry only opens the editor.
function renameItem(pin: ResolvedPlacement, hooks: TileMenuHooks): ContextMenuOption[] {
  if (pin.region !== 'desktop' || !hooks.onRename) return []
  // keepsFocus: onRename focuses the inline input — the menu must not pull focus back to the tile.
  return [{ label: 'Rename', icon: 'lucide-pencil', onClick: hooks.onRename, keepsFocus: true }]
}

// The open verbs for ANY tile — every pin runs the same tile-click action (openRef, ADR-0023/0024):
// a bare-app pin opens the app's default surface, a doctype/record/applet pin resolves to its Surface.
// So a doctype shortcut now offers "Open" just like an app tile — the click, double-click, and this
// menu entry are one path. An app whose front door is a full-window applet (opensAppletOnClick, e.g.
// raven's chat) additionally gets "Open Workspaces" to reach its workbench hub — one entry, not one
// per workspace. Every open verb is followed by a divider before the management group.
function openItems(pin: ResolvedPlacement): ContextMenuOption[] {
  const ref = pin.ref
  const items: ContextMenuOption[] = [
    { label: 'Open', icon: openIcon(ref), onClick: () => void openRef(ref) },
  ]
  if (ref.app && opensAppletOnClick(ref.app))
    items.push({ label: 'Open Workspaces', icon: 'lucide-layers', onClick: () => void openAppWorkbench(ref.app!) })
  return [...items, { separator: true }]
}

// The "Open" glyph, keyed off the reference shape (an applet/record/list/app each read at a glance).
function openIcon(ref: SurfaceRef): string {
  if (ref.applet) return 'lucide-layout-grid'
  if (ref.view === 'form') return 'lucide-file-text'
  if (ref.doctype) return 'lucide-table-2'
  return 'lucide-app-window'
}

function removeItem(pin: ResolvedPlacement): ContextMenuOption {
  return { label: 'Remove', icon: 'lucide-trash-2', onClick: () => void removeResolvedPlacement(pin) }
}
