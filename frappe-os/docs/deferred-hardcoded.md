# Frappe OS — deferred & hardcoded inventory

A living list of things currently **hardcoded, stubbed, faked, or placeholder-ed** in the
Frappe OS frontend (`src/`) that were done quickly to keep moving and are meant to be wired
up properly later. Grouped by how much they matter, with `file:line` references.

> Captured 2026-06-30 from a full sweep of `src/`. Update this as items land — delete a
> bullet when it's done, don't just check it off.

---

## 1. Demo / fake data still wired in (should come from boot/session)

The clearest "fix it later" stubs — literal demo content.

- **`components/MenuBar/MenuBar.vue:21`** — `userName = "Faris Ansari"` hardcoded instead of
  `os.state.userName`.
- **`components/Window/AppDashboard.vue:23`** — greeting falls back to `"Faris"`.
- **`components/Window/AppDashboard.vue:69–82`** — the entire **"Your team" panel** is
  hardcoded demo people (Faris Ansari, Aditya N, Riya Sharma, Hussain R) with hardcoded roles
  and status-dot colors. Flagged in-code: _architecture-review §3 item 4 — "should come from
  boot/session."_
- **`desktop/windows.ts:17–21`** — `presenceFor()` is a **stub**: the real backend has no
  viewer source, so a form always shows "You", lists/dashboards show nothing. Marked _Phase 4
  may add real presence._

## 2. "Coming soon" placeholder features (no data fetched yet)

- **`surface/aspects.ts:17–21`** — form **Aspects** (Details / Activities / Email) are a
  hardcoded built-in array. Only **Details** is real; **Activities and Email fetch no data**.
- **`components/Window/AspectPane.vue:15`** — renders literal **"Coming soon"** for those
  unwired Aspects.
- **`surface/index.ts:99–101`** — resolver **rung 3 (first-doctype-list surface) is
  intentionally DORMANT**, pending the app exposed-doctype / nav-source decision (ADR-0021
  open question). Rung 4 (`emptyAppSurface`) is the explicit placeholder fallback.

## 3. Curated config that should come from server metadata (biggest area — all "Phase 4")

- **`config/apps.ts`** — the whole `APP` object is hand-curated: app list + ordering
  (`APP_ORDER = ['frappe','crm','erpnext']`, line 79), module→doctype maps, and **dashboard
  cards with guessed filters/fieldnames** (e.g. `CRM Lead status: Open`, `CRM Deal
  annual_revenue`, Sales Invoice receivables). Comment marks these _"curated guesses to
  reconcile against live meta in Phase 4."_
- **`config/doctypes.ts`** — per-doctype list columns, widths, title fields, and
  `GENERIC_STATUS_THEMES` (Active→green, etc.) all hardcoded; comment: _"verify keys against
  live field names when wiring live lists (Phase 4)."_ Some columns (`enabled_label`,
  `status_label`, `stock_qty`) are **display-only with no backend field**, which forces the
  `fields: ['*']` workaround in `data/records.ts:28–37`.
- **`config/icons.ts:40–65`** — `DOCTYPE_ICON`, a hardcoded 26-doctype→icon map that should
  derive from doctype metadata.
- **`data/os-api.ts:75–83`** — `CAPABILITIES` flags hardcoded; component-surface **rendering
  and scripting advertise `false` "for now."**

## 4. Hardcoded UI that should be dynamic / registry-driven

- **`components/MenuBar/MenuBar.vue:87`** — only the **File menu** is resolved from the Actions
  registry; **Edit/View/Window/Help stay hardcoded** (comment: _"pending later incremental
  migration, ADR-0001"_), and several items are **no-op handlers** — _About this workspace_,
  _Lock screen_, _Log out…_ (lines 52–67) and Edit's Undo/Redo/Cut/Copy/Paste do nothing.
- **`registry/index.ts:301–304`** — `FIRST_PARTY` applets are a hardcoded list of exactly two
  (`my-todos`, `customizations`); a new first-party applet needs a source edit.
- **`components/Finder/locations.ts:21`** — `LOCATIONS = ['Applications','Doctypes','Recents','Favorites']`
  fixed.

## 5. Magic numbers / fixed limits (configurability deferred)

- **Pagination** — `data/api.ts:71` default `limit = 50` vs `data/records.ts:37` override
  `limit: 100`; inconsistent and not configurable.
- **Palette** — `desktop/palette.ts:39–40`: 8 default / 30 max results.
- **Recents** — `recents/index.ts:20,24`: `RECENTS_CAP = 50`, `DEBOUNCE_MS = 800`.
- **Geometry** — `desktop/geometry.ts`: `MIN_W=420, MIN_H=300, TOP_BOUND=34`, fallback
  viewport `1280×800`, and hardcoded default window cascades/sizes for app/settings/system/
  finder windows.
- **Dock** — `desktop/dock-visibility.ts:22–23`: `HIDE_BAND=90`, `REVEAL_EDGE=1`.
- **Grid** — `desktop/grid.ts:11–14,52`: `CELL_W=90, CELL_H=92, INSET_RIGHT=18, INSET_TOP=46`,
  200-column search bound.
- **Persistence** — `desktop/persistence.ts`: `BLOB_KEY='frappe-os:desktop'`, 250 ms autosave
  debounce.

## 6. Hardcoded styling tokens & un-localized strings (minor)

- **`components/Window/OSWindow.vue:81–84`** — window shadows use raw `rgba(...)` literals
  instead of design tokens.
- **`components/Settings/WallpaperPicker.vue:12`** — selected border `#0d8ef8` instead of
  `var(--surface-blue-5)`.
- **i18n gaps** — `desktop/state.ts:30` English day-name array; hardcoded English strings in
  the CommandPalette placeholder, Finder / MyTodos empty-state messages, and default tab /
  section / location names (`surface/index.ts:25,35,41`).

---

### Where the deliberate debt clusters

1. **"Faris" demo data** — MenuBar / AppDashboard + the presence stub.
2. **Activities/Email Aspects + the dormant doctype-list rung** — "Coming soon".
3. **The entire `config/` layer** — curated client-side guesses pending the **Phase 4
   live-metadata** wiring.
4. **Menus / applets / limits** — not yet made dynamic.

Categories 1–3 are the ones with explicit code comments promising follow-up.
