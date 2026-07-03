// Session persistence: the URL only holds *focus*; the rest of the desktop (which
// windows exist, their geometry, z-order, split, per-window nav history,
// toggles, durable working state) lives in one localStorage blob, debounced 250ms. Theme is
// not here — frappe-ui's useTheme persists it under its own `theme` key. The wallpaper selection
// is not here either — it roams per-user on the server (src/wallpapers/, ADR-0036). Ephemeral
// overlay flags (palette / menu) and the transient settings window are
// excluded — a refresh never restores an open overlay or a system pane.
import { watch } from 'vue'
import { useRegistry, getMeta, knownApplet } from '@/registry'
import { state } from './state'
import { syncTopZ } from './geometry'
import { HIST_CAP } from './windows'
import { initialSurface, isBuiltin, windowRole } from '@/surface'
import type { OsWindow, Surface, WorkingEntry } from '@/types'

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

// Reduce the working-state slab (ADR-0029) to what persists: durable entries carrying a defined
// value, in ordinary app windows only. Ephemeral entries are memory-only; an empty slot (value
// cleared on save, slice 03) has nothing to restore; system/settings windows are respawned from
// the URL and never carry a slab (mirrors serialize()'s window filter). Pure and defensive over
// the slab so it serves both serialize (trusted state) and hydrate (untrusted JSON) unchanged.
export function durableWorkingState(
  slab: Record<string, Record<string, WorkingEntry>>,
): Record<string, Record<string, WorkingEntry>> {
  const out: Record<string, Record<string, WorkingEntry>> = {}
  for (const winId of Object.keys(slab || {})) {
    if (windowRole(winId) !== 'app') continue
    const win = slab[winId]
    if (!win || typeof win !== 'object') continue
    const kept: Record<string, WorkingEntry> = {}
    for (const subject of Object.keys(win)) {
      const entry = win[subject]
      if (entry && typeof entry === 'object' && entry.persist === 'durable' && entry.value !== undefined)
        kept[subject] = entry
    }
    if (Object.keys(kept).length) out[winId] = kept
  }
  return out
}

export function serialize() {
  return {
    version: BLOB_VERSION,
    windows: state.windows.filter((w) => !['settings', 'system'].includes(windowRole(w.id))).map((w) => ({
      id: w.id, surface: w.surface,
      back: (w.back || []).slice(-HIST_CAP), fwd: (w.fwd || []).slice(-HIST_CAP),
    })),
    geo: state.geo, split: state.split, activeId: state.activeId,
    toggles: state.toggles, sidebarHidden: state.sidebarHidden,
    // Durable-only working state (ADR-0029). An OPTIONAL key: old blobs simply lack it and
    // hydrate reads `workingState || {}`, so adding it needs no BLOB_VERSION bump (a bump would
    // discard every user's existing desktop).
    workingState: durableWorkingState(state.workingState),
    rowOpenTarget: state.rowOpenTarget, rememberWindowSize: state.rememberWindowSize,
    dockPosition: state.dockPosition, dockAutoHide: state.dockAutoHide,
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
  state.toggles = blob.toggles || {}
  state.sidebarHidden = blob.sidebarHidden || {}
  state.rowOpenTarget = blob.rowOpenTarget === 'new-window' ? 'new-window' : 'inline'
  state.rememberWindowSize = blob.rememberWindowSize !== false // default on
  state.dockPosition = ['bottom', 'left', 'right'].includes(blob.dockPosition) ? blob.dockPosition : 'left'
  state.dockAutoHide = blob.dockAutoHide !== false // default on
  // Restore durable working-state slabs (ADR-0029). durableWorkingState re-applies the durable/
  // defined/app-window filter to the untrusted blob; keep only slabs whose window survived the
  // filter above, so a dropped window never leaves an orphan slab behind.
  state.workingState = {}
  const durable = durableWorkingState(blob.workingState || {})
  for (const winId of Object.keys(durable)) {
    if (ids.has(winId)) state.workingState[winId] = durable[winId]
  }
  syncTopZ(windows, state.geo)
  return true
}


// Debounced autosave. onPointerMove fires setGeo every frame during drag/resize;
// never write localStorage per-frame — coalesce to a single write ~250ms after the
// last mutation. Call once, after hydrate(), so hydration churn isn't re-saved eagerly.
let saveTimer: ReturnType<typeof setTimeout> | undefined
export function startAutosave(): void {
  watch(
    () => [state.windows, state.geo, state.split, state.activeId, state.toggles, state.sidebarHidden, state.workingState, state.rowOpenTarget, state.rememberWindowSize, state.dockPosition, state.dockAutoHide],
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => { try { localStorage.setItem(BLOB_KEY, JSON.stringify(serialize())) } catch { /* quota / private mode: skip */ } }, 250)
    },
    { deep: true },
  )
}
