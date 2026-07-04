// Live record store: reactive caches over the Frappe REST/whitelisted API, replacing
// the old synchronous mock. Three caches — lists, single docs, dashboard card values
// — each entry shaped { loading, data, error }. Getters (listFor/docFor/countFor)
// return the reactive entry; the load* actions populate it. Writes go through api.js
// and refresh the affected cache. Display config (which fields to fetch) comes from
// the curated getMeta — the records here carry no display knowledge.

import { reactive } from 'vue'
import { getList, getDoc, getDoctypeMeta, saveDoc as apiSaveDoc, createDoc as apiCreateDoc, bulkUpdate as apiBulkUpdate, cardValue } from '@/data/api'
import { watchTask, type TaskWatch } from '@/data/realtime'
import { notify } from '@/data/notify'
import { registerScopedContributions } from '@/registry'
import type { CacheEntry, ListFilters, FrappeDoc, GetListOptions, BulkUpdateResult, DoctypeMetaPayload } from '@/types'

// A list entry carries, beside the reactive slot, the doctype and the SHAPE it was last
// fetched with — so a context-free write can find and replay every open window of that
// doctype (see refreshLists) rather than clobbering them with one unfiltered read.
interface ListEntry extends CacheEntry<FrappeDoc[]> {
  doctype: string
  options: GetListOptions
}

// Lists are keyed by REQUEST SHAPE (fields + filters + order_by), mirroring countKey — so a
// filtered/lean list window and a context-free read of the same doctype (dashboard recents,
// post-save refresh) keep SEPARATE row arrays and can't overwrite each other. `limit`/`start`
// are deliberately NOT part of the key: paging grows the same entry (a wider window replaces,
// a `start > 0` page appends).
const lists = reactive<Record<string, ListEntry>>({})
const docs = reactive<Record<string, CacheEntry<FrappeDoc | null>>>({}) // "doctype/name" -> entry, data is the doc
const counts = reactive<Record<string, CacheEntry<number | null>>>({}) // cache key -> entry, data is a number
const fieldMetas = reactive<Record<string, CacheEntry<DoctypeMetaPayload | null>>>({}) // doctype -> entry, data is the live doctype meta

const entry = <T>(data: T): CacheEntry<T> => ({ loading: false, data, error: null })
const docKey = (doctype: string, name: string) => `${doctype}/${name}`
const countKey = (doctype: string, filters?: ListFilters, fieldname?: string) =>
  JSON.stringify([doctype, filters || null, fieldname || null])
const listKey = (doctype: string, options: GetListOptions = {}) =>
  JSON.stringify([doctype, options.fields ?? null, options.filters ?? null, options.order_by ?? null])

// ---- list cache --------------------------------------------------------------
// The caller passes the fetch shape (fields/filters/order_by) so its window is looked up by
// that shape — the list view its lean set (name + visible wire columns + Record-indicator
// resolver fields, ADR-0028 / #04b); a context-free reader passes nothing and shares the
// unfiltered `['*']` entry. `limit`/`start` don't change the key (paging grows one window).
export function listFor(doctype: string, options: GetListOptions = {}): CacheEntry<FrappeDoc[]> {
  const key = listKey(doctype, options)
  if (!lists[key]) lists[key] = { loading: false, data: [], error: null, doctype, options }
  return lists[key]
}

export async function loadList(doctype: string, options: GetListOptions = {}): Promise<CacheEntry<FrappeDoc[]>> {
  const state = listFor(doctype, options) as ListEntry
  state.options = options // remember the latest shape so a context-free write can replay it
  state.loading = true
  state.error = null
  try {
    const rows = await getList(doctype, { fields: ['*'], limit: 100, ...options })
    // A paged read (`start > 0`) appends the next page; the first page replaces.
    state.data = (options.start ?? 0) > 0 ? [...state.data, ...rows] : rows
  } catch (e) {
    state.error = (e as Error).message
  } finally {
    state.loading = false
  }
  return state
}

// Append the next page: fetch from the current row count as the offset, keeping the
// active filters/sort/limit. Paging lives in the OS store (the single fetch seam,
// ADR-0025), not the library's useListData.
export async function loadMore(doctype: string, options: GetListOptions = {}): Promise<CacheEntry<FrappeDoc[]>> {
  return loadList(doctype, { ...options, start: listFor(doctype, options).data.length })
}

// Refresh every open list window of a doctype after a context-free write (saveDoc/createDoc/
// bulkUpdate hold no column shape). Each window is re-fetched with ITS OWN remembered shape,
// from page 1, so the filtered/paged lists on screen refill correctly instead of being
// replaced by one unfiltered read. Nothing open → nothing to refresh (the next view fetches fresh).
async function refreshLists(doctype: string): Promise<void> {
  const open = Object.values(lists).filter((state) => state.doctype === doctype)
  await Promise.all(open.map((state) => loadList(doctype, { ...state.options, start: 0 })))
}

// ---- single-doc cache --------------------------------------------------------
export function docFor(doctype: string, name: string): CacheEntry<FrappeDoc | null> {
  const key = docKey(doctype, name)
  if (!docs[key]) docs[key] = entry<FrappeDoc | null>(null)
  return docs[key]
}

export async function loadDoc(doctype: string, name: string): Promise<CacheEntry<FrappeDoc | null>> {
  const state = docFor(doctype, name)
  state.loading = true
  state.error = null
  try {
    state.data = await getDoc(doctype, name)
  } catch (e) {
    state.error = (e as Error).message
  } finally {
    state.loading = false
  }
  return state
}

// ---- dashboard card values ---------------------------------------------------
export function countFor(doctype: string, filters?: ListFilters, fieldname?: string): CacheEntry<number | null> {
  const key = countKey(doctype, filters, fieldname)
  if (!counts[key]) counts[key] = entry<number | null>(null)
  return counts[key]
}

export async function loadCount(doctype: string, filters?: ListFilters, fieldname?: string): Promise<CacheEntry<number | null>> {
  const state = countFor(doctype, filters, fieldname)
  state.loading = true
  state.error = null
  try {
    state.data = await cardValue(doctype, filters, fieldname)
  } catch (e) {
    state.error = (e as Error).message
  } finally {
    state.loading = false
  }
  return state
}

// ---- live field schema (for the editable form) -------------------------------
// The doctype's real field descriptors, grouped by section, plus its create/write
// permissions. Static per doctype, so it is fetched once and cached.
export function fieldMetaFor(doctype: string): CacheEntry<DoctypeMetaPayload | null> {
  if (!fieldMetas[doctype]) fieldMetas[doctype] = entry<DoctypeMetaPayload | null>(null)
  return fieldMetas[doctype]
}

export async function loadFieldMeta(doctype: string): Promise<CacheEntry<DoctypeMetaPayload | null>> {
  const state = fieldMetaFor(doctype)
  if (state.data || state.loading) return state
  state.loading = true
  state.error = null
  try {
    state.data = await getDoctypeMeta(doctype)
    // Deliver the doctype's Doctype/View-scoped Actions/Commands into the registry (ADR-0032) — the
    // live-meta half of delivery-by-scope, folded in the moment its meta arrives (the App/OS half
    // rides boot). The projector then composes them with the front stack, gated by Eligibility.
    registerScopedContributions(doctype, state.data.contributions || [])
  } catch (e) {
    state.error = (e as Error).message
  } finally {
    state.loading = false
  }
  return state
}

// ---- writes (refresh the cache through the live API) -------------------------
export async function saveDoc(doctype: string, name: string, changes: Record<string, unknown>): Promise<FrappeDoc> {
  const saved = await apiSaveDoc(doctype, name, changes)
  docFor(doctype, name).data = saved
  await refreshLists(doctype)
  return saved
}

export async function createDoc(doctype: string, values: Record<string, unknown>): Promise<FrappeDoc> {
  const created = await apiCreateDoc(doctype, values)
  if (created && created.name) docFor(doctype, created.name).data = created
  await refreshLists(doctype)
  return created
}

// Bulk-update a field across many docnames — the write-then-refresh seam a bulk run Handler drives
// (ADR-0032), mirroring saveDoc/createDoc, but split on how the backend applies the write. A small
// selection runs INLINE (a `failed` array back): the rows are mutated now, so we refresh the open
// list windows and report the failures. 20+ rows are ENQUEUED (`null` back): nothing has changed
// yet, so we must NOT refresh eagerly (a refresh would show stale rows under a false success) nor
// read [] as "all succeeded". Instead we acknowledge the enqueue and let the pre-joined watch refresh
// + confirm the moment the job finishes (data/realtime.ts; the Desk `_server_messages` alert the
// backend emits never reaches the OS shell, so feedback rides `toast`, not that alert).
//
// We JOIN the job's realtime room (keyed by a client-generated `task_id`) BEFORE firing the write, so
// a fast enqueued job can't finish before we're listening (review #2); then we commit to one outcome —
// arm the watch (enqueued) or cancel it (inline ran synchronously; a stray terminal emit is ignored).
export async function bulkUpdate(doctype: string, docnames: string[], changes: Record<string, unknown>): Promise<BulkUpdateResult> {
  const taskId = newTaskId()
  const watch = await watchTask(taskId)
  // A rejected write (network / 417 / CSRF) means the job never ran, so its terminal event will
  // never come — cancel the pre-joined watch before re-throwing, else its room membership and
  // reconnect resubscriber leak on the shared, process-lifetime socket until the timeout fires.
  let failed: string[] | null
  try {
    failed = await apiBulkUpdate(doctype, docnames, changes, taskId)
  } catch (error) {
    watch.cancel()
    throw error
  }
  if (failed === null) return enqueuedBulk(doctype, docnames.length, watch)
  watch.cancel()
  await refreshLists(doctype)
  // The inline run applied now — confirm it and surface any rows the backend rejected instead of
  // silently dropping the returned `failed` array (same summary the enqueued completion uses).
  notify(bulkSummary(docnames.length, failed, doctype))
  return { enqueued: false, failed }
}

// The enqueued tail: acknowledge the background job, then refresh + confirm when its terminal event
// lands. The job carries its `failed` list on that event, so the completion reports failures exactly
// like the inline path; when the seam is dark and the timeout fallback fires with no result, we can't
// itemize — say so softly rather than claim a false "all updated".
function enqueuedBulk(doctype: string, total: number, watch: TaskWatch): BulkUpdateResult {
  notify(`Updating ${recordCount(total, doctype)} in the background…`)
  watch.onComplete((result) => {
    refreshLists(doctype)
    const done = (result as { failed?: string[] } | undefined)?.failed
    notify(done ? bulkSummary(total, done, doctype) : `Background update finished.`)
  })
  return { enqueued: true, failed: [] }
}

// "3 ToDo records" / "1 ToDo record" — the shared count phrase for every bulk-update toast.
function recordCount(count: number, doctype: string): string {
  return `${count} ${doctype} record${count === 1 ? '' : 's'}`
}

// The bulk-completion toast, shared by both paths (inline now, enqueued when its terminal event
// lands): a clean "Updated N …" on full success, or "Updated X …; K failed" when some rows were
// rejected — the failures are reported, never swallowed.
function bulkSummary(total: number, failed: string[], doctype: string): string {
  if (!failed.length) return `Updated ${recordCount(total, doctype)}.`
  return `Updated ${recordCount(total - failed.length, doctype)}; ${failed.length} failed.`
}

// A short unique id naming the enqueued job's realtime progress channel (`task_progress:{id}`).
// `crypto.randomUUID` where available; a random fallback for older/test environments.
function newTaskId(): string {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2, 12)
}

// ---- synchronous getter (compat bridge for components, Phase 4 wires loads) --
// A pure read — it never creates a cache entry, so calling it during a component render can't
// mutate reactive state. Returns whatever the load* actions have cached so far, keyed by
// doctype/name (the shaped LIST keys are never bare-doctype, so there is no synchronous list
// getter here — a window reads its own listFor(doctype, shape) entry, ADR-0028).
export const recordObj = (doctype: string, name: string): FrappeDoc | null => {
  const state = docs[docKey(doctype, name)]
  return state ? state.data : null
}
