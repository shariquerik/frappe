# Working state: per-window, per-subject, hoisted out of the surface components

Status: accepted

A **Window** hosts a **Surface** (an addressable coordinate — doctype/record/view/aspect) and
carries **Geo** (its box). Neither holds the *work in progress* a user builds up over that
surface: a list's filters/sort/columns, a form's unsaved edits, scroll, an applet's internal
state. Today that state lives in the surface components (`OSForm`'s `formDoc` ref, the state
inside `@framework/ui`'s `useListView`), so it dies whenever the component unmounts — and we
want to unmount cold windows to reclaim memory as many windows accumulate. This ADR introduces
**Working state** as the third per-window fact, hoisted into the OS store, so unmounting a
window is lossless.

## Decision

- **Identity — per `(Window × subject)`.** Working state is scoped to a window (Instances are
  independent, per CONTEXT), and *within* a window to a **subject**: a coarsened surface
  identity, not the full coordinate. `subjectKey(surface)` lives beside `sameSurface` in
  `surface/index.ts` and is total (every surface has a subject): `list:<doctype>`,
  `form:<doctype>:<recordName>` (**Aspect excluded**, so edits survive Details↔Activities),
  `dashboard:<appId>`, `applet:<appId>:<appletId>`, and the system windows by their own id.
  Aspect is deliberately dropped from the form subject even though `sameSurface` keys on it —
  a draft belongs to the record, not the record-at-a-tab.

- **Persistence is a per-entry policy, not a per-kind table.** Each entry declares **durable**
  (also written to `localStorage`, survives reload) or **ephemeral** (memory-only, survives
  unmount but not reload). The list **View Snapshot** is durable (ADR-0007's `snapshot`/
  `restore` seam, finally wired on the host side); form drafts, scroll, and applet blobs are
  ephemeral. Durable entries are kept across window close and only overwritten (mirroring how
  `closeWin` keeps `state.geo[id]`, ADR-0019); ephemeral entries are history-pruned (bounded by
  `HIST_CAP`) and dropped on close. The durable list entry is exactly ADR-0007's
  `ListViewSnapshot` (filters/sort/columns/quick-filter).

- **A subject holds multiple FACETS, each with its own policy.** A durable list snapshot and an
  ephemeral scroll/paging position belong to the *same* list subject but need *different*
  persistence — which one entry cannot mix. So a subject's primary entry keeps the bare
  `subjectKey` (the durable snapshot, byte-identical to `ListViewSnapshot`), and a **facet** is a
  second entry keyed `subjectKey<NUL>facet` (`subjectFacet`/`baseSubject` in
  `desktop/working-state.ts`; `useWorkingState({ facet })`). Facets share the subject's lifecycle:
  prune and reachability coarsen a facet key back to its base subject, and durable persistence
  filters by policy, so an ephemeral facet is naturally excluded from `localStorage`. This is what
  lets the list's **scroll + paging position** live as one ephemeral facet `{ scrollTop, count }`
  beside the durable snapshot: the list reopens where it was left after visiting a record
  (survives in-window nav + unmount), but resets to page-one/top on reload. `count` is the visible
  row window — the fetch requests exactly that many rows, so the earlier "pageLength stays local,
  resets on remount" note is superseded: paging is now this ephemeral facet, not a lost local ref.

- **Unsaved ephemeral state is guarded, never silently lost or silently persisted.** An
  ephemeral entry that is **dirty** arms both a `beforeunload` confirmation (browser reload/tab
  close) and a symmetric in-app confirmation on OS window close. A form draft's dirty signal is
  its existing `isDirty`; it clears on successful save/create.

- **A saved form adopts the saved doc as its new clean baseline.** On successful save the draft is
  dropped AND `formDoc` is reseeded from the returned doc, so the server-refreshed `modified`
  realigns. Without this the stale `modified` lingers as a phantom dirty field that a second save
  resends, tripping Frappe's optimistic lock (`TimestampMismatchError`). The dirty diff
  (`changedFields`) is thus purely record-vs-working-copy, with the record as the authoritative
  baseline.

- **One dogfooded seam — `useWorkingState`.** The applet OS-API composable and the internal
  `OSList`/`OSForm` wiring are the same composable. It derives the subject from the window's
  current surface (provided by `OSWindow`, like `TOOLBAR_SLOT`/`WINDOW_FOCUSED`) and takes the
  `persist` policy + `dirty` getter from the caller. Applets — being custom-coded — participate
  *only* through this seam; the OS never reads inside them.

- **Home — `desktop/`, not `data/`.** Working state is window-scoped UI state (family of
  geometry), not a server cache. The reactive slab `state.workingState[winId][subjectKey]` lives
  in `desktop/state.ts`; the logic (`entryFor`, prune, drop, `dirtyWindows`) in
  `desktop/working-state.ts`.

## Considered and rejected

- **`useListView` replacement.** Unnecessary — the library already exposes the exact `snapshot`/
  `restore` persistence seam (ADR-0007); the host simply never wired it. We consume it.
- **Per-window single "current surface" slot (no subject).** Simpler, zero GC, but loses list
  filters and drafts on in-window back-nav — the weaker half-solution.
- **Never unmounting applet windows** (sidestepping the applet-state problem) — caps the memory
  win for exactly the heaviest windows.

## Deferred

- **Durable form drafts** — `.scratch/working-state/issues/` (durable-drafts): document
  restoration across reload, gated on staleness handling. Ephemeral + guard is the safe default.
- **LRU cap on durable entries** — durable snapshots accumulate per doctype-ever-filtered per
  window; a per-window cap is deferred until localStorage growth is real.
- **Applet `useWorkingState` OS-API seam** — the store and subject model land first; the applet
  seam is a fast-follow on the identical foundation.
