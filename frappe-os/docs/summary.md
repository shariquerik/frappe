# Frappe OS — orientation

**Frappe OS**: a macOS-style desktop shell for Frappe, built on frappe-ui. A standalone
frontend (does not touch the `/x` shell POC) served at `/os`, wired to the live Frappe
backend — lists, forms, counts and recents come from the REST/whitelisted API, with
editable Save/New. The curated app icons, colors and dashboard card definitions are
config (`src/config/*`); the data behind them is live. The `src/` tree is now fully
TypeScript (`.ts`/`.vue`); a few `.js` test specs remain. Read this to get oriented before
changing code.

```
cd apps/frappe/frappe-os && yarn dev   # → http://localhost:5273/  (base /os/)
```

## Mental model
Everything is **store-driven**. `useOS()` (`desktop/index.ts`) is a module-singleton reactive store;
components render from it and call its actions. The desktop draws its own windows — there is
no `<router-view>` UI. The URL is a side-channel that only mirrors the *focused* window.

**A window** (`state.windows[]`):
```
{ id, type:'app'|'record'|'settings', appId,
  view?:{mode:'dashboard'|'list'|'form', doctype, recordName},  // app windows
  doctype?, recordName?,                                        // record windows
  back?, fwd?,                                                  // per-window nav history
  settingsTab? }                                               // settings windows
```
- IDs: `app:<appId>` · `rec:<doctype>/<name>` · `settings:<appId>` · `wallpaper` (singleton
  system pane). One window per id (deduped); only ever one `app:<id>` per app, but
  records/settings add more windows. `windowRole(id)` derives the role from the id prefix.
- **Geometry is separate**: `state.geo[id] = {x,y,w,h,z,min,max}`, merged over a by-index
  default in the `geoMap` computed. `bumpZ()` raises focus.

**Persistence**: one localStorage blob (`frappe-os:desktop`) holds windows/geo/split/
activeId/theme/wallpaper/toggles, debounced 250ms (`startAutosave`). Excluded: ephemeral
overlays (palette/menu) and the transient **settings / wallpaper windows** (respawned from URL, never saved).
`hydrate()` runs before routing and defensively drops windows whose doctype/record no
longer resolves.

**Routing** (`routing/` + `main.ts`): a `focusSig` watcher pushes the focused window's
path; `afterEach` restores focus on back/forward; `applyRoute` spawns from a cold deep-link.
Paths: `/os/<app>` (dashboard), `/os/<app>/<doctype>[/<name>]` (list/form), `/os/<app>/settings`.
A `programmatic`/`restoring` guard pair breaks the focus→push→restore loop — preserve it.

## Files
The `src/` tree is grouped by subsystem; each folder owns its logic AND a colocated
`types.ts` (re-exported through the thin `src/types.ts` barrel, so `@/types` stays one
stable import path). Folders: `desktop/` `data/` `registry/` `surface/` `actions/` `config/`
`routing/` `components/` `applets/` `brokers/`.
- `desktop/` — the window-manager state machine, split to satisfy the file-size rule and
  re-assembled by `index.ts` `useOS()` (public surface stable; was `store/`). `state.ts`
  (shared reactive singleton + clock), `windows.ts` (open*/in-window nav/lifecycle:
  openApp/openListGlobal/openRecordGlobal/openNew/popOut/openSettings, openList/
  openRecordInline/goHome/winBack/winFwd, focusWin/activateWin/closeWin/minimizeWin/
  restoreWin/clearFocus/toggleZoom/toggleSidebar, enterSplit/exitSplit, theme/wallpaper/
  toggles), `geometry.ts` (geo defaults/drag/resize/`geoMap`/`bumpZ`), `palette.ts`,
  `persistence.ts` (serialize/hydrate/startAutosave; theme/wallpaper/toggles persisted here).
- `data/` — the backend-facing layer. `api.ts` (Frappe client: whitelisted GET reads, REST
  PUT/POST writes with CSRF), `records.ts` (live reactive caches over `api.ts`:
  listFor/docFor/countFor/fieldMetaFor + load*/saveDoc/createDoc + recordsFor/recordObj —
  assembled into `useOS()`), `boot.ts` (boot payload: window globals in prod, whitelisted
  `boot()` in dev; seeds CSRF), `os-api.ts` (the ADR-0003 OS API seam handed to applets).
  The `@/data` barrel exposes only the public boot+seam; slices use `@/data/api`/`@/data/records`.
- `registry/` — the client Registry seam (`index.ts` `useRegistry()`: apps/display-config/
  views/cards projections over the merged Contribution[]; was `store/registry.ts`). Also folds
  the Action-model `command`/`action` contributions (`commands()`/`actions()`) the server
  projects from each app's `os_commands`/`os_actions` hook (Slice 2), alongside `applet`.
- `surface/` — `index.ts` Surface constructors + pure helpers (windowRole/sameSurface/…).
- `actions/` — the Action/extension model engine (CONTEXT.md → Command/Action/Region/Handler/
  Context/Eligibility). Pure-data resolver (no `eval`, no handler loading): `eligibility.ts`
  (`isEligible` — equality-as-data, unknown `when` key → no-match+warn), `specificity.ts` (the
  lexicographic `(surfaceCount,windowCount)` vector), `resolve.ts` (competition per
  `(region,command)`; specificity→layer→order→logged `⚠ true-tie`; attributed shadows),
  `context.ts` (`contextForOS` — the 6 fields from the active window), `contributions.ts`
  (first-party `frappe` File Commands/Actions + `FIRST_PARTY_RUN` ref→fn map + `invoke`),
  `menubar.ts` (`fileMenuOptions` — the File-menu render seam). Slice 1: only `menubar:file`
  is migrated; MenuBar.vue's other six menus stay literal (incremental ADR-0001 dogfooding).
  Slice 2: `menubar.ts` resolves over the first-party `FILE_*` ⊕ the registry-folded
  `command`/`action` contributions, so an app's hook-declared override competes — e.g. erpnext
  re-titles "New window" only for an erpnext window via a gated Action carrying a `commandPatch`
  (ADR-0007 Patch of the Command's presentation); the shadowed default is attributed + logged.
- `config/` — curated DISPLAY config: `apps.ts` (APP tree, dashboard card defs, initials/pill),
  `doctypes.ts` (per-doctype label/color/icon/columns + `getMeta`), `icons.ts` (ICON map).
- `routing/` — the URL side-channel. `route-map.ts` (pure focus↔URL logic
  `pathForFocus`/`focusSig`/`applyRoute`, unit-tested), `router.ts` (empty catch-all route).
- `main.ts` — URL↔focus bridge wiring (boot, guards, watchers) + `/app/...`→`/os/...` interop.
- `App.vue` — desktop root (wallpaper, icons, windows, menu bar, dock, overlays, global keys).
- `components/` — `Window/` (`OSWindow` is a thin dispatcher: geometry + window-type branch,
  composing `WindowChrome` (bar + traffic lights), `AppToolbar`/`AppSidebar` (app-window nav),
  and `AppDashboard` (stats/recents/team); each child takes only `win`); `Views/` (the view seam:
  `DoctypeView` resolves a doctype's active view to a component via `registry.ts`'s
  `resolveView` — builtin `list`/`form` from a `BUILTIN_VIEWS` map, applet-backed views via
  `resolveApplet`); `List/` (`OSList` list screen + `OSListView` table) and `Form/` (`OSForm`
  editable record screen) — the self-fetching builtin views, each with Save/New; `Settings`
  (settings two-pane body), `MenuBar`, `Dock` (with window chooser), `CommandPalette`,
  `WallpaperPicker`, `StatusPill`. The chrome **look** (Frappe-native ground/menu bar/
  windows/traffic dots + the adapt-behind dock) is specified in
  `docs/design/chrome-visual-language.md` — read it before restyling chrome.
- `index.css` — frappe-ui style + Tailwind. Backend
  host page: `frappe/www/os.{py,html}`.

## Tests
```
yarn test          # Vitest (unit): store state machine + route-map projection (jsdom)
yarn test:watch    # Vitest in watch mode

yarn dev           # terminal 1 — dev server on :5273 (E2E needs it running)
yarn e2e           # terminal 2 — Cypress headless run
yarn cypress       # Cypress interactive runner
```
- **Vitest** (`tests/*.spec.js`) covers the pure logic: focus transitions + `hydrate`
  (`store.spec.js`), `pathForFocus`/`applyRoute` decision tables (`route-map.spec.js`), and
  the live record caches with `api.ts` mocked (`records.spec.js` — entry shape, load*
  lifecycle, field-meta caching, write-through refresh), and the `actions` resolver decision
  tables (`actions.spec.js` — eligibility, the specificity vector, the tiebreak chain, shadow
  logging, `invoke`, and `fileMenuOptions` rendering the File menu from resolved Actions).
- **Cypress** (`cypress/e2e/routing.cy.js`) covers only what unit tests can't — the
  vue-router `/os/` base, cold-boot URL seeding, reload persistence, browser back/forward,
  and DOM-driven minimize. Asserts via `data-active-window` (desktop root) and
  `data-win-id` (window root). History-timeline specs are timing-sensitive: assert the
  window is visible before driving back/forward. **Needs a logged-in bench** behind
  `yarn dev` now (boot is live) — not part of an unattended gate; see `cypress.config.js`.

## Conventions & gotchas
- **Stacking**: the desktop root has `isolation:isolate`, so window/chrome z-indexes stay
  local and reka-ui popovers (Dropdown/Tooltip) — which portal to `<body>` with no z-index —
  float above by DOM order. Don't add per-popover z-index hacks; keep the root isolated.
- **Custom chrome** (windows/dock/menu bar/split) is hand-built but styled only on frappe-ui
  CSS variable tokens (`--surface-*`, `--ink-*`, `--outline-*`). Use solid `--surface-base`
  for popovers over the wallpaper; alpha tokens wash out.
- **Changing the window-id scheme or URL projection?** Update together: `pathForFocus`/
  `applyRoute` (`routing/route-map.ts`), `restoreFromHistory` (`main.ts`), the id builders in
  `desktop/windows.ts`, and the `route-map.spec.js` decision tables.
- **Dev white-screen** (`init_shared_esm_bundler is not defined`): keep
  `optimizeDeps.exclude:['frappe-ui','@framework/ui']` in `vite.config.js`; keep their CJS
  leaf deps (feather-icons, socket.io/`debug`, prosemirror, vuedraggable, dompurify) in
  `optimizeDeps.include`. `yarn build` is unaffected.

## Known gaps vs original
- Menu-bar keyboard-shortcut chips omitted (frappe-ui Dropdown is label + action only).
- FormLayout Link fields render as disabled inputs; long Text fields don't span both columns.
- Command palette is a custom blurred overlay (frappe-ui Dialog doesn't match the macOS
  sheet look). The wallpaper picker is a singleton desktop window (`wallpaper` role), not
  an overlay — opened from the desktop context-menu / menu bar, deep-linkable at `/wallpaper`.
