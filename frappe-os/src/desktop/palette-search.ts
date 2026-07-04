// Live search behind the Command Palette — the "later add" palette.ts promised. One
// debounced query fans out to BOTH server searches (record hits from the global-search
// index, doctype-name hits over the caller's readable set); results are stamped with the
// query they answered, so a stale out-of-order response can never render under a newer
// query. Either call failing (no index, offline) degrades that section to no rows — the
// curated palette results still render. This slice owns only the query→hits state
// machine; mapping hits to PaletteItems (registry lookups, window opening) stays in
// palette.ts.
import { reactive } from 'vue'
import { call } from '@/data/api'
import type { RecordHit } from './types'

export const RECORD_SEARCH_MIN_CHARS = 2
export const RECORD_SEARCH_DEBOUNCE_MS = 180
export const RECORD_RESULT_CAP = 8
export const DOCTYPE_RESULT_CAP = 6

const store = reactive<{ query: string; records: RecordHit[]; doctypes: string[] }>({
  query: '',
  records: [],
  doctypes: [],
})
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

// The hits answering exactly `query` (trimmed), else empty — the synchronous reads
// paletteResults merges while a newer request is still debouncing/in flight.
export function recordHits(query: string): RecordHit[] {
  return store.query === query.trim() ? store.records : []
}
export function doctypeHits(query: string): string[] {
  return store.query === query.trim() ? store.doctypes : []
}

// Drop pending work and clear hits (palette open/close). Bumping `seq` orphans any
// response already in flight.
export function resetRecordSearch(): void {
  if (timer) clearTimeout(timer)
  seq += 1
  store.query = ''
  store.records = []
  store.doctypes = []
}

// A search call that degrades to its empty value instead of rejecting, so one failing
// leg never drops the other's results (they land together via Promise.all).
function searchCall<T>(method: string, params: Record<string, unknown>, empty: T): Promise<T> {
  return call(method, params).catch(() => empty)
}

// Debounce, then fan out both searches. Only the newest request may land (seq guard) —
// an older response resolving late is dropped, not rendered.
export function queueRecordSearch(query: string): void {
  if (timer) clearTimeout(timer)
  const q = query.trim()
  if (q.length < RECORD_SEARCH_MIN_CHARS) return resetRecordSearch()
  const mine = ++seq
  timer = setTimeout(() => {
    Promise.all([
      searchCall<RecordHit[]>('frappe.os_core.search.search_records', { text: q, limit: RECORD_RESULT_CAP }, []),
      searchCall<string[]>('frappe.os_core.search.search_doctypes', { text: q, limit: DOCTYPE_RESULT_CAP }, []),
    ]).then(([records, doctypes]) => {
      if (mine !== seq) return
      store.query = q
      store.records = Array.isArray(records) ? records : []
      store.doctypes = Array.isArray(doctypes) ? doctypes : []
    })
  }, RECORD_SEARCH_DEBOUNCE_MS)
}
