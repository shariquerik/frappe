# Plan: Migrate `src/components/*` to feature folders

**Status:** ✅ Done & verified (2026-06-19) · **Trigger:** the `ListView/` folder (shipped
with the ListView adoption) established the convention; this plan rolled it out to the rest.

Tracking doc — all items complete. Gate green after every folder: final
`yarn typecheck && yarn test && yarn build` = **8 spec files, 111 tests** (was 6/95;
+10 MyTodos `todo-groups`, +6 Form `buildFormLayout`). Kept for history; safe to delete.

## Convention (locked, set by `components/ListView/`)
A feature folder owns everything for one cohesive UI concern:
```
components/<Feature>/
  index.ts            # barrel — the ONLY public surface; importers use `@/components/<Feature>`
  <Feature>.vue       # (and sibling .vue parts that belong only to this feature)
  <logic>.ts          # pure helpers/projections (mirrors route-map.ts style)
  types.ts            # feature-local types (single file)
  tests/              # colocated *.spec.js (a folder — a feature can have several)
```
Rules:
- **Barrel is the seam.** Outside code imports `@/components/<Feature>`, never a file inside.
- **`types.ts` is one file**; **`tests/` is a folder.**
- **Shared leaf components stay flat** in `components/` (e.g. `StatusPill.vue` — used by both
  list and form — must NOT be pulled into a feature folder).
- Vitest already collects colocated specs via `src/**/*.spec.js` (vitest.config.js).

## Groupings (final)
- [x] **`Form/`** — extracted the form half of `DocView.vue` into `Form/OSForm.vue` (a smart
  form that fetches its own field schema + doc and writes) + `Form/layout.ts` (the pure
  live-schema→FormLayout `buildFormLayout`, was inline in DocView) + `types.ts` + tests.
  `DocView.vue` is now a thin list/form switch (stays flat, keeps the list chrome).
- [x] **`Window/`** — `OSWindow.vue` + barrel; `Crumb`/`DocProps` pulled into `Window/types.ts`.
- [x] **`Dock/`** — `Dock.vue` + barrel (no Vue-free logic to extract; `DockApp` stays inline).
- [x] **`MenuBar/`** — `MenuBar.vue` + barrel (composes the flat `OSDropdown` leaf).
- [x] **`CommandPalette/`** — `CommandPalette.vue` + barrel (projection stays in `store/palette.ts`).
- [x] **`Settings/`** — `SettingsDialog.vue` + `WallpaperPicker.vue` + barrel.
- [x] **Stay flat (shared/leaf):** `StatusPill.vue`, `OSDropdown.vue`.
- [x] **`MyTodos` → `src/applets/MyTodos/`** (NEW sibling dir, not `components/`): it's an
  applet (reaches the OS only through `OS_KEY`). Pure logic extracted to `todo-groups.ts`
  (`groupByDueDate`/`asText`/`toDateKey`/`priorityTheme`) + `types.ts` + tests; barrel's
  `default` IS the SFC (the applet-loader contract in `store/registry.ts loadApplet`).

## Per-folder checklist (done for every group above)
- [x] Create folder; move the `.vue`/logic files in.
- [x] Extract feature-local types to `types.ts`; extract inline pure logic to a `.ts` module
  (where any existed: `Form/layout.ts`, `applets/MyTodos/todo-groups.ts`,
  `components/Window/types.ts`, `Form/types.ts`).
- [x] Add `index.ts` barrel exporting the public component(s) + types.
- [x] Author specs under `tests/` (Form + MyTodos; the logic-only folders had nothing new to test).
- [x] Update all importers to the barrel path (`@/components/<Feature>` / `@/applets/MyTodos`).
- [x] `yarn typecheck && yarn test && yarn build` green after each folder, verifying the test
  COUNT rose via `npx vitest list` (the load-bearing `src/**` glob gotcha).

## Decisions (resolved 2026-06-19)
- [x] **Rollout scope: full uniform rollout.** Every top-level feature becomes a folder for
  shape uniformity — `Settings/`, `CommandPalette/`, `Dock/`, `MenuBar/`, `Window/`, `Form/`
  — even the ones with little Vue-free logic to extract (those folders are barrel + `.vue`).
- [x] `DocView.vue` **stays flat** as the list/form switch; `ListView/` + `Form/` are the
  feature folders it composes.
- [x] **`MyTodos` moves OUT of `components/` into a new sibling `src/applets/MyTodos/`** — it
  is applet-shaped (reaches the OS only through the injected `OS_KEY` seam, ADR-0002/0009),
  not a store-bound component. Its pure logic (date bucketing, `asText`, priority themes) is
  extracted to a tested module there.
- [x] **Shared leaves stay flat:** `StatusPill.vue`, `OSDropdown.vue`.
- [x] Capture this convention as an ADR → `docs/adr/0013-component-feature-folders.md`.
- [x] Sequencing: one folder per step, lowest-risk first (Settings/, CommandPalette/, Dock/,
  MenuBar/, then MyTodos applet, Window/, and Form/ last), full gate after each.

## Out of scope
Behavior changes. This is pure relocation + barrel/types/tests extraction; no rendering,
store, or API changes.
