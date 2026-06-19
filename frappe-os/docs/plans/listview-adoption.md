# Plan: Adopt frappe-ui `ListView` in Frappe OS

**Status:** ✅ Done & verified · **Phase:** 1 (like-for-like swap)

Tracking doc — phase 1 is complete (typecheck/test/build green + visual check on a
logged-in bench). Kept for history; phase 2 gets its own plan if/when scheduled.

> **Note:** during implementation the files were reorganized into a feature folder
> (`src/components/ListView/`) per ADR-0013 — so the final paths differ from the
> original task list below (paths updated inline). Broader rollout: see
> `docs/plans/component-feature-folders.md`.

## Goal
Replace the hand-rolled CSS-grid table in `DocView.vue` (L202–227) with frappe-ui
`<ListView>`, extracted into a new `OSListView.vue` wrapper. Selection enabled
(`selectable:true`) — checkboxes functional; bulk actions deferred to phase 2.
Toolbar, saved-view chips, presence, footer, loading/error states, and the whole
form half are untouched.

## Decisions (locked)
- Extract a dedicated `OSListView.vue` (keep `DocView.vue` lean).
- Enable real selection now (`selectable:true`); selections emit, no bulk actions yet.
- Use `options.onRowClick` (OS opens windows, not router routes) — not `getRowRoute`.
- Keep our own loading/error UI; let ListView own only the empty state.
- Pure mappers go in a new `src/lib/list-columns.ts` (mirrors `route-map.ts`/`records.ts`).

## Verified facts (don't re-derive)
- `getGridTemplateColumns` passes string widths verbatim into `grid-template-columns`
  (only numbers get `fr`), so existing `'120px'`/`'minmax(160px,1.5fr)'` configs give
  exact layout parity. ListView prepends a `14px` checkbox track (was a `30px` fake one).
- Custom cells via `#cell="{ column, item, isActive }"`; `item` = `row[column.key]`.
- Curated presentation to preserve: `listColumns`, `statusField`/`statusThemes`→`StatusPill`,
  `titleField`, column types (`status|currency|avatar|int`, `primary`). Server-projected
  in `www/os.py`, overlaid in `store/registry.ts` (`osNativeMeta`) — both untouched.
- frappe-ui is a shared singleton for applets; host *adding* ListView usage is the safe
  direction (no `brokers/frappe-ui.ts` change needed).

## Tasks
- [x] **NEW `src/components/ListView/list-columns.ts`** — pure helpers (types in `./types.ts`):
  - [x] `toListViewColumns(cols)` → `{key,label,width,align,type,primary}` (currency/int → `'right'`, else `'left'`; width pass-through w/ `minmax(120px,1fr)` fallback; `type`/`primary` carried for the cell slot).
  - [x] `cellKind(value, column, statusThemes)` → classification (`status`+theme / `avatar` / `primary` / plain with `—` fallback).
- [x] **NEW `src/components/ListView/OSListView.vue`**:
  - [x] Props: `doctype`, `columns`, `rows`, `meta`, `loading`, `error`, `onOpen?`; emits `update:selections`.
  - [x] `<ListView :columns :rows row-key="name" :options>` with `selectable:true`, `showTooltip:true`, `onRowClick`, `emptyState`.
  - [x] `#cell` slot reproducing the 4 kinds (reuse `StatusPill` + `Avatar`).
  - [x] Own loading/error divs around `<ListView>`.
- [x] **NEW `src/components/ListView/index.ts`** — barrel (public surface; importers use `@/components/ListView`).
- [x] **EDIT `src/components/DocView.vue`**:
  - [x] Removed list table block + now-unused `gridCols`, `columns` align-map, `cellFor`, `Cell` interface, dead type imports.
  - [x] Renders `<OSListView ... />` via the barrel (`import { OSListView } from './ListView'`). DocView = 241 lines.
- [x] **EDIT `types/frappe-ui.d.ts`** — added `export const ListView: any`.
- [x] **NEW `src/components/ListView/tests/list-columns.spec.js`** (Vitest) — decision tables for `toListViewColumns` + `cellKind`.
- [x] **EDIT `vitest.config.js`** — widened `include` to also collect colocated `src/**/*.spec.js` (otherwise the feature-folder spec is silently never run).

## Verification
- [x] `yarn typecheck && yarn test && yarn build` green in `apps/frappe/frappe-os` (6 spec files, 95 tests).
- [x] Visual `yarn dev` → http://localhost:5273/ (logged-in bench): list renders, columns
  align, status pills themed, row-click opens form window, checkboxes toggle.

## Out of scope (phase 2+)
Bulk actions (`ListSelectBanner`), grouping (`ListGroups`), column resize, virtual-scroll
tuning. Server projection, registry overlay, broker, and the form half stay as-is.
