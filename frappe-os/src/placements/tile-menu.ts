// tileMenuOptions(pin): the right-click menu for a placed tile — a desktop or dock pin. A single
// "Remove" that funnels through removeResolvedPlacement, so a tile reuses the exact remove path the
// Window-menu verbs and Favorites share (ADR-0023): an INHERITED pin is tombstoned with a hidden
// override, an OWN pin's row is deleted — never a shared-layer row delete. The label stays bare
// "Remove" — the menu is already contextual (it opened on this tile), so it needs no "…from Desktop"
// / "…from Dock" qualifier; the pin carries its region, so the same builder serves both surfaces.
import { removeResolvedPlacement } from '@/placements'
import type { ResolvedPlacement } from '@/types'
import type { ContextMenuOption } from '@/components/OSContextMenu.vue'

export function tileMenuOptions(pin: ResolvedPlacement): ContextMenuOption[] {
  return [
    {
      label: 'Remove',
      icon: 'lucide-trash-2',
      onClick: () => void removeResolvedPlacement(pin),
    },
  ]
}
