// Live record store: reactive caches over the Frappe REST/whitelisted API, replacing
// the old synchronous mock. Three caches — lists, single docs, dashboard card values
// — each entry shaped { loading, data, error }. Getters (listFor/docFor/countFor)
// return the reactive entry; the load* actions populate it. Writes go through api.js
// and refresh the affected cache. Display config (which fields to fetch) comes from
// the curated getMeta — the records here carry no display knowledge.

import { reactive } from 'vue'
import { getList, getDoc, getDoctypeMeta, saveDoc as apiSaveDoc, createDoc as apiCreateDoc, bulkUpdate as apiBulkUpdate, cardValue } from '@/data/api'
import { registerScopedContributions } from '@/registry'
import type { CacheEntry, ListFilters, FrappeDoc, GetListOptions, BulkUpdateResult } from '@/types'

const lists = reactive<Record<string, CacheEntry<FrappeDoc[]>>>({}) // doctype -> entry, data is rows[]
const docs = reactive<Record<string, CacheEntry<FrappeDoc | null>>>({}) // "doctype/name" -> entry, data is the doc
const counts = reactive<Record<string, CacheEntry<number | null>>>({}) // cache key -> entry, data is a number
const fieldMetas = reactive<Record<string, CacheEntry<any>>>({}) // doctype -> entry, data is the live field schema

const entry = <T>(data: T): CacheEntry<T> => ({ loading: false, data, error: null })
const docKey = (doctype: string, name: string) => `${doctype}/${name}`
const countKey = (doctype: string, filters?: ListFilters, fieldname?: string) =>
  JSON.stringify([doctype, filters || null, fieldname || null])

// ---- list cache --------------------------------------------------------------
export function listFor(doctype: string): CacheEntry<FrappeDoc[]> {
  if (!lists[doctype]) lists[doctype] = entry<FrappeDoc[]>([])
  return lists[doctype]
}

// The caller projects the fields to fetch: the list view passes its lean set (name + visible
// wire columns + Record-indicator resolver fields, ADR-0028 / #04b). `['*']` stays only as the
// fallback for context-free refreshes (post-save, dashboard recents) that hold no column shape.
export async function loadList(doctype: string, options: GetListOptions = {}): Promise<CacheEntry<FrappeDoc[]>> {
  const state = listFor(doctype)
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
  return loadList(doctype, { ...options, start: listFor(doctype).data.length })
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
export function fieldMetaFor(doctype: string): CacheEntry<any> {
  if (!fieldMetas[doctype]) fieldMetas[doctype] = entry<any>(null)
  return fieldMetas[doctype]
}

export async function loadFieldMeta(doctype: string): Promise<CacheEntry<any>> {
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
  await loadList(doctype)
  return saved
}

export async function createDoc(doctype: string, values: Record<string, unknown>): Promise<FrappeDoc> {
  const created = await apiCreateDoc(doctype, values)
  if (created && created.name) docFor(doctype, created.name).data = created
  await loadList(doctype)
  return created
}

// Bulk-update a field across many docnames — the write-then-refresh seam a bulk run Handler drives
// (ADR-0032), mirroring saveDoc/createDoc, but split on how the backend applies the write. A small
// selection runs INLINE (a `failed` array back): the rows are mutated now, so we refresh the list
// and report the failures. 20+ rows are ENQUEUED (`null` back): nothing has changed yet, so we must
// NOT refresh (a refresh would show stale rows under a false success) nor read [] as "all succeeded"
// — we return `enqueued` instead. Refreshing the list when the background job finishes needs a
// realtime completion signal; deferred (.scratch/deferred-hardcoded/issues/17-bulk-update-enqueued-refresh.md).
export async function bulkUpdate(doctype: string, docnames: string[], changes: Record<string, unknown>): Promise<BulkUpdateResult> {
  const failed = await apiBulkUpdate(doctype, docnames, changes)
  if (failed === null) return { enqueued: true, failed: [] }
  await loadList(doctype)
  return { enqueued: false, failed }
}

// ---- synchronous getters (compat bridge for components, Phase 4 wires loads) -
// Pure reads — they never create a cache entry, so calling them during a component
// render can't mutate reactive state. They return whatever the load* actions have
// cached so far (empty until Phase 4 triggers loads).
export const recordsFor = (doctype: string): FrappeDoc[] => (lists[doctype] && lists[doctype].data) || []
export const recordObj = (doctype: string, name: string): FrappeDoc | null => {
  const state = docs[docKey(doctype, name)]
  return state ? state.data : null
}
