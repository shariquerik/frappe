// Window lifecycle and navigation: opening apps/lists/records, per-window back/forward
// history, focus/minimize/close, split view, settings panes, and appearance (theme,
// wallpaper, toggles). All geometry is delegated to geometry.js; all display config
// comes from config/*. This slice owns "what windows exist and what they show".
import { computed } from 'vue'
import { appForDoctype } from '@/registry'
import { bumpZ, geoMap, setGeo } from './geometry'
import { state } from './state'
import {
  dashboardSurface, listSurface, formSurface, settingsSurface, wallpaperSurface, appletSurface,
  initialSurface, sameSurface, isBuiltin, windowRole, surfaceAppId,
} from '@/surface'
import type { OsWindow, Surface, Theme, WallpaperDef } from '@/types'

// ---- surface helpers ---------------------------------------------------------
// Presence dots shown on a window. The real backend has no viewer source yet, so a form
// just shows "You"; lists and dashboards show nothing. (Phase 4 may add real presence.)
export function presenceFor(surface?: Surface | null): { label: string }[] {
  return isBuiltin(surface) && surface.view === 'form' ? [{ label: 'You' }] : []
}

// ---- per-window back/forward stacks ------------------------------------------
// Each app window owns its own nav history (authoritative; the chrome back button
// pops these). Browser back is deliberately NOT wired here — that mapping is
// incoherent across N simultaneous windows. Soft-capped to keep the blob small.
export const HIST_CAP = 50
function pushHist(w: OsWindow, next: Surface) {
  if (!w.back) w.back = []
  if (!w.fwd) w.fwd = []
  if (w.surface && !sameSurface(w.surface, next)) {
    w.back.push({ ...w.surface })
    if (w.back.length > HIST_CAP) w.back.shift()
    w.fwd = []
  }
}
export function winBack(id: string) {
  const w = state.windows.find((x) => x.id === id)
  if (!w || !w.back || !w.back.length) return
  w.fwd = w.fwd || []
  w.fwd.push({ ...w.surface })
  w.surface = w.back.pop()!
  const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id
}
export function winFwd(id: string) {
  const w = state.windows.find((x) => x.id === id)
  if (!w || !w.fwd || !w.fwd.length) return
  w.back = w.back || []
  w.back.push({ ...w.surface })
  w.surface = w.fwd.pop()!
  const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id
}

// ---- opening apps / lists / records ------------------------------------------
function ensureApp(appId: string, surface: Surface | null) {
  const id = 'app:' + appId
  const z = bumpZ()
  const exists = state.windows.some((w) => w.id === id)
  if (!exists) state.windows.push({ id, surface: surface || initialSurface(appId), back: [], fwd: [] })
  else if (surface) { const w = state.windows.find((x) => x.id === id)!; pushHist(w, surface); w.surface = surface }
  setGeo(id, { z, min: false })
  state.activeId = id
  state.menu = null
  state.paletteOpen = false
}
export const openApp = (appId: string) => ensureApp(appId, null)
export const openListGlobal = (dt: string) => ensureApp(appForDoctype(dt), listSurface(dt))
export const openRecordGlobal = (dt: string, name: string) => ensureApp(appForDoctype(dt), formSurface(dt, name))
// Open an applet contribution in its owning app window (ADR-0012 polymorphic host).
export const openApplet = (appId: string, appletId: string, props?: Record<string, unknown>) =>
  ensureApp(appId, appletSurface(appId, appletId, props))

// Open ANY surface in its owning app window — the generic primitive the OS API seam
// dispatches arbitrary surfaces through (the typed openers above are shorthands over
// the same `ensureApp`). Component surfaces resolve to their declared `appId`.
export const openSurface = (surface: Surface) => ensureApp(surfaceAppId(surface), surface)

function navFocus(winId: string, surface: Surface) {
  const z = bumpZ()
  const w = state.windows.find((x) => x.id === winId)
  if (w) { pushHist(w, surface); w.surface = surface }
  setGeo(winId, { z, min: false })
  state.activeId = winId
}
export const openList = (winId: string, dt: string) => navFocus(winId, listSurface(dt))
export const openRecordInline = (winId: string, dt: string, name: string) => navFocus(winId, formSurface(dt, name))
// A blank create form. `'new'` is the sentinel record name: the form renders empty
// and OSForm creates the doc on Save, then navigates to the real record.
export const openNew = (winId: string, dt: string) => navFocus(winId, formSurface(dt, 'new'))
export const goHome = (winId: string) => navFocus(winId, dashboardSurface(windowAppId(winId)))

// The app a window belongs to (read off its current surface; falls back to the id).
function windowAppId(winId: string): string {
  const w = state.windows.find((x) => x.id === winId)
  return (w && isBuiltin(w.surface) && w.surface.appId) || winId.replace(/^app:/, '')
}

export function popOut(dt: string, name: string) {
  const id = 'rec:' + dt + '/' + name
  const z = bumpZ()
  if (!state.windows.some((w) => w.id === id)) state.windows.push({ id, surface: formSurface(dt, name) })
  setGeo(id, { z, min: false })
  state.activeId = id
}

// ---- focus / minimize / close ------------------------------------------------
export const focusWin = (id: string) => { const z = bumpZ(); setGeo(id, { z }); state.activeId = id }
// Bring a specific window to the front from anywhere (e.g. the dock chooser):
// raise it, un-minimize, focus. The focusSig watcher mirrors it into the route.
export const activateWin = (id: string) => { const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id }

// Refocus an existing window and (for app windows) set its view, WITHOUT touching
// the per-window back/fwd stacks. Used by browser back/forward: those drive the
// global URL timeline, which is a separate history from each window's own nav.
// Returns false if the window no longer exists (caller respawns from the URL).
export function restoreWin(id: string, surface?: Surface): boolean {
  const w = state.windows.find((x) => x.id === id)
  if (!w) return false
  if (windowRole(id) === 'app' && surface) w.surface = surface
  const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id
  return true
}

export function closeWin(id: string) {
  state.windows = state.windows.filter((w) => w.id !== id)
  if (state.activeId === id) {
    // Fall back to the top-most still-visible window only; never un-minimize a
    // hidden one. If nothing visible remains, focus clears to the bare desktop
    // and the route settles on /os/ (the focusSig watcher mirrors activeId).
    let top: string | null = null, tz = -1
    state.windows.forEach((w) => {
      const g = geoMap.value[w.id] || {}
      if (g.min) return
      if ((g.z || 0) >= tz) { tz = g.z || 0; top = w.id }
    })
    state.activeId = top
    if (top) setGeo(top, { z: bumpZ() })
  }
  if (state.split && (state.split[0] === id || state.split[1] === id)) state.split = null
}

export function minimizeWin(id: string) {
  setGeo(id, { min: true })
  if (state.activeId !== id) return
  // Minimizing the active window hands focus to the top-most still-visible window
  // (the route mirrors the new activeId via focusSig); if nothing else is visible,
  // focus clears to the bare desktop.
  let top: string | null = null, tz = -1
  state.windows.forEach((w) => {
    if (w.id === id) return
    const g = geoMap.value[w.id] || {}
    if (g.min) return
    if ((g.z || 0) >= tz) { tz = g.z || 0; top = w.id }
  })
  state.activeId = top
  if (top) setGeo(top, { z: bumpZ() })
}

// Drop to the bare desktop: minimize EVERY visible window so nothing covers the
// desktop, and leave nothing focused. Used when the route settles on /os/ — the
// path means "no window in front", so revealing only the active one isn't enough
// when other windows sit behind it.
export function clearFocus() {
  state.windows.forEach((w) => {
    if (!(geoMap.value[w.id] || {}).min) setGeo(w.id, { min: true })
  })
  state.activeId = null
}
export const toggleZoom = (id: string) => { const g = geoMap.value[id] || {}; setGeo(id, { max: !g.max }) }
export const toggleSidebar = (id: string) => { state.sidebarHidden[id] = !state.sidebarHidden[id] }

// ---- settings panes ----------------------------------------------------------
// Settings is a standalone window (one per app), not an in-window overlay: a real
// macOS-style System Settings pane that can be moved, resized, minimized and
// stacked independently of the app it configures.
export function openSettings(appId: string, tab?: string) {
  const id = 'settings:' + appId
  const z = bumpZ()
  const w = state.windows.find((x) => x.id === id)
  if (!w) state.windows.push({ id, surface: settingsSurface(appId, tab) })
  else if (tab && isBuiltin(w.surface)) w.surface.params = { tab }
  setGeo(id, { z, min: false })
  state.activeId = id
  state.menu = null
}
export const closeSettings = (id: string) => closeWin(id)
export const setSettingsTab = (id: string, tab: string) => {
  const w = state.windows.find((x) => x.id === id)
  if (w && isBuiltin(w.surface)) w.surface.params = { tab }
}

// ---- split view --------------------------------------------------------------
export function enterSplit() {
  const apps = state.windows.filter((w) => !(geoMap.value[w.id] || {}).min)
  if (apps.length < 2) return
  const sorted = [...apps].sort((a, b) => ((geoMap.value[b.id] || {}).z || 0) - ((geoMap.value[a.id] || {}).z || 0))
  state.split = [sorted[1].id, sorted[0].id]
  state.menu = null
}
export const exitSplit = () => { state.split = null }

// ---- appearance (theme / wallpaper / toggles) --------------------------------
export const setTheme = (t: Theme) => { state.theme = t }

export function wallpaperDefs(): WallpaperDef[] {
  return [
    // The OS default ground: "Product Duotone" — ERPNext indigo → CRM teal. A
    // colored (not neutral) gradient; dark, so chrome reads white over it.
    { id: 'duotone', label: 'Duotone', bg: 'radial-gradient(150% 130% at 12% -10%, #5b54e6 0%, #2c3a9e 42%, #0f7d78 100%)', dark: true },
    { id: 'mist', label: 'Mist', bg: 'radial-gradient(140% 130% at 0% 0%, #f8fafc 0%, #eef1f5 46%, #e1e6ec 100%)', dark: false },
    { id: 'linen', label: 'Linen', bg: 'radial-gradient(140% 130% at 0% 0%, #faf7f3 0%, #f2ece4 50%, #e8ddd0 100%)', dark: false },
    { id: 'sky', label: 'Sky', bg: 'radial-gradient(130% 130% at 100% 0%, #ecf5fe 0%, #d6e8fb 54%, #bdd6f3 100%)', dark: false },
    { id: 'sage', label: 'Sage', bg: 'radial-gradient(130% 130% at 0% 100%, #eef6f0 0%, #d9e9dd 54%, #c6dccc 100%)', dark: false },
    { id: 'dusk', label: 'Dusk', bg: 'linear-gradient(155deg, #6c7fdb 0%, #5160ad 52%, #3c4884 100%)', dark: true },
    { id: 'frappe', label: 'Frappe', bg: 'linear-gradient(155deg, #38a6fb 0%, #0d8ef8 42%, #0a62b6 100%)', dark: true },
    { id: 'graphite', label: 'Graphite', bg: 'radial-gradient(140% 130% at 0% 0%, #34383e 0%, #25282d 54%, #191b1e 100%)', dark: true },
    { id: 'ink', label: 'Ink', bg: 'radial-gradient(130% 130% at 100% 0%, #2c3050 0%, #1d2032 58%, #14161f 100%)', dark: true },
  ]
}
export const currentWp = computed(() => {
  const id = state.wallpaper || 'duotone'
  const list = wallpaperDefs()
  return list.find((w) => w.id === id) || list[0]
})
export const setWallpaper = (id: string) => { state.wallpaper = id }
// The wallpaper picker is a singleton window (like a settings pane): open focuses the
// existing one or spawns it; close just removes it. Transient — never persisted.
export function openWallpaper() {
  const id = 'wallpaper'
  const z = bumpZ()
  if (!state.windows.find((x) => x.id === id)) state.windows.push({ id, surface: wallpaperSurface() })
  setGeo(id, { z, min: false })
  state.activeId = id
  state.menu = null
}
export const closeWallpaper = (id = 'wallpaper') => closeWin(id)

export const tog = (k: string, def: boolean) => { state.toggles[k] = !(state.toggles[k] == null ? def : state.toggles[k]) }
export const isOn = (k: string, def: boolean): boolean => { const v = state.toggles[k]; return v == null ? def : v }
