# OS Recent store (record-opens) + Finder Recents Location

Status: ✅ DONE (2026-06-25)

Triage: ready-for-agent (AFK)

## Implementation note (2026-06-25)

Shipped as the final leaf of the Customizable-Desktop arc, riding the proven surface-reference seam.

- **`OS Recent` DocType** (`frappe/desk/doctype/os_recent/`) — owner-scoped, one row per open
  (`surface_ref` JSON + `opened_at`), de-duped by canonical reference, mirrors the row-per-placement
  shape (ADR-0023) and roams the same way. Permission shape copied from `OS Placement Override`
  (Desk User, `if_owner`).
- **Server (`frappe/www/os.py`)** — `record_recent(surface_ref: str)` (`POST`, annotated → no 417)
  bumps-or-inserts the owner's row then `_trim_recents()` enforces the `RECENTS_CAP=50` trim
  server-side; `get_recents()` reads the rows newest-first through the pure `recents_view(refs,
  can_see, cap)` (dedup + permission-gate + cap — the merge_placements-style testable core). Injected
  into the boot dict beside `placements`.
- **Client write seam** — a new `src/recents/` store (mirrors `src/placements/`): `initRecents`
  off boot, `useRecents()` synchronous read, `recordRecent(dt, name)` which optimistically bumps the
  local list (dedup + cap) and persists per-reference-debounced (800ms). Hooked at **every** real
  record-open opener — `openRecordGlobal` / `openRecordInline` **and** the new shared
  `openRecordNewWindow` (the "Open in New Window" / row-target='new-window' path, added during review
  so new-window opens don't bypass Recents). List/app/dashboard opens deliberately don't write.
- **Form references** — a recent stores `{doctype, name, view:'form'}`; `SurfaceRef` gained an
  optional `name`, and `placementView` (label by record name) + `placementSurface` (→ `formSurface`)
  learned the form shape so a Recents tile renders and a drag-out lands a re-openable form Placement.
- **Finder Recents Location** — `'Recents'` added to `LOCATIONS` + `recentItems()` builder + the
  `Finder.vue` clock icon + a FinderBody empty-state; drag-out reuses the existing one write path.

Verify gate green: `yarn typecheck` · `yarn test` (318) · `yarn build` · Cypress `finder.cy.js` (5) ·
Python `test_os_recent` (5, pure `recents_view`) · live DB round-trip (dedup + newest-first) ·
HTTP annotation/417 check. Reviewed with `/code-review` (medium, 4 angles) — the only actionable
finding (new-window opens bypassing Recents) is fixed above; the rest were refuted or intended
mirror-of-placements design.

## What to build

The last and most independent leaf (ADR-0024): a per-user, server-side **Recents** log and the
Finder Location that browses it. It rides the proven surface-reference seam, so it is scheduled
last.

A "recent" is a **surface reference + timestamp**. The OS owns the definition of "recent" (which
surfaces count, how they dedup/cap) rather than projecting Desk's route log.

- **`OS Recent` DocType** — owner-scoped, **one row per open**, **de-duped by surface reference**
  (a re-open updates the existing row's timestamp), **trimmed to ~50** newest. Mirrors the
  row-per-placement choice (ADR-0023) — no whole-blob rewrite per open. It **roams** like
  Placements.
- **Record opens only.** The honest "recent *documents*" analog — lists and apps are reachable via
  the Doctypes and Applications Locations, so they don't pollute Recents. (Widening to lists/apps
  later is additive.)
- **Write seam: client-side on form-surface open** (`openRecordGlobal` / `openRecordInline`),
  debounced; the **server trims**. Reuses the surface-reference vocabulary — no new client concept.
- **Wire the Finder Recents Location** (depends on the #05 Finder): time-ordered, capped,
  dedup-by-reference (newest wins); drag a recent out → a form/list Placement.

The dashboard's existing "recents" is unrelated ("newest records of one configured `recentDoctype`",
not a per-user open-history) and stays as-is.

## Acceptance criteria

- [x] `OS Recent` is owner-scoped, row-per-open, de-duped by surface reference (re-open bumps the
      timestamp), and trimmed to ~50 newest.
- [x] Opening a record via `openRecordGlobal` / `openRecordInline` writes a recent (debounced);
      opening a list or an app does not. (Also the new-window opener `openRecordNewWindow`.)
- [x] The server enforces the ~50 trim.
- [x] The Finder **Recents** Location shows the per-user, newest-first list and supports drag-out →
      Placement.
- [x] Recents roam across devices (server-side, like Placements).
- [x] Tests cover dedup-by-reference, the trim policy, record-opens-only filtering, and the Recents
      Location render.

## Blocked by

- #05 (Finder window + Locations)
