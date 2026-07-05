import { createApp, watch, nextTick } from 'vue'
import type { LocationQuery, RouteLocationNormalized, RouteParamsGeneric } from 'vue-router'
// index.css imports frappe-ui/style.css then runs Tailwind's directives against THIS
// project's content globs — without it only frappe-ui's prebuilt utilities exist and
// app-specific classes silently no-op.
import './index.css'
import App from './App.vue'
import { useOS } from '@/desktop'
import { faviconHref, applyFavicon } from '@/desktop/favicon'
import { getBoot, isRealUser, initOsApi } from '@/data'
import { ApiError } from '@/data/api'
import { redirectToLogin } from '@/data/session'
import { setOnSessionExpired } from '@/data/session-expiry'
import { initRegistry } from '@/registry'
import { initPlacements } from '@/placements'
import { initRecents } from '@/recents'
import { initWallpapers } from '@/wallpapers'
import { initAppearance } from '@/appearance'
import { router, pathForFocus, focusSig, applyRoute, parseSegments, INSTANCE_KEY } from '@/routing'
import { formSurface, listSurface, dashboardSurface, appletSurface, isAspectId, paneForSlug, SETTINGS_PANES, APP_SETTINGS_PANES } from '@/surface'
import type { RouteParams, Surface } from '@/types'

const os = useOS()

// The router's `:segments*` capture is a decoded string[] (a single string for one segment, or
// undefined/'' for the bare desktop); normalize to a clean array so parseSegments can reshape it
// into the { app, workspace, doctype, name, aspect } coordinate (workspace-vs-doctype resolved by
// lookup, ADR-0040). `instance` parses the reserved `?instance=n` query (junk → null = canonical).
function routeParams(loc: { params: RouteParamsGeneric; query: LocationQuery }): RouteParams {
  const one = (v: string | (string | null)[] | undefined | null) => (Array.isArray(v) ? v[0] : v) || undefined
  const segments = (Array.isArray(loc.params.segments) ? loc.params.segments : [loc.params.segments]).filter(Boolean) as string[]
  const raw = one(loc.query[INSTANCE_KEY])
  const instance = raw ? Number.parseInt(raw, 10) : NaN
  return { ...parseSegments(os, segments), instance: Number.isInteger(instance) ? instance : null }
}

// Resolve an uncurated-but-real doctype segment into the registry BEFORE routing, so a cold deep
// link to ANY DocType (not just the curated boot set) opens its list. Skips the settings/applet
// tails (not doctypes) and a doctype already known. A missing doctype leaves the index untouched —
// applyRoute then falls through to the app's default window, and a doctype owned by another app
// opens under that app (openListGlobal derives the app from the resolved owner, not the URL).
async function ensureRouteDoctype(params: RouteParams): Promise<void> {
  const dt = params.doctype
  if (!dt || dt === 'settings' || os.knownApplet(params.app || '', dt)) return
  await os.ensureDoctype(dt)
}

// ---- Frappe interop: /app/... -> /os/... -------------------------------------
// frappe.set_route / notifications / share links all emit `/app/:doctype/:name`.
// Translate such an entry URL into the OS scheme (doctype -> appForDoctype) before
// the router parses it, so an incoming Frappe link spawns the right OS window.
;(function translateAppLink() {
  const p = window.location.pathname
  if (!p.startsWith('/app/')) return
  const [dt, name] = p.slice(5).split('/').filter(Boolean).map(decodeURIComponent)
  if (!dt) return
  const seg = encodeURIComponent
  const path = '/os/' + [os.appForDoctype(dt), seg(dt), name && seg(name)].filter(Boolean).join('/')
  window.history.replaceState(null, '', path + window.location.search + window.location.hash)
})()

// ---- store <-> history bridge: a GLOBAL navigation timeline -------------------
// The URL is a linear timeline over the whole desktop. Every navigation OR focus-
// switch pushState's one entry whose state carries the focused window id; the path
// mirrors that window's view. Browser back/forward pops an entry and RESTORES that
// (window, view) snapshot — re-focusing the right window, respawning it if it was
// closed. (Per-window chrome back is a separate, in-window history.)
//
// `programmatic` marks our own push/replace so afterEach doesn't treat them as a
// user pop. `restoring` suppresses the focus->push watcher while a pop is being
// applied, so restoring focus doesn't itself push a new entry (which would corrupt
// the timeline). Both guards are essential to break the push<->restore feedback loop.
let programmatic = false
let restoring = false

// pathForFocus / focusSig / applyRoute live in route-map.js (pure, unit-tested).
// Bind them to this module's `os` so the call sites below stay terse.
const navState = () => ({ osWin: os.state.activeId || null })

// Push a new timeline entry for the current focus. Skip when the path is unchanged
// (vue-router treats a same-path push as a no-op and wouldn't fire afterEach, which
// would leave `programmatic` stuck true and swallow the next real navigation).
function pushFocus() {
  const loc = pathForFocus(os)
  // Compare resolved fullPaths so the reserved `?instance=n` query counts: two app
  // instances on the same surface share a path but differ by query, and we DO want a
  // timeline entry for that focus switch (so browser back/forward toggles them).
  if (router.currentRoute.value.fullPath === router.resolve(loc).fullPath) return
  programmatic = true
  router.push({ path: loc.path, query: loc.query, state: navState() })
}

// Browser back/forward: restore the (window, view) the popped entry encodes. The
// window id comes from history state (it disambiguates two app instances sharing a
// surface, which share a path but differ by `?instance=n`). If that window is still
// open, just refocus + restore its view; if it was closed, respawn it from the path.
function restoreFromHistory(to: RouteLocationNormalized) {
  const st = window.history.state || {}
  const winId: string | null = st.osWin || null
  const { app, doctype, name, instance, aspect } = routeParams(to)

  // App-settings windows: path is /<app>/settings/<pane>, state id is app-settings:<app>.
  // openAppSettings refocuses if still open (re-targeting the pane), else respawns it — the pane
  // rides the trailing segment (settings panes aren't persisted). An unknown slug → General.
  if ((winId && winId.indexOf('app-settings:') === 0) || doctype === 'settings') {
    const aid = app || (winId ? winId.slice('app-settings:'.length) : null)
    if (aid && os.DATA.APP[aid]) os.openAppSettings(aid, paneForSlug(APP_SETTINGS_PANES, name))
    return
  }

  // The singleton per-user Settings window (/settings or /settings/<pane>): openSettings
  // refocuses it — re-targeting the pane — if open, else respawns it. The pane rides the
  // second path segment (ADR-0027); an unknown/absent slug degrades to the default pane.
  if (app === 'settings') { os.openSettings(paneForSlug(SETTINGS_PANES, doctype)); return }

  // Bare-desktop entry (/os/, no app segment): the PATH is authoritative — show the
  // focus-less desktop and clear focus, regardless of any (possibly stale) window id
  // in history.state. Otherwise popping to /os/ would restore the encoded window and
  // leave it focused/maximized while the URL claims a bare desktop.
  if (!app) { os.clearFocus(); return }

  // An applet deep-link (/<app>/<appletId>): restore the applet surface, not a
  // list keyed by the id. knownApplet gates it so a real doctype still wins.
  if (doctype && os.knownApplet(app, doctype)) {
    const surface = appletSurface(app, doctype)
    if (winId && os.restoreWin(winId, surface)) return
    os.openApplet(app, doctype, undefined, instance)
    return
  }

  let surface: Surface
  // A known trailing Aspect rides the restored form surface; an unknown tail is ignored (default).
  // The workspace is NOT rebuilt onto the surface (ADR-0042): it is window identity, restored via the
  // history-state window id below (`app:<app>/<workspace>`) when the window is still open, or by
  // applyRoute (which routes the parsed workspace into the right window) when it was closed.
  if (doctype && name) surface = formSurface(doctype, name, isAspectId(aspect) ? aspect : undefined)
  else if (doctype) surface = listSurface(doctype)
  else surface = dashboardSurface(app)

  if (winId && os.restoreWin(winId, surface)) return
  applyRoute(os, routeParams(to))
}

async function boot() {
  // 0. Resolve the boot payload, then seed the two boot-time singletons from it: the
  //    registry (server-merged + permission-filtered, ADR-0005/0010) so every renderer
  //    reads "what this user may see", and the OS API seam handed to applets. Falls
  //    back to the config seed if boot can't be fetched (offline dev / no bench behind
  //    Vite) — the seam stays uninitialised then, but no consumer reads it yet.
  try {
    const bootData = await getBoot()
    // Guard the dev entry: www/os.py redirects Guests before serving the shell, but the Vite dev
    // server serves it ungated, so a logged-out load reaches here. Leave for /login (desk parity)
    // rather than render an empty desktop — a resolved Guest payload, or the whitelisted boot()
    // call rejecting 401/403 because we're not authenticated. A plain network error (no bench
    // behind Vite) carries no status and falls through to the offline seed below.
    if (!isRealUser(bootData.user)) return redirectToLogin()
    // The live session identity drives the menu-bar label + dashboard greeting; left unset
    // on a failed/offline boot so those render a neutral state, never demo data.
    os.state.userName = bootData.user_fullname || undefined
    initRegistry(bootData)
    initPlacements(bootData)
    initRecents(bootData)
    initWallpapers(bootData)
    initOsApi(bootData)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return redirectToLogin()
    initRegistry(null)
    initPlacements(null)
    initRecents(null)
    initWallpapers(null)
  }

  // Boot-independent: if the server ever drops our session (expiry, logout in another tab), the data
  //   layer flags it on the failing response and leaves for /login. Wire that reaction here.
  setOnSessionExpired(redirectToLogin)

  // Boot-independent: seed the Theme submenu's run Handlers + its checkmark provider (the seam that
  // bridges the OS chrome to frappe-ui's theme engine — kept out of the pure actions graph).
  initAppearance()

  // 1. Hydrate the saved desktop FIRST — a deep-link layers onto the restored
  //    session, never wipes it.
  os.hydrate()

  const app = createApp(App)
  app.use(router)
  await router.isReady()

  // 2. Apply the entry route (cold deep-link) on top of the hydrated desktop, then
  //    3. seed the FIRST timeline entry with replace (not push) so back doesn't
  //    leave a stale pre-OS URL. Reset the guard explicitly: a same-path replace
  //    may not fire afterEach. First resolve an uncurated doctype segment so a deep
  //    link to any DocType opens its list rather than the app's default window.
  const entry = routeParams(router.currentRoute.value)
  await ensureRouteDoctype(entry)
  applyRoute(os, entry)
  programmatic = true
  const seed = pathForFocus(os)
  await router.replace({ path: seed.path, query: seed.query, state: navState() }).catch(() => {})
  programmatic = false

  // 4. history -> store: only genuine pops (browser back/forward) restore focus;
  //    our own push/replace are swallowed by the `programmatic` guard.
  router.afterEach((to: RouteLocationNormalized) => {
    if (programmatic) { programmatic = false; return }
    restoring = true
    restoreFromHistory(to)
    nextTick(() => { restoring = false })
  })

  // 5. store -> storage (debounced) and store -> history (push on focus/view change,
  //    except while a pop is being restored).
  os.startAutosave()
  watch(() => focusSig(os), () => { if (!restoring) pushFocus() })

  // 6. store -> browser tab: the favicon follows the focused window's app logo.
  watch(faviconHref, applyFavicon, { immediate: true })

  app.mount('#app')

  registerServiceWorker()
}

// Register the desktop-PWA service worker so /os is installable in its own window.
// Only in production: sw.js is a Frappe www file served under /os/, so it 404s under
// the pure-vite dev server. Scope is /os/ — the worker only controls its own subtree.
function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/os/sw.js', { scope: '/os/' }).catch(() => {})
}

boot()
