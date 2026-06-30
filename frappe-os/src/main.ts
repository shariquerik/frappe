import { createApp, watch, nextTick } from 'vue'
import type { LocationQuery, RouteLocationNormalized, RouteParamsGeneric } from 'vue-router'
// index.css imports frappe-ui/style.css then runs Tailwind's directives against THIS
// project's content globs — without it only frappe-ui's prebuilt utilities exist and
// app-specific classes silently no-op.
import './index.css'
import App from './App.vue'
import { useOS } from '@/desktop'
import { getBoot, initOsApi } from '@/data'
import { initRegistry } from '@/registry'
import { initPlacements } from '@/placements'
import { initRecents } from '@/recents'
import { router, pathForFocus, focusSig, applyRoute, INSTANCE_KEY } from '@/routing'
import { formSurface, listSurface, dashboardSurface, appletSurface, isAspectId } from '@/surface'
import type { RouteParams, Surface } from '@/types'

const os = useOS()

// vue-router's params/query are `string | string[]` per key; our routes only ever bind
// single segments, so collapse to the `{ app, doctype, name, instance }` shape route-map
// expects. `instance` parses the reserved `?instance=n` query (junk → null = canonical).
function routeParams(loc: { params: RouteParamsGeneric; query: LocationQuery }): RouteParams {
  const one = (v: string | (string | null)[] | undefined | null) => (Array.isArray(v) ? v[0] : v) || undefined
  const raw = one(loc.query[INSTANCE_KEY])
  const instance = raw ? Number.parseInt(raw, 10) : NaN
  return { app: one(loc.params.app), doctype: one(loc.params.doctype), name: one(loc.params.name),
    aspect: one(loc.params.aspect),
    instance: Number.isInteger(instance) ? instance : null }
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

  // Settings windows: path is /<app>/settings, state id is settings:<app>. Refocus
  // if still open, else respawn from the app segment (settings panes aren't persisted).
  if ((winId && winId.indexOf('settings:') === 0) || doctype === 'settings') {
    if (winId && os.restoreWin(winId)) return
    const aid = app || (winId ? winId.slice('settings:'.length) : null)
    if (aid && os.DATA.APP[aid]) os.openSettings(aid)
    return
  }

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
    initRegistry(bootData)
    initPlacements(bootData)
    initRecents(bootData)
    initOsApi(bootData)
  } catch {
    initRegistry(null)
    initPlacements(null)
    initRecents(null)
  }

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

  app.mount('#app')
}

boot()
