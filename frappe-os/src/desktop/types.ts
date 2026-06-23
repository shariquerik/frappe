// The desktop window-manager's own state shapes: the theme and the one shared reactive
// `OsState` singleton every desktop slice (state/windows/geometry/palette/persistence)
// mutates. Re-exported via @/types.
import type { OsWindow, Geo } from '@/surface/types'

export type Theme = 'light' | 'dark'

// Where a plain left-click on a list row opens the record (ADR-0018 update to ADR-0017): in
// the SAME window (default — swaps that window's sidebar to the Aspect rail) or a NEW app
// instance. A per-user preference; the right-click menu always offers both regardless.
export type RowOpenTarget = 'inline' | 'new-window'

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
  dockMenu: string | null
  // Logged-in display name for the dashboard greeting. Not seeded yet (the shell
  // hardcodes a fallback), so it stays optional until boot wires the real user.
  userName?: string
}
