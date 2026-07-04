# Workspace is a window, not a surface coordinate

> **Status:** Accepted (2026-07-04, grilled; data model grilled and settled 2026-07-05 — see
> "Data model" below). **Supersedes ADR-0040.** Not yet implemented.
> Reworks slice 07 (the coordinate becomes window identity) and reshapes slices 08/11.
> Reserves `Space` for a future OS-level feature. Extends ADR-0012 (surfaces) and ADR-0032
> (Context); composes with ADR-0039 (app menus).

ADR-0040 made a workspace a **coordinate inside one window** — Selling and Stock were two
addresses of the same erpnext window, swapped by an in-window switcher. Grilling that against the
real shape of erpnext broke it: a workspace is not a flavor of one window, it is **a place you
open**. erpnext is a suite; Selling and Stock are workbenches you want open **side by side**, each
its own window. So a workspace gets its own window, and the coordinate becomes window identity.

## Two window types

- **App window — the hub.** Opening erpnext opens a hub whose **sidebar lists its workspaces**
  (Selling, Stock, Accounts…). This is the "which workbench" level. Its **main section shows the
  app's default workspace overview** (recents, key actions, shortcut cards) so the hub is never
  empty.
- **Workspace window — the workbench.** Clicking a workspace opens **a new window** whose sidebar
  is *that workspace's doctypes*. Two workbenches (Selling, Stock) can be open at once, each its
  own window.

**Single-workspace apps skip the hub.** An app that resolves to a single workspace has nothing to
choose — opening it opens the workbench directly. The hub only earns its place when an app has
more than one workspace. This is the same backward-compatible-absence pattern as before: one
implicit workspace means "the app is the window." (Whether a given app is single-workspace is a
fact of its real modules, not an assumption: seeding is honest to `DocType.module`, so e.g. crm
resolves to *two* — its main `FCRM` pipeline plus the secondary `Lead Syncing` module — and so
earns a hub. An app is single-workspace only when it genuinely ships one module with doctypes.)

## Identity: app owns the dock, workspace owns the window

- **The app stays the package** — dock icon, identity, settings, attribution, updates are all
  app-level. Workspaces get **no dock icon and no settings of their own.** This is *not* "modules
  as first-class OS apps" (rejected in ADR-0039/0040) — identity does not move.
- **The window belongs to `(app, workspace)`.** Window ids, the App menu, and persistence key on
  it. This is the middle tier ADR-0040 refused — reintroduced **only at the window tier**, because
  the "two workbenches side by side" behavior genuinely needs two window identities and a
  coordinate on one surface cannot express it.
- **App menus (ADR-0039) gate on the window's workspace**, not a surface coordinate. `when:
  { workspace: 'selling' }` still works; it reads the window's workspace from Context.

## Workspaces are data, seeded from modules, not ingested from desk

A workspace is a **real OS-native record the user can create, rename, and re-order** — not a
read-off of `DocType.module` and not desk's `Workspace Sidebar`. For a multi-module app the
starting set is **seeded one workspace per module** (from `DocType.module`, the data Frappe
already has); the user adds more on top. A workspace's doctype sidebar is likewise **derived** —
the app's doctypes for that module, child tables (`istable`) and settings singles excluded — with
OS-side additions layered when wanted.

We do **not** ingest desk's `Workspace Sidebar` trees. Copying 60-item hand-curated trees per
workspace is unreasonable and drifts the day it is written, and it couples the OS to a desk
doctype the two systems will let diverge during coexistence. Seeding from `module` gives an honest
zero-authoring base; curation, if ever wanted, is an OS-side layer, never a desk copy.

## Data model (grilled 2026-07-05)

The grill the original acceptance deferred. Five decisions, each following the os_core house
style where one exists:

- **A real DocType: `OS Workspace`** (module OS Core, hash-named like its siblings) — not a
  JSON blob and not boot-derived. Rows carry `app`, `workspace_id`, `label`, `module` (source
  module, empty for user-added), `sequence`, `hidden`, `is_default`. Rename/re-order/user-add
  need rows anyway; a blob would reinvent identity, ordering, and CRUD.
- **Identity is an immutable slug.** `workspace_id` — unique per app, seeded from the module
  name (Selling → `selling`), slugified from the initial label for user-added rows, never
  changed afterward. It is the `workspace` in window identity, URLs, and
  `when: { workspace: 'selling' }` gates; rename touches only `label`, so open windows, saved
  URLs, and menu gates survive. Neither the hash row name (unwritable in `when`) nor the label
  (breaks on rename) can be the key.
- **Seeding: `after_migrate`, insert-if-missing.** Same hook as `seed_wallpapers`, keyed by
  `(app, module)`. The seeder only inserts missing keys — it never updates or deletes existing
  rows, so user renames and re-orders survive every migrate. A module added later gets its
  workspace on the next migrate automatically. Removing a seeded workspace sets `hidden`
  (the row stays, so the seeder cannot resurrect it); user-added rows have no module key and
  are never touched. Full-sync (upsert + prune) was rejected: it clobbers user edits, which is
  wrong for user-editable data.
- **Edits are layered, per the placements/indicators precedent.** Site layer: seeded +
  System-Manager-curated `OS Workspace` rows. User layer: a per-user, owner-scoped
  `OS Workspace Override` (rename/hide/re-order/add), folded by a pure merge. **Slice 08
  ships only the site base and the merge seam**; the override doctype and its edit UI are
  their own later slice.
- **Default: manifest declares, seeder stamps.** `os/app.json` gains
  `default_workspace: "<module>"`; the seeder stamps `is_default` on the matching row
  (unknown module → skip + warn). Fallback when unset: lowest sequence. Stamping into data
  (rather than resolving from the manifest at boot) lets a site re-point the default without
  forking the app's manifest.

## Naming: `Workspace` here, `Space` reserved

- **`Workspace`** is the app-level axis (Selling, Stock). User-creatable, first-class, seeded from
  a module but **not** a code module — so `module` would be the wrong name (it collides with
  `Module Def` and bakes in a 1:1 that user-added workspaces break). This is the same concept desk
  calls a Workspace; sharing the noun is honest (like both systems having Users).
- **`Space`** is reserved for a **future OS-level feature — virtual desktops** (macOS "Spaces"): a
  whole desktop of windows you switch between. Naming it now keeps `workspace` free for the app
  tier and gives the OS feature its correct macOS name when it lands. Nothing implements `Space`
  yet.

## Considered and rejected

- **Workspace as a surface coordinate (ADR-0040).** One window, an in-window switcher, `workspace`
  on the surface address. Cannot express two workbenches open at once, and the switcher hides that
  erpnext is a suite. Superseded.
- **Ingest desk's `Workspace Sidebar`.** Reuses curation but copies 60-item trees that drift and
  couples the OS to a desk doctype during the exact window the two coexist. Rejected for the
  seeded-from-module base.
- **Re-author the trees in `os/`.** Consistent with ADR-0030 but unreasonable at sidebar scale
  (per-workspace item trees are large and drift immediately). Rejected; `os/` stays for the thin
  override layer only.
- **`module` as the name.** Accurate only while workspaces stay 1:1 with code modules; user-added
  workspaces and cross-module groupings break it, and it collides with `Module Def`.
- **`workspace` for the OS-level virtual-desktop feature.** That is what macOS calls a *Space*;
  taking `workspace` for it would force a worse name on the app tier that desk already calls
  Workspace.
- **No hub — open a default workspace straight for every app.** Loses the "which workbench"
  overview and the place to add/re-order workspaces. Kept for multi-workspace apps; single-
  workspace apps skip it.

## Relationship to prior ADRs

- **Supersedes ADR-0040.** The workspace *concept* (an app's intra-app axis that flavors sidebar,
  overview, and menus) carries; its *placement* flips from surface coordinate to window identity.
- **Extends ADR-0012.** The window, not just the surface, now carries a coordinate — its
  `(app, workspace)` identity. Surface chrome stays agnostic.
- **Extends ADR-0032.** The window's workspace publishes into Context for `when` eligibility, the
  same key ADR-0040 named, now sourced from window identity.
- **Composes with ADR-0039.** App menus gate on the window's workspace.
- **Does not use ADR-0030's ingestion for trees.** The `os/` manifest stays for identity and a
  thin workspace-override layer; the base is seeded from `Module Def`, not authored.
</content>
</invoke>
