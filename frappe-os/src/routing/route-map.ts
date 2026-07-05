// Pure mapping between the desktop store and the URL. Extracted from main.js so the
// decision tables (focus -> path, route -> store action) are unit-testable in
// isolation: every function takes the `os` store explicitly and touches no router,
// history, or window globals. main.js owns the wiring (guards, boot, watchers).
import { windowWorkspace } from '@/surface'
import { DEFAULT_ASPECT, isAspectId } from '@/surface/aspects'
import { DEFAULT_SETTINGS_PANE, DEFAULT_APP_SETTINGS_PANE, SETTINGS_PANES, APP_SETTINGS_PANES, paneForSlug, slugForPane } from '@/surface/panes'
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
  // The workspace segment comes from window identity (ADR-0042), not the surface — read it off the
  // window id so `/erpnext/selling/Customer` projects from the Selling window regardless of content.
  return { path: pathForSurface(os, w.surface, windowWorkspace(id)), query: instanceQuery(id) }
}

// The `?instance=n` discriminator for a non-canonical app instance id `app:<id>#n`; empty
// for the canonical `app:<id>` and for non-app windows (settings/system). Gated on the
// `app:` prefix so only real app-instance ids ever carry the query.
export function instanceQuery(id: string): Record<string, string> {
  if (!id.startsWith('app:')) return {}
  const match = /#(\d+)$/.exec(id)
  return match ? { [INSTANCE_KEY]: match[1] } : {}
}

// The canonical path for one surface. An applet surface projects to
// /<appId>/<appletId> (mirrors Frappe overloading /app/<x> — resolve, not tag);
// applet ids are kebab-case so they never shadow a TitleCase doctype name.
function pathForSurface(os: OsStore, s: Surface, workspace?: string): string {
  const seg = encodeURIComponent
  if (s.kind === 'applet') return `/${s.appId}/${seg(s.appletId)}`
  // The window's workspace (ADR-0042) projects to a segment between app and doctype
  // (/erpnext/selling/Customer); absent = no segment, so a plain app window's URL is unchanged.
  const ws = workspace ? `/${seg(workspace)}` : ''
  if (s.view === 'app-settings') {
    // Per-app settings; the URL segment stays `settings`. The selected pane projects to a
    // trailing segment; General is the default and stays on the bare /<app>/settings path.
    const pane = (s.params?.pane as string) || DEFAULT_APP_SETTINGS_PANE
    const base = `/${s.appId}/settings`
    return pane === DEFAULT_APP_SETTINGS_PANE ? base : `${base}/${seg(slugForPane(pane))}`
  }
  if (s.view === 'settings') {
    // The selected pane projects to a trailing path segment (ADR-0027); General is the
    // default and stays on the bare /settings path, so the existing Settings URL is unchanged.
    const pane = (s.params?.pane as string) || DEFAULT_SETTINGS_PANE
    return pane === DEFAULT_SETTINGS_PANE ? '/settings' : `/settings/${seg(slugForPane(pane))}`
  }
  if (s.view === 'finder') return '/finder' // singleton Finder window, no app segment (ADR-0024)
  if (s.view === 'form') {
    // The selected Aspect projects to a trailing path segment (ADR-0018); Details is the
    // default and stays on the bare record path, so existing form URLs are unchanged.
    const base = `/${os.appForDoctype(s.doctype!)}${ws}/${seg(s.doctype!)}/${seg(s.recordName!)}`
    return s.aspect && s.aspect !== DEFAULT_ASPECT ? `${base}/${seg(s.aspect)}` : base
  }
  if (s.view === 'list') return `/${os.appForDoctype(s.doctype!)}${ws}/${seg(s.doctype!)}`
  // Every app — including frappe — projects to /os/<appId>. Bare /os is reserved for the
  // focus-less desktop, so the frappe home window is /os/frappe (no alias), otherwise
  // "nothing focused" and "frappe home focused" would share one URL. A workspace-scoped
  // dashboard (the Overview) adds its segment: /os/erpnext/selling (ADR-0040).
  return `/${s.appId}${ws}`
}

// Signature that changes whenever focus OR the focused window's surface changes.
export function focusSig(os: OsStore): string {
  const w = os.state.windows.find((x) => x.id === os.state.activeId)
  if (!w) return ''
  const s = w.surface
  if (s.kind === 'applet') return `${w.id}|applet|${s.appletId}`
  // Include the pane so switching a Settings pane changes the signature and pushes a history
  // entry — browser back/forward then steps between panes (ADR-0027), mirroring Aspects.
  if (s.view === 'settings') return `${w.id}|settings|${(s.params?.pane as string) || DEFAULT_SETTINGS_PANE}`
  if (s.view === 'app-settings') return `${w.id}|app-settings|${s.appId}|${(s.params?.pane as string) || DEFAULT_APP_SETTINGS_PANE}`
  // Include the Aspect so switching it changes the signature and pushes a timeline entry — browser
  // back/forward then steps between Aspects (ADR-0018), mirroring the trailing URL segment. The
  // workspace needs no term: it is window identity (ADR-0042), already in `w.id`, so switching
  // workspaces is switching windows — the leading `w.id` changes the signature on its own.
  return `${w.id}|${s.view}|${s.doctype || ''}|${s.recordName || ''}|${s.aspect || ''}`
}

// Reshape the raw path segments (the router's `:segments*` capture) into RouteParams, resolving
// the optional workspace segment between app and doctype (ADR-0040). `os.workspaceForSlug` is the
// membership guard that tells a workspace from a doctype: an unrecognised second segment is the
// doctype (existing scheme unchanged), a recognised one is the workspace and the rest shifts by
// one. Pure and total — a bad/empty path yields an empty RouteParams (a bare desktop).
export function parseSegments(os: OsStore, segments: string[]): RouteParams {
  const [app, ...rest] = segments
  if (!app) return {}
  const workspace = os.workspaceForSlug(app, rest[0])
  const [doctype, name, aspect] = workspace ? rest.slice(1) : rest
  return { app, workspace, doctype, name, aspect }
}

// Turn a cold deep-link / respawn route into store actions. `params` is the route's
// { app, doctype, name }. Dead doctype/record degrade gracefully.
export function applyRoute(os: OsStore, params: RouteParams): void {
  const { app, workspace, doctype, name, instance } = params
  // Read the trailing segment as an Aspect ONLY when it matches a known id (ADR-0018), so a
  // record name is never misread as `record/aspect` and an unknown tail produces no phantom Aspect.
  const aspect = isAspectId(params.aspect) ? params.aspect : undefined
  // Path is authoritative: a bare /os means "no window in front", so clear focus
  // rather than letting a hydrated/restored activeId mirror itself back into the URL.
  // (Matches restoreFromHistory's bare-path handling — boot must not trust the store
  // over the path, or a cold /os redirects to /os/<app> of the last focused window.)
  if (!app) { os.clearFocus(); return }
  // Settings is the singleton per-user system pane at `/settings`; a trailing segment selects
  // the pane (ADR-0027). An unknown/absent slug degrades to the default (General) pane.
  if (app === 'settings') { os.openSettings(paneForSlug(SETTINGS_PANES, doctype)); return }
  // The Finder is a singleton system window at a bare `/finder` (no app segment, ADR-0024).
  if (app === 'finder' && !doctype) { os.openFinder(); return }
  // A doctype derives its own app (appForDoctype), so a valid doctype can open even
  // when the app segment is junk. But if NEITHER the app nor the doctype is real, the
  // route points at nothing — clear focus so the seeded URL settles on the bare
  // desktop instead of leaving a stale /os/<badapp> that doesn't match any window.
  const knownApp = !!os.DATA.APP[app]
  const knownDoctype = doctype && doctype !== 'settings' && !!os.getMeta(doctype)
  if (!knownApp && !knownDoctype) { os.clearFocus(); return }
  // Open the app's home surface, workspace-aware (ADR-0040): a URL that named a workspace but no
  // doctype (/erpnext/selling) — or one with a junk tail — lands on that workspace's Overview.
  const openHome = () => (workspace ? os.openWorkspace(app, workspace) : os.openApp(app, instance))
  // Per-app settings (/<app>/settings); a trailing segment (the route's `name`) selects the
  // pane (an unknown/absent slug degrades to General).
  if (doctype === 'settings') { if (knownApp) os.openAppSettings(app, paneForSlug(APP_SETTINGS_PANES, name)); return }
  if (doctype && !knownDoctype) {
    // A second segment that isn't a doctype may be an applet id (/<app>/<appletId>).
    // knownDoctype was checked first, so a real doctype never reaches here — doctype-wins
    // precedence falls out for free. Otherwise it's an app deep-link with a junk tail.
    if (os.knownApplet(app, doctype)) { os.openApplet(app, doctype, undefined, instance); return }
    if (knownApp) openHome()
    return
  }
  // Records load live, so we can't prove a record exists synchronously: always open
  // the form for a known doctype + name and let the form view show a not-found state
  // on a 404 (Phase 4). A doctype with no name opens its list. `instance` targets a
  // specific app window when the URL carried `?instance=n` (else the canonical one).
  // A URL that named a doctype but no workspace (`/frappe/Access Log`) canonicalises to the
  // doctype's own workspace (ADR-0042), so it lands on the workbench — with the doctype rail and
  // active row — not the hub; pathForFocus then reprojects the module segment. A doctype in no
  // seeded workspace yields undefined and opens the plain app window (unchanged).
  const ws = doctype ? workspace ?? os.workspaceForDoctype(doctype) : workspace
  if (doctype && name) {
    os.openRecordGlobal(doctype, name, instance, aspect, ws)
  } else if (doctype) {
    os.openListGlobal(doctype, instance, ws)
  } else if (knownApp) {
    openHome()
  }
}
