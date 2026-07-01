# List cell enrichment (keep the `['*']` fetch)

Status: ✅ DONE

Triage: ready-for-agent (AFK)

## What to build

Re-connect the list's dormant `cellKind` classifier to the **live** wire columns (ADR-0028). The
status column (from the indicator spec's `statusField`, matched against the live wire columns)
renders a themed `StatusPill` via `indicatorFor`; the title column renders `primary`; Link/user
columns render `avatar`. Today every cell renders plain because wire columns carry the raw
fieldtype, never the OS cell kinds.

**`cellKind` becomes per-record.** `indicatorFor(doc, meta)` needs the whole row (docstatus /
enabled / workflow state can't be read from the status word alone), so the status cell is fed the
full row, not just the cell value. The old `cellKind(value, column, statusThemes)` value→theme dict
signature goes; the status branch calls `indicatorFor(row, liveMeta)`.

**Keep `records.ts loadList` on `fields: ['*']` for this slice** — the resolver's extra fields
(docstatus, enabled, workflow state) are all present under `['*']`, so pills are correct with zero
risk of silently-dark tiers. Narrowing the fetch is split out to #04b so the enrichment lands and
is verified first.

## Acceptance criteria

- [x] Status cells render themed pills via `indicatorFor(row, meta)`; title renders primary; user/Link render avatar.
- [x] Cell kinds derive from the live wire column shape + indicator spec, not curated `type`.
- [x] `cellKind` receives the full row (per-record), not a lone value; the value→theme dict path is gone.
- [x] `loadList` still fetches `['*']` (narrowing deferred to #04b).
- [x] Coverage for the live-column → cell-kind projection.

## Blocked by

- #01 (resolver) and #02 (server spec).
