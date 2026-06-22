# The Customizations view is a read-only structural catalog of declared customizations

---
Status: accepted
Refines: ADR-0014 item 3 (the "Customizations" view) and item 4 (the feature-app flag)
Builds-on: ADR-0007 (layer order, contribution identity), ADR-0011 (Projection)
---

ADR-0014 item 3 promised one "Customizations" view that surfaces, rather than buries,
the overrides and removals apps impose on a site. This ADR settles the four design forks
that item left open: what the view reads, whether it can edit, who may restore, and how it
groups.

## Decision

### 1. Read-only this slice; the restore/revert write path is deferred but not foreclosed

The view is an **audit listing**. It does not yet let a human restore a removed item or
revert an override inline. ADR-0014 item 2's "always reversible by the human" stays true
only **by layering** for now — a higher-layer Action already wins mechanically — with no
human-facing button until the write-path slice ships.

We split it because the write path does not exist yet: every Action today folds from app
hooks or the seed (`registry/index.ts`), and there is **no Site/User Action persistence
anywhere**. Inventing that store is a separable concern. The constraint we accept in return:
the view's projection must be shaped so a per-row **Restore / Revert** affordance is
*additive* later — a column the rows already carry the data for — not a rewrite.

### 2. Restore happens at the layer the human operates at — no extra authority gate

When the write path ships, a **User** may restore for themselves and a **Site** admin may
restore for everyone, each authoring a counter-Action at their own layer. There is **no
"only a Site admin may undo an app removal" gate.** ADR-0014's thesis is "safety is
visibility + reversibility, *not prohibition*"; a restore gate would reintroduce prohibition
and let an app+admin pairing have the final word over a person, which item 2 forbids. The
layer order already encodes the right outcome — a User restore wins for that user only, a
Site restore wins for everyone, and an admin who disagrees authors a higher-`priority` Site
Action. Permission (ADR-0010, server-side) stays the orthogonal gate for *whether a user may
write a Site-layer record at all*.

### 3. The counter-Action persists through the Projection seam — no new merge path

A restore/revert is an ordinary Site/User-layer `Action` (`layer: 'site' | 'user'`, no
`removed`, optionally a higher `priority`) **projected from a metadata DocType** — the
Property Setter analogue for chrome — arriving in `boot.registry.contributions` and folding
through `addToIndex` unchanged, winning by the existing tiebreak. No new client-side merge
logic: the view writes a record, boot re-projects, the resolver does the rest. The concrete
DocType is **deferred to the write-path slice** — naming the schema now risks specifying a
table we revise once we build the round-trip.

### 4. The view is a structural projection over the contribution set, not live resolver output

This is the load-bearing decision. `resolve()` runs **per-Region against the current
Context**, filtering by eligibility (`when`) *before* competition, and only `console.warn`s
its `ShadowEvent`s — **there is no stored shadow ledger.** So a contextual customization
(erpnext re-titling "New window" `when activeApp = 'erpnext'`) produces a shadow *only* when
the live Context matches, and no single Context surfaces them all. "List the resolver's
shadows" is therefore under-defined.

Instead, the view reads the full declared Action set (`useRegistry().actions()`) and
**describes the customizations structurally**: it groups Actions by competition identity
`(region, command)` and, for each customizing contender — any Action carrying `removed`,
carrying a `commandPatch`, or a non-`app`-layer same-identity Action — reports its
`sourceApp`, `layer`, **reason** (`removal` if `removed`, else `override`), and the **`when`
scope it applies under** ("applies when activeApp = erpnext"). It deliberately asserts **no
single live winner** — the winner is Context-dependent; the view shows the *contest and its
conditions*, not a replay of one window's decision. Consequently it lists **every customizing
contender**, not a filtered "winner" set.

This reuses the resolver's `override` / `removal` vocabulary but **not its live output** — a
real shift from ADR-0014 item 3's "built from attribution data" phrasing, recorded here so it
is not a later surprise: built from the same *contribution set and reason vocabulary* the
resolver attributes from, read as a catalog.

### 5. Grouped by app; the feature-app flag is surfaced here

Primary grouping is **by overriding app** (region and reason are secondary sort / columns,
not the top level), because the human question is "what has *this app* done to my OS?" — the
app-as-actor framing of ADR-0014.

The view is the human home ADR-0014 item 4's loud-removal warning was always meant to reach.
Each app group shows its **kind** (feature / pure-customization, from `useRegistry().appKind`)
and a **feature app that removes chrome carries a visible "unexpected — review this" marker**
on those removal rows — the human-facing twin of the `removals.ts` console warning, from the
same predicate. Pure-customization removals list quietly. No new classification logic.

## Considered alternatives

- **Editable in v1 (ship the restore button now).** Rejected: requires the Site/User Action
  persistence store, which does not exist and is a separable write-path slice. Deferred, not
  abandoned — decisions 2 and 3 keep it AFK-ready.
- **Restore reserved to Site admins.** Rejected: reintroduces the prohibition ADR-0014
  explicitly rejects; lets an app have the final word over a user.
- **Resolve live under the current (or an empty) Context.** Rejected: the current Context
  misses every customization not active in this window; an empty Context misses every
  *contextual* override — the most interesting case. Neither enumerates all customizations.
- **Group by region or by action type.** Rejected as primary axis: scatters one app's
  changes across the view and makes the per-app feature-app flag awkward; both remain as
  secondary columns/filters.

## Consequences

- The view depends only on `useRegistry().actions()` and `useRegistry().appKind` — no new
  resolver surface, no persistence, no server round-trip in this slice.
- ADR-0014 item 3 and item 4 are now resolved (read-only catalog + surfaced flag); the
  reversibility *button* (item 2's human-facing half) is the named next slice.
- The structural projection is testable as a pure function over an `Action[]` fixture
  (Vitest), independent of Context or the live resolver.
