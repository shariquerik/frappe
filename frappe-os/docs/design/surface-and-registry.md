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
                      //   | 'display-config' | 'dashboard-card' | 'command' | 'action'
                      //   | 'default-surface' | 'script' | 'applet' | 'widget' | ...
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

// type:'command'  target:''  — COLLECTION (the Action-model verb, CONTEXT.md → Command).
// name = the command id. Handler is resolved by id (navigate = data; run = lazy ref), never
// raw code. First-party OS commands stay bundled in @/actions; apps ship these via os_commands.
interface CommandPayload {
  id: string; sourceApp: string; title: string
  handler: { kind: 'navigate'; surface: Surface } | { kind: 'run'; ref: string }
}

// type:'action'  target:<region>  — COLLECTION (the Action-model placement, CONTEXT.md → Action).
// name = the placed command id, so a same-id Action competes per (region, command). `when` gates
// it contextually; `commandPatch` is an ADR-0007 Patch of the placed Command's presentation,
// applied only when this Action wins (e.g. erpnext re-titling New window for an erpnext window).
interface ActionPayload {
  command: string; region: string; sourceApp: string
  when?: Record<string, string>; order?: number; group?: string
  commandPatch?: { title?: string }
}

// type:'applet'  target:''  — COLLECTION (loadable applet registry, ADR-0009)
// `kind` ('native'|'framed', ADR-0020) is how the content is produced; absent → 'native'.
// `nav` (ADR-0026) is whether the applet wants the OS nav rail; absent → false (no rail).
interface AppletPayload { appletId: string; appId: string; assetUrl: string; minOsApi: number; kind?: 'native' | 'framed'; nav?: boolean }

// type:'default-surface'  target:<appId>  — SINGLETON, patch-merged App<Site<User (ADR-0021)
// The app's declared landing, as a stable app-qualified surface REFERENCE (never a Surface
// descriptor). The resolver parses it; a per-user default is just a User-layer override.
type SurfaceRef =
  | { applet: string; app?: string }
  | { doctype: string; view: string }     // the doctype names its owning app
  | { dashboard: true; app?: string }

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

> **Applet loader (B) — tracer bullet PLAN** (next slice; ADR-0009 + its dependency-boundary
> addendum). Retires the architecture's one entirely-unvalidated promise: *a separately-built
> app contributes a pre-built applet the OS loads at runtime as native ESM, sharing the host's
> single Vue/frappe-ui/OS-API — no OS rebuild.* The applet tracer bullet proved render/OS-API/
> persistence/URL but stubbed this behind a LOCAL map; steps 4/5 only proved server-merge. This
> slice proves the **load**.
> - **B-before-A (deliberate inversion of the handoff).** The risk lives entirely in the runtime
>   load + shared-singleton render, NOT in server emission (that's the same merge pattern steps
>   4/5/5.2 already proved). So this slice does **B** (real `import(assetUrl)` of an external
>   artifact through an import map + broker) and **defers A** (server `applet` contributions) to
>   the next slice. The `assetUrl` is hardcoded in the local `APPLETS` map for now — the map stays
>   "the only thing that grows"; callers never change.
> - **Contributor = erpnext, not CRM (cleanest proof).** An applet is **not a second Vue app**
>   (CONTEXT.md): it ships no Vue of its own and binds to the OS's single shared Vue. CRM's
>   standalone `frontend` SPA (its own Vue) would muddy the proof; erpnext has no Vue frontend, so
>   an erpnext-shipped applet can *only* be running on the OS's Vue. The contributor is just an
>   `appId` + an asset home (`/assets/erpnext/…`); the applet is a brand-new preset-built artifact
>   in erpnext's public assets, touching none of erpnext's existing frontend.
> - **Sharing = Strategy 2, broker re-export (NOT host-dep externalization).** The host stays
>   bundled; the frappe-os build emits stable-URL **broker** entries that re-export its *own*
>   `vue` / `frappe-ui` / `@frappe-os/api` instances (separate files per specifier to avoid
>   namespace-merge collisions). An **import map** in `www/os.html` maps those three bare
>   specifiers → the broker URLs, before any module loads. The applet's preset marks the three
>   `external`; at runtime they resolve via the import map to the host's *one* instance. Rejected
>   Strategy 1 (externalize the host's own frappe-ui — deep, fragile surgery given the existing
>   `optimizeDeps` chain) for this slice.
> - **OS-API bare specifier = `@frappe-os/api`** (parallels the repo's `@framework/ui`). Shared
>   not just for the API object but because `OS_KEY` is a `Symbol` — `inject(OS_KEY)` only resolves
>   if both sides reference the *same* Symbol AND the *same* Vue runtime. The applet preset
>   types-aliases `@frappe-os/api` → `src/os-api.ts` at build, externalizes it for bundle.
> - **Dependency boundary (ADR-0009 addendum):** the applet bundles *everything except* the three
>   externals; it has its own `package.json` + build. The tracer-bullet applet deliberately needs
>   **zero extra deps** (keeps the bullet about the load, not dep-bundling). Duplication of any
>   non-shared dep across applets is the accepted cost; promotion to a shared singleton is a
>   host-only ADR-0008 compatibility event.
> - **`resolveApplet` gains an `assetUrl` branch:** `AppletEntry.assetUrl?` → `resolveApplet` does
>   `import(/* @vite-ignore */ assetUrl)` and returns `module.default`; else today's `load()`. One
>   hardcoded entry `'erp-hello': { appId:'erpnext', label:'ERPNext Hello',
>   assetUrl:'/assets/erpnext/os-applets/hello.js' }`. Applet build emits to
>   `apps/erpnext/erpnext/public/os-applets/hello.js` at a **stable un-hashed filename**.
>   `knownApplet`/`listApplets`/persistence/URL (`/erpnext/erp-hello`)/palette all work unchanged.
> - **Green bar — a *falsifiable* proof (two-Vues fails LOUDLY):** the erpnext applet on mount
>   (1) `inject(OS_KEY)` → loud `NO OS API` state if falsy; (2) `os.data.getList` a guaranteed
>   readable doctype → renders rows; (3) one **frappe-ui** `Button` (proves external #2) → click →
>   `os.ui.notify` toast; (4) a local `ref` counter ++ (reactivity on the shared scheduler); (5)
>   `os.windows.open(formSurface(...))` → spawns a builtin window (proves `windows` across the
>   boundary, ADR-0012, like `my-todos`). Cypress on the bench-served build asserts all five.
> - **Three dev loops (the load mechanism is production-only — dev-host Vue isn't externalized):**
>   `yarn dev` + the local-map `my-todos` for **host** wiring; the erpnext applet's own `vite dev`
>   + a **~30-line stub-OS dev harness** (`dev.html` mounts the SFC, `provide(OS_KEY, stubOs)`,
>   stubOs hits the bench REST) for **applet** authoring with HMR; `vite build --watch` the applet
>   → bench-served built host → reload for the **load** integration. Cypress is the gate. The stub
>   harness is *not* throwaway — it's how every future applet author works.
> - **Deliverables:** the official **Vite build preset** (externalizes the three; emits stable
>   filename) — ADR-0009's "official preset" is a real artifact of this slice; broker entries +
>   import map in `www/os.html`; `resolveApplet` `assetUrl` branch + hardcoded entry; the erpnext
>   applet SFC + its `package.json`/preset config + stub-OS dev harness; Vitest for the branch;
>   Cypress green-bar spec (built+bench). **Verify:** `yarn typecheck && yarn test && yarn build`
>   in frappe-os + build the erpnext applet + Cypress against the bench-served build.
> - **Honest gap (no silent caps):** the loader path is NOT exercised by the fast `yarn dev` loop
>   (production-only mechanism) — mitigated by the local-map path staying dev-testable and the
>   `build --watch` integration loop. Server `applet` emission (A), the doctype-view applet
>   (`DoctypeViewPayload.appletId`), and Scripts (ADR-0006) remain deferred.

> **Applet loader (B) as built** (`src/brokers/{vue,frappe-ui,api}.ts`, `index.html`,
> `vite.config.js`, `store/registry.ts`, `preset/applet.js`, `package.json`; the erpnext
> applet `apps/erpnext/erpnext/os-applets/hello/*`; `tests/registry.spec.js` +3 and a new
> Cypress green-bar spec — all green: typecheck + 82 Vitest + frappe-os build + applet build;
> brokers + applet artifact verified SERVED by the bench, content-type `text/javascript`):
> - **The architecture's one unvalidated promise is now real:** a separately-built app
>   (erpnext, no Vue of its own) ships a pre-built applet the OS loads at runtime as native
>   ESM, sharing the host's single Vue / frappe-ui / OS-API — no OS rebuild. The erpnext build
>   emits a 3 KB `hello.js` whose only un-bundled imports are the three bare specifiers
>   `vue` / `frappe-ui` / `@frappe-os/api`; `export { … as default }` is the SFC.
> - **Sharing = Strategy 2 (broker re-export), confirmed working.** `src/brokers/*` are
>   additional Vite entries emitted at STABLE, un-hashed URLs (`os-brokers/{vue,frappe-ui,
>   api}.js`) under the build's base; each re-exports the host's OWN bundled instance, deduped
>   onto the one chunk the host already ships. The **`osImportMap()` plugin** injects an import map
>   (`head-prepend`, before the entry module) mapping the three bare specifiers → those broker URLs
>   in build (and → the broker SOURCE modules in dev — see the dev/prod bullet below), so the
>   applet's `import(assetUrl)` binds to the host's singletons. `@frappe-os/api`'s broker
>   (`brokers/api.ts`) doubles as the curated public surface — `OS_KEY` + surface constructors
>   only, internals (`getOsApi`/`resolveApplet`/…) stay private; an applet author's tsconfig
>   aliases `@frappe-os/api` → this file.
> - **The make-or-break detail — re-export preservation.** Rolldown (Vite 8) tree-shakes a
>   broker entry's re-exports to a bare side-effect `import"<chunk>"` because nothing in the
>   host build consumes the broker, leaving `import { OS_KEY }` resolving to nothing (the silent
>   two-Vues failure mode the green bar guards against). Fix: `build.rollupOptions.
>   preserveEntrySignatures: 'strict'` pins each entry's signature, so the broker emits the real
>   `import { … } from "<chunk>"; export { … as OS_KEY/ref/Button/… }`. Verified: the served
>   brokers re-export OS_KEY/formSurface (api), ref/inject/onMounted/Fragment/… (vue), and
>   Button/Badge/toast (frappe-ui). (An earlier `generateBundle` regex fallback was removed once
>   `preserveEntrySignatures` proved sufficient — no dead plumbing left.)
> - **`resolveApplet` gained an `assetUrl` branch** (`store/registry.ts`): `AppletEntry` is now
>   `{ appId, label, load?, assetUrl? }`; the extracted `loadApplet(entry, importer)` does
>   `importer(assetUrl)` (default = `import(/* @vite-ignore */ url)`) → `.default`, else the
>   first-party static `load()`. The injected `importer` makes the branch unit-testable in jsdom
>   without a network module. One hardcoded entry `'erp-hello' → /assets/erpnext/os-applets/
>   hello.js`; `knownApplet`/`listApplets`/persistence/URL (`/erpnext/erp-hello`)/palette work
>   unchanged. (Server `applet` emission (A) is now done — see "Server applet emission (A) as built";
>   the local map no longer grows, an app's `os_applets` hook does.)
> - **The official Build preset is a real artifact** (`preset/applet.js`): `appletConfig({root,
>   entry,outDir,fileName,devApiPath})` → Vite lib-mode ES build, `external` = the three shared
>   singletons (`SHARED_EXTERNALS`), stable un-hashed filename. The erpnext applet ships ZERO
>   extra deps and no build tooling of its own — its `vite.config.js` imports the preset by path
>   and is RUN FROM frappe-os (`yarn build:applet:erpnext` / `dev:applet:erpnext`), so vite +
>   `@vitejs/plugin-vue` + vue resolve from frappe-os/node_modules (the applet config must NOT
>   `import 'vite'` — it has no node_modules; it returns the preset's plain config object).
> - **Dev loops.** Host wiring: `yarn dev` + the local-map `my-todos`. Applet authoring: the erpnext
>   applet's own `vite dev` (stub-OS `dev.html`/`dev.ts` providing `OS_KEY`, `stub-os.ts` hitting the
>   bench REST) for HMR — NOT throwaway, it's how every applet author works. Load integration: with
>   the **mode-aware import map** the runtime-loaded applet now also works in the MAIN `yarn dev`
>   server (`build:applet:erpnext` → reload the dev host) — no longer only the bench-served build.
> - **Green bar = five falsifiable checks PASSED** in `Hello.vue`, asserted by `cypress/e2e/
>   applet-loader.cy.js` against the BENCH-SERVED prod build: (1) `inject(OS_KEY)` resolved (else a
>   loud `data-os="missing"` state); (2) `data.getList('DocType')` rows; (3) a frappe-ui `Button` →
>   `ui.notify` toast; (4) a `ref` counter ++; (5) `windows.open(formSurface(...))` spawns a builtin
>   window. Run logged-in as Administrator on `http://f2.localhost:8016` — all five green.
> - **Works in BOTH the bench-served prod build (:8016) AND the Vite dev server** — via a
>   **mode-aware import map** (`osImportMap()` plugin, injected `head-prepend` so it precedes the
>   entry module; the static `index.html` block was removed). The map's targets differ because the
>   host's modules do: BUILD → the stable `/assets/frappe/os/os-brokers/*.js` chunks (re-export the
>   host's BUNDLED instances); DEV → the broker SOURCE modules `/src/brokers/*.ts` Vite serves, whose
>   `export * from 'vue'` / `@/os-api` resolve to the SAME deduped dev vue / live os-api the host
>   runs. So a built applet (loaded via the bench-proxied `/assets/<app>/…` in dev) binds to the dev
>   host's singletons too — `inject(OS_KEY)` resolves in dev. Green bar PASSES on both :8016 and the
>   dev server.
> - **The diagnosis that led here:** the first green-bar run hit `data-os="missing"` against :8096;
>   `performance.getEntriesByType` showed the host had loaded `/src/os-api.ts` (dev) while the broker
>   re-exported the prod `os-api` chunk → two OS_KEY Symbols. The prod fix is the bench webserver;
>   the dev fix is the DEV branch of the import map above. (:8096 is itself a Vite dev server.)
> - **`ui.notify` was a silent no-op** — the host mounted no toast renderer, so `toast()` queued
>      into a vue-sonner instance nothing displayed. Fixed by mounting frappe-ui's `<ToastProvider />`
>      in `App.vue` (makes `ui.notify` real for EVERY applet, built-in or runtime-loaded; the shim
>      `types/frappe-ui.d.ts` gained `ToastProvider`).
> - **Prod SPA route added** (`frappe/hooks.py`): `{"from_route": "/os/<path:app_path>", "to_route":
>   "os"}` — mirrors the `/desk/<path:app_path>` rule. Without it the webserver 404'd every `/os/<…>`
>   deep link / reload ("Page not found"), since the www page only answered exact `/os`. Now any
>   `/os/<…>` serves the single os page and vue-router resolves the sub-path client-side. The green
>   bar visits the deep link `/os/erpnext/erp-hello` DIRECTLY and passes. (hooks.py is cached —
>   `bench clear-cache` + a webserver reload; the dev `bench start` auto-reloads the .py change.)
> - **Honest gaps (no silent caps):** the runtime-loaded applet now runs in dev too (via the DEV
>   import map), but it still requires the applet ARTIFACT to be built (`build:applet:erpnext`) — the
>   main `yarn dev` HMR loop covers the host, not the applet's own source (that's the stub-OS
>   harness's job). Server `applet` emission (A) is now **done — see the next note**; the doctype-view
>   applet (`DoctypeViewPayload.appletId`) and Scripts (ADR-0006) remain deferred. Shared-chunk
>   tree-shaking means an applet using a Vue API the host never references would not find it —
>   acceptable for the closed shared contract (ADR-0008); promotion stays a host-only event.

> **Server applet emission (A) as built** (`frappe/www/os.py` `_applet_contributions()` + `get_registry`;
> `erpnext/erpnext/hooks.py` `os_applets`; `frappe-os/src/store/registry.ts` `FIRST_PARTY` ⊕ server fold;
> `tests/registry.spec.js` "folds a server applet contribution" — all green: 24 registry specs):
> - **The hardcoded `APPLETS` map is retired.** Loader (B) called that map "the only thing that grows";
>   it no longer grows. An app **declares** the applets it ships via the `os_applets` hook; the server
>   projects them into the Registry and the client discovers them at boot — no OS edit per applet.
> - **The hook (per app):** `os_applets = [{ appletId, label, fileName, minOsApi? }]`. erpnext ships
>   `{appletId:'erp-hello', label:'ERPNext Hello', fileName:'hello.js'}` (`erpnext/hooks.py`). The
>   server reads it via `frappe.get_hooks("os_applets", app_name=app)` for each **installed OS app**
>   only (`_installed_os_apps()`), so an uninstalled app contributes nothing.
> - **Server projection** (`os.py` `_applet_contributions()`, `get_registry().extend(...)`): one
>   `type:'applet'` contribution per hook entry — `{appletId, appId:app, assetUrl, label, minOsApi}` —
>   with `assetUrl` **derived server-side** as `/assets/{app}/os-applets/{fileName}` (the app's public
>   assets path, the same URL the build preset emits to). `sourceApp=app`, `name=appletId`, `order` by
>   hook position. This is the same merge pattern as steps 4/5/5.2 — the low-risk slice the B-before-A
>   inversion promised.
> - **Client fold-in** (`registry.ts`): `erp-hello` was **removed from `FIRST_PARTY`** (only the
>   OS-bundled `my-todos` remains — a static `import()` the OS build code-splits, which genuinely can't
>   come from the server). `addToIndex`'s `APPLET` branch folds each server contribution into
>   `ix.applets`, seeded `FIRST_PARTY` ⊕ server. `knownApplet`/`listApplets`/`resolveApplet`/the
>   `assetUrl` load branch/persistence/URL (`/erpnext/erp-hello`)/palette all work unchanged — the
>   entry now simply *arrives from the hook* instead of being literal in the OS source.
> - **Proof:** `registry.spec.js` "folds a server applet contribution into the index (ADR-0009 server
>   emission)" indexes a registry carrying `applet('erp-hello','erpnext',…)` and asserts `listApplets`
>   /`knownApplet('erpnext','erp-hello')` see it while the first-party `my-todos` is kept.
> - **Still deferred (no silent caps):** the doctype-view applet (`DoctypeViewPayload.appletId` — an
>   app-contributed bespoke view for a doctype, now unblocked by A) and Scripts (ADR-0006); Number Card
>   → `dashboard-card`, Client Script → Script, Report/Kanban → `doctype-view` as before. `minOsApi`
>   is emitted but not yet gate-enforced client-side (additive, ADR-0008).

> **Default surface + framed applets as built** (ADR-0020/0021, issues `.scratch/default-surface/
> 01–07`; `frappe/www/os.py`, `raven`/`crm`/`erpnext`/`frappe` `hooks.py`, `frappe-os/vite.config.js`,
> `src/registry/{index,types}.ts`, `src/surface/index.ts`, `src/components/Window/{OSWindow,EmptyAppPane}.vue`,
> raven's `os-applets/raven` (now built to `chat.js`); `tests/surface.spec.js` + registry specs —
> all green: typecheck + 235 Vitest; `os.py` verified live on `f2.localhost`):
> - **Apps self-declare via the `os_app` hook** (ADR-0021). `os.py` `_os_app_decl(app)` reads it
>   (with a recursive `_unwrap_hook` — Frappe's `append_hook` list-wraps **nested** dict leaves, so
>   `default_surface` arrives as `{"applet":["chat"]}`); `_installed_os_apps()` = installed apps that
>   ship `os_app` (the hardcoded `OS_APPS` list and the `add_to_apps_screen` branding scrape are
>   **gone**). frappe/crm/erpnext/raven each declare `os_app` (identity), so the apps screen is
>   unchanged; an app without `os_app` is not an OS app.
> - **Two separate layered contributions from one hook.** `_app_contribution` projects identity
>   (`app`); `_default_surface_contribution` projects `os_app.default_surface` (`default-surface`,
>   shape-validated by `_valid_surface_ref`, internal Surface descriptors never leaked). They layer
>   **independently** (App<Site<User) via the existing display-config patch-merge — a per-user default
>   is a User-layer `default-surface` override touching only the landing, never the logo. The client
>   `default-surface` Singleton is `useRegistry().defaultSurface(appId)`.
> - **The resolver replaces the hardcoded landing priority** (`src/surface/index.ts`
>   `initialSurface(appId)`, first-match-wins): rung 1 `resolveRef` (declared ref → Surface) → rung 2
>   the app's dashboard (how frappe/crm/erpnext still land on their dashboard — now *via* the
>   resolver) → rung 3 first doctype list (**DORMANT** no-op, comment-only, slots in additively once
>   the nav-source decision lands) → rung 4 `emptyAppSurface` → `EmptyAppPane.vue` ("no default
>   screen configured for *App*"), so every declared OS app stays openable.
> - **`resolveRef(openedApp, ref)` handles own- and cross-app refs.** `refApp = ref.app || openedApp`;
>   it builds the Surface against `refApp` (applet/dashboard) or the doctype's owning app (`{doctype,
>   view:'list'}`). **Cross-app refs are permission-gated** via `appVisible(app) = !!registry.app(app)`
>   — the Registry is already server-permission-filtered (ADR-0010), so *presence is the client
>   permission signal*; a ref the viewer can't see returns `null` → falls through to rung 2/4 (a
>   redirect never grants access). Own-app refs stay ungated (slice-05 behaviour preserved).
> - **Window identity ≠ surface ownership** needed no new plumbing — the split already existed: the
>   window `id` is minted from the *opened* app (`app:<openedApp>`, dock/icon/`?instance`, ADR-0016),
>   while chrome/nav already read the *surface's* `appId` (`OSWindow.vue` title/logo, `sidebarKind`).
>   A cross-app default just returns a surface owned by another app and the scoping falls out.
> - **An applet's nav rail is its explicit `nav` capability** (ADR-0026, refining ADR-0020). The
>   `nav` flag rides the `os_applets` hook → `AppletPayload.nav` → `appletWantsNav(appletId)`;
>   `sidebarKind(surface)` returns `'nav'` only when the applet opts in, else `'none'` (full-window),
>   and the per-window hide-sidebar toggle is a graceful no-op when there is no rail. `kind` no longer
>   decides the rail (a native applet may want none, a framed one may want one). **One gap fixed
>   mid-implementation:** the server wasn't forwarding `kind` (slice 02 added it client-side only), so `os.py`'s applet projection now
>   passes `spec.get("kind","native")`.
> - **Raven is the worked example.** `raven/hooks.py` declares `default_surface:{"applet":"chat"}`
>   + the `chat` applet `kind:"framed"`; opening Raven lands directly on `chat` (rung 1), full-window.
>   The dev proxy is now a generic catch-all (`vite.config.js`: owns `/os/*` + Vite internals, forwards
>   the rest to the bench), retiring the bespoke `^/raven` rule — no framed app named in build config.
> - **Build gotcha (no silent caps):** the `chat` applet asset is a build output. It 404'd in the
>   first live test because `public/os-applets/` was empty after the raven→chat rename; built via the
>   official preset (`os-applets/raven` → `yarn build`) → `chat.js`. **Now chained into the host
>   build:** frappe-os's `build` runs `scripts/build-applets.js`, which discovers and builds every
>   installed app's applet, so `bench build` (incl. Frappe Cloud) ships the assets — apps carry
>   applet source only. In dev, rebuild one applet directly when its source/name changes.
> - **Deliberately deferred (need separate grilling):** rung 3 (first doctype list) pending the
>   exposed-doctype / nav source; the dashboard concept (rung 2) is provisional; the write-path UI for
>   editing Site/User `default-surface` overrides (the *resolver* honours them already).

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
| Applet loader (B) ✅ | new `src/brokers/{vue,frappe-ui,api}.ts`, `preset/applet.js`; `vite.config.js` (`osImportMap()` mode-aware import map + `preserveEntrySignatures:'strict'` + broker entries), `store/registry.ts` (`assetUrl` branch + `loadApplet` + `erp-hello`), `App.vue` + `types/frappe-ui.d.ts` (`ToastProvider`), `frappe/hooks.py` (`/os/<path>` route), `package.json` (applet scripts); new `apps/erpnext/erpnext/os-applets/hello/*` (SFC + preset config + stub-OS harness); `registry.spec.js` +3, new `cypress/e2e/applet-loader.cy.js` | done — separately-built erpnext applet loaded at runtime as native ESM, sharing the host's single Vue/frappe-ui/OS-API via import map + brokers (Strategy 2). Official Build preset shipped; `import(assetUrl)` branch; **5-check Cypress green bar PASSED via a DIRECT deep-link visit on the bench-served build (:8016)**. **also PASSES in the `yarn dev` server** via the mode-aware import map. Mounted `ToastProvider` (ui.notify was a no-op); added the `/os/<path>` SPA route (deep links 404'd). Server `applet` emission (A) now done (next row); doctype-view applet, Scripts still deferred |
| Server applet emission (A) ✅ | `frappe/www/os.py` (`_applet_contributions`/`get_registry`), `erpnext/erpnext/hooks.py` (`os_applets`), `frappe-os/src/store/registry.ts` (`FIRST_PARTY` ⊕ server fold; `erp-hello` removed from the bundled map); `registry.spec.js` | done — apps declare applets via the `os_applets` hook `{appletId,label,fileName,minOsApi?}`; the server projects one `type:'applet'` contribution each with `assetUrl=/assets/{app}/os-applets/{fileName}` (installed OS apps only); the client folds them into `ix.applets` at boot. The hardcoded `APPLETS` map is retired — `erp-hello` arrives from erpnext's hook. doctype-view applet (`DoctypeViewPayload.appletId`, now unblocked) + Scripts (ADR-0006) still deferred |
| Default surface + framed applets ✅ | `frappe/www/os.py` (`_os_app_decl`/`_unwrap_hook`/`_installed_os_apps`/`_app_contribution`/`_default_surface_contribution`/`_valid_surface_ref`; applet `kind`); `raven`/`crm`/`erpnext`/`frappe` `hooks.py` (`os_app`); `vite.config.js` (generic catch-all proxy); `src/registry/{index,types}.ts` (`defaultSurface`/`appletKind`/`SurfaceRef`/`default-surface` Singleton); `src/surface/index.ts` (`initialSurface` resolver + `resolveRef` + `appVisible`); `OSWindow.vue`, new `EmptyAppPane.vue`; raven `os-applets/raven` built → `chat.js`; `tests/surface.spec.js` + registry specs | done (ADR-0020/0021) — apps self-declare via `os_app` (opt-in + identity, retiring `OS_APPS`/`add_to_apps_screen`); one hook → separate layered `app` + `default-surface` contributions; resolver declared→dashboard→[DORMANT list]→empty-app pane, cross-app refs permission-gated (presence-in-registry) with window-identity≠surface-ownership; framed applets full-window (`sidebarKind 'none'`); raven lands on framed `chat`. Rung 3 / nav-source / dashboard-replacement / override-editing UI deferred |
```
