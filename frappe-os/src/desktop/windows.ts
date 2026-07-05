// Window lifecycle and navigation: opening apps/lists/records, per-window back/forward
// history, focus/minimize/close, split view, settings panes, and appearance (theme,
// wallpaper, toggles). All geometry is delegated to geometry.js; all display config
// comes from config/*. This slice owns "what windows exist and what they show".
import { computed } from 'vue'
import { appForDoctype, soleWorkspace, workspaceForDoctype } from '@/registry'
import { recordRecent } from '@/recents'
import { useWallpapers, wallpaperSelection, setSelection } from '@/wallpapers'
import { bumpZ, geoMap, setGeo } from './geometry'
import { state } from './state'
import {
  dashboardSurface, listSurface, formSurface, appSettingsSurface, settingsSurface, finderSurface, appletSurface,
  initialSurface, workspaceBodySurface, sameSurface, isBuiltin, windowRole, surfaceAppId, subjectKey,
  placementSurface, isAppRef,
} from '@/surface'
import { pruneWindow, dropWindow, windowIsDirty } from './working-state'
import { clearSelection } from './selection'
import { clearFocusKind } from './focus-kind'
import type { DockPosition, OsWindow, RowOpenTarget, Surface, SurfaceRef, WallpaperDef } from '@/types'

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
// Swap what a window shows, dropping its now-stale row selection in the same move. EVERY surface
// change routes through here — in-window nav, per-window back/fwd, and the browser-history restore —
// so a selection made on one surface can never survive onto another and mislead a bulk verb into
// firing against the wrong doctype's records (ADR-0032). A caller that also prunes Working state
// does so AFTER this, since pruneWindow reads the freshly-set surface.
// Gated on a REAL surface change: restoreWin refocuses on browser back/forward and can be handed the
// surface the window already shows (two same-doctype instances differ only by `?instance=n`), so an
// unconditional clear would wipe a live selection on a pure refocus. mirrors pushHist's sameSurface skip.
function swapSurface(w: OsWindow, surface: Surface) {
  if (sameSurface(w.surface, surface)) return
  w.surface = surface
  clearSelection(w.id)
  clearFocusKind(w.id) // the focused widget belonged to the old surface (ADR-0038 lifecycle)
}
export function winBack(id: string) {
  const w = state.windows.find((x) => x.id === id)
  if (!w || !w.back || !w.back.length) return
  w.fwd = w.fwd || []
  w.fwd.push({ ...w.surface })
  swapSurface(w, w.back.pop()!)
  pruneWindow(id, reachableSubjects(w))
  const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id
}
export function winFwd(id: string) {
  const w = state.windows.find((x) => x.id === id)
  if (!w || !w.fwd || !w.fwd.length) return
  w.back = w.back || []
  w.back.push({ ...w.surface })
  swapSurface(w, w.fwd.pop()!)
  pruneWindow(id, reachableSubjects(w))
  const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id
}

// The Working-state subjects still reachable within a window: the current surface plus every one
// held in its bounded back/fwd history. `pruneWindow` drops ephemeral entries outside this set —
// a draft whose record the user can no longer navigate back to is gone for good (ADR-0029).
function reachableSubjects(w: OsWindow): string[] {
  return [w.surface, ...(w.back || []), ...(w.fwd || [])].map(subjectKey)
}

// Commit an in-window navigation: record history, swap the surface, then prune Working state to the
// surfaces still reachable. The single seam `ensureApp` and `navFocus` both go through, so every
// forward navigation (which clears `fwd`) reclaims the drafts it just made unreachable.
function navigateWindow(w: OsWindow, surface: Surface) {
  pushHist(w, surface)
  swapSurface(w, surface)
  pruneWindow(w.id, reachableSubjects(w))
}

// ---- opening apps / lists / records ------------------------------------------
// App window ids encode the `(app, workspace)` IDENTITY (ADR-0042). The base id is `app:<app>` for
// a plain app window (the hub / single-workspace case) or `app:<app>/<workspace>` for a workbench
// scoped to a workspace — so opening Selling then Stock in erpnext yields two distinct windows
// (`app:erpnext/selling`, `app:erpnext/stock`) side by side. The first ("canonical") instance of an
// identity owns its bare base id; extras get `#n` (n ≥ 2). The suffix is still role 'app' and still
// groups under the app in the dock (which reads surface.appId, not the id). `instance` ≥ 2 maps to a
// suffixed id; anything else is canonical.
const baseId = (appId: string, workspace?: string) => 'app:' + appId + (workspace ? '/' + workspace : '')
const instanceId = (appId: string, workspace: string | undefined, n?: number | null) =>
  n && n >= 2 ? baseId(appId, workspace) + '#' + n : baseId(appId, workspace)

// The workspace a to-be-opened window is scoped to (ADR-0042) — the single canonicalisation seam every
// focus-or-create open funnels through. An EXPLICIT workspace (a URL that named one, openWorkspace)
// always wins. Otherwise a doctype-bound surface (list/form) derives its doctype's canonical workspace,
// so a doctype lands on its workbench no matter the entry point — URL, desktop icon, Finder, palette,
// Dock (ADR-0042 retired the old URL-only asymmetry). A non-doctype surface (dashboard/applet/settings)
// or a doctype in no seeded workspace has none, so it opens the plain app window (unchanged).
function surfaceWorkspace(surface: Surface | null, explicit?: string): string | undefined {
  if (explicit) return explicit
  if (isBuiltin(surface) && (surface.view === 'list' || surface.view === 'form')) return workspaceForDoctype(surface.doctype!)
  return undefined
}

// Open windows that are instances of one `(app, workspace)` identity, matched by id — NOT by current
// surface, since an instance navigated onto another app's doctype is still this identity's window.
// The `#` guard stops `app:crm` matching `app:crm2`, and the base-id equality keeps a plain app
// window (`app:erpnext`) distinct from a workbench of the same app (`app:erpnext/selling`).
const identityInstances = (appId: string, workspace?: string) => {
  const base = baseId(appId, workspace)
  return state.windows.filter((w) => w.id === base || w.id.startsWith(base + '#'))
}
// The instance to bring forward when re-opening an app: the focused one if it's already
// this app, else the top of the z-order.
const topInstance = (wins: OsWindow[]): OsWindow | undefined =>
  wins.slice().sort((a, b) => (geoMap.value[b.id]?.z || 0) - (geoMap.value[a.id]?.z || 0))[0]

// Create a window at an explicit id and focus it, sizing it per the user's preference.
function spawnWindow(id: string, appId: string, surface: Surface | null): OsWindow {
  const win: OsWindow = { id, surface: surface || initialSurface(appId), back: [], fwd: [] }
  state.windows.push(win)
  applyOpenSize(id, /#\d+$/.test(id))
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
// instance reads as visibly distinct from the window already on screen.
function applyOpenSize(id: string, isExtra: boolean): void {
  if (!state.rememberWindowSize || isExtra) delete state.geo[id]
  setGeo(id, { z: bumpZ(), min: false })
}

// Focus-or-create a window for an app, giving it `surface` if provided.
//  - `instance` set (from a `?instance=n` URL): target that EXACT id, respawning it if a
//    reload/deep-link lands on a closed instance — so an instance stays URL-addressable.
//  - `instance` omitted (app icon, plain deep-link): the bare path is the CANONICAL
//    instance's address, so focus the canonical when it exists; else fall back to any
//    surviving instance (so closing the canonical doesn't spawn a blank one on reload — the
//    #n scheme's wart); else mint the canonical. Canonical-first keeps `/os/<app>` stable:
//    an instance only owns the URL via its own `?instance=n`, never the bare path.
function ensureApp(appId: string, surface: Surface | null, instance?: number | null, workspace?: string) {
  // Canonicalise the workspace once, up front (surfaceWorkspace): a doctype-bound surface with no
  // explicit workspace resolves to its workbench identity, so all the openers below key on the same id.
  workspace = surfaceWorkspace(surface, workspace)
  const open = identityInstances(appId, workspace)
  const base = baseId(appId, workspace)
  const target = instance != null
    ? open.find((w) => w.id === instanceId(appId, workspace, instance))
    : open.find((w) => w.id === base) || topInstance(open)
  if (!target) return void spawnWindow(instance != null ? instanceId(appId, workspace, instance) : base, appId, surface)
  if (surface) navigateWindow(target, surface)
  const z = bumpZ(); setGeo(target.id, { z, min: false }); state.activeId = target.id
  state.menu = null
  state.paletteOpen = false
}
// Opening an app (dock click, palette, a bare `/<app>` deep link). The body is the app's default
// surface — applet/dashboard/empty via initialSurface, resolved on spawn from the null surface so a
// re-open focuses without resetting content. A single-workspace app skips the hub and lands that
// surface on its one workbench identity (ADR-0042 "the app is the window"); a multi-workspace app
// opens the plain app window (the hub). The workspace lands on the window identity, so the
// URL/Context project it — the surface stays plain content. The workspace-level counterpart is
// openWorkspace, which opens a workbench BODY (never the app default), so an applet-default app's
// individual workspaces stay reachable as workbenches (tile menu, `/os/<app>/<workspace>` URL).
export const openApp = (appId: string, instance?: number | null) =>
  ensureApp(appId, null, instance, soleWorkspace(appId))

// The next free window id for an `(app, workspace)` identity: the canonical `app:<id>[/<ws>]` if
// unused, else the lowest `…#n` (n ≥ 2) not already taken.
function freshAppWindowId(appId: string, workspace?: string): string {
  if (!state.windows.some((w) => w.id === baseId(appId, workspace))) return baseId(appId, workspace)
  let n = 2
  while (state.windows.some((w) => w.id === instanceId(appId, workspace, n))) n += 1
  return instanceId(appId, workspace, n)
}

// Open a BRAND-NEW window for an app even when one is already open (File ▸ New window, "Open in New
// Window"). Unlike openApp (focus-or-create), this always mints a fresh instance — scoped to the
// surface's canonical workspace (surfaceWorkspace) so a record opens in a workbench instance, matching
// the focus-or-create openers; a bare app new-window (no surface) has none and stays a plain instance.
export const newAppWindow = (appId: string, surface?: Surface): OsWindow =>
  spawnWindow(freshAppWindowId(appId, surfaceWorkspace(surface ?? null)), appId, surface ?? null)

// `workspace` OVERRIDES the target WINDOW identity (ADR-0042) — a URL that named one, else undefined.
// When omitted, ensureApp derives the doctype's canonical workspace (surfaceWorkspace), so every entry
// point (URL, desktop icon, Finder, palette, Dock) lands the doctype on its workbench — one seam, no
// URL-only asymmetry. A doctype in no seeded workspace still opens the plain app window (unchanged).
export const openListGlobal = (dt: string, instance?: number | null, workspace?: string) =>
  ensureApp(appForDoctype(dt), listSurface(dt), instance, workspace)
// `aspect` seeds the form's selected facet (ADR-0018) from a cold deep-link / reload; omitted = default.
// A real record open is the one event that feeds Recents (ADR-0024) — both global and inline form
// openers note it (debounced server-side); list/app/dashboard opens deliberately do not.
export const openRecordGlobal = (dt: string, name: string, instance?: number | null, aspect?: string, workspace?: string) => {
  recordRecent(dt, name)
  return ensureApp(appForDoctype(dt), formSurface(dt, name, aspect), instance, workspace)
}
// Open an app's workspace window (ADR-0042): the `(app, workspace)` window a `/erpnext/selling` URL
// or a tile-menu "Open <workspace>" entry lands on. Its SIDEBAR is the workspace's derived doctypes
// (AppSidebar reads the workspace off the window id); its BODY opens on workspaceBodySurface — the
// dashboard for an app that has one, else the empty pane, so a dashboard-less workspace never lands
// on a dashboard it can't fill. The app's default-surface (e.g. raven's chat applet) is deliberately
// excluded there, so a workspace always shows a workbench, not a full-window applet. Focus-or-create
// per identity — reopening the same workspace focuses its window, a different one opens alongside.
export const openWorkspace = (appId: string, workspace: string) =>
  ensureApp(appId, workspaceBodySurface(appId), undefined, workspace)
// Open an applet-default app's WORKBENCH from its tile (ADR-0042) — the workspace hub (or its sole
// workbench) a normal app opens on click, for an app whose tile click opens a full-window applet
// instead (raven's chat). Same window identity as openApp (sole workspace, else the plain hub), but
// the BODY is workspaceBodySurface, so the applet default is skipped and the window is always a
// workbench/hub. The tile-menu "Open Workspaces" entry lands here.
export const openAppWorkbench = (appId: string) =>
  ensureApp(appId, workspaceBodySurface(appId), undefined, soleWorkspace(appId))
// Open an applet contribution in its owning app window (ADR-0012 polymorphic host).
export const openApplet = (appId: string, appletId: string, props?: Record<string, unknown>, instance?: number | null) =>
  ensureApp(appId, appletSurface(appId, appletId, props), instance)

// Open ANY surface in its owning app window — the generic primitive the OS API seam
// dispatches arbitrary surfaces through (the typed openers above are shorthands over
// the same `ensureApp`). Component surfaces resolve to their declared `appId`.
export const openSurface = (surface: Surface) => ensureApp(surfaceAppId(surface), surface)

// Open ANY surface reference the way a desktop or Finder tile does (ADR-0023/0024): a bare-app
// reference opens the app's default surface (like the dock icon), any other reference resolves to its
// Surface and opens in the owning app's window. The ONE open path a desktop double-click, a Finder
// tile click, and the tile context menu's "Open" all share — so those three never drift apart.
export const openRef = (ref: SurfaceRef) => {
  // Settings and a workspace both carry an `app` with no applet/doctype/dashboard, so isAppRef would
  // wrongly treat them as bare-app opens — route them FIRST. Neither is a navigable surface: Settings
  // is a singleton window (openSettings), a workspace is window identity + body (openWorkspace).
  if (ref.view === 'settings') return openSettings()
  if (ref.workspace && ref.app) return openWorkspace(ref.app, ref.workspace)
  if (isAppRef(ref)) return openApp(ref.app!)
  const surface = placementSurface(ref)
  if (surface) openSurface(surface)
}

// In-window navigation (sidebar click, Aspect switch, goHome, new form): swap the window's content
// while keeping its identity. No workspace threading (ADR-0042 retired the ADR-0040 carry-over rule):
// the workspace is the window's identity, fixed on its id, so a Selling sidebar click stays in the
// Selling window inherently — its URL keeps projecting `/erpnext/selling` because pathForFocus reads
// the workspace off the window id, not the surface.
function navFocus(winId: string, surface: Surface) {
  const z = bumpZ()
  const w = state.windows.find((x) => x.id === winId)
  if (w) navigateWindow(w, surface)
  setGeo(winId, { z, min: false })
  state.activeId = winId
}
export const openList = (winId: string, dt: string) => navFocus(winId, listSurface(dt))
export const openRecordInline = (winId: string, dt: string, name: string, aspect?: string) => {
  recordRecent(dt, name)
  navFocus(winId, formSurface(dt, name, aspect))
}

// A plain left-click on a list row opens the record per the user's preference (ADR-0018):
// 'inline' re-uses the same window (swapping its sidebar to the Aspect rail); 'new-window'
// mints a fresh app instance already on that record's form (the ADR-0017 path). The
// right-click menu's explicit Open / Open in New Window bypass this and are always available.
export function openRow(winId: string, dt: string, name: string) {
  if (state.rowOpenTarget === 'new-window') openRecordNewWindow(dt, name)
  else openRecordInline(winId, dt, name)
}

// Open a record in a BRAND-NEW app window (the ADR-0017 path). Like the focus-or-create openers it
// is a real record open, so it feeds Recents (ADR-0024) — the shared seam both the 'new-window' row
// preference and the explicit "Open in New Window" menu action funnel through, so neither bypasses
// the recent-on-open write.
export const openRecordNewWindow = (dt: string, name: string): OsWindow => {
  recordRecent(dt, name)
  return newAppWindow(appForDoctype(dt), formSurface(dt, name))
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

// The app a window belongs to (read off its current surface; falls back to parsing the id). The id
// fallback strips the role prefix, the `#n` instance suffix, and the `/<workspace>` identity segment
// (ADR-0042) so a workbench id `app:erpnext/selling` still resolves to `erpnext`.
function windowAppId(winId: string): string {
  const w = state.windows.find((x) => x.id === winId)
  return (w && isBuiltin(w.surface) && w.surface.appId) || winId.replace(/^app:/, '').replace(/#\d+$/, '').replace(/\/.*$/, '')
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
  if (windowRole(id) === 'app' && surface) swapSurface(w, surface)
  const z = bumpZ(); setGeo(id, { z, min: false }); state.activeId = id
  return true
}

// Ask to close a window, guarding unsaved work: a window holding a dirty ephemeral draft (ADR-0029)
// raises the in-app confirm (via `state.closeConfirm`, rendered by CloseConfirmDialog) instead of
// closing; a clean window closes straight away. The user-facing close gestures (traffic light,
// ⌘W) funnel through here; `closeWin` remains the unconditional close the confirm resolves to.
export function requestCloseWin(id: string) {
  if (windowIsDirty(id)) state.closeConfirm = id
  else closeWin(id)
}
// Resolve a pending confirm: discard the draft and close, or cancel and keep the window.
export function confirmCloseWin() {
  const id = state.closeConfirm
  state.closeConfirm = null
  if (id) closeWin(id)
}
export const cancelCloseWin = () => { state.closeConfirm = null }

export function closeWin(id: string) {
  // Ephemeral Working state dies with the window; durable survives (a reopened window reuses its id
  // and its durable slab), mirroring how the geometry below is deliberately kept.
  dropWindow(id)
  clearSelection(id)
  clearFocusKind(id) // the focus tier dies with the window (ADR-0038)
  if (state.closeConfirm === id) state.closeConfirm = null
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

// ---- app-settings panes ------------------------------------------------------
// An app's settings is a standalone window (one per app), not an in-window overlay: a real
// macOS-style pane that can be moved, resized, minimized and stacked independently of the app
// it configures. Distinct from the singleton per-user Settings window below.
export function openAppSettings(appId: string, pane = 'General') {
  const id = 'app-settings:' + appId
  const z = bumpZ()
  const w = state.windows.find((x) => x.id === id)
  if (!w) state.windows.push({ id, surface: appSettingsSurface(appId, pane) })
  else if (isBuiltin(w.surface)) w.surface.params = { pane }
  setGeo(id, { z, min: false })
  state.activeId = id
  state.menu = null
}
export const closeAppSettings = (id: string) => closeWin(id)
export const setAppSettingsPane = (id: string, pane: string) => {
  const w = state.windows.find((x) => x.id === id)
  if (w && isBuiltin(w.surface)) w.surface.params = { pane }
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

// ---- appearance (wallpaper / toggles) ----------------------------------------
// Theme lives in frappe-ui's useTheme (light/dark/system), not here. The wallpaper catalog + the
// per-user selection are the server-backed src/wallpapers/ seam (ADR-0036); these thin wrappers keep
// the useOS() surface stable (wallpaperDefs / currentWp / setWallpaper) for the desktop and picker.
export function wallpaperDefs(): WallpaperDef[] {
  return useWallpapers()
}
// The wallpaper the desktop draws: the user's selected row, else the default global, else the first —
// never undefined (App.vue renders its bg/image unconditionally). Reactive over the seam store.
export const currentWp = computed(() => {
  const list = wallpaperDefs()
  const id = wallpaperSelection()
  return list.find((w) => w.id === id) || list.find((w) => w.isDefault) || list[0]
})
export const setWallpaper = (id: string) => setSelection(id)
// Settings is the per-user singleton window holding the user's Account plus the desktop-wide
// preferences (General/window behavior, Appearance/theme, Wallpaper, Dock): open focuses the
// existing one or spawns it, re-targeting its `pane`; close just removes it. Transient —
// never persisted. (Renamed from "System Settings", ADR-0027.)
export function openSettings(pane = 'General') {
  const id = 'settings'
  const z = bumpZ()
  const w = state.windows.find((x) => x.id === id)
  if (!w) state.windows.push({ id, surface: settingsSurface(pane) })
  else if (isBuiltin(w.surface)) w.surface.params = { pane }
  setGeo(id, { z, min: false })
  state.activeId = id
  state.menu = null
}
export const closeSettings = (id = 'settings') => closeWin(id)
// Switch the open Settings window to a different pane (left-nav click).
export function setSettingsPane(pane: string) {
  const w = state.windows.find((x) => x.id === 'settings')
  if (w && isBuiltin(w.surface)) w.surface.params = { pane }
}

// ---- Finder (ADR-0024) -------------------------------------------------------
// The Finder is a singleton `system`-role window like Settings (respawned-from-URL,
// never persisted): open focuses the existing one or spawns it, re-targeting its sidebar
// `location`; close just removes it. The dock launcher button opens it.
export function openFinder(location = 'Applications') {
  const id = 'finder'
  const z = bumpZ()
  const w = state.windows.find((x) => x.id === id)
  if (!w) state.windows.push({ id, surface: finderSurface(location) })
  else if (isBuiltin(w.surface)) w.surface.params = { location }
  setGeo(id, { z, min: false })
  state.activeId = id
  state.menu = null
  state.paletteOpen = false
}
export const closeFinder = (id = 'finder') => closeWin(id)
// Switch the open Finder window to a different sidebar Location (left-nav click).
export function setFinderLocation(location: string) {
  const w = state.windows.find((x) => x.id === 'finder')
  if (w && isBuiltin(w.surface)) w.surface.params = { location }
}

// The per-user list-row open-target preference (ADR-0018), persisted like sidebarHidden.
export const setRowOpenTarget = (t: RowOpenTarget) => { state.rowOpenTarget = t }

// Whether a window reopens at its last size/position (ADR-0019), persisted like
// rowOpenTarget. Off makes every window open at the standard small size.
export const setRememberWindowSize = (on: boolean) => { state.rememberWindowSize = on }

// Dock placement and reveal behaviour (ADR-0022), persisted like rememberWindowSize. Position
// is one of bottom/left/right; auto-hide off pins the dock so it never slides away.
export const setDockPosition = (p: DockPosition) => { state.dockPosition = p }
export const setDockAutoHide = (on: boolean) => { state.dockAutoHide = on }

export const tog = (k: string, def: boolean) => { state.toggles[k] = !(state.toggles[k] == null ? def : state.toggles[k]) }
export const isOn = (k: string, def: boolean): boolean => { const v = state.toggles[k]; return v == null ? def : v }
