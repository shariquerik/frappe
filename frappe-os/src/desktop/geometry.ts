// Window geometry: per-window position/size/z-order plus the drag/resize pointer
// loop and the desktop/dock element refs. Geometry is kept separate from window
// identity — state.geo[id] is a sparse patch over a by-index default (geoMap merges
// them). topZ/drag/resize are deliberately non-reactive bookkeeping.
import { computed } from 'vue'
import { state } from './state'
import { shouldShowDock } from './dock-visibility'
import { windowRole } from '@/surface'
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
const deskRef: { el: HTMLElement | null; w: number; h: number } = { el: null, w: 1280, h: 800 }
const dockRef: { el: HTMLElement | null } = { el: null }
let dockShown = true // last applied dock visibility; feeds the hysteresis

export const bumpZ = (): number => { topZ += 1; return topZ }
// Re-seed topZ above every restored window after hydrate, so the next focus wins.
export const syncTopZ = (windows: OsWindow[], geo: Record<string, Partial<Geo>>): void => {
  topZ = Math.max(0, ...windows.map((w) => (geo[w.id] || {}).z || 0))
}

const defAppGeo = (i: number): Geo => ({ x: 70 + (i % 5) * 36, y: 56 + (i % 5) * 30, w: 1080, h: 700, z: i + 1, min: false, max: true })
const defSettingsGeo = (i: number): Geo => ({ x: 200 + (i % 6) * 30, y: 92 + (i % 6) * 26, w: 720, h: 560, z: i + 1, min: false, max: false })
// A compact, roughly-centered gallery window (singleton, so the by-index offset never applies).
const defWallpaperGeo = (i: number): Geo => ({ x: 330, y: 150, w: 640, h: 470, z: i + 1, min: false, max: false })

// Effective geometry per window: default-by-index merged with any saved patch.
export const geoMap = computed<Record<string, Geo>>(() => {
  const map: Record<string, Geo> = {}
  state.windows.forEach((w, i) => {
    const role = windowRole(w.id)
    const base = role === 'app' ? defAppGeo(i) : role === 'settings' ? defSettingsGeo(i) : defWallpaperGeo(i)
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
    const dh = deskRef.h || (deskRef.el ? deskRef.el.clientHeight : 800)
    dockShown = shouldShowDock({
      windowCount: state.windows.length,
      dockMenu: state.dockMenu,
      gestureActive: !!(drag || resize),
      clientY: e.clientY,
      deskH: dh,
      currentlyShown: dockShown,
    })
    dockRef.el.style.transform = dockShown ? 'translateY(0)' : 'translateY(155%)'
  }
  if (drag) setGeo(drag.id, { x: Math.max(0, drag.ox + (e.clientX - drag.sx)), y: Math.max(34, drag.oy + (e.clientY - drag.sy)) })
  else if (resize) setGeo(resize.id, resizePatch(resize, e))
}

export function onPointerUp(): void {
  if (drag || resize) { drag = null; resize = null; document.body.style.userSelect = '' }
}

export const setDeskEl = (el: HTMLElement | null): void => { if (el) { deskRef.el = el; deskRef.w = el.clientWidth; deskRef.h = el.clientHeight } }
export const setDockEl = (el: HTMLElement | null): void => { if (el) dockRef.el = el }
export { deskRef }
