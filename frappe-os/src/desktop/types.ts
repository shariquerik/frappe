// The desktop window-manager's own state shapes: the theme and the one shared reactive
// `OsState` singleton every desktop slice (state/windows/geometry/palette/persistence)
// mutates. Re-exported via @/types.
import type { OsWindow, Geo } from '@/surface/types'

export type Theme = 'light' | 'dark'

// Where a plain left-click on a list row opens the record (ADR-0018 update to ADR-0017): in
// the SAME window (default — swaps that window's sidebar to the Aspect rail) or a NEW app
// instance. A per-user preference; the right-click menu always offers both regardless.
export type RowOpenTarget = 'inline' | 'new-window'

// Which screen edge the dock sits on (ADR-0022). 'top' is reserved for the menu bar, so the
// dock is only offered left (default) / right / bottom — mirroring macOS's Dock position.
export type DockPosition = 'bottom' | 'left' | 'right'

// The shared reactive desktop state (desktop/state.ts). One module singleton that every
// store slice mutates; useOS() exposes it directly. `geo` is sparse — a per-window patch
// over the by-index defaults that geoMap merges in. `menu`/`dockMenu` hold the id of the
// open menu-bar / dock popover (null when closed); `split` is a [rightId, leftId] pair.
export interface OsState {
  windows: OsWindow[]
  geo: Record<string, Partial<Geo>>
  activeId: string | null
  menu: string | null
  split: [string, string] | null
  paletteOpen: boolean
  paletteQuery: string
  theme: Theme
  wallpaper: string | null
  toggles: Record<string, boolean>
  sidebarHidden: Record<string, boolean>
  // Per-user list-row left-click open-target (ADR-0018). 'inline' (default) opens in the same
  // window; 'new-window' mints a fresh app instance. Persisted like sidebarHidden.
  rowOpenTarget: RowOpenTarget
  // When true (default), a window reopens at the size/position it was last left at; when
  // false, it always opens at the standard small size. Persisted like rowOpenTarget.
  rememberWindowSize: boolean
  // Which screen edge the dock sits on, and whether it auto-hides (ADR-0022). Defaults match
  // the original behaviour: a bottom dock that slides away when a window nears it. Persisted
  // like rememberWindowSize. With autoHide off the dock stays pinned (macOS "keep in dock").
  dockPosition: DockPosition
  dockAutoHide: boolean
  dockMenu: string | null
  // True while the dock's right-click menu is open; keeps the dock revealed like dockMenu does.
  // Transient (never persisted), like the menu/palette overlay flags.
  dockContextOpen: boolean
  // Logged-in display name for the dashboard greeting. Not seeded yet (the shell
  // hardcodes a fallback), so it stays optional until boot wires the real user.
  userName?: string
}
