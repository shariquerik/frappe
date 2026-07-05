// The Finder's tile selection (issue #05): the single highlighted Finder tile. It mirrors the
// desktop's icon selection (desktop/icon-selection.ts) but for the Finder body — a Finder tile is
// NOT a Placement (it's a launcher / nav item), so it can't ride the desktop's `iconSelection`
// (keyed by placementKey); it gets its own slice keyed by the FinderItem key. Single-select is
// enough here (issue asks for "single-click-selection"): a click REPLACES the selection, and
// clicking empty grid space or switching Location clears it. A module singleton — the Finder is a
// singleton system window, so one selection is the whole story.
import { reactive } from 'vue'

const state = reactive<{ key: string | null }>({ key: null })

// Select a tile — replaces whatever was selected (single-select). The tile paints its highlight
// off isFinderTileSelected.
export function selectFinderTile(key: string): void {
  state.key = key
}

// Drop the selection — a click on empty grid space or a Location change deselects, like clicking the
// Finder background. Idempotent: clearing an empty selection is a no-op.
export function clearFinderSelection(): void {
  state.key = null
}

// Is this tile key the current selection? Read by the tile to paint its highlight.
export function isFinderTileSelected(key: string): boolean {
  return state.key === key
}

// The selected tile key, or null when nothing is selected — the target Enter-to-open acts on.
export function selectedFinderTile(): string | null {
  return state.key
}
