// Session persistence: the URL only holds *focus*; the rest of the desktop (which
// windows exist, their geometry, z-order, split, per-window nav history, theme,
// wallpaper, toggles) lives in one localStorage blob, debounced 250ms. Ephemeral
// overlay flags (palette / menu) and the transient settings / wallpaper windows are
// excluded — a refresh never restores an open overlay or a system pane.
import { watch } from 'vue'
import { useRegistry, getMeta, knownApplet } from '@/registry'
import { state } from './state'
import { syncTopZ } from './geometry'
import { HIST_CAP } from './windows'
import { initialSurface, isBuiltin, windowRole } from '@/surface'
import type { OsWindow, Surface } from '@/types'

const BLOB_KEY = 'frappe-os:desktop'
// Bumped to 2 when windows moved from `type`/`view`/`doctype`/`recordName` to `surface`
// (ADR-0012). Pre-2 blobs carry the old shape, so they are discarded on read.
const BLOB_VERSION = 2

// A surface is restorable when its doctype is a known (curated) doctype — records load
// live, so we no longer prove a specific record exists. A form just needs a name to
// fetch; the form view renders its own not-found state on a 404. An applet surface is
// restorable when its id is still a known contribution (a dead id falls back to the app's
// initial surface in hydrate, mirroring a dead doctype).
export function validSurface(s?: Surface | null): boolean {
  if (s?.kind === 'applet') return knownApplet(s.appId, s.appletId)
  if (!isBuiltin(s)) return false
  if (s.view === 'dashboard') return true
  if (s.view === 'list') return !!s.doctype && !!getMeta(s.doctype)
  if (s.view === 'form') return !!s.doctype && !!getMeta(s.doctype) && !!s.recordName
  return false
}

export function serialize() {
  return {
    version: BLOB_VERSION,
    windows: state.windows.filter((w) => !['settings', 'wallpaper'].includes(windowRole(w.id))).map((w) => ({
      id: w.id, surface: w.surface,
      back: (w.back || []).slice(-HIST_CAP), fwd: (w.fwd || []).slice(-HIST_CAP),
    })),
    geo: state.geo, split: state.split, activeId: state.activeId,
    theme: state.theme, wallpaper: state.wallpaper,
    toggles: state.toggles, sidebarHidden: state.sidebarHidden,
    rowOpenTarget: state.rowOpenTarget, rememberWindowSize: state.rememberWindowSize,
  }
}

// Restore the desktop from storage. Defensive: drop any window/surface whose doctype is
// no longer a known doctype (fall an app window back to its dashboard). Legacy `rec:`
// pop-out windows (ADR-0017 removed the role) are dropped wholesale — disposable POC
// sessions, no migration. Incompatible blob shapes are discarded whole.
export function hydrate(): boolean {
  // Untrusted JSON: read as `any` and validate defensively below.
  let blob: any = null
  try { blob = JSON.parse(localStorage.getItem(BLOB_KEY) ?? 'null') } catch { blob = null }
  if (!blob || blob.version !== BLOB_VERSION) return false
  const reg = useRegistry()
  const windows: OsWindow[] = []
  for (const w of blob.windows || []) {
    if (w.id?.startsWith('rec:')) continue // legacy pop-out window (ADR-0017) -> drop
    const appId = w.surface?.appId
    if (!reg.app(appId)) continue
    const surface = validSurface(w.surface) ? w.surface : initialSurface(appId) // dead -> dashboard
    windows.push({
      id: w.id, surface,
      back: (w.back || []).filter(validSurface), fwd: (w.fwd || []).filter(validSurface),
    })
  }
  const ids = new Set(windows.map((w) => w.id))
  state.windows = windows
  state.geo = {}
  Object.keys(blob.geo || {}).forEach((k) => { if (ids.has(k)) state.geo[k] = blob.geo[k] })
  state.split = Array.isArray(blob.split) && blob.split.every((id: string) => ids.has(id)) ? blob.split : null
  // Preserve "nothing focused" across reloads. A persisted null means the desktop
  // was bare (clearFocus / minimize-to-empty); don't resurrect focus onto the last
  // window, or a cold /os would auto-open it and redirect to /os/<app>.
  state.activeId = ids.has(blob.activeId) ? blob.activeId : null
  state.theme = blob.theme || 'light'
  state.wallpaper = blob.wallpaper || null
  state.toggles = blob.toggles || {}
  state.sidebarHidden = blob.sidebarHidden || {}
  state.rowOpenTarget = blob.rowOpenTarget === 'new-window' ? 'new-window' : 'inline'
  state.rememberWindowSize = blob.rememberWindowSize !== false // default on
  syncTopZ(windows, state.geo)
  return true
}


// Debounced autosave. onPointerMove fires setGeo every frame during drag/resize;
// never write localStorage per-frame — coalesce to a single write ~250ms after the
// last mutation. Call once, after hydrate(), so hydration churn isn't re-saved eagerly.
let saveTimer: ReturnType<typeof setTimeout> | undefined
export function startAutosave(): void {
  watch(
    () => [state.windows, state.geo, state.split, state.activeId, state.theme, state.wallpaper, state.toggles, state.sidebarHidden, state.rowOpenTarget, state.rememberWindowSize],
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => { try { localStorage.setItem(BLOB_KEY, JSON.stringify(serialize())) } catch { /* quota / private mode: skip */ } }, 250)
    },
    { deep: true },
  )
}
