# Retire the boot display projection; shrink DoctypeMeta; delete dead code

Status: ✅ DONE

Triage: ready-for-agent (AFK)

## What to build

With every consumer moved to live meta (#03, #04), retire the boot Registry's per-doctype
presentation projection (ADR-0028). The Registry keeps identity only.

- `DoctypeMeta` (config/types.ts) sheds `titleField`, `statusField`, `statusThemes`, `listColumns`;
  keeps `label`, `icon`, `color`, `generic`, ownership.
- `config/doctypes.ts`: delete `GENERIC_STATUS_THEMES`, all curated `listColumns` arrays, per-doctype
  `statusThemes`/`statusField`/`titleField`. `defineGeneric` collapses to color + icon; bespoke
  entries keep only color/icon (+ any genuine override that still exists).
- `registry/index.ts`: drop `listColumns`/`statusField`/`statusThemes`/`titleField` from
  `OS_NATIVE_META` and the `BESPOKE_ONLY` deferral; keep the sync existence + identity seam intact.
- `os.py:_display_payload`: drop `_list_columns` and `_status_field` and the `titleField` projection.
- Delete `toListViewColumns` (unused) and prune `list-columns.ts` to the live cell path.

## Acceptance criteria

- [x] `DoctypeMeta` no longer carries title/status/themes/columns; typecheck passes.
- [x] `GENERIC_STATUS_THEMES`, curated `listColumns`, per-doctype status maps, `toListViewColumns` deleted.
- [x] `_display_payload` projects only identity/label; `_list_columns`/`_status_field` removed.
- [x] Sync consumers (routing/persistence/resolver) still work on existence + identity.
- [x] `yarn test` + `yarn typecheck` green; no dangling references to removed fields.

## Blocked by

- #03 and #04a (all reads of the removed fields must be gone first). #04b (fetch narrowing) is a
  perf optimization independent of retiring the projection — it need not precede this.
