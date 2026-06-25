// useRecents(): the client Recents seam (ADR-0024). A "recent" is a record open — a surface
// reference + timestamp. The server owns the definition (record opens only, deduped by reference,
// capped to ~50) and delivers the already-resolved, newest-first, permission-gated list in
// boot.recents; this module holds it and records new opens. Mirrors placements/index.ts: seeded once
// at boot (initRecents), so useRecents() stays a synchronous lookup for the Finder's Recents Location.
//
// The frontend's only write here is recording an open (debounced) — the server is the trim guarantee.
// It never merges or re-orders; reading and an optimistic front-of-list bump are all it does.
import { reactive } from 'vue'
import { callPost } from '@/data/api'
import type { BootData, SurfaceRef } from '@/types'
import type { ResolvedRecent } from './types'

// Reactive so an optimistic bump (a record opened this session) re-renders the Recents Location
// without a reload. Boot replaces it wholesale; recordRecent moves a reference to the front.
const store = reactive<{ list: ResolvedRecent[] }>({ list: [] })

// The server cap, mirrored client-side so an optimistic bump trims the local list the same way the
// server trims on write — the local view never grows past what the next boot would return.
const RECENTS_CAP = 50
// Coalesce rapid re-opens of the SAME record (a form re-mount, a quick back-and-forth) into one
// server write; distinct records each persist after they settle. The debounce is a courtesy — the
// server still trims defensively, and the optimistic bump keeps the UI correct meanwhile.
const DEBOUNCE_MS = 800

// Read the resolved list off the boot payload, tolerating a missing/legacy key (ADR-0008): an older
// server with no `recents` key, or junk, degrades to an empty Recents rather than throwing.
function readRecents(boot?: BootData | null): ResolvedRecent[] {
  const list = (boot as { recents?: unknown } | null | undefined)?.recents
  return Array.isArray(list) ? (list as ResolvedRecent[]) : []
}

export function initRecents(boot?: BootData | null): void {
  store.list = readRecents(boot)
}

// The resolved recents (newest-first) — the synchronous seam the Finder's Recents Location reads.
export function useRecents(): ResolvedRecent[] {
  return store.list
}

// A stable identity for a reference (sorted keys), matching the server's canonical JSON so the
// optimistic dedup keys the same way a re-open's row match does.
function refKey(ref: SurfaceRef): string {
  return JSON.stringify(ref, Object.keys(ref).sort())
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

// Record a record open (ADR-0024): bump it to the front of the local list (deduped, capped) at once,
// then persist after a short idle. Record opens only — every window opener that flows a real record
// (openRecordGlobal / openRecordInline / openRecordNewWindow) calls this; list/app/dashboard opens do not.
export function recordRecent(doctype: string, name: string): void {
  const ref: SurfaceRef = { doctype, name, view: 'form' }
  bumpLocal(ref)
  const key = refKey(ref)
  const pending = timers.get(key)
  if (pending) clearTimeout(pending)
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      callPost('frappe.www.os.record_recent', { surface_ref: JSON.stringify(ref) }).catch((error) =>
        console.error('record_recent failed', error),
      )
    }, DEBOUNCE_MS),
  )
}

// Move a reference to the front of the local list as the server would on the next boot: drop any
// existing row for it (dedup by reference, newest wins), unshift, trim to the cap.
function bumpLocal(ref: SurfaceRef): void {
  const key = refKey(ref)
  const existing = store.list.findIndex((r) => refKey(r.ref) === key)
  if (existing >= 0) store.list.splice(existing, 1)
  store.list.unshift({ ref })
  if (store.list.length > RECENTS_CAP) store.list.length = RECENTS_CAP
}
