# Frappe OS — orientation

**Frappe OS**: a macOS-style desktop shell for Frappe, built on frappe-ui. A standalone
frontend served at `/os`, wired to the live Frappe backend — lists, forms, counts and recents
come from the REST/whitelisted API, with editable Save/New. Curated app icons/colors/dashboard
cards are config (`src/config/*`); the data behind them is live. The `src/` tree is TypeScript
(`.ts`/`.vue`); a few `.js` test specs remain.

```
cd apps/frappe/frappe-os && yarn dev   # → http://localhost:5273/  (base /os/)
```

This file is the **durable orientation**: the mental model, what each subsystem owns, and the
gotchas. It deliberately does **not** restate volatile specifics — exact window-id strings,
route shapes, or per-file export lists — because those live in the code and rot here. For those,
read the named file. For *why* a thing is shaped the way it is, read the relevant ADR
(`docs/adr/`) and the reserved domain language (`CONTEXT.md`).

## Mental model
Everything is **store-driven**. `useOS()` (`desktop/index.ts`) is a module-singleton reactive
store; components render from it and call its actions. The desktop draws its own windows — there
is **no `<router-view>` UI**. The URL is a side-channel that only mirrors the *focused* window.

- **A window** = an entry in `state.windows[]` carrying its `id`, its `surface` (WHAT it shows —
  a builtin dashboard/list/form/settings surface or an applet, ADR-0012), and per-window nav
  history. The **id encodes the role**: `windowRole(id)` derives `app`|`settings`|`system` from
  the id prefix. An app can have **multiple instances** (Window ▸ New window): the first is the
  **canonical instance** (owns the bare `/os/<app>` path), extras get a `#n` suffix and are
  addressed by `?instance=n`. There is no separate record/pop-out window kind — opening a record
  in a new window mints an ordinary app instance already on that record's form (ADR-0016/0017).
  The exact id scheme lives in `desktop/windows.ts` + `surface/index.ts` (`windowRole`).
- **Geometry is separate** from identity: `state.geo[id]` merged over a by-index default in the
  `geoMap` computed; `bumpZ()` raises focus.
- **Persistence**: one debounced localStorage blob holds the durable desktop (windows/geo/split/
  activeId/theme/wallpaper/toggles); ephemeral overlays and the transient settings windows are
  excluded (respawned from URL). `hydrate()` runs before routing and drops windows whose
  doctype/record no longer resolves. See `desktop/persistence.ts`.
- **Routing** (`routing/route-map.ts` — pure — + `main.ts` — wiring only): a focus watcher pushes
  the focused window's path; back/forward restores focus; `applyRoute` spawns from a cold
  deep-link. A `programmatic`/`restoring` guard pair breaks the focus→push→restore loop —
  preserve it. Keep the URL projection pure and in `route-map.ts`.

## Subsystems (`src/`)
Grouped by subsystem; each folder owns its logic AND a colocated `types.ts`, re-exported through
the thin `src/types.ts` barrel so `@/types` stays one stable import path. What each owns:

- `desktop/` — the window-manager state machine (open*/nav/lifecycle/geometry/palette/
  persistence), split to satisfy the file-size rule and re-assembled by `index.ts` `useOS()`.
- `data/` — the backend-facing layer: `api.ts` (Frappe client, CSRF), `records.ts` (live reactive
  list/doc/count/field-meta caches over `api.ts`), `boot.ts` (boot payload), `os-api.ts` (the
  ADR-0003 OS API seam handed to applets). `@/data` exposes only the public boot+seam.
- `registry/` — the client Registry seam. `index.ts` is a re-export **barrel** (ADR-0013); the
  logic lives in named files (`store.ts` accessors/`useRegistry`, `ingest.ts`, `index-builder.ts`,
  `applets.ts`, `extension-points.ts`, `classify.ts`). Projects apps/views/cards/default-surface
  over the merged `Contribution[]`, and folds the Action-model `command`/`action` contributions
  (an app declares its verbs in its `os/commands.json` manifest, ADR-0030).
- `surface/` — Surface constructors + pure helpers (`windowRole`/`sameSurface`/…), and the
  **default-surface resolver** `initialSurface(appId)` (ADR-0021).
- `actions/` — the Action/extension model **engine** (CONTEXT.md → Command/Action/Region/Handler/
  Context/Eligibility). A pure-data resolver (no `eval`, no handler loading): eligibility,
  specificity, per-`(region,command)` competition with attributed shadow logging. Every menu-bar
  menu and every surface toolbar renders through the one `projectRegion` path — menus via
  `menuOptions`, toolbars via `toolbarItems`. First-party OS verbs are `frappe` Commands/Actions
  (`menu-contributions.ts`); an app's folded contributions compete with them, so any menu is
  customizable (ADR-0001/0007/0014/0032). The bar is **earned** (ADR-0039): a menu renders only
  when a real Action resolves into it, so the OS owns no File menu (apps earn it), whole-OS verbs
  like full screen live in System not View, and the pin verbs live in Window. `contributions.ts`
  is the run-Handler mechanism only — a run Handler receives an **Invocation** (context + selection
  snapshot frozen at click, ADR-0037), never the bare store.
- `indicators/`, `placements/`, `recents/`, `wallpapers/` — the live-meta indicator model
  (ADR-0028), the user-arrangeable desktop/dock Placements (App<Site<User, ADR-0023), the per-user
  Recents record-open log (ADR-0024), and the wallpaper catalog/selection (ADR-0036). Each is a
  subsystem folder with a colocated `types.ts`.
- `config/` — curated DISPLAY config only: `apps.ts` (APP tree, dashboard card defs), `doctypes.ts`
  (per-doctype label/color/icon — list columns are now live-meta/synthetic, `getMeta` is a
  Registry projection), `icons.ts`. The data behind it is live.
- `routing/`, `main.ts`, `App.vue` — the URL side-channel, its bridge wiring, and the desktop root.
- `components/` — Vue **feature folders** behind barrels (ADR-0013): `Window/`, `List/`, `Form/`,
  `Views/` (the doctype view seam), `Settings/` (the two-pane settings body + wallpaper picker),
  `MenuBar/`, `Dock/`, `CommandPalette/`, `Finder/`. Shared leaves (`StatusPill`, `OSDropdown`,
  `OSContextMenu`) stay flat. The chrome **look** is specified in
  `docs/design/chrome-visual-language.md` — read it before restyling chrome.
- `applets/` — sibling to `components/`; an applet reaches the OS only through the injected
  `OS_KEY` seam (ADR-0002/0009), not the store.

Backend host page: `frappe/www/os.{py,html}`; the OS engine is `frappe/os_core/` (reads each app's
`os_app` hook for OS opt-in + identity and projects the layered contributions). `frappe/os/` is a
**data-only** manifest folder — never add `.py` there (it would re-shadow stdlib `os`).

## Tests
```
yarn test          # Vitest (unit, jsdom) — pure logic + the record caches
yarn dev & yarn e2e  # Cypress — needs the dev server on :5273 and a logged-in bench
```
Vitest covers the pure logic and the live record caches (`api.ts` mocked): focus transitions +
`hydrate`, the `pathForFocus`/`applyRoute` decision tables, and the `actions` resolver decision
tables (eligibility, specificity, tiebreak chain, shadow logging, and every menu rendering from
resolved Actions). Cypress covers only what unit tests can't — the vue-router `/os/` base,
cold-boot URL seeding, reload persistence, back/forward, DOM-driven minimize — asserting via
`data-active-window` / `data-win-id`. **Where a spec lives** is decided by its subject's folder
kind (ADR-0013): a feature folder under `components/`/`applets/` colocates its specs in a local
`tests/`; a subsystem folder under `src/` uses the top-level `tests/`.

## Conventions & gotchas
- **Stacking**: the desktop root has `isolation:isolate`, so window/chrome z-indexes stay local
  and reka-ui popovers (which portal to `<body>` with no z-index) float above by DOM order. Don't
  add per-popover z-index hacks; keep the root isolated.
- **Custom chrome** (windows/dock/menu bar/split) is hand-built but styled only on frappe-ui CSS
  variable tokens (`--surface-*`, `--ink-*`, `--outline-*`). Use solid `--surface-base` for
  popovers over the wallpaper; alpha tokens wash out.
- **Changing the window-id scheme or URL projection?** Update together: `pathForFocus`/`applyRoute`/
  `parseSegments` (`routing/route-map.ts`), the router's `:segments*` capture (`routing/router.ts`),
  `routeParams`/`restoreFromHistory` (`main.ts`), the id builders in `desktop/windows.ts`, and the
  `route-map.spec.js` decision tables.
- **The path is variable-length, not fixed positions** (ADR-0040): the scheme is
  `/<app>/<workspace?>/<doctype?>/<name?>/<aspect?>`. The optional **workspace** segment between app
  and doctype (`/erpnext/selling/Customer`) is disambiguated from a doctype by `parseSegments` via
  `os.workspaceForSlug` — a membership lookup, never a guess. The workspace set is provisionally
  sourced from `AppDef.modules` until Workspace Sidebar ingestion lands (deferred issue). Because a
  cold link can't be parsed without that set, the registry must be seeded (boot step 0) before the
  entry route is applied — it already is.
- **`defineProps`/`defineEmits` macro types** must import from the CONCRETE module (e.g.
  `@/surface/types`), never the `@/types` barrel — only the dev `vite:vue` transform catches the
  violation; `vue-tsc` and `yarn build` don't.
- **Framed applet 404 / blank window**: a framed applet loads its asset from a **build output**
  (gitignored) that the app builds as part of **its own** build, guarded to skip on stock frappe.
  This is deliberate — Frappe Cloud builds each app in its own layer where siblings aren't on disk
  yet, so only the app-owns-its-applet-build model survives. In dev, rebuild the applet directly.
- **Dev proxy is a generic catch-all** (`vite.config.js`): the OS dev server owns only `/os/*` +
  Vite internals; everything else forwards to the bench (ADR-0020). Never name a framed app in the
  config — that was the retired privileged-core leak.
- **Dev white-screen** (`init_shared_esm_bundler is not defined`): keep
  `optimizeDeps.exclude:['frappe-ui','@framework/ui']` and their CJS leaf deps in
  `optimizeDeps.include`. `yarn build` is unaffected.

## Known gaps vs original
- Menu-bar keyboard-shortcut chips omitted (frappe-ui Dropdown is label + action only).
- FormLayout Link fields render as disabled inputs; long Text fields don't span both columns.
- The command palette is a custom blurred overlay (frappe-ui Dialog doesn't match the macOS sheet
  look). Per-user **Settings** (ADR-0027) is a singleton desktop window with the desktop-wide prefs
  (Appearance/wallpaper, Dock), opened from the desktop context-menu / menu bar / dock right-click.
