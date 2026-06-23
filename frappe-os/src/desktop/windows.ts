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
import type { OsWindow, RowOpenTarget, Surface, Theme, WallpaperDef } from '@/types'

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
// App window ids: the first ("canonical") instance owns the bare `app:<id>`; extras get
// `app:<id>#n` (n ≥ 2). Keeping the first on the plain id leaves its URL/deep-link/
// persistence behaviour unchanged; the suffix is still role 'app' and still groups under
// the app in the dock. `instance` ≥ 2 maps to a suffixed id; anything else is canonical.
const canonicalId = (appId: string) => 'app:' + appId
const instanceId = (appId: string, n?: number | null) =>
  n && n >= 2 ? canonicalId(appId) + '#' + n : canonicalId(appId)

// Open windows that are instances of an app, identified by id — NOT by current surface,
// since an instance navigated onto another app's doctype is still this app's window. The
// `#` guard stops `crm` matching `crm2`.
const appInstances = (appId: string) =>
  state.windows.filter((w) => w.id === canonicalId(appId) || w.id.startsWith(canonicalId(appId) + '#'))
// The instance to bring forward when re-opening an app: the focused one if it's already
// this app, else the top of the z-order.
const topInstance = (wins: OsWindow[]): OsWindow | undefined =>
  wins.slice().sort((a, b) => (geoMap.value[b.id]?.z || 0) - (geoMap.value[a.id]?.z || 0))[0]

// Create a window at an explicit id and focus it, sizing it per the user's preference.
function spawnWindow(id: string, appId: string, surface: Surface | null): OsWindow {
  const win: OsWindow = { id, surface: surface || initialSurface(appId), back: [], fwd: [] }
  state.windows.push(win)
  applyOpenSize(id, id !== canonicalId(appId))
  state.activeId = id
  state.menu = null
  state.paletteOpen = false
  return win
}

// Size a freshly-spawned window (ADR-0019). Windows always open small, with one twist:
// when `rememberWindowSize` is on (default), a canonical window keeps whatever geometry is
// already saved for its id — closing leaves state.geo[id] intact, so reopening reuses the
// last size/position (including a maximized one the user left it at); a never-opened app
// falls back to the small by-index default (defAppGeo). When remember is off, the saved size
// is dropped so it resets to the small default. Extras (#n) always reset to small so a fresh
// twin reads as visibly distinct from the window already on screen.
function applyOpenSize(id: string, isExtra: boolean): void {
  if (!state.rememberWindowSize || isExtra) delete state.geo[id]
  setGeo(id, { z: bumpZ(), min: false })
}

// Focus-or-create a window for an app, giving it `surface` if provided.
//  - `instance` set (from a `?instance=n` URL): target that EXACT id, respawning it if a
//    reload/deep-link lands on a closed instance — so a twin stays URL-addressable.
//  - `instance` omitted (app icon, plain deep-link): the bare path is the CANONICAL
//    instance's address, so focus the canonical when it exists; else fall back to any
//    surviving twin (so closing the canonical doesn't spawn a blank one on reload — the
//    #n scheme's wart); else mint the canonical. Canonical-first keeps `/os/<app>` stable:
//    a twin only owns the URL via its own `?instance=n`, never the bare path.
function ensureApp(appId: string, surface: Surface | null, instance?: number | null) {
  const open = appInstances(appId)
  const target = instance != null
    ? open.find((w) => w.id === instanceId(appId, instance))
    : open.find((w) => w.id === canonicalId(appId)) || topInstance(open)
  if (!target) return void spawnWindow(instance != null ? instanceId(appId, instance) : canonicalId(appId), appId, surface)
  if (surface) { pushHist(target, surface); target.surface = surface }
  const z = bumpZ(); setGeo(target.id, { z, min: false }); state.activeId = target.id
  state.menu = null
  state.paletteOpen = false
}
export const openApp = (appId: string, instance?: number | null) => ensureApp(appId, null, instance)

// The next free window id for an app: the canonical `app:<id>` if unused, else the lowest
// `app:<id>#n` (n ≥ 2) not already taken.
function freshAppWindowId(appId: string): string {
  if (!state.windows.some((w) => w.id === canonicalId(appId))) return canonicalId(appId)
  let n = 2
  while (state.windows.some((w) => w.id === instanceId(appId, n))) n += 1
  return instanceId(appId, n)
}

// Open a BRAND-NEW window for an app even when one is already open (File ▸ New window).
// Unlike openApp (focus-or-create), this always mints a fresh instance.
export const newAppWindow = (appId: string, surface?: Surface): OsWindow =>
  spawnWindow(freshAppWindowId(appId), appId, surface ?? null)

export const openListGlobal = (dt: string, instance?: number | null) => ensureApp(appForDoctype(dt), listSurface(dt), instance)
// `aspect` seeds the form's selected facet (ADR-0018) from a cold deep-link / reload; omitted = default.
export const openRecordGlobal = (dt: string, name: string, instance?: number | null, aspect?: string) =>
  ensureApp(appForDoctype(dt), formSurface(dt, name, aspect), instance)
// Open an applet contribution in its owning app window (ADR-0012 polymorphic host).
export const openApplet = (appId: string, appletId: string, props?: Record<string, unknown>, instance?: number | null) =>
  ensureApp(appId, appletSurface(appId, appletId, props), instance)

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
export const openRecordInline = (winId: string, dt: string, name: string, aspect?: string) => navFocus(winId, formSurface(dt, name, aspect))

// A plain left-click on a list row opens the record per the user's preference (ADR-0018):
// 'inline' re-uses the same window (swapping its sidebar to the Aspect rail); 'new-window'
// mints a fresh app instance already on that record's form (the ADR-0017 path). The
// right-click menu's explicit Open / Open in New Window bypass this and are always available.
export function openRow(winId: string, dt: string, name: string) {
  if (state.rowOpenTarget === 'new-window') newAppWindow(appForDoctype(dt), formSurface(dt, name))
  else openRecordInline(winId, dt, name)
}

// Select a form Aspect (ADR-0018) in a window: re-navigate the same record's form to the new
// Aspect coordinate. Goes through navFocus so it pushes the window's history and the focusSig
// watcher mirrors the trailing-segment URL — the Aspect is real, addressable navigation, not
// local UI state. No-op unless the window currently hosts that record's form.
export function openAspect(winId: string, aspect: string) {
  const w = state.windows.find((x) => x.id === winId)
  if (!w || !isBuiltin(w.surface) || w.surface.view !== 'form') return
  navFocus(winId, formSurface(w.surface.doctype!, w.surface.recordName!, aspect))
}
// A blank create form. `'new'` is the sentinel record name: the form renders empty
// and OSForm creates the doc on Save, then navigates to the real record.
export const openNew = (winId: string, dt: string) => navFocus(winId, formSurface(dt, 'new'))
export const goHome = (winId: string) => navFocus(winId, dashboardSurface(windowAppId(winId)))

// The app a window belongs to (read off its current surface; falls back to the id).
function windowAppId(winId: string): string {
  const w = state.windows.find((x) => x.id === winId)
  return (w && isBuiltin(w.surface) && w.surface.appId) || winId.replace(/^app:/, '').replace(/#\d+$/, '')
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

// The per-user list-row open-target preference (ADR-0018), persisted like sidebarHidden.
export const setRowOpenTarget = (t: RowOpenTarget) => { state.rowOpenTarget = t }

// Whether a window reopens at its last size/position (ADR-0019), persisted like
// rowOpenTarget. Off makes every window open at the standard small size.
export const setRememberWindowSize = (on: boolean) => { state.rememberWindowSize = on }

export const tog = (k: string, def: boolean) => { state.toggles[k] = !(state.toggles[k] == null ? def : state.toggles[k]) }
export const isOn = (k: string, def: boolean): boolean => { const v = state.toggles[k]; return v == null ? def : v }
