# OS Recent store (record-opens) + Finder Recents Location

Status: 📋 Ready (2026-06-25)

Triage: ready-for-agent (AFK)

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

- [ ] `OS Recent` is owner-scoped, row-per-open, de-duped by surface reference (re-open bumps the
      timestamp), and trimmed to ~50 newest.
- [ ] Opening a record via `openRecordGlobal` / `openRecordInline` writes a recent (debounced);
      opening a list or an app does not.
- [ ] The server enforces the ~50 trim.
- [ ] The Finder **Recents** Location shows the per-user, newest-first list and supports drag-out →
      Placement.
- [ ] Recents roam across devices (server-side, like Placements).
- [ ] Tests cover dedup-by-reference, the trim policy, record-opens-only filtering, and the Recents
      Location render.

## Blocked by

- #05 (Finder window + Locations)
