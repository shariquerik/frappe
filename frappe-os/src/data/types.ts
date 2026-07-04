// The data-layer shapes (the Frappe doc, the cache slot, list options) AND the OS API seam
// (ADR-0003) — the single, narrow object every component & script receives to reach Frappe
// OS. The seam lives here because data/os-api.ts implements it; applets never touch the
// store, router, data/api.ts or records.ts directly. Additive-only (ADR-0008): grow these
// interfaces, never reshape. Re-exported via @/types.
import type { Component } from 'vue'
import type { useOS } from '@/desktop'
import type { FilterValue, DoctypeMeta, DoctypeViewPayload } from '@/config/types'
import type { Surface } from '@/surface/types'
import type { BootData, Contribution } from '@/registry/types'
import type { IndicatorSpec } from '@/indicators/types'
import type { CustomizationGroup } from '@/actions/types'

// ── Data layer (api.ts, records.ts) ──────────────────────────────────────────────
// A Frappe document as returned by the REST/whitelisted API: a free-form field bag
// that always carries at least `name`. Concrete doctypes aren't modeled — the shell
// reads fields dynamically via the curated config, not a per-doctype interface.
export interface FrappeDoc {
  name: string
  [field: string]: any
}

// One reactive cache slot in the records store: the load* actions flip `loading`,
// fill `data`, or set `error` (the caught message). `T` is the cached payload —
// a row array, a single doc, a card number, or the live field schema.
export interface CacheEntry<T> {
  loading: boolean
  data: T
  error: string | null
}

// ── Live doctype meta (get_doctype_meta) ─────────────────────────────────────────
// One form field descriptor from the live doctype meta, tagged with the label of the Section
// Break it falls under. Snake_case by the casing boundary (CONTEXT.md): this is Frappe-native
// meta (`frappe.get_meta(...).fields`) passed through verbatim, not an OS-authored shape.
export interface DoctypeField {
  fieldname: string
  label: string
  fieldtype: string
  options: string | null
  section: string
  reqd: boolean
  read_only: boolean
  in_list_view: boolean
}

// The live, permission-checked doctype meta a list/form loads when a doctype opens (ADR-0028) —
// the return of `frappe.os_core.meta.get_doctype_meta`. This is the one response that carries
// BOTH sides of the casing boundary (CONTEXT.md): snake_case Frappe-native meta at the top level
// wrapping the camelCase OS-authored `contributions` list. Typed so a typo on the snake_case side
// fails at typecheck instead of surfacing at runtime as untyped `any`.
export interface DoctypeMetaPayload {
  doctype: string
  // The doctype's title field, defaulting to "name" server-side when it has none.
  title_field: string
  // The normalized Record-indicator spec (ADR-0028); null when the doctype has no status model.
  indicator: IndicatorSpec | null
  can_create: boolean
  can_write: boolean
  // Lean field descriptors grouped by Section Break — the form-layout raw material.
  fields: DoctypeField[]
  // The doctype's co-located `os/` manifest (ADR-0030), carried as data for the view to read;
  // {} when the doctype ships none. Opaque here — the later folders evaluate what it declares.
  manifest: Record<string, unknown>
  // The doctype's Doctype/View-scoped Action + Command contributions (ADR-0032) — the OS-authored,
  // camelCase half of this payload, folded into the registry the moment the meta arrives.
  contributions: Contribution[]
}

// A single Frappe wire filter — the shape the list-view controls emit
// (`[fieldname, operator, value]`), optionally doctype-qualified
// (`[doctype, fieldname, operator, value]`). `frappe.client.get_list` and the OS
// `card_value` method both accept this list form alongside the field→value dict.
export type WireFilter = [string, string, unknown] | [string, string, string, unknown]

// A list read's filters: the legacy field→value dict OR the controls' wire list
// (`view.filters.wire`). Both reach the same server methods unchanged (ADR-0025).
export type ListFilters = Record<string, FilterValue> | WireFilter[]

// Options for a list read (api.getList). All optional; the server applies defaults.
// `start` is the paging offset (`limit_start`); a value > 0 appends the next page.
export interface GetListOptions {
  fields?: string[]
  limit?: number
  start?: number
  order_by?: string
  filters?: ListFilters
}

// The outcome of a bulk write (records.bulkUpdate). The standard bulk method applies a small
// selection inline but ENQUEUES 20+ rows in a background job, so the two must not be conflated:
// an enqueued run has changed nothing yet (its `failed` is [] because nothing has run, NOT because
// everything succeeded), and the list is deliberately left un-refreshed rather than showing stale
// rows under a false "done". `enqueued` lets the caller tell "applied now" from "applied later".
export interface BulkUpdateResult {
  enqueued: boolean // true → running in the background; the list is not yet refreshed
  failed: string[] // docnames the inline run failed on; [] when enqueued (nothing has run yet)
}

// ── Store surface ─────────────────────────────────────────────────────────────────
// `OsStore` is the *exact* surface useOS() returns — derived from the assembly in
// desktop/index.ts (the type-only import above) rather than hand-maintained, so it can
// never drift from the real store. Consumers that take the store explicitly (route-map.ts,
// the typed components) annotate against this; a Vue computed/ref member is exposed as
// `{ value }`. The import is type-only, so it is erased at runtime and the
// seam ⇄ desktop import cycle never materializes.
export type OsStore = ReturnType<typeof useOS>

// ── OS API seam (data/os-api.ts) ───────────────────────────────────────────────────
// Data access. Reads + `call` go straight to data/api.ts (they throw on error and never
// touch the shared list/doc caches, so a component's filtered read can't clobber what
// a built-in view shows); writes go through the records store so those caches refresh.
export interface OsData {
  getList(doctype: string, options?: GetListOptions): Promise<FrappeDoc[]>
  getDoc(doctype: string, name: string): Promise<FrappeDoc>
  saveDoc(doctype: string, name: string, changes: Record<string, unknown>): Promise<FrappeDoc>
  createDoc(doctype: string, values: Record<string, unknown>): Promise<FrappeDoc>
  call(method: string, params?: Record<string, unknown>): Promise<any>
}

// Window lifecycle. `open` dispatches any Surface to its owning app window;
// `focus` raises + un-minimizes; `close` disposes.
export interface OsWindows {
  open(surface: Surface): void
  close(id: string): void
  focus(id: string): void
}

// User feedback. `notify` is a transient toast; `confirm` resolves true/false.
export interface OsUi {
  notify(message: string): void
  confirm(message: string): Promise<boolean>
}

// A permission action. Open string (ADR-0004): the common four plus whatever the
// server-merged permission map carries.
export type PermissionType = 'read' | 'write' | 'create' | 'delete' | string

// Read-only session facts, projected from the resolved BootData. `hasPermission`
// reads BootData.permissions[doctype][ptype] (Frappe-style read/write/create/delete),
// defaulting to false; `roles` is the server-supplied role list (BootData.roles).
export interface OsSession {
  user: string | null
  roles: string[]
  hasPermission(doctype: string, ptype?: PermissionType): boolean
}

// Read-only registry projections (surface-and-registry.md §2). Step 3 backs these with
// useRegistry(); step 4 swaps useRegistry()'s source to the server-merged Registry with
// no change to this shape. `views` is the real DoctypeViewPayload collection (was a
// `string[]` placeholder in step 2).
export interface OsRegistry {
  displayConfig(doctype: string): DoctypeMeta | null
  views(doctype: string): DoctypeViewPayload[]
  // Resolve an applet contribution to its Vue component by id (ADR-0009, async-by-id).
  // First-party applets resolve from a local map; external ESM loading is deferred
  // behind this same seam, so the contract never changes when it lands.
  resolveApplet(appletId: string): Promise<Component>
  // The cooked Customizations catalog (ADR-0015, issue 05): groups carrying appKind, rows
  // carrying the baked-in `unexpected` flag — the OS computes, the applet only renders. The
  // internal Action model stays private (no raw actions()/appKind() on the seam); a fresh
  // snapshot per call, like the other registry projections.
  customizations(): CustomizationGroup[]
}

export interface OsApi {
  data: OsData
  windows: OsWindows
  ui: OsUi
  session: OsSession
  registry: OsRegistry
  // Feature detection (ADR-0008): components test a capability before using it
  // instead of sniffing OS API versions. Additive — flip false→true as features land.
  capabilities: Record<string, boolean>
}
