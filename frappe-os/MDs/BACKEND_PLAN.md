# Frappe OS — backend connection plan

Working doc for connecting Frappe OS to the real Frappe backend (replacing mock
data) and refactoring to the bench code rules. Written to be picked up cold in a
new session. Read `summary.md` first for the app's mental model.

## Status (last updated 2026-06-17 — Phase 5 complete; all phases done)

**Branch:** work is on the `frappe-os` branch (in `apps/frappe`), based on the
**latest `develop`** (remote is `upstream`, frappe/frappe). The `/x` shell source is
NOT on this branch — its referenced files are frozen in `shell-reference/` (see that
folder's README). frappe-os depends on `@framework/ui` (`ui/vite` for the build,
`FormLayout` for the form view); both are present on current `develop`. If the build
ever fails on a missing `@framework/ui` export, the local `develop` is stale —
`git fetch upstream develop` and rebase (do NOT switch to framework2).

**Done — Phases 0, 1, 2, 3** (build + 22 Vitest tests green):
- Phase 0 backend plumbing (`www/os.py`, `www/os.html`, `vite.config.js`, `index.html`).
- Phase 1 data layer (`src/api.js`, `src/boot.js`).
- Phase 2 config files (`src/config/{icons,doctypes,apps}.js`). **Additive** — `data.js`,
  the store and the components were intentionally NOT touched.
- Phase 3 store refactor + mock removal:
  - `src/store.js` (417 lines) split into `src/store/{state,geometry,windows,palette,
    persistence,records,index}.js`; `useOS()` re-assembled by `store/index.js`, public
    surface unchanged (plus new records actions). All importers repointed to `@/store`.
  - `src/store/records.js` — live reactive caches `listFor`/`docFor`/`countFor`
    (`{loading,data,error}` + `load*` actions) over `api.js`, plus `saveDoc`/`createDoc`
    write-through. `recordsFor`/`recordObj` kept as **pure-read** compat getters (return
    empty until Phase 4 wires loads).
  - Store wired to `config/*`: `appForDoctype` moved to `config/apps.js`; `getMeta` stays
    sync; `os.DATA` is now a compat shape `{ APP, meta: doctypes, ICON }` assembled from
    config (components still read it by namespace until Phase 4).
  - Relaxed for async: `applyRoute` always opens the form for `doctype+name` (no record
    lookup); `validView`/`hydrate` need only a known doctype (+ name for forms); record
    pop-outs kept on hydrate unless the doctype is unknown. `presenceFor` dropped mock
    `__viewer` (form → `[{label:'You'}]`). `paletteResults` = apps + curated doctype
    lists (no mock records).
  - Deleted `src/data.js` and `src/store.js`. Components' `initials`/`pill` imports moved
    to `@/config/apps`. `vitest.config.js` got the `@` alias (mirrors `vite.config.js`).
  - Updated `route-map.spec.js`: the old "degrades a missing record to the list" case now
    asserts the form opens for an unloaded record.

**Done — Phase 4** (components wired to live data; build + 22 Vitest green). DocView
self-fetches list/doc/field-schema; form is editable with Save/New; dashboard cards +
recents + sidebar counts are live; Phase-3 breakages (SettingsDialog Members, OSWindow
stats/counts) fixed; `os.py` registry expanded + existence-guarded. See the Phase 4
section for the full changelog and the two carry-forward notes.

**App state after Phase 4:** the app builds, runs, and (against a logged-in bench) shows
live lists/forms/dashboards with editable Save/New. NOT yet manually verified on a running
bench in-session — see the Phase 4 "Manual live-bench verification NOT done here" note.

**Open items left for whoever continues (verify against a live bench):**
- `config/doctypes.js` `listColumns` synthetic keys (`enabled_label`/`status_label`/
  `stock_qty`) render `—` under the `fields:['*']` fetch — map to real fields or compute
  client-side. `config/apps.js` card `fieldname`s marked `verify` (`annual_revenue`, etc.)
  must be confirmed live; a wrong fieldname makes that one card show `—` (graceful).
- The `os.DATA` compat shape is still the bridge components read by namespace; Phase 5
  de-proto can consider dropping it now that loads are wired.

**Done — Phase 5** (tests + de-prototype): added `tests/records.spec.js` (13 specs,
`@/api` mocked); the store/route-map specs were already async-correct from Phase 3. Gated
Cypress on a logged-in bench (note in `cypress.config.js` + spec). De-proto'd: renamed the
`package.json` to `frappe-os`, stripped the "throwaway/prototype/mock/no-backend" framing
from `summary.md` + `CLAUDE.md` (file map now reflects the real `store/`+`config/` tree),
and refreshed the `frappe-os-proto` memory note. Build + 35 Vitest green.

**All planned phases (0–5) are complete.** The only remaining work is live-bench manual
verification (open an app, edit+save a record, create one, confirm dashboard counts) and
reconciling the `verify`-marked card `fieldname`s / synthetic `listColumns` keys against
real field names — both need a running, logged-in bench.

## Goal

Connect Frappe OS to the live backend instead of mock data, keep building **in
`frappe-os`** (the `/x` shell is left untouched — we are NOT porting this design
into shell), drop the "prototype/throwaway" framing, and refactor existing code to
follow `apps/frappe/CLAUDE.md` (small functions ~10 lines, files 100–300 lines,
≤15 files/folder, no abbreviations, reuse, standard frappe-ui/espresso, tests).

## Decisions locked (from the kickoff Q&A)

1. **Serving / auth — serve at `/os` using the shell's proven plumbing.**
   Adopt the `frappeui()` Vite plugin (`frappeProxy` + `jinjaBootData` +
   `buildConfig`) plus a `www/os.html` + `os.py` host page, so Frappe OS shares the
   logged-in Desk session + CSRF. Modeled on `apps/frappe/shell` (served at `/x`).
2. **Metadata — Hybrid.** Keep the curated app icons/colors/module grouping and the
   dashboard card *definitions*; pull **form fields, list data, and the real count
   numbers live** from Frappe. New doctypes must be added to the curated config to
   appear on the desktop, but their fields render live.
3. **Scope — read + write now.** Lists, form display, real counts, AND
   create/edit/save via the REST resource API with CSRF (like shell's
   `updateDoc`/`createDoc`).
4. **App coverage — installed apps only.** Show `frappe`, `erpnext`, `crm`. Drop
   `hr`, `helpdesk`, `drive` from the curated config (this bench has only those
   three apps installed). Nothing on screen should map to a missing backend.

## Open defaults (picked, change if desired before/while implementing)

- **Data fetching style:** plain `fetch` helpers (`api.js`), mirroring the shell —
  NOT frappe-ui `createResource`. Consistent with the sibling POC; trade-off is we
  hand-roll caching. (Alternative: `createResource` for free caching/reactivity.)
- **Dashboard cards:** server `card_value` method supporting both **count** and
  **sum**, so currency cards ("$1.2M pipeline") stay meaningful. (Alt: counts only.)
- **Form rendering:** build our own `FormLayout` schema from a lean
  `get_doctype_meta` (what `DocView` already does), keeping the curated design.
  (Alt: adopt `@framework/ui` `useDoctypeLayout` like shell — less code, less control.)
- **Store split:** full split into `store/{windows,geometry,persistence,palette,records}.js`
  to satisfy the file-size rule. (Alt: minimal — just add `records.js`.)

## Reference: how the `/x` shell does it (copy these patterns)

> **Note:** `frappe-os` will move to a branch based on `develop`, where
> `apps/frappe/shell` does **not** exist. Frozen copies of every file referenced
> below live in `frappe-os/MDs/shell-reference/` (see its `README.md`). Read those
> snapshots after the branch switch; the `apps/frappe/...` paths below are the
> originals on `framework2`.

- `apps/frappe/shell/vite.config.js` (snapshot: `shell-reference/vite.config.js`) — `frappeui({ frappeProxy:true, jinjaBootData:true,
  buildConfig:{ outDir: ../frappe/public/shell, baseUrl:/assets/frappe/shell/,
  indexHtmlPath: ../frappe/www/x.html } })` + `frameworkUI()` + the optimizeDeps
  include/exclude list (already mirrored in `frappe-os/vite.config.js`).
- `apps/frappe/shell/src/api.js` (snapshot: `shell-reference/api.js`) — reads via whitelisted GET (`frappe.client.get_list`,
  `/api/resource/<dt>/<name>`); writes via REST `PUT`/`POST` with
  `X-Frappe-CSRF-Token`. **Port this file almost verbatim.**
- `apps/frappe/frappe/www/x.py` (snapshot: `shell-reference/x.py`) — host page `get_context` (Guest → redirect to
  `/login`), `get_boot()` (user + csrf + registry), `@whitelist boot()` for the dev
  server, `get_doctype_meta(doctype)` (lean field descriptors, perms). **Template for
  `os.py`.**
- `apps/frappe/frappe/www/x.html` (snapshot: `shell-reference/x.html`) — `window.csrf_token` + the `boot` injection loop.
- Shell router: `createWebHistory('/x')`, hardcoded mount base. For OS keep
  `createWebHistory('/os')` but let the frappe-ui plugin own the Vite base (drop the
  manual `base:'/os/'` + `os-base-slash-redirect` dev middleware in vite.config.js).

## Current state (what exists in `frappe-os/src`)

- `data.js` (239 lines) — `buildData()` returns `{ APP, meta, ICON }` ALL synchronous
  mock: app tree, per-doctype `listColumns`/`savedViews`/`fields`/`records`,
  hardcoded `totalCount` and dashboard `stats`. Defines 7 apps incl. hr/helpdesk/drive.
- `store.js` (417 lines) — module-singleton reactive store. Reads mock synchronously
  via `getMeta`/`recordsFor`/`recordObj`/`appForDoctype`/`presenceFor`/`paletteResults`.
  Window lifecycle, geometry/drag/resize, per-window nav history, split, theme,
  wallpaper, palette, serialize/hydrate/autosave.
- `route-map.js` — pure focus↔URL (`pathForFocus`/`focusSig`/`applyRoute`). NOTE:
  `applyRoute` calls `recordObj()` synchronously to choose form-vs-list.
- `main.js` — URL↔focus bridge (guards/boot/watchers) + `/app/...`→`/os/...` interop.
- `components/` — `DocView` (list + form; form already uses `@framework/ui` FormLayout
  with a read-only schema built from `meta.fields`), `OSWindow`, `SettingsDialog`,
  `MenuBar`, `Dock`, `CommandPalette`, `WallpaperPicker`, `StatusPill`.
- `tests/` — Vitest `store.spec.js` (focus machine + hydrate), `route-map.spec.js`
  (path projection + applyRoute decision table). Cypress `routing.cy.js`.

## Key refactor implication (read before touching the store)

With Hybrid, **`getMeta(doctype)` stays synchronous** (curated display config), but
**records, form field schemas, and counts become async**. Therefore:

- `recordObj(doctype, name)` can no longer synchronously prove a record exists.
  Relax `applyRoute`: when `doctype && name`, always `openRecordGlobal` (the form
  view loads the doc and shows a not-found state on 404). Relax `validView`/`hydrate`
  for forms to require only a known doctype + a name (no record lookup).
- Drop the mock-only `__viewer`/`__assigned`/`__tags`/`__activity` presence + activity
  data in `DocView`/`presenceFor` (no real backend source yet).
- `paletteResults` switches to apps + doctype lists (live record search is a later add).
- Update the affected Vitest expectations (esp. "degrades a missing record to the
  list" → now opens the form; hydrate form-view validity).

## Phases & actionables

### Phase 0 — Backend plumbing (serve at `/os`) ✅ DONE
- [x] `apps/frappe/frappe/www/os.html` — copy `x.html` (title "Frappe OS", csrf +
      boot loop). NOTE: regenerated by `yarn build` (buildConfig writes hashed assets
      here from `index.html`); the hand-written version was just a seed.
- [x] `apps/frappe/frappe/www/os.py` — modeled on `x.py`:
  - `get_context` (Guest → `/login` redirect), `get_boot()` (user, csrf_token,
    registry, + a `permissions` map of per-registry-doctype `can_create`/`can_write`),
    `@whitelist boot()`.
  - `@whitelist get_doctype_meta(doctype)` — lean fields, each tagged with its current
    Section Break label (tracked while walking `meta.fields`) for the sectioned layout.
  - `@whitelist card_value(doctype, filters=None, fieldname=None)` — live count, or a
    sum of `fieldname` when given. Permission-checked.
  - `setup_desk_switch()` adding "Switch to Frappe OS" (→ `/os`) to the Desk navbar.
- [x] `frappe-os/vite.config.js` — flipped `frappeProxy:true`, `jinjaBootData:true`,
      `buildConfig:{ outDir: ../frappe/public/os, baseUrl:/assets/frappe/os/,
      indexHtmlPath: ../frappe/www/os.html, emptyOutDir:true }`. Removed the manual
      `base:'/os/'` and the `os-base-slash-redirect` middleware. optimizeDeps kept.
- [x] `frappe-os/index.html` — added `window.csrf_token` script (literal in pure Vite
      dev); title is now "Frappe OS".

### Phase 1 — Data layer ✅ DONE
- [x] `frappe-os/src/boot.js` — reads window globals (`user`/`csrf_token`/`registry`/
      `permissions`), falls back to the whitelisted `boot()` in dev; seeds api CSRF.
      Exposes `getBoot()` and re-exports `setCsrf`.
- [x] `frappe-os/src/api.js` — ported shell's `call`/`getList`/`getDoc`/`createDoc`;
      `updateDoc` renamed `saveDoc`; added `getDoctypeMeta(doctype)` and
      `cardValue(doctype, filters, fieldname)` wrappers.

### Phase 2 — Hybrid config (replace mock `data.js`) ✅ DONE (additive; mock not yet removed)
- [x] `frappe-os/src/config/icons.js` — `ICON` map + `dtIcon` lookup (covered doctypes).
- [x] `frappe-os/src/config/doctypes.js` — curated per-doctype DISPLAY only: `label`,
      `color`, `icon`, `titleField`, `statusField`, `statusThemes`, `listColumns`, plus
      a sync `getMeta(doctype)`. No `records`/`fields`/`totalCount`/`savedViews`. Covers
      frappe/erpnext/crm doctypes only (hr/helpdesk/drive dropped).
- [x] `frappe-os/src/config/apps.js` — curated `APP` for frappe/erpnext/crm only:
      `glyph`, `hex`, `logo`, `hasDashboard`, module→doctype grouping, and dashboard
      card *definitions* `{ label, sub, doctype, filters?, fieldname? }` (value comes
      from `card_value`). `APP_ORDER`, `initials`, `pill` helpers included here.
  - ⚠️ The mock `data.js` is still the runtime source (store/components unchanged).
    Phase 3 must point the store at `config/*` + `records.js` and then delete `data.js`.

### Phase 3 — Store refactor (async data + CLAUDE.md split) ✅ DONE
- [x] `frappe-os/src/store/records.js` — reactive caches: `listFor(doctype)`,
      `docFor(doctype,name)`, `countFor(...)`, each `{ loading, data, error }` with
      load actions; plus `saveDoc`/`createDoc` writing through `api.js` and refreshing
      the cache. `recordsFor`/`recordObj` are pure-read compat getters.
- [x] Split `store.js` → `store/{state,geometry,windows,palette,persistence,records}.js`,
      re-assembled by `store/index.js` `useOS()`. Public surface stable; importers use
      `@/store`. (Added `state.js` for the shared reactive singleton + clock.)
- [x] Relaxed `recordObj`/`validView`/`applyRoute`/`hydrate` for async records (see
      implication section). `getMeta` stays synchronous. Deleted mock `data.js`.

### Phase 4 — Components ✅ DONE (build + 22 Vitest green; live-bench manual check still pending)
- [x] `DocView` list — renders live rows from `records.js` with loading / empty / error
      states; dropped the `__viewer` dot; live total (`countFor`) in the count pill +
      footer. DocView now **self-fetches** (list/doc/field-schema) off `@/store`, so the
      record pop-out reuses it and `OSWindow` only passes `doc`/`meta`/`presence`/handlers.
- [x] `DocView` form — fetches real fields via `getDoctypeMeta` (new `fieldMetaFor`/
      `loadFieldMeta` cache in `records.js`), builds the sectioned FormLayout from REAL
      fields, **editable**; **Save** (`saveDoc`, dirty-diff of changed fields only) +
      **New/Create** (`createDoc`, then navigate to the new record). Gated on
      `can_create`/`can_write` from the live meta. Removed the mock assigned/tags/
      activity sidebar (no real source yet); header presence is just "You".
- [x] Dashboard — `stats` now comes from `app.cards` with values from `card_value`
      (`loadCount` per card, count or sum); recents are the live `recentDoctype` list;
      sidebar nav counts are live plain counts. Curated labels/subs kept.
- [x] CommandPalette — already on the curated apps+doctype surface from Phase 3 (no change).
- [x] **New plumbing:** `openNew(winId, dt)` (windows.js) opens a blank form with the
      `'new'` sentinel recordName; DocView detects it, skips `loadDoc`, and Creates on Save.
      `OSWindow` breadcrumb + DocView header show "New <doctype>". Route projects
      `/os/app/<dt>/new` (cold-load just shows an empty new form — no 404 fetch).
- [x] **Phase-3 breakage fixed:** `SettingsDialog` Members read the removed
      `meta['User'].records` → rewired to the live `listFor('User')` (loads on the
      Members tab). `OSWindow`'s `m.totalCount`/`m.records`/`app.stats` refs all replaced.
- [x] **Backend:** `os.py` `REGISTRY_DOCTYPES` expanded from the curated config (open
      item #1); `get_registry`/`get_permissions` now existence-checked (`_readable_meta`)
      so an uninstalled-app doctype is skipped quietly instead of raising.

**Decisions worth knowing for Phase 5:**
- **`loadList` fetches `fields: ['*']`** (not the curated column keys). Several curated
  `listColumns` keys are display-only synthetics with no live field (`enabled_label`,
  `status_label`, `stock_qty`) — requesting them by name would 500 the list. Columns now
  read whatever keys exist on the row; a synthetic/missing key renders `—`. The Phase-4
  open item "reconcile listColumns/card fieldname against live field names" is therefore
  **softened, not resolved** — lists won't break, but those synthetic status columns show
  `—` until either real fields are mapped or the values are computed client-side. Card
  `fieldname` sums that name a missing field error server-side → that card shows `—`
  (graceful), so `annual_revenue`/`outstanding_amount` guesses still need live confirming.
- **Manual live-bench verification NOT done here** (no running bench in this session):
  log in, open an app, load a list, open+edit+save a record, create a new one, confirm
  dashboard counts/recents are real, and reconcile the `verify`-marked field names.

### Phase 5 — Tests + de-prototype ✅ DONE (build + 35 Vitest green)
- [x] Vitest: `store.spec.js` / `route-map.spec.js` were already async-correct from Phase 3
      (the "still opens the form for an unloaded record" case is in place); added
      `tests/records.spec.js` — 13 specs over `records.js` with `@/api` mocked (`vi.mock`):
      entry shape `{loading,data,error}`, the `load*` lifecycle (success + error), the
      countKey filter-keying, `loadFieldMeta` fetch-once caching, `saveDoc`/`createDoc`
      write-through + list refresh, and the sync `recordsFor`/`recordObj` getters. Note:
      cache reads come back as reactive proxies, so those assertions use `toEqual` not `toBe`.
- [x] Cypress: gated on a logged-in bench — boot is live now (`yarn dev` proxies `/api`,
      `boot.js` falls back to the whitelisted `boot()`), so a Guest/no-bench dev server
      can't mount. Note added to `cypress.config.js` + the spec header (not in any
      unattended gate until a bench on `f2.localhost:8016` is up and logged in).
- [x] De-prototype: `package.json` name `frappe-os-proto` → `frappe-os`; rewrote the
      "throwaway/prototype/mock/no-backend" framing in `summary.md` (intro, file map now
      reflects `store/` + `config/` + `api.js`/`boot.js`, tests section) and `CLAUDE.md`
      (title + intro + tests).
- [x] Memory: updated `frappe-os-proto.md` (description + body now say "wired to the live
      backend", `src/store/`+`config/`, served at `/os`) and its `MEMORY.md` index line.
      Kept the filename/slug to avoid index/link churn.

**Still open (live-bench, unchanged from Phase 4):** manual verification on a running
bench, and reconciling the `verify`-marked card `fieldname`s + synthetic `listColumns`
keys against real field names.

## Verification
- `yarn build` (must stay green — the `init_shared_esm_bundler` dev-only issue does
  not affect build).
- `yarn test` (Vitest) after touching store/route-map/records.
- Manual: `bench serve` (port 8016, site `f2.localhost`) + `yarn dev`; log in, open
  an app, load a live list, open + edit + save a record, create a new one, confirm
  dashboard counts are real.
- Build output served at `/os` via `os.py`; verify Guest → `/login` redirect.

## Constraints / don't-break
- Leave `apps/frappe/shell` (`/x`) and `frappe/www/x.*` untouched.
- Preserve the URL↔focus bridge invariants in `main.js` (programmatic/restoring
  guards) and the window-id scheme — changing either touches `route-map.js`,
  `restoreFromHistory`, the id builders, and the route-map tests together.
- Keep the desktop root `isolation:isolate` (popover stacking) and frappe-ui CSS
  token styling (`--surface-*`/`--ink-*`/`--outline-*`).
</content>
</invoke>
