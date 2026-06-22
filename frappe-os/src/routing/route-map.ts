// Pure mapping between the desktop store and the URL. Extracted from main.js so the
// decision tables (focus -> path, route -> store action) are unit-testable in
// isolation: every function takes the `os` store explicitly and touches no router,
// history, or window globals. main.js owns the wiring (guards, boot, watchers).
import type { OsStore, RouteParams, Surface } from '@/types'

// Project the focused window to its canonical path (no /os prefix — the router's base
// adds it). Doctype is authoritative over `:app` (recomputed via appForDoctype). A record
// pop-out projects like an inline form; the window id in history state is what
// distinguishes the two (they share a path).
export function pathForFocus(os: OsStore): string {
  const id = os.state.activeId
  if (!id) return '/'
  const w = os.state.windows.find((x) => x.id === id)
  if (!w) return '/'
  // A minimized window isn't on screen, so it shouldn't own the URL — treat it as
  // a bare desktop. (activeId shouldn't point at a minimized window, but guard anyway.)
  if ((os.geoMap?.value?.[id] || {}).min) return '/'
  return pathForSurface(os, w.surface)
}

// The canonical path for one surface. An applet surface projects to
// /<appId>/<appletId> (mirrors Frappe overloading /app/<x> — resolve, not tag);
// applet ids are kebab-case so they never shadow a TitleCase doctype name.
function pathForSurface(os: OsStore, s: Surface): string {
  const seg = encodeURIComponent
  if (s.kind === 'applet') return `/${s.appId}/${seg(s.appletId)}`
  if (s.view === 'settings') return `/${s.appId}/settings` // self-describing; not aliased to /
  if (s.view === 'wallpaper') return '/wallpaper' // singleton system pane, no app segment
  if (s.view === 'form') return `/${os.appForDoctype(s.doctype!)}/${seg(s.doctype!)}/${seg(s.recordName!)}`
  if (s.view === 'list') return `/${os.appForDoctype(s.doctype!)}/${seg(s.doctype!)}`
  // Every app — including frappe — projects to /os/<appId>. Bare /os is reserved for the
  // focus-less desktop, so the frappe home window is /os/frappe (no alias), otherwise
  // "nothing focused" and "frappe home focused" would share one URL.
  return `/${s.appId}`
}

// Signature that changes whenever focus OR the focused window's surface changes.
export function focusSig(os: OsStore): string {
  const w = os.state.windows.find((x) => x.id === os.state.activeId)
  if (!w) return ''
  const s = w.surface
  if (s.kind === 'applet') return `${w.id}|applet|${s.appletId}`
  return `${w.id}|${s.view}|${s.doctype || ''}|${s.recordName || ''}`
}

// Turn a cold deep-link / respawn route into store actions. `params` is the route's
// { app, doctype, name }. Dead doctype/record degrade gracefully.
export function applyRoute(os: OsStore, params: RouteParams): void {
  const { app, doctype, name } = params
  // Path is authoritative: a bare /os means "no window in front", so clear focus
  // rather than letting a hydrated/restored activeId mirror itself back into the URL.
  // (Matches restoreFromHistory's bare-path handling — boot must not trust the store
  // over the path, or a cold /os redirects to /os/<app> of the last focused window.)
  if (!app) { os.clearFocus(); return }
  // The wallpaper picker is a singleton system pane at a bare `/wallpaper` (no app segment).
  if (app === 'wallpaper' && !doctype) { os.openWallpaper(); return }
  // A doctype derives its own app (appForDoctype), so a valid doctype can open even
  // when the app segment is junk. But if NEITHER the app nor the doctype is real, the
  // route points at nothing — clear focus so the seeded URL settles on the bare
  // desktop instead of leaving a stale /os/<badapp> that doesn't match any window.
  const knownApp = !!os.DATA.APP[app]
  const knownDoctype = doctype && doctype !== 'settings' && !!os.getMeta(doctype)
  if (!knownApp && !knownDoctype) { os.clearFocus(); return }
  if (doctype === 'settings') { if (knownApp) os.openSettings(app); return }
  if (doctype && !knownDoctype) {
    // A second segment that isn't a doctype may be an applet id (/<app>/<appletId>).
    // knownDoctype was checked first, so a real doctype never reaches here — doctype-wins
    // precedence falls out for free. Otherwise it's an app deep-link with a junk tail.
    if (os.knownApplet(app, doctype)) { os.openApplet(app, doctype); return }
    if (knownApp) os.openApp(app)
    return
  }
  // Records load live, so we can't prove a record exists synchronously: always open
  // the form for a known doctype + name and let the form view show a not-found state
  // on a 404 (Phase 4). A doctype with no name opens its list.
  if (doctype && name) {
    os.openRecordGlobal(doctype, name)
  } else if (doctype) {
    os.openListGlobal(doctype)
  } else if (knownApp) {
    os.openApp(app)
  }
}
