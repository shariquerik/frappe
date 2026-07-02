# Synthetic list columns — a host-declared column that is not a docfield

> **Status:** Accepted (2026-07-02). Grilled, not yet implemented. Extends ADR-0025
> (shared list-view controls) and follows ADR-0028 (live Record indicators). Supersedes the
> render-only indicator-column projection that shipped with the list-indicator fix
> (`withIndicatorColumn` in `frappe-os/src/components/List/list-columns.ts`).

The **Record indicator** (ADR-0028) is a whole-row status pill — resolved from docstatus /
workflow state / enabled / publication, not from any single field's value. It therefore needs its
own column, independent of which docfields are visible. The first cut gave it a **render-only
projection** (`withIndicatorColumn`): a synthetic `_indicator` column folded into the render columns
*after* the library's column state, kept out of `useListView` entirely. That worked for rendering
but left the column a second-class citizen — invisible to **ColumnSettings** (its width could not
persist, its header resizer was a dead affordance, and the raw status field it subsumed still showed
a toggle the render silently ignored).

Rather than paper over those gaps, we make the concept **first-class**: `@framework/ui` gains a
**synthetic column** — a list **Column** declared by the *host* instead of resolved from doctype
Meta. This is a reusable extensibility seam (action columns, avatar columns, computed columns all
become possible later), with the Record indicator as its first user.

## A column is a field column or a synthetic column

A **field column** is the existing `Column` — backed by a real docfield `fieldname`, its render
metadata (`align` / `type` / `options`) derived from Meta at serialize time. A **synthetic column**
is declared by the host and carries its own render metadata. The two are a union; a synthetic column
is a first-class member of the shared column state — it lives in `shown`, persists in the **View
Snapshot** (ADR-0029), and appears in **ColumnSettings**.

The library stays **presentation-agnostic** (the ADR-0025 boundary holds): a synthetic column only
*declares* itself; the **host** draws its cell through the `#cell` slot (the cell **kind**). The
library never learns how to render a status pill.

## The declaration is host config; the state is user-owned — they do not co-mingle

A synthetic column has two disjoint kinds of data:

- **Declaration** (static, host-authored): `{ key, label, type?, align?, width?, place?, subsumes? }`.
  Passed to `useColumns(doctype, { synthetic })` (threaded from `useListView`).
- **State** (dynamic, user-owned, persisted): whether shown, current width, order — lives in
  `shown` like any column.

We refuse to bake declaration into the persisted `Column`. Freezing `type: 'Status'` / render config
into a user's snapshot (localStorage today, a saved View tomorrow) would let a stale copy outlive a
library update. So **the persisted snapshot shape does not change**: a synthetic column rides the
existing `{ fieldname, label, width? }` slot, with its `key` in the `fieldname` position. The key is
**reserved with a leading `_`** (`_indicator`) — Frappe fieldnames never start with `_`, so it can
never collide with a docfield. Synthetic-ness is resolved by matching that key against the
declaration list at serialize time, never stored.

## Declaration fields

- **`key`** — the reserved identity (`_indicator`), rides the `fieldname` slot.
- **`label`**, **`type`**, **`align`**, **`width`** — the render metadata Meta would otherwise
  supply; `serializeColumns` passes these straight through for a synthetic key instead of a Meta
  lookup. `type` is a hint the host's cell slot reads (`'Status'`).
- **`place`** — the *default* position anchor: `'after-title' | 'start' | 'end'` (default `'end'`).
  The indicator uses `'after-title'`. An anchor, not a numeric index, because the library already
  knows `title_field` and an index is fragile against Meta's field order. Position seeds the default
  only; once the user reorders, the persisted order wins.
- **`subsumes`** — an optional docfield this column replaces in the **default seed** (see below).

Deferred: a **`pinned`** capability (always-shown, non-removable — a future row-actions column) is
*not* built now. The Record indicator is a plain default-on, fully toggleable column: clicking ✕
hides it, and it is re-addable — a customizable, soon-to-be-saveable View should not carry
non-removable citizens.

## `subsumes`: hide the raw status field by default, keep it re-addable

When a doctype has an indicator, showing both a "Paid" pill and a "Paid" text column is redundant.
Desk suppresses the raw `status` field entirely. We generalize that into the declaration:
`subsumes: spec.statusField` drops that one docfield from the **default seed only** — not a hard
render block. The field stays a Meta field, so it remains in the "Add Column" picker; re-adding it
renders normal text. This removes the old no-op-toggle mismatch without a bespoke hide-seam.

## The re-add path forces a picker union

Because a hidden synthetic column is not a Meta field, the "Add Column" picker
(`getColumnOptions(meta.fields)`) would never offer it back — hide would be irreversible. So the
picker offers **(Meta fields ∪ declared synthetic columns) − currently shown**. This is the one
place ColumnSettings needs the declaration list (a new additive `:synthetic` prop); everything else
it already does over the clean `{fieldname,label,width?}` model.

## The fetch must skip synthetic keys

Once the synthetic column lives inside `shown` / `wire`, its key flows into `wire`. `listFetchFields`
must **skip `_`-prefixed synthetic keys** — there is no docfield named `_indicator` to fetch. The
real fields the pill resolves against (`docstatus`, `enabled`, the status field) already arrive via
`spec.fields`, so nothing is lost. This is the load-bearing regression test on the OS side.

## Additive, so it does not breach ADR-0025

ADR-0025 refused to *fork* the shared controls for a consumer-specific need (risk to CRM). This is
the opposite: a **general seam**, upstreamed. Zero synthetic declarations ⇒ byte-identical behavior
for every existing consumer. The Record indicator is the OS's first use; the primitive is CRM's to
use too.

## Considered and rejected

- **Keep the render-only projection** (`withIndicatorColumn`) and only paper over the ColumnSettings
  gaps host-side. Rejected — the two mismatches (dead resizer, no-op status toggle) both need a
  library seam anyway, and a render-only column can never persist its width or be customized. Half
  the fix for the same upstream change.
- **Discriminated `Column`** — store the render metadata (`type`, `pinned`) on the persisted
  `Column`. Rejected — co-mingles static host config with user state and freezes stale render config
  into the snapshot.
- **A bespoke `status_field` special-case** (Desk's literal approach — hardcode a "Status" pseudo
  column in the controls). Rejected — solves only the indicator; a synthetic-column primitive solves
  the whole class (actions / avatar / computed columns) for the same effort.

## Relationship to prior ADRs

- **ADR-0025 (shared list-view controls).** This extends its column model; the presentation-agnostic
  boundary (host renders cells) is preserved, and the "no downstream fork" line is respected by
  keeping the change additive and upstream.
- **ADR-0028 (live Record indicators).** The indicator is *why* a non-docfield column is needed; this
  ADR is the column mechanism, that one is the pill's data model.
- **ADR-0029 (working state per window).** The synthetic column persists through the existing View
  Snapshot round-trip for free, precisely because the snapshot shape is unchanged.
