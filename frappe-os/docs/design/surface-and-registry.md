# Surface model & Registry schema — design sketch

> **Status:** step 1 (Surface model) is **implemented**; the Registry/OS-API sections below
> remain a provisional sketch seeding steps 2–4 (`memory/frappe-os-architecture.md`). Refine
> when implementing. Conforms to ADR-0002, 0003, 0004, 0005, 0007, 0012. Types are
> illustrative TS in the style of `src/types.ts`.

> **Step 1 as built** (refinements to §1's sketch, all green: typecheck + 35 Vitest + build):
> - `OsWindow` is `{ id, surface, back?, fwd? }`. `appId` **and** `settingsTab` folded into
>   the surface (`surface.appId`, `surface.params.tab`) — single source of truth, no drift.
> - Window **role** (`app`/`record`/`settings`) is *derived from the id prefix* via
>   `surface.ts` `windowRole(id)`, never stored — that is what "WindowType collapses" means.
> - Surface constructors + pure helpers (`windowRole`, `sameSurface`, `isBuiltin`,
>   `surfaceTab`, `initialSurface`) live in `src/surface.ts`; everything else imports them.
> - `view` is an open `BuiltinView = string` (incl. `'settings'`/`'dashboard'`), per ADR-0004.
> - Persistence `BLOB_VERSION` bumped 1→2 (window shape changed `view`→`surface`; old blobs
>   discard cleanly). Component-surface persistence/URL projection are deferred to a later step.

## 1. Surface model (ADR-0012, build step 1)

A window stops carrying `view: {mode, doctype, recordName}` and instead carries a `Surface`
— a tagged union of "built-in view" vs "applet contribution". Window chrome, geometry,
focus, history, and URL projection stay agnostic to the tag.

```ts
// Replaces ViewMode/WindowType closed unions + the `view` field in types.ts.
export type Surface =
  | BuiltinSurface       // rendered by generic OS machinery
  | AppletSurface        // resolved by the runtime loader (ADR-0009)

export interface BuiltinSurface {
  kind: 'builtin'
  view: string           // 'list' | 'form' | 'dashboard' | 'report' | 'kanban' | ...
                         // OPEN string, not a closed union (ADR-0004). The OS knows a
                         // built-in renderer for some; unknown → applet or fallback.
  doctype?: string       // present for doctype-bound views (list/form/report/kanban)
  recordName?: string    // present for form
  appId?: string         // present for app-level surfaces (dashboard/workspace)
  params?: Record<string, unknown>  // view-specific (filters, group-by, calendar field)
}

export interface AppletSurface {
  kind: 'applet'
  appletId: string       // identity into the Registry: which applet contribution
  appId: string          // owning app (for asset resolution + OS API scoping)
  props?: Record<string, unknown>
}

export interface OsWindow {
  id: string
  surface: Surface       // ⬅ the change. (was: type + view + doctype + recordName)
  back?: Surface[]       // per-window history is now history of Surfaces
  fwd?: Surface[]
}
```

Notes:
- `WindowType` ('app'|'record'|'settings') collapses into `Surface` — "settings" is just a
  built-in view or an applet surface; "record" is `builtin/form`; "app" is
  `builtin/dashboard`.
- `route-map.ts` `pathForFocus`/`applyRoute` switch on `surface.kind`/`view` instead of
  `w.type`/`view.mode`. Keep them pure.
- Surface must be serializable (persistence + history + URL), so no functions/closures in it
  — `AppletSurface` references an applet by id, never by import.

## 2. Registry schema (ADR-0005/0007, build step 3)

The Registry is the **already-merged, already-permission-filtered** list of contributions
the server hands the client (ADR-0005, ADR-0010). The client never sees layers.

```ts
export interface Registry {
  schemaVersion: number              // tolerant versioning (ADR-0008)
  contributions: Contribution[]      // flat list; client indexes by type/target
}

export interface Contribution {
  // Identity tuple (ADR-0007): unique across the merged registry.
  type: string        // extension-point type, e.g. 'app' | 'doctype-view'
                      //   | 'display-config' | 'dashboard-card' | 'menu-item'
                      //   | 'command' | 'script' | 'applet' | 'widget' | ...
  target: string      // what it attaches to: doctype, workspace, app id, '' for global
  name: string        // stable id within (type,target): 'list', 'kanban', a card slug...
  sourceApp: string   // 'erpnext' | 'crm' | a custom app | '__site__' | '__user__'

  // Merge behaviour is a property of the *type*, surfaced here for the client:
  //   singleton → one effective value per (type,target); collection → many, ordered.
  payload: unknown    // type-specific; see per-type shapes below
  order?: number      // collections: explicit ordering
  minOsApi?: number   // applets/scripts: version gate (ADR-0008/0009)
}
```

### Per-type payloads (initial set, ADR-0004)

```ts
// type:'app'  target:'' (or app id)  — singleton per app
interface AppPayload { id: string; name: string; logo: string; color: string; order: number }

// type:'display-config'  target:<doctype>  — SINGLETON, patch-merged (ADR-0007)
// This is today's DoctypeMeta, now a contribution. Site/user layers ship PARTIAL patches.
interface DisplayConfigPayload {
  label?: string; color?: string; icon?: string; titleField?: string
  statusField?: string; statusThemes?: Record<string, string>
  listColumns?: ListColumn[]      // patch ops on collections handled at merge time
}

// type:'doctype-view'  target:<doctype>  — COLLECTION (many views per doctype)
interface DoctypeViewPayload {
  view: string                    // 'list'|'form'|'report'|'kanban'|...
  label: string
  builtin?: boolean               // true → generic renderer; false → appletId below
  appletId?: string               // when applet-backed (resolves to an AppletSurface)
  defaults?: Record<string, unknown>  // default filters/sort/group
}

// type:'dashboard-card'  target:<workspace|app>  — COLLECTION
interface CardPayload { label: string; sub: string; doctype: string;
  filters?: Record<string, FilterValue>; fieldname?: string }

// type:'command'  target:''  — COLLECTION (command palette)
interface CommandPayload { label: string; sub?: string; icon?: string; surface?: Surface }

// type:'applet'  target:''  — COLLECTION (loadable applet registry, ADR-0009)
interface AppletPayload { appletId: string; appId: string; assetUrl: string; minOsApi: number }

// type:'script'  target:<doctype|'global'>  — COLLECTION (ADR-0006)
interface ScriptPayload { assetUrl?: string; source?: string; events: string[] }
```

### Client-side seam

```ts
// build step 3: every generic renderer reads THIS, not config/* or getMeta().
useRegistry() {
  displayConfig(doctype): DisplayConfigPayload      // merged singleton
  views(doctype): DoctypeViewPayload[]              // ordered collection
  apps(): AppPayload[]
  cards(workspaceOrApp): CardPayload[]
  commands(): CommandPayload[]
  resolveApplet(appletId): Promise<Component>       // dynamic import (ADR-0009)
}
```

`useRegistry()` is backed first by today's `config/*` reshaped to these payloads (step 3),
then swapped to the server `Registry` (step 4) with no renderer change.

> **Step 5 as built** (`www/os.py` `get_registry` display-config projection; `store/registry.ts`
> server-overlay; `tests/registry.spec.js` rewritten — all green: typecheck + 69 Vitest + build):
> - **The permit-over-seed model is gone.** `registry.ts` `buildIndex` now branches: a real
>   `boot.registry` → `overlayServer()` indexes the server contributions **directly**; no/legacy/
>   junk registry → the full `config/*` seed (`seedContributions()`), the pure offline fallback.
>   So a doctype the server exposes that `config/*` doesn't curate **lights up from its server
>   payload** — config is decoration, no longer the source of "what exists" (ADR-0011).
> - **Server projects display-config from Desk meta** (`os.py` `_display_payload`): `label`,
>   `titleField` (as before) **plus `listColumns`** (from `in_list_view` fields, title column
>   first, fieldtype→type: Currency→`currency`/Int→`int`/the status field→`status`, capped at 5)
>   and `statusField` (a `status`/`stage` Select — Desk's convention). The ~18 uncurated registry
>   doctypes now get real columns instead of the generic name/status/modified.
> - **OS-native presentation stays client-curated and is OVERLAID** (decision per ADR-0011's last
>   paragraph — no OS-native store yet; reuse `config/*` as the overlay source, not a new seed):
>   `osNativeMeta()` picks `{color,icon,statusField,statusThemes,listColumns,savedViews}` from the
>   curated `DoctypeMeta` and shallow-merges it **over** the server payload (curated wins on
>   overlap; server keeps `label`/`titleField`). `appPayloadFor()` overlays curated app branding
>   (`glyph/hex/logo/modules`/dashboard prefs) under the server identity (`id`/`name`).
> - **Cards are OS-native** (no faithful Desk source for these built-ins — projecting Number Cards
>   would blank most sites' dashboards): `curatedCards()` injects the curated collection for each
>   exposed app, filtered to readable doctypes (preserves step-4 ADR-0010 card visibility).
> - **Ownership is now server-projected:** `addToIndex` fills `owner[target] ??= sourceApp` from
>   display-config contributions (server sets `sourceApp` via `_app_of`/Module Def), so uncurated
>   server doctypes resolve to their real owning app; module-derived owner still wins ties (offline).
> - **Step 5.1 (dogfooding fix, verified in-browser):** the ~18 `defineGeneric` placeholder metas
>   were *shadowing* the server projection with worse columns (e.g. Warehouse showed an always-empty
>   `Status` column). Fix: `DoctypeMeta.generic` marks them; `osNativeMeta()` now defers
>   `BESPOKE_ONLY = [statusField, listColumns]` to the live server projection for generic doctypes
>   (keeping curated `color`/`icon`/`statusThemes` for all), while the 6 hand-tuned bespoke metas
>   still override. config keeps the generic columns as the offline fallback. Warehouse/Stock Entry/
>   Journal Entry/… now render real `in_list_view` columns; bespoke lists (Sales Invoice, CRM Lead)
>   unchanged. This is what made step 5's projection finally *visible* in production.
> - **Deferred, logged (no silent caps):** Property Setter → live display-config patch is now
>   **done — see "Step 5.2 as built" below**; Number Card → `dashboard-card`; Client Script →
>   Script (ADR-0006); Report/Kanban → `doctype-view`; `app.modules`/`logo` projection (curated
>   subset is an OS curation; projecting all Module Defs would flood the UI). schemaVersion stays
>   tolerant (ADR-0008); per-user filtering stays server-side (ADR-0010); `useRegistry()` unchanged.

> **Step 5.2 as built** (`www/os.py` Property Setter projection; no client change — the patch-merge
> already existed and is unit-tested; verified end-to-end on `f2.localhost`):
> - **Property Setters now ride as a live `__site__` display-config patch** (ADR-0007 App-default ⊕
>   Site-layer, ADR-0011 "Property Setters become Display-config patches"). `get_registry()` emits,
>   per affected doctype, a second `display-config` contribution `{name:'patch', sourceApp:'__site__',
>   order:1}` carrying only the mapped fields; the client's existing `addToIndex` shallow patch-merge
>   folds it over the base. Proven live: a `title_field` Property Setter on ToDo → base
>   `titleField:'description'` ⊕ patch `titleField:'reference_name'` → merged `reference_name`.
> - **The merge is real, not idempotent.** The base now carries the **app-default** title
>   (`_title_default` reads the raw DocType row, ignoring this site's Property Setters — `get_meta`
>   would have baked them in and mislabelled them as the app's), so base ⊕ patch genuinely layers.
>   The primary list column routes through the same app-default title for base-internal consistency.
> - **Faithful minimal mapping** (`DISPLAY_PATCH_PROPERTIES`): doctype-level `title_field` →
>   `titleField` is the only property with a clean scalar OS equivalent today. Other doctype-level
>   properties (`search_fields`, `sort_field`, …) are **logged + skipped** (`frappe.logger`), no
>   silent drop. One coalesced patch per doctype (keyed `'patch'`), not one per Property Setter.
> - **Field-level Property Setters stay deferred but lossless:** they'd target `listColumns`, a
>   collection nested in the singleton that shallow-merge can only re-supply wholesale (violates
>   ADR-0007's partial-patch rule). They remain honoured implicitly — `get_meta` bakes a relabel /
>   `in_list_view` change into the base columns — so the customization still renders; it just isn't
>   emitted as an attributed `__site__` patch yet. Number Card / Client Script / Report / Kanban
>   projection still deferred as above.

> **Applet tracer bullet as built** (`os-api.ts`, `surface.ts`, `store/registry.ts`,
> `store/windows.ts`, `store/{index,persistence,palette}.ts`, `route-map.ts`, `main.ts`,
> `components/OSWindow.vue` + new `components/MyTodos.vue`; `os-api`/`route-map`/`store`/
> `registry` specs + new Cypress spec — all green: typecheck + 79 Vitest + build, MyTodos
> emitted as its own lazy chunk):
> - **Terminology:** the second `Surface` kind — an app-contributed, custom-coded, full-window
>   screen — is named an **Applet** (`AppletSurface`, `kind:'applet'`, `appletId`,
>   `resolveApplet`/`knownApplet`). It is *implemented as* a Vue component (the loaded module's
>   default export IS the SFC), but "component" is reserved for the Vue mechanism, not the
>   domain concept. (§1/§2 above now use the `Applet*` names to match the code.)
> - **First real applet driven end to end** — render + OS-API + persistence + URL — validating
>   the runtime/consumer half of the architecture (steps 4/5 only exercised the
>   server-merge/generic-renderer half). External ESM / import-map loader and server `applet`
>   emission stay **deferred behind `resolveApplet`** (ADR-0009); the OS ships a LOCAL
>   first-party map today.
> - **Entry contract (D1, permanent, ADR-0008):** `provide`/`inject`, not a module global. The
>   typed key `OS_KEY: InjectionKey<OsApi> = Symbol('frappe-os:os')` is exported from `os-api.ts`;
>   the host (`OSWindow`) `provide(OS_KEY, getOsApi())` (skipped offline via `tryGetOsApi()`), the
>   applet `inject(OS_KEY)`. A module's **default export IS the SFC**; `surface.props` are the
>   only serializable view-params (`v-bind`), os is **never** a prop. `MyTodos.vue` reaches the OS
>   ONLY through the seam — never the store/api.ts/records.
> - **The applet (D2):** "My open ToDos" (`appId='frappe'`) — `data.getList('ToDo', owner=
>   session.user, status=Open)`, grouped Overdue/Today/Upcoming + priority badges (the
>   justification over the generic list); row → `windows.open(formSurface('ToDo', name))` (an
>   applet spawns a builtin window, ADR-0012); "Mark done" → `data.saveDoc` → `ui.notify`.
> - **URL scheme (D3):** `/<appId>/<appletId>` (e.g. `/frappe/my-todos`) — no sigil; mirrors
>   Frappe overloading `/app/<x>` (resolve, not tag). `pathForSurface` projects it; `applyRoute`
>   resolves it inside the existing `!knownDoctype` branch AFTER the doctype check, so
>   **doctype-wins precedence falls out for free** (kebab ids never shadow TitleCase doctypes).
>   Two seams: sync `knownApplet(app,id)` (routing/palette/persistence) vs async
>   `resolveApplet(id)` (mount). `restoreFromHistory` (browser back/fwd) handles it too.
> - **Persistence:** `validSurface` now accepts an applet surface when `knownApplet` holds;
>   a dead id falls back to the app's `initialSurface` (mirrors a dead doctype). Palette gains an
>   "Open My open ToDos" entry. `capabilities.applets` flipped `false→true`.
> - **Cypress** reload-persistence spec added (needs `yarn dev` + a logged-in bench — not a
>   headless gate); dev-server smoke (route 200, no transform error) + build chunk both verified.

> **Step 4 as built** (`store/registry.ts`, `www/os.py`, `boot.ts`, `main.ts`,
> `store/index.ts`, `os-api.ts`, `types.ts`; `registry.spec.js` +4 → all green:
> typecheck + 64 Vitest + build):
> - **`registry.ts` is now index-driven.** `seedContributions()` reshapes `config/*` into
>   the §2 `Contribution[]` (the App-default seed — the only `config/*` importer);
>   `indexContributions()` sorts by `order` once, then folds: `display-config` → singleton
>   **patch-merge** (`{...acc, ...payload}`, ADR-0007), `doctype-view`/`dashboard-card` →
>   ordered collections, `app` → ordered list. `useRegistry()`/`getMeta`/`appForDoctype`
>   read the index; the seam is byte-for-byte unchanged.
> - **Cards are now real `dashboard-card` contributions** (finishing step 3's deferral):
>   the seed splits `AppDef.cards` into a per-app collection; `cards()` reads the index.
> - **Where the merge runs (ADR-0005, confirmed):** the server merges + permission-filters;
>   the client only **indexes + projects + applies the server's visibility filter** — never
>   layer-merges payloads. `www/os.py` `get_registry()` emits `{schemaVersion, contributions}`
>   = `app` (installed OS apps) + `display-config`/`doctype-view` (readable doctypes), already
>   per-user filtered (ADR-0010). The client treats it as a **permit-list**: `permit()` drops
>   seed contributions whose doctype/app the server didn't expose. No server registry
>   (offline / legacy bare array / unit tests) → seed passes through unfiltered.
> - **§2 refinement — payloads stay client-seeded this step.** The rich *presentation*
>   payloads (branding, `listColumns`, `statusThemes`, icons) remain TS-curated in `config/*`
>   (the App-default layer) rather than ported to Python, because **step 5 projects them
>   server-side from Desk metadata** (ADR-0011) and a hand-port would be throwaway. So step 4
>   moves *visibility* to the server (the real ADR-0005/0010 win) and leaves *presentation* in
>   the seed; step 5 moves presentation too, demoting `config/*` to a pure offline fallback.
> - **schemaVersion tolerance (ADR-0008):** `asServerRegistry()` accepts any numeric
>   `schemaVersion` with a `contributions` array and indexes the types it knows (ignores the
>   rest) — a newer/older server degrades, never throws. Junk / legacy `[]` → no filter.
> - **Boot seeding stays synchronous:** `initRegistry(boot)` builds + caches the module index
>   once at boot (`main.ts`, before `hydrate`; falls back to the seed if `getBoot()` fails),
>   mirroring `initOsApi`/`getOsApi`. `useRegistry()` stays sync via `ensureIndex()` (lazy seed
>   when `initRegistry` hasn't run — unit tests / pre-boot reads). `store/index.ts`'s eager
>   import-time `APP`/`APP_ORDER` became **getters** on `useOS()`, so a store captured before
>   boot still reflects the boot-seeded index.
> - **Real session shape (ADR-0010):** `get_boot()` now emits `roles` (`frappe.get_roles()`)
>   and a standard `permissions[doctype]` = `{read,write,create,delete}` map (was the
>   mismatched `{can_create,can_write}`). `BootData` gains `roles: string[]`, `registry:
>   OsRegistryData | unknown[]`, `permissions: Record<string, Record<string, boolean>>`;
>   `os-api.ts` `makeSession` reads `boot.roles` (Array-guarded for offline) and
>   `permissions[doctype][ptype]` — no longer defensive placeholders.

> **Step 3 as built** (`src/store/registry.ts`, `tests/registry.spec.js`; all green:
> typecheck + 60 Vitest + build):
> - `useRegistry()` exposes `apps()` / `app(id)` / `appForDoctype(doctype)` /
>   `displayConfig(doctype)` / `views(doctype)` / `cards(appId)`. `registry.ts` is now the
>   **only** module that imports `config/apps` + `config/doctypes`; step 4 reshapes just its
>   internals to read the server-merged Registry.
> - **The existing config types already ARE the payloads**, so the reshape is light (reuse
>   over new code): `AppDef` realizes `AppPayload` (richer than the minimal sketch — renderers
>   need glyph/hex/modules), `DoctypeMeta` realizes `DisplayConfigPayload`, `Card` realizes
>   `CardPayload`. Only `DoctypeViewPayload` (types.ts) is genuinely new.
> - **`views` is now the real projection** (not the `['list','form']` string placeholder):
>   `views(doctype)` returns `DoctypeViewPayload[]` — `[{view:'list',label:'List',builtin:true},
>   {view:'form',label:'Form',builtin:true}]` for a known doctype, `[]` otherwise — derived
>   from display-config presence until component-backed views land. `OsRegistry.views`'s
>   return type changed `string[]`→`DoctypeViewPayload[]` (the seam has no consumers yet).
> - **Accessors rerouted** through `useRegistry()`: `appForDoctype` + `getMeta` *moved* from
>   `config/*` into `registry.ts`; `store/index.ts` builds `DATA.APP`/`APP_ORDER`/`getMeta`/
>   `appForDoctype` from it; `surface.ts`, `store/{windows,palette,persistence}.ts`, and
>   `os-api.ts`'s `registry.*` now read the registry, not config. **`os.DATA.meta` was dropped**
>   (a parallel meta map that wouldn't survive the step-4 server backing); its 7 renderer
>   sites read `os.getMeta(doctype)` instead.
> - **`commands()` not built** — no current renderer consumes it (the palette generates its
>   own items from `apps()` + owned doctypes), per "build only what renderers need". `cards()`
>   exists as the §2 accessor, but cards stay nested in `AppDef` for authoring; the server
>   splits them into `dashboard-card` contributions in step 4. `config/apps.ts`'s
>   `initials`/`pill` are pure presentation helpers, not registry data, so they stay put.

## 3. OS API seam (ADR-0003) — minimum surface to start

The one object applets & scripts receive. Keep it *narrow* and additive-only (ADR-0008).

> **Step 2 as built** (`src/os-api.ts`, `src/types.ts` interfaces, `tests/os-api.spec.js`;
> all green: typecheck + 51 Vitest + build):
> - `createOsApi(boot)` factory + `initOsApi`/`getOsApi` singleton — the seam is built once
>   boot resolves and handed to components. No consumer wired yet (no component exists).
> - **`data` splits its backing on purpose:** `getList`/`getDoc`/`call` wrap `api.ts`
>   directly (they throw on error, and never touch the doctype-keyed shared list/doc caches
>   — a component's filtered read would otherwise clobber what a built-in list shows);
>   `saveDoc`/`createDoc` wrap the records store so those caches refresh write-through and
>   built-in views stay coherent after a component mutates.
> - `windows.open(surface)` needed a generic store action — added `openSurface` (windows.ts)
>   over the existing private `ensureApp`, plus `surfaceAppId` (surface.ts). `close`→`closeWin`,
>   `focus`→`activateWin` (raises + un-minimizes).
> - `ui.notify`→frappe-ui `toast`; **`confirm` simplified to `confirm(message): Promise<boolean>`**
>   over `window.confirm` (the sketch's `confirm(opts)` — no structured options needed yet).
> - `registry.displayConfig`→`getMeta`; `views(doctype)` is a placeholder (`['list','form']`
>   for known doctypes) until step 3's `useRegistry`.
> - **Refinement flagged:** `BootData` carries no `roles` (and its `permissions` shape is
>   server-defined later) — `session.roles` is read defensively and is `[]` until boot / the
>   merged Registry (step 4) supplies it. `hasPermission` reads `permissions[doctype][ptype]`.

```ts
interface OsApi {
  data: { getList; getDoc; saveDoc; createDoc; call }   // wraps api.ts/records.ts
  windows: { open(surface: Surface); close(id); focus(id) }
  ui: { notify(msg); confirm(opts) }
  session: { user; roles; hasPermission(doctype, ptype) }
  registry: { displayConfig; views }                    // read-only projections
  capabilities: Record<string, boolean>                 // feature detection (ADR-0008)
}
```

## Mapping to current code (what each step touches)

| Step | Files | Change |
|---|---|---|
| 1 Surface ✅ | new `surface.ts`; `types.ts`, `store/{windows,geometry,persistence,state}.ts`, `route-map.ts`, `main.ts`, `OSWindow/Dock/MenuBar/SettingsDialog.vue`, both store specs | done — `type`/`view` replaced by `Surface`; role derived via `windowRole`; switch on `view`/`kind` |
| 2 OS API ✅ | new `os-api.ts` (`createOsApi(boot)` + `initOsApi`/`getOsApi`); `surface.ts` `surfaceAppId`, store `openSurface`; `types.ts` `OsApi`/`OsData`/…; `os-api.spec.js` | done — single seam built. **Reads (`getList`/`getDoc`) + `call` wrap api.ts directly** (throw on error; no shared-cache pollution); **writes (`saveDoc`/`createDoc`) wrap the records store** (write-through refresh). `windows.open` → new generic `openSurface`; `ui.notify` → frappe-ui `toast`, `confirm` → `window.confirm`; `session` projects BootData; `registry` reads curated `getMeta`; `capabilities` honest flags |
| 3 useRegistry ✅ | new `store/registry.ts` (`useRegistry()` + moved `appForDoctype`/`getMeta`); `types.ts` `DoctypeViewPayload` + `OsRegistry.views`; `store/{index,windows,palette,persistence}.ts`, `surface.ts`, `os-api.ts`; `OSWindow/Dock.vue` (`DATA.meta`→`getMeta`); `registry.spec.js`, `os-api.spec.js` | done — `registry.ts` is the sole `config/*` consumer; existing config types reused as payloads; `views` is the real `DoctypeViewPayload[]`; `DATA.meta` dropped for `os.getMeta`; `commands()` deferred (unused) |
| 4 server swap ✅ | `www/os.py` (`get_registry`/`get_permissions`/`get_boot`); `store/registry.ts` (index + filter + `initRegistry`); `boot.ts`, `main.ts`, `store/index.ts` (getters), `os-api.ts`, `types.ts`; `registry.spec.js` | done — server emits `{schemaVersion, contributions}` permission-filtered; client indexes the seed + applies it as a visibility filter; `roles`/perms shape made real; **presentation stays client-seeded until step 5** |
| 5 dogfood ✅ | `www/os.py` (`_display_payload`/`_list_columns`/`_status_field`); `store/registry.ts` (`overlayServer`/`osNativeMeta`/`appPayloadFor`/`curatedCards`/`decorate`; `permit`/`allowed` removed); `registry.spec.js` | done — server projects display-config from Desk meta (label/title/columns/status); client indexes server payloads DIRECTLY + overlays OS-native presentation (branding/icons/status/cards) keyed by id; config/* demoted to offline fallback; ownership from `sourceApp`. Property Setter/Number Card/Client Script/Report/Kanban projection deferred |
| 5.2 Property Setter ✅ | `www/os.py` (`_title_default`/`_doctype_property_setters`/`_display_patch`/`DISPLAY_PATCH_PROPERTIES`; `get_registry` patch emit); no client change | done — doctype `title_field` Property Setter → live `__site__` display-config patch (ADR-0007 App-default ⊕ Site-layer); base carries the app-default title so the merge is real; unmapped doctype properties logged+skipped; field-level deferred (lossless via baked meta). Verified on f2.localhost |
| Applet tracer bullet ✅ | `os-api.ts` (`OS_KEY`/`tryGetOsApi`/`resolveApplet`/caps), `surface.ts` (`appletSurface`), `store/registry.ts` (local map + `knownApplet`/`resolveApplet`/`listApplets`), `store/windows.ts` (`openApplet`), `store/{index,persistence,palette}.ts`, `route-map.ts`, `main.ts`, `OSWindow.vue` + new `MyTodos.vue`; specs + Cypress | done — first real **applet** (app-contributed full-window screen; implemented as a Vue component, but "component" stays the Vue mechanism) end-to-end (render + OS-API + persistence + URL). provide/inject entry contract (`OS_KEY`); "My open ToDos" grouped by due date; URL `/<app>/<appletId>` (doctype-wins); external loader + server `applet` emission deferred behind `resolveApplet` |
```
