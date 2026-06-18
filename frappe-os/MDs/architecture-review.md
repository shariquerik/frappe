# Frappe OS — architecture review

_Reviewed: 2026-06-17. Scope: `frappe-os/src`, against `apps/frappe/CLAUDE.md` guidelines._

> **Context:** Frappe OS is being built as the **new frontend for the framework**, not a
> throwaway POC. The findings below are weighted accordingly — data-layer and reuse
> decisions that would be cosmetic in a prototype are *foundational* here, because every
> doctype the framework ever ships will flow through them.

## Verdict at a glance

A well-built shell with sound bones: store-driven, fully TypeScript, unit + e2e tested,
and disciplined about styling on frappe-ui tokens. The architecture (singleton reactive
store split into slices, pure route projection, geometry separated from window identity)
is the right shape to grow on.

Three things to get right **before** this becomes the framework's frontend:

1. The data layer is hand-rolled and duplicates what frappe-ui already ships.
2. `@framework/ui` is barely used — the package that exists to render doctype forms is
   imported for one component and then bypassed.
3. `OSWindow.vue` (629 lines) is the one hard file-size violation and mixes 4 concerns.

---

## 1. frappe-ui & @framework/ui usage

### Used correctly
| Library | Used |
|---|---|
| `frappe-ui` | `Button`, `Avatar`, `Dropdown`, `Switch`, `Badge` |
| `@framework/ui` | `FormLayout` only |
| Styling | frappe-ui CSS tokens throughout (`--surface-*`, `--ink-*`, `--outline-*`) ✅ |

### Gap A — the data layer reimplements frappe-ui  ⚑ foundational
`api.ts` (custom `fetch`, CSRF, `getList`/`getDoc`/`saveDoc`/`createDoc`) plus
`store/records.ts` (the `{ loading, data, error }` cache, `listFor`/`docFor`/`loadList`,
write-through refresh) **reimplement frappe-ui's `createResource` / `createListResource` /
`useDoc` / `useList` / `call`**. Those already provide loading/data/error state, automatic
CSRF, caching, and `.reload()`. A `grep` confirms **zero** usage of any of them.

- Violates CLAUDE.md **#7** (use standard API) and **#8** (reuse / least code).
- The header says it was deliberately "ported from the /x shell." Fine for a POC — but as
  the framework frontend, every bespoke line here is CSRF/error/cache logic you maintain
  forever instead of the framework team. This is the highest-leverage decision to revisit.

### Gap B — `@framework/ui` is underused  ⚑ closes your own "known gaps"
The package exports `Link`, `Phone`, `Grid`, `TableMultiSelect`, `useDoctypeLayout`,
`useScriptedLayout`. Only `FormLayout` is used.
- **`useDoctypeLayout`** builds a `FormLayoutSchema` from a doctype automatically.
  `DocView.vue` instead hand-builds the layout (manual section grouping + alternating
  two-column split) **and** relies on a custom backend method `frappe.www.os.get_doctype_meta`.
- The documented gaps — *"Link fields render as disabled inputs; long Text fields don't
  span both columns"* — are almost certainly **caused by** hand-rolling the layout instead
  of using `useDoctypeLayout`, which handles field types and column spans natively.
- **`Link`** would fix the disabled-Link-field gap directly.

### Gap C — `SettingsDialog.vue` fake controls
The General tab renders selects as static `<div>`s with a chevron (non-functional).
`frappe-ui` `FormControl` (already in the type shim, unused) is the standard control.

### Justified custom UI — leave as-is
Command palette, wallpaper picker, and the macOS window chrome / list table are
intentionally hand-built (frappe-ui `Dialog`/`ListView` don't match the macOS look). Sound
call — worth a one-line note that `ListView` was considered and rejected so nobody "fixes" it.

---

## 2. CLAUDE.md guideline adherence

| # | Guideline | Status | Notes |
|---|---|---|---|
| 1 | Clean over clever | ✅ | Readable, well-commented |
| 3 | Functions ~10 lines | ⚠️ | Mostly; large computeds in `OSWindow.vue`/`DocView.vue` |
| 4 | Files 100–300 lines | ❌ | **`OSWindow.vue` = 629** — 2× over. All else in range |
| 5 | <15 files per folder | ✅ | `components/` 9, `store/` 8, `config/` 3 |
| 6 | No abbreviations | ⚠️ | Terse locals: `g`, `v`, `k`, `tog`, `rd`, `rm`, `st` |
| 7 | Standard API | ❌ | Custom data layer vs frappe-ui resources (Gap A) |
| 8 | Reuse / least code | ❌ | Same — `api.ts`+`records.ts` duplicate frappe-ui |
| 9 | frappe-ui / espresso styling | ✅ | Token-based throughout |
| 10 | Always write tests | ✅ | Vitest (store, route-map, records) + Cypress e2e |
| 11 | Minimum app, iterate | ✅ | Clear phased build |

Folder layout is clean and conventional (`store/` slices, `config/` display data,
`components/`, `MDs/` docs, `types/` shims). The store-slice split exists specifically to
satisfy the file-size rule — good instinct that `OSWindow.vue` didn't receive.

---

## 3. Architecture improvements (ranked)

1. **Split `OSWindow.vue` (629 → ~3×150).** It renders all three window types *plus* the
   full dashboard inline. Extract `WindowChrome.vue` (traffic lights + title bar, repeated
   3×), `AppDashboard.vue` (the stats/recents/team grid), leaving `OSWindow` a thin
   dispatcher. Highest-value, lowest-risk, and the only hard guideline violation.

2. **Adopt frappe-ui resources incrementally.** Don't rip out `api.ts` wholesale — route
   *new* data paths through `createListResource`/`useDoc`. Start with the form path in
   `DocView` via `useDoctypeLayout` + `useDoc`; that closes Gaps B's two known issues for
   free and shrinks `records.ts` over time.

3. **Drop the custom `get_doctype_meta` backend method** if `useDoctypeLayout` fetches meta
   itself — fewer bespoke whitelisted endpoints to own.

4. **Remove hard-coded demo data from production components.** `OSWindow.vue` hardcodes the
   `team` list and a "Faris" greeting; `MenuBar.vue` hardcodes `userName = 'Faris Ansari'`.
   These must come from boot/session, not be baked into render functions — especially as
   the framework frontend.

5. **Minor:** rename single-letter template locals (`g`, `v`) for #6; reassess whether the
   `recordsFor`/`recordObj` sync getters (header calls them a "compat bridge") are still
   needed now that loads are live.

---

## 4. Doc staleness — fixed

`MDs/summary.md` and `frappe-os/CLAUDE.md` described the codebase as `.js` and referenced
"Phase 4 / synchronous mock"; the `src/` tree is now fully `.ts`/`.vue` and data is live.
Both docs were refreshed on 2026-06-17.

**Still carrying stale comments inside source** (`store/records.ts`, `route-map.ts`,
`config/*.ts`, `store/windows.ts`): "Phase 4 wires loads", "compat bridge", "former
synchronous mock". Worth a cleanup pass — left untouched for now.
