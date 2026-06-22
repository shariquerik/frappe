// Window geometry: per-window position/size/z-order plus the drag/resize pointer
// loop and the desktop/dock element refs. Geometry is kept separate from window
// identity — state.geo[id] is a sparse patch over a by-index default (geoMap merges
// them). topZ/drag/resize are deliberately non-reactive bookkeeping.
import { computed } from 'vue'
import { state } from './state'
import { windowRole } from '@/surface'
import type { Geo, OsWindow } from '@/types'

// Non-reactive pointer-loop bookkeeping: the window being dragged/resized and the
// pointer/geometry origin captured on press.
interface DragState { id: string; sx: number; sy: number; ox: number; oy: number }
interface ResizeState { id: string; sx: number; sy: number; ow: number; oh: number }

let topZ = 0
let drag: DragState | null = null
let resize: ResizeState | null = null
const deskRef: { el: HTMLElement | null; w: number; h: number } = { el: null, w: 1280, h: 800 }
const dockRef: { el: HTMLElement | null } = { el: null }

export const bumpZ = (): number => { topZ += 1; return topZ }
// Re-seed topZ above every restored window after hydrate, so the next focus wins.
export const syncTopZ = (windows: OsWindow[], geo: Record<string, Partial<Geo>>): void => {
  topZ = Math.max(0, ...windows.map((w) => (geo[w.id] || {}).z || 0))
}

const defAppGeo = (i: number): Geo => ({ x: 70 + (i % 5) * 36, y: 56 + (i % 5) * 30, w: 1080, h: 700, z: i + 1, min: false, max: true })
const defRecGeo = (i: number): Geo => ({ x: 220 + (i % 6) * 34, y: 110 + (i % 6) * 28, w: 760, h: 600, z: i + 1, min: false, max: false })
const defSettingsGeo = (i: number): Geo => ({ x: 200 + (i % 6) * 30, y: 92 + (i % 6) * 26, w: 720, h: 560, z: i + 1, min: false, max: false })
// A compact, roughly-centered gallery window (singleton, so the by-index offset never applies).
const defWallpaperGeo = (i: number): Geo => ({ x: 330, y: 150, w: 640, h: 470, z: i + 1, min: false, max: false })

// Effective geometry per window: default-by-index merged with any saved patch.
export const geoMap = computed<Record<string, Geo>>(() => {
  const map: Record<string, Geo> = {}
  state.windows.forEach((w, i) => {
    const role = windowRole(w.id)
    const base = role === 'app' ? defAppGeo(i) : role === 'settings' ? defSettingsGeo(i) : role === 'wallpaper' ? defWallpaperGeo(i) : defRecGeo(i)
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

export function startResize(id: string, e: PointerEvent): void {
  e.preventDefault(); e.stopPropagation()
  const g = geoMap.value[id] || {}
  resize = { id, sx: e.clientX, sy: e.clientY, ow: g.w || 760, oh: g.h || 600 }
  document.body.style.userSelect = 'none'
}

export function onPointerMove(e: PointerEvent): void {
  // auto-hide dock
  if (dockRef.el) {
    const dh = deskRef.h || (deskRef.el ? deskRef.el.clientHeight : 800)
    const show = state.windows.length === 0 || state.dockMenu || e.clientY > dh - 90
    dockRef.el.style.transform = show ? 'translateY(0)' : 'translateY(155%)'
  }
  if (drag) setGeo(drag.id, { x: Math.max(0, drag.ox + (e.clientX - drag.sx)), y: Math.max(34, drag.oy + (e.clientY - drag.sy)) })
  else if (resize) setGeo(resize.id, { w: Math.max(420, resize.ow + (e.clientX - resize.sx)), h: Math.max(300, resize.oh + (e.clientY - resize.sy)) })
}

export function onPointerUp(): void {
  if (drag || resize) { drag = null; resize = null; document.body.style.userSelect = '' }
}

export const setDeskEl = (el: HTMLElement | null): void => { if (el) { deskRef.el = el; deskRef.w = el.clientWidth; deskRef.h = el.clientHeight } }
export const setDockEl = (el: HTMLElement | null): void => { if (el) dockRef.el = el }
export { deskRef }
