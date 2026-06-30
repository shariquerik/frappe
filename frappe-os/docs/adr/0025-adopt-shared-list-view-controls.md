# Adopt the @framework/ui list-view controls as a controlled overlay

> **Status:** Proposed (2026-06-30). Grilled, not implemented. First slice of replacing
> `OSList`'s hand-rolled toolbar (the dead Filter/Sort buttons) with the shared list-view
> controls extracted into `@framework/ui` (frappe/frappe#40404).

The **list** Surface's toolbar adopts the shared, controlled, meta-driven controls —
**Filter**, **SortBy**, **ColumnSettings**, **QuickFilter** — bound to one `useListView(doctype)`
state composable. The controls own only view state; frappe-os stays the host that owns
**fetching**, **persistence**, and **cross-control wiring** (the library's split — see its
[`ui/CONTEXT.md`](../../../ui/CONTEXT.md) and ADR-0007). This records the boundary choices that
are surprising in the OS's own terms and costly to walk back.

## frappe-os keeps fetching; the library's `useListData` is not used

The controls are fetch-free by design and expose **wire projections** — `view.filters.wire`
(a Frappe filter list) and `view.sort.orderBy` (an `order_by` string). frappe-os feeds those
into its **existing** data layer (`os.loadList` / `os.loadCount` → `frappe.client.get_list`),
**not** the library's optional `useListData` companion.

`useListData` would have been less code, but it calls `frappe.client.get_list` directly — a
**second data path** alongside the OS store that already powers nav-rail counts and the record
caches. Two fetch layers for one screen, and one of them outside the OS data seam (ADR-0003),
was the wrong trade. We extend the OS store with paging instead (`start`/offset + `loadMore`
append + `pageLength`→`limit`), and bind frappe-ui's presentation-only `ListFooter` to it. The
count is made **filter-aware** (`os.loadCount` receives the same wire filters) so "X of Y" stays
honest once filtering is live.

## Field Options come from the library's `useDoctypeMeta` — a deliberate Registry carve-out

Each control derives its **Field Options** from doctype **Meta** via the library's
`useDoctypeMeta` (Frappe's `getdoctype`). The controls hard-wire this — there is no inject/prop
seam — so frappe-os uses it as shipped rather than forking the four components.

This is the surprising part in OS terms: the **Registry** is meant to be "the frontend's single
source of truth," and `config/*.ts` is meant to dissolve into it. Yet the list controls reach
raw Frappe metadata directly, bypassing the Registry. We accept this because field **schema**
(fieldtypes → operator sets) is genuinely raw Frappe metadata — distinct in kind from the curated
**Display config** the Registry owns (labels, colors, cell kinds, default columns/filters). The
Registry carve-out is for *schema*, not for *presentation*; presentation stays the Registry's.

## Cells are Meta-derived now; Display-config enrichment is a deferred layer

`OSListView` stays the renderer, but its column input is now Meta-derived
(`getDefaultColumns`), and its cells render plain/typed in this slice. The curated presentation
— the themed `StatusPill` (status→color), the `Avatar` treatment, the `primary` title, and the
curated default column set — is **Display config**, and it is **not Meta-derivable**. It becomes
a separate **enrichment layer** applied over Meta-derived columns, **deferred** to a later slice.
The `StatusPill`/`Avatar`/`primary` code stays in the tree, dormant, until that layer lands.

Two accepted consequences for the first slice: the column set differs from today's curated six
(Meta picks the defaults), and the screenshot's pills/avatars are absent until enrichment returns.

## Considered and rejected

- **Full shell replacement** (library `ListViewShell` + frappe-ui `ListView` table +
  `useListData`). Maximum reuse, but bypasses the OS data seam and discards the custom cell
  rendering. Rejected — the controlled overlay keeps the OS in charge of its own data and chrome.
- **Make `useDoctypeMeta` OS-aware** (source fields from an OS meta endpoint, one meta source).
  Rejected — it modifies shared `@framework/ui` code for a consumer-specific need (risk to CRM),
  and the lean OS meta endpoint doesn't carry the full `RawMetaField` shape (operators,
  `in_standard_filter`, options) the helpers need.
- **Fork the four controls with an injectable `fields` prop.** Most control, most code, defeats
  reuse. Better upstreamed to the library later as a real injection seam than forked downstream.
- **Display-config enrichment now (hybrid cells).** Rejected — that *is* the deferred layer; the
  clean Meta-derived boundary is worth a temporary visual regression.

## Persistence is the host's, and deferred

The library tops out at a **View Snapshot** and owns no saving (ADR-0007). The host decides when
and where. For this slice we defer it entirely: view state is **in-memory only** and resets on
remount/reload. There is **no saved-view concept** — the non-functional saved-view chip and
bookmark affordance are **removed** rather than left as dead chrome, and return when the feature
is actually built. When persistence lands it is expected to ride the OS Customization layers
(App < Site < User) as a User-layer override, consistent with ADR-0005 and Placements (ADR-0023),
not a parallel store.

## Relationship to prior ADRs

- **ADR-0003 (OS API single seam).** The driver for keeping fetching on the OS store rather than
  `useListData`. Note the carve-out: the controls reach `getdoctype` for *schema* outside that
  seam — accepted, scoped to schema, and recorded here.
- **ADR-0007 (library, persistence deferred to host).** Why there is no saving in this slice; the
  host owns when/where.
- **ADR-0005 (layered registry server merge) / ADR-0023 (Placements).** The intended home for the
  deferred persistence (a User-layer override), when it lands.
</content>
</invoke>
