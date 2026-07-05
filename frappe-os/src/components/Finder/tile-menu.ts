// finderTileMenuOptions(item, os): the right-click menu for a Finder tile. A Finder tile is NOT a
// pin (it's a launcher / nav item, ADR-0024), so this differs from placements/tile-menu.ts: it shows
// "Open" (the tile-click action, openRef), then per region an "Add to Desktop/Dock" — flipped to
// "Remove from …" when this reference is ALREADY pinned there. It has NO "Rename" (a Finder tile has
// no personal pin to carry a label — rename is a desktop/dock-pin gesture) and no bare "Remove".
// Add/Remove funnel through the SAME ref-targeted helpers the Window "Add to Desktop/Dock" verbs use
// (placement-verbs), so a tile and the menu bar pin identically.
import { openRef } from '@/desktop/windows'
import { pinToDesktop, pinToDock, unpinRef, isPinned } from '@/actions/placement-verbs'
import type { FinderItem } from './locations'
import type { OsStore, PlacementRegion, SurfaceRef } from '@/types'
import type { ContextMenuOption } from '@/components/OSContextMenu.vue'

export function finderTileMenuOptions(item: FinderItem, os: OsStore): ContextMenuOption[] {
  const ref = item.ref
  return [
    { label: 'Open', icon: openIcon(ref), onClick: () => void openRef(ref) },
    { separator: true },
    regionItem('desktop', ref, os),
    regionItem('dock', ref, os),
  ]
}

// One region's pin verb: "Remove from …" when the reference is already pinned there (the same
// own-vs-inherited remove path the menu-bar verb uses), else "Add to …" into the next free slot.
function regionItem(region: PlacementRegion, ref: SurfaceRef, os: OsStore): ContextMenuOption {
  const noun = region === 'desktop' ? 'Desktop' : 'Dock'
  if (isPinned(region, ref))
    return { label: `Remove from ${noun}`, icon: 'lucide-trash-2', onClick: () => unpinRef(region, ref) }
  const add = region === 'desktop' ? () => pinToDesktop(ref, os.desktopRef.h) : () => pinToDock(ref)
  return { label: `Add to ${noun}`, icon: regionIcon(region), onClick: add }
}

const regionIcon = (region: PlacementRegion): string =>
  region === 'desktop' ? 'lucide-monitor' : 'lucide-panel-bottom'

// The "Open" glyph, keyed off the reference shape — mirrors placements/tile-menu.ts so the Open verb
// reads identically whether the tile lives in the Finder or on the desktop.
function openIcon(ref: SurfaceRef): string {
  if (ref.applet) return 'lucide-layout-grid'
  if (ref.view === 'form') return 'lucide-file-text'
  if (ref.doctype) return 'lucide-table-2'
  return 'lucide-app-window'
}
