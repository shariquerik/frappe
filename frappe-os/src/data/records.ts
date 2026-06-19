// Live record store: reactive caches over the Frappe REST/whitelisted API, replacing
// the old synchronous mock. Three caches — lists, single docs, dashboard card values
// — each entry shaped { loading, data, error }. Getters (listFor/docFor/countFor)
// return the reactive entry; the load* actions populate it. Writes go through api.js
// and refresh the affected cache. Display config (which fields to fetch) comes from
// the curated getMeta — the records here carry no display knowledge.

import { reactive } from 'vue'
import { getList, getDoc, getDoctypeMeta, saveDoc as apiSaveDoc, createDoc as apiCreateDoc, cardValue } from '@/data/api'
import type { CacheEntry, FilterValue, FrappeDoc, GetListOptions } from '@/types'

const lists = reactive<Record<string, CacheEntry<FrappeDoc[]>>>({}) // doctype -> entry, data is rows[]
const docs = reactive<Record<string, CacheEntry<FrappeDoc | null>>>({}) // "doctype/name" -> entry, data is the doc
const counts = reactive<Record<string, CacheEntry<number | null>>>({}) // cache key -> entry, data is a number
const fieldMetas = reactive<Record<string, CacheEntry<any>>>({}) // doctype -> entry, data is the live field schema

const entry = <T>(data: T): CacheEntry<T> => ({ loading: false, data, error: null })
const docKey = (doctype: string, name: string) => `${doctype}/${name}`
const countKey = (doctype: string, filters?: Record<string, FilterValue>, fieldname?: string) =>
  JSON.stringify([doctype, filters || null, fieldname || null])

// ---- list cache --------------------------------------------------------------
export function listFor(doctype: string): CacheEntry<FrappeDoc[]> {
  if (!lists[doctype]) lists[doctype] = entry<FrappeDoc[]>([])
  return lists[doctype]
}

// We fetch all standard fields (`*`) rather than the curated column keys: several
// curated columns (enabled_label, status_label, stock_qty) are display-only and have
// no live backend field, so requesting them by name would error. Columns just read
// whatever keys exist on the row; missing ones render as "—".
export async function loadList(doctype: string, options: GetListOptions = {}): Promise<CacheEntry<FrappeDoc[]>> {
  const state = listFor(doctype)
  state.loading = true
  state.error = null
  try {
    state.data = await getList(doctype, { fields: ['*'], limit: 100, ...options })
  } catch (e) {
    state.error = (e as Error).message
  } finally {
    state.loading = false
  }
  return state
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
export function countFor(doctype: string, filters?: Record<string, FilterValue>, fieldname?: string): CacheEntry<number | null> {
  const key = countKey(doctype, filters, fieldname)
  if (!counts[key]) counts[key] = entry<number | null>(null)
  return counts[key]
}

export async function loadCount(doctype: string, filters?: Record<string, FilterValue>, fieldname?: string): Promise<CacheEntry<number | null>> {
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

// ---- synchronous getters (compat bridge for components, Phase 4 wires loads) -
// Pure reads — they never create a cache entry, so calling them during a component
// render can't mutate reactive state. They return whatever the load* actions have
// cached so far (empty until Phase 4 triggers loads).
export const recordsFor = (doctype: string): FrappeDoc[] => (lists[doctype] && lists[doctype].data) || []
export const recordObj = (doctype: string, name: string): FrappeDoc | null => {
  const state = docs[docKey(doctype, name)]
  return state ? state.data : null
}
