// The desktop-icon selection (macOS Finder-style): which desktop icons are currently highlighted,
// held as a flat array of pin keys (`placementKey`, the same key each DesktopIcon renders under).
// Distinct from `state.selection`, which is the FRONT LIST's row selection (ADR-0038) — an icon
// living on the wallpaper is a different surface, so it gets its own slice. The array shape is
// deliberate: multi-select (Cmd/Shift-click) writes several keys, and a later move/delete layer
// acts on the whole set. Single-click replaces, a modified click toggles, empty-desktop clears.
import { state } from './state'

// Select an icon. A plain click REPLACES the selection with just this key (the common case —
// one icon at a time). An additive click (Cmd/Ctrl or Shift) TOGGLES this key in the existing
// set — clicking a selected icon again removes it, clicking an unselected one extends the set.
export function selectIcon(key: string, opts: { additive?: boolean } = {}): void {
  if (!opts.additive) { state.iconSelection = [key]; return }
  if (isIconSelected(key)) state.iconSelection = state.iconSelection.filter((k) => k !== key)
  else state.iconSelection = [...state.iconSelection, key]
}

// Drop the whole icon selection — a plain left-click on empty wallpaper deselects everything,
// like clicking the Finder desktop background. Idempotent: clearing an empty selection is a no-op.
export function clearIconSelection(): void {
  state.iconSelection = []
}

// Is this icon key part of the current selection? Read by the tile to paint its highlight.
export function isIconSelected(key: string): boolean {
  return state.iconSelection.includes(key)
}

// The current selected icon keys — the READ model a later multi-move/delete layer acts on.
export function selectedIcons(): string[] {
  return state.iconSelection
}

// The single selected icon key, or null when the selection is empty OR holds more than one. This is
// the target a contextual single-icon action acts on — Return/F2-to-rename (Finder-style). A multi-
// select deliberately yields null, so such actions stay disabled until exactly one icon is picked.
export function soleSelectedIcon(): string | null {
  return state.iconSelection.length === 1 ? state.iconSelection[0] : null
}
