// Window geometry: per-window position/size/z-order plus the drag/resize pointer
// loop and the desktop/dock element refs. Geometry is kept separate from window
// identity — state.geo[id] is a sparse patch over a by-index default (geoMap merges
// them). topZ/drag/resize are deliberately non-reactive bookkeeping.
import { computed, reactive } from 'vue'
import { state } from './state'
import { shouldShowDock } from './dock-visibility'
import { windowRole } from '@/surface'
import { resolveDrop, layoutDesktop, type Cell } from './grid'
import { usePlacements } from '@/placements'
import type { Geo, OsWindow } from '@/types'

// Non-reactive pointer-loop bookkeeping: the window being dragged/resized and the
// pointer/geometry origin captured on press. A resize tracks its edge mask `dir`
// (any of n/s/e/w) so the same loop serves all 8 corners and edges.
export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
interface DragState { id: string; sx: number; sy: number; ox: number; oy: number }
interface ResizeState { id: string; dir: ResizeDir; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }

const MIN_W = 420, MIN_H = 300, TOP_BOUND = 34

let topZ = 0
let drag: DragState | null = null
let resize: ResizeState | null = null

// Desktop-icon drag is its own gesture: a pointer press on an icon, a live pixel offset while
// moving (so the icon follows the cursor without yet committing a cell), and on release a snap to
// a grid cell that the consumer persists as a User-layer override. `key` is the pin's placementKey;
// `occupied` is every OTHER pin's current cell, so the drop can flow off a collision deterministically.
interface IconDragState { key: string; sx: number; sy: number; ox: number; oy: number; occupied: Cell[]; commit: (cell: Cell, moved: boolean) => void }
let iconDrag: IconDragState | null = null
// The live drag offset, reactive so the rendered icon follows the cursor; null when not dragging.
export const iconDragState = reactive<{ key: string | null; dx: number; dy: number }>({ key: null, dx: 0, dy: 0 })
// The floating OS-level drag ghost: the presentation of a tile being dragged OUT (a Finder drag-out,
// #04) that has no on-desktop element of its own to follow the cursor — unlike a desktop-icon MOVE,
// which lifts its own rendered tile and needs no ghost. `view` is null except during such a create-
// drag; `x/y` are live client coordinates so App.vue can paint the ghost right under the pointer.
export interface DragGhostView { label: string; logo?: string; icon?: string }
export const dragGhost = reactive<{ view: DragGhostView | null; x: number; y: number }>({ view: null, x: 0, y: 0 })
// Reactive so the desktop size is a single source: the cell→pixel projection, the live drag clamp,
// AND the drop-snap on release all read it, and re-run when the viewport resizes (syncDesktopSize).
const desktopRef = reactive<{ el: HTMLElement | null; w: number; h: number }>({ el: null, w: 1280, h: 800 })
const dockRef: { el: HTMLElement | null } = { el: null }
let dockShown = true // last applied dock visibility; feeds the hysteresis

export const bumpZ = (): number => { topZ += 1; return topZ }
// Re-seed topZ above every restored window after hydrate, so the next focus wins.
export const syncTopZ = (windows: OsWindow[], geo: Record<string, Partial<Geo>>): void => {
  topZ = Math.max(0, ...windows.map((w) => (geo[w.id] || {}).z || 0))
}

// App windows open as a small floating window by default (max:false). The user's
// windowOpenMode preference can override this per-open (see applyOpenMode in windows.ts).
const defAppGeo = (i: number): Geo => ({ x: 70 + (i % 5) * 36, y: 56 + (i % 5) * 30, w: 1080, h: 700, z: i + 1, min: false, max: false })
const defSettingsGeo = (i: number): Geo => ({ x: 200 + (i % 6) * 30, y: 92 + (i % 6) * 26, w: 720, h: 560, z: i + 1, min: false, max: false })
// A roughly-centered two-pane Settings window (singleton, so the by-index offset never applies).
const defSystemGeo = (i: number): Geo => ({ x: 290, y: 110, w: 780, h: 540, z: i + 1, min: false, max: false })
// The Finder (ADR-0024) is a wider two-pane navigator (Locations sidebar + a tile grid), so it
// opens larger than Settings; also a singleton, so the by-index offset never applies.
const defFinderGeo = (i: number): Geo => ({ x: 230, y: 96, w: 880, h: 580, z: i + 1, min: false, max: false })

// Effective geometry per window: default-by-index merged with any saved patch.
export const geoMap = computed<Record<string, Geo>>(() => {
  const map: Record<string, Geo> = {}
  state.windows.forEach((w, i) => {
    const role = windowRole(w.id)
    const base = role === 'app' ? defAppGeo(i)
      : role === 'settings' ? defSettingsGeo(i)
      : w.id === 'finder' ? defFinderGeo(i) : defSystemGeo(i)
    map[w.id] = Object.assign(base, state.geo[w.id] || {})
  })
  return map
})

export function setGeo(id: string, patch: Partial<Geo>): void {
  state.geo[id] = Object.assign({}, geoMap.value[id], state.geo[id], patch)
}

export function startDrag(id: string, e: PointerEvent): void {
  if (e.button != null && e.button !== 0) return
  const g = geoMap.value[id] || {}
  if (g.max || (state.split && (state.split[0] === id || state.split[1] === id))) return
  e.preventDefault()
  drag = { id, sx: e.clientX, sy: e.clientY, ox: g.x || 0, oy: g.y || 0 }
  document.body.style.userSelect = 'none'
}

export function startResize(id: string, dir: ResizeDir, e: PointerEvent): void {
  e.preventDefault(); e.stopPropagation()
  const g = geoMap.value[id] || {}
  resize = { id, dir, sx: e.clientX, sy: e.clientY, ox: g.x || 0, oy: g.y || 0, ow: g.w || 760, oh: g.h || 600 }
  document.body.style.userSelect = 'none'
}

// Begin dragging a desktop icon. `ox/oy` are the icon's current top-left in desktop-local pixels
// (its pre-drag cell projected), so the drop pixel is origin + pointer delta. `commit` is called
// once on release with the resolved cell — the consumer turns it into a User-layer override write.
// `ghost` is passed ONLY by a create-drag (a Finder drag-out) whose tile isn't rendered on the
// desktop, so it needs a floating ghost to follow the cursor; a desktop-icon move omits it and lifts
// its own tile instead.
export function startIconDrag(
  key: string, ox: number, oy: number, occupied: Cell[], commit: (cell: Cell, moved: boolean) => void, e: PointerEvent,
  ghost?: DragGhostView,
): void {
  if (e.button != null && e.button !== 0) return
  e.preventDefault()
  iconDrag = { key, sx: e.clientX, sy: e.clientY, ox, oy, occupied, commit }
  iconDragState.key = key
  iconDragState.dx = 0
  iconDragState.dy = 0
  dragGhost.view = ghost ?? null
  dragGhost.x = e.clientX
  dragGhost.y = e.clientY
  document.body.style.userSelect = 'none'
}

// The active edges decide which of x/y/w/h move. East/south grow from the fixed
// top-left; west/north move the edge, so they shift the origin too. Each axis is
// clamped to the minimum size and the desktop bounds (left ≥ 0, top ≥ TOP_BOUND).
function resizePatch(r: ResizeState, e: PointerEvent): Partial<Geo> {
  const patch: Partial<Geo> = {}
  if (r.dir.includes('e')) patch.w = Math.max(MIN_W, r.ow + (e.clientX - r.sx))
  if (r.dir.includes('s')) patch.h = Math.max(MIN_H, r.oh + (e.clientY - r.sy))
  if (r.dir.includes('w')) {
    const dx = Math.max(Math.min(e.clientX - r.sx, r.ow - MIN_W), -r.ox)
    patch.x = r.ox + dx; patch.w = r.ow - dx
  }
  if (r.dir.includes('n')) {
    const dy = Math.max(Math.min(e.clientY - r.sy, r.oh - MIN_H), TOP_BOUND - r.oy)
    patch.y = r.oy + dy; patch.h = r.oh - dy
  }
  return patch
}

export function onPointerMove(e: PointerEvent): void {
  // auto-hide dock
  if (dockRef.el) {
    const dw = desktopRef.w || (desktopRef.el ? desktopRef.el.clientWidth : 1280)
    const dh = desktopRef.h || (desktopRef.el ? desktopRef.el.clientHeight : 800)
    const pos = state.dockPosition
    // Distance from the dock's own screen edge along its perpendicular axis (ADR-0022).
    const distFromEdge = pos === 'left' ? e.clientX : pos === 'right' ? dw - e.clientX : dh - e.clientY
    // A fullscreen window (the active window maximized, or split view) hides the dock even when
    // it's pinned — matching macOS, where a fullscreen Space auto-hides the Dock (ADR-0022).
    const fullscreen = !!state.split || !!(state.activeId && geoMap.value[state.activeId]?.max)
    dockShown = shouldShowDock({
      windowCount: state.windows.length,
      menuOpen: !!state.dockMenu || state.dockContextOpen,
      gestureActive: !!(drag || resize),
      autoHide: state.dockAutoHide || fullscreen,
      distFromEdge,
      currentlyShown: dockShown,
    })
    // Slide the dock off its own edge when hidden; the outer wrapper owns the centering transform.
    const hidden = pos === 'left' ? 'translateX(-155%)' : pos === 'right' ? 'translateX(155%)' : 'translateY(155%)'
    dockRef.el.style.transform = dockShown ? '' : hidden
  }
  if (drag) setGeo(drag.id, { x: Math.max(0, drag.ox + (e.clientX - drag.sx)), y: Math.max(34, drag.oy + (e.clientY - drag.sy)) })
  else if (resize) setGeo(resize.id, resizePatch(resize, e))
  else if (iconDrag) {
    iconDragState.dx = e.clientX - iconDrag.sx; iconDragState.dy = e.clientY - iconDrag.sy
    if (dragGhost.view) { dragGhost.x = e.clientX; dragGhost.y = e.clientY }
  }
}

export function onPointerUp(): void {
  if (drag || resize) { drag = null; resize = null; document.body.style.userSelect = '' }
  if (iconDrag) {
    // The drop pixel is the icon's pre-drag top-left plus the pointer delta; snap it to a cell,
    // flowing off any other pin's cell, then hand the cell to the consumer to persist.
    const dropX = iconDrag.ox + iconDragState.dx
    const dropY = iconDrag.oy + iconDragState.dy
    const cell = resolveDrop({ x: dropX, y: dropY }, iconDrag.occupied, desktopRef.w, desktopRef.h)
    // A press that barely moved is a click, not a move — let the consumer open instead of writing.
    const moved = Math.abs(iconDragState.dx) > 4 || Math.abs(iconDragState.dy) > 4
    iconDrag.commit(cell, moved)
    iconDrag = null
    iconDragState.key = null
    iconDragState.dx = 0
    iconDragState.dy = 0
    dragGhost.view = null
    dragGhost.x = 0
    dragGhost.y = 0
    document.body.style.userSelect = ''
  }
}

// Every desktop pin's currently-resolved grid cell — the occupancy a fresh drop (an icon move or a
// Finder drag-out, ADR-0024) must flow off so two pins never stack. Reuses layoutDesktop, the same
// resolved-list→cells projection the desktop render uses, against the live desktop height.
export function occupiedDesktopCells(): Cell[] {
  return layoutDesktop(usePlacements().desktop(), desktopRef.h)
}

export const setDesktopEl = (el: HTMLElement | null): void => { if (el) { desktopRef.el = el; desktopRef.w = el.clientWidth; desktopRef.h = el.clientHeight } }
// Refresh the cached desktop size from the live element — called on mount and on window resize so
// every consumer (render, drag clamp, drop-snap) stays on one up-to-date source.
export const syncDesktopSize = (): void => { if (desktopRef.el) { desktopRef.w = desktopRef.el.clientWidth; desktopRef.h = desktopRef.el.clientHeight } }
export const setDockEl = (el: HTMLElement | null): void => { if (el) dockRef.el = el }
export { desktopRef }
