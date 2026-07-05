// tileMenuOptions(pin, opts): the right-click menu for a placed tile — a desktop or dock pin. An app
// tile shows "Open" (the tile-click action), then — only for an app whose click opens a full-window
// applet (raven's chat) — "Open Workspaces" to reach its workbench hub; then the management group:
// "Rename" (desktop only, when the caller wires `onRename`) and "Remove". A doctype/applet pin is not
// an app ref, so it skips the open verbs. Remove funnels through removeResolvedPlacement, so a tile
// reuses the exact remove path the Window-menu verbs and Favorites share (ADR-0023): an INHERITED pin
// is tombstoned with a hidden override, an OWN pin's row is deleted — never a shared-layer row delete.
// The labels stay bare — the menu is already contextual (it opened on this tile), so it needs no
// "…from Desktop" / "…from Dock" qualifier; the pin carries its region, so the same builder serves
// both surfaces (desktop icons and dock tiles). Rename is a desktop-only gesture (dock tiles show no
// text label), so it appears only when a desktop caller passes the `onRename` starter.
import { removeResolvedPlacement } from '@/placements'
import { opensAppletOnClick } from '@/surface'
import { openApp, openAppWorkbench } from '@/desktop/windows'
import type { ResolvedPlacement } from '@/types'
import type { ContextMenuOption } from '@/components/OSContextMenu.vue'

// Caller-supplied hooks for actions the menu can't run on its own — `onRename` starts the desktop's
// inline label edit for this pin (App.vue owns that transient UI state; the dock passes nothing).
export interface TileMenuHooks {
  onRename?: () => void
}

export function tileMenuOptions(pin: ResolvedPlacement, hooks: TileMenuHooks = {}): ContextMenuOption[] {
  return [...appOpenItems(pin), ...renameItem(pin, hooks), removeItem(pin)]
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

// The open verbs for a tile that names an app — a bare-app pin OR an applet/dashboard pin of that app
// (so the dock's raven-chat applet pin still exposes its app's verbs, not just "Remove"). "Open" runs
// the app's front-door action (openApp — raven's chat applet, a normal app's workbench). "Open
// Workspaces" appears only when that front door is a full-window applet (opensAppletOnClick), giving
// the app the workbench hub a normal app already reaches on click — one entry, not one per workspace.
// A doctype pin names no app, so it gets neither.
function appOpenItems(pin: ResolvedPlacement): ContextMenuOption[] {
  const app = pin.ref.app
  if (!app) return []
  const items: ContextMenuOption[] = [
    { label: 'Open', icon: 'lucide-app-window', onClick: () => void openApp(app) },
  ]
  if (opensAppletOnClick(app))
    items.push({ label: 'Open Workspaces', icon: 'lucide-layers', onClick: () => void openAppWorkbench(app) })
  return [...items, { separator: true }]
}

function removeItem(pin: ResolvedPlacement): ContextMenuOption {
  return { label: 'Remove', icon: 'lucide-trash-2', onClick: () => void removeResolvedPlacement(pin) }
}
