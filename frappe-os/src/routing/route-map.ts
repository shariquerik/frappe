// Pure mapping between the desktop store and the URL. Extracted from main.js so the
// decision tables (focus -> path, route -> store action) are unit-testable in
// isolation: every function takes the `os` store explicitly and touches no router,
// history, or window globals. main.js owns the wiring (guards, boot, watchers).
import { DEFAULT_ASPECT, isAspectId } from '@/surface/aspects'
import type { FocusLocation, OsStore, RouteParams, Surface } from '@/types'

// Reserved query key naming a non-canonical app window instance (`app:<id>#n`). OS-owned:
// apps and list filters must not use it (a leading-letter Frappe fieldname could otherwise
// collide). Absent for the canonical instance, so single-window URLs are unchanged.
export const INSTANCE_KEY = 'instance'

const bare = (): FocusLocation => ({ path: '/', query: {} })

// Project the focused window to its canonical content path (no /os prefix — the router's
// base adds it) plus a derived query. Doctype is authoritative over `:app` (recomputed via
// appForDoctype). Two app instances on the same surface share a path, so the `?instance=n`
// query keeps them individually addressable.
export function pathForFocus(os: OsStore): FocusLocation {
  const id = os.state.activeId
  if (!id) return bare()
  const w = os.state.windows.find((x) => x.id === id)
  if (!w) return bare()
  // A minimized window isn't on screen, so it shouldn't own the URL — treat it as
  // a bare desktop. (activeId shouldn't point at a minimized window, but guard anyway.)
  if ((os.geoMap?.value?.[id] || {}).min) return bare()
  return { path: pathForSurface(os, w.surface), query: instanceQuery(id) }
}

// The `?instance=n` discriminator for a non-canonical app instance id `app:<id>#n`; empty
// for the canonical `app:<id>` and for non-app windows (settings/wallpaper). Gated on the
// `app:` prefix so only real app-instance ids ever carry the query.
export function instanceQuery(id: string): Record<string, string> {
  if (!id.startsWith('app:')) return {}
  const match = /#(\d+)$/.exec(id)
  return match ? { [INSTANCE_KEY]: match[1] } : {}
}

// The canonical path for one surface. An applet surface projects to
// /<appId>/<appletId> (mirrors Frappe overloading /app/<x> — resolve, not tag);
// applet ids are kebab-case so they never shadow a TitleCase doctype name.
function pathForSurface(os: OsStore, s: Surface): string {
  const seg = encodeURIComponent
  if (s.kind === 'applet') return `/${s.appId}/${seg(s.appletId)}`
  if (s.view === 'settings') return `/${s.appId}/settings` // self-describing; not aliased to /
  if (s.view === 'wallpaper') return '/wallpaper' // singleton system pane, no app segment
  if (s.view === 'form') {
    // The selected Aspect projects to a trailing path segment (ADR-0018); Details is the
    // default and stays on the bare record path, so existing form URLs are unchanged.
    const base = `/${os.appForDoctype(s.doctype!)}/${seg(s.doctype!)}/${seg(s.recordName!)}`
    return s.aspect && s.aspect !== DEFAULT_ASPECT ? `${base}/${seg(s.aspect)}` : base
  }
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
  // Include the Aspect so switching facets of one record changes the signature and pushes a
  // timeline entry — browser back/forward then steps between Aspects (ADR-0018).
  return `${w.id}|${s.view}|${s.doctype || ''}|${s.recordName || ''}|${s.aspect || ''}`
}

// Turn a cold deep-link / respawn route into store actions. `params` is the route's
// { app, doctype, name }. Dead doctype/record degrade gracefully.
export function applyRoute(os: OsStore, params: RouteParams): void {
  const { app, doctype, name, instance } = params
  // Read the trailing segment as an Aspect ONLY when it matches a known id (ADR-0018), so a
  // record name is never misread as `record/aspect` and an unknown tail produces no phantom Aspect.
  const aspect = isAspectId(params.aspect) ? params.aspect : undefined
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
    if (os.knownApplet(app, doctype)) { os.openApplet(app, doctype, undefined, instance); return }
    if (knownApp) os.openApp(app, instance)
    return
  }
  // Records load live, so we can't prove a record exists synchronously: always open
  // the form for a known doctype + name and let the form view show a not-found state
  // on a 404 (Phase 4). A doctype with no name opens its list. `instance` targets a
  // specific app window when the URL carried `?instance=n` (else the canonical one).
  if (doctype && name) {
    os.openRecordGlobal(doctype, name, instance, aspect)
  } else if (doctype) {
    os.openListGlobal(doctype, instance)
  } else if (knownApp) {
    os.openApp(app, instance)
  }
}
