// The desktop window-manager's own state shapes: the one shared reactive `OsState`
// singleton every desktop slice (state/windows/geometry/palette/persistence) mutates.
// Re-exported via @/types. Theme is owned by frappe-ui's useTheme, not OsState.
import type { Ref } from 'vue'
import type { OsWindow, Geo, Surface } from '@/surface/types'

// Working state (ADR-0029): the work-in-progress a user builds over a Surface — a list's
// filters/sort/columns, a form's unsaved draft, an applet's internal blob — hoisted out of the
// surface components into the OS store so unmounting a cold window is lossless. Scoped per
// `(Window × subject)`; see `subjectKey` (surface/index.ts) and `desktop/working-state.ts`.

// Per-entry persistence policy: `durable` is also mirrored to localStorage (survives reload);
// `ephemeral` is memory-only (survives unmount, not reload). Not a per-kind table — each entry
// declares its own policy, so one window can hold a durable list snapshot beside an ephemeral
// form draft.
export type Persist = 'durable' | 'ephemeral'

// One window×subject slot. `value` is the JSON-serializable work-in-progress (list snapshot,
// form draft, applet blob). `dirty` is written by the mounted surface (a form's `isDirty`) and
// read after unmount by `dirtyWindows()` to arm the unsaved-changes guards — so it lives as data,
// not a live component getter that would go stale once the window unmounts.
export interface WorkingEntry {
  persist: Persist
  value: unknown
  dirty?: boolean
}

// The window context a mounted surface injects to reach its Working state (ADR-0029): the host
// window's id plus its live (reactive) current surface, from which `useWorkingState` derives the
// subject via `subjectKey`. Provided by OSWindow — the common ancestor of every surface body —
// like TOOLBAR_SLOT / WINDOW_FOCUSED. The surface is reactive so the bound entry follows in-window
// navigation that keeps the component mounted (record→record on one doctype, which DoctypeView
// does not remount).
export interface WorkingStateContext {
  winId: string
  surface: Ref<Surface>
}

// What a surface hands `useWorkingState`: the entry's persistence policy, and — for a guarded
// surface (a form) — a `dirty` getter mirrored into the entry as stored data, so the close/reload
// guards can read it after the surface unmounts (ADR-0029).
//
// `facet` namespaces a SECOND entry within one subject, so a list can hold its DURABLE snapshot
// (bare subject) beside an EPHEMERAL scroll/paging position (`facet: 'position'`) — each with its
// own persist policy, which a single entry cannot mix. Omitted = the subject's primary facet.
export interface WorkingStateOptions {
  persist: Persist
  dirty?: () => boolean
  facet?: string
}

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
  wallpaper: string | null
  toggles: Record<string, boolean>
  sidebarHidden: Record<string, boolean>
  // Working state (ADR-0029), keyed winId -> subjectKey -> entry. Sparse: a window gets a map
  // only once it accumulates work-in-progress; durable entries survive close (like `geo`).
  workingState: Record<string, Record<string, WorkingEntry>>
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
  // The window id awaiting an unsaved-changes close confirm (ADR-0029), or null when no confirm is
  // pending. Set by `requestCloseWin` when the window holds a dirty draft; the confirm dialog reads
  // it. Transient (never persisted), like the overlay flags.
  closeConfirm: string | null
  // Logged-in display name for the dashboard greeting. Not seeded yet (the shell
  // hardcodes a fallback), so it stays optional until boot wires the real user.
  userName?: string
}
