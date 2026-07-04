# Workspace is a surface coordinate, not an identity

> **Status:** SUPERSEDED by ADR-0042 (2026-07-04). The surface-coordinate model below was
> reversed under grilling: a workspace gets its own window, not a coordinate inside one. Slice 07
> (commit `bf3120f`) shipped the coordinate — the surface/Context `workspace`, `navFocus`
> carry-over, and URL segment — which ADR-0042 reworks into window identity. The rest of this ADR
> is kept for the record; **read ADR-0042 for the live decision.** Extends ADR-0012 (surfaces) and
> ADR-0032 (Context).

erpnext is one app to the user but twenty workspaces inside — and its verb/report/navigation
vocabulary is per-workspace (Selling's Create menu is not Stock's). The shell needs the
intra-app axis without splitting app identity.

## The coordinate

- **App stays the package** (erpnext, raven, crm): identity, dock, window ids, App menu,
  settings, attribution. Nothing keyed by app id moves.
- **`BuiltinSurface` gains `workspace?`** — part of the address: serializable, in the URL
  (`/erpnext/selling/...`), swapped by in-window navigation like every other coordinate
  (ADR-0012 untouched).
- **`Context` gains `workspace?`** at the surface tier, published like `doctype`/`view` and
  eligible for the same equality `when`. App-declared menus (ADR-0039) gate their content with
  `when: { workspace: 'selling' }` — same menu skeleton, workspace-flavored items.

**Workspace is a scope you are in, not a place you visit.** It never becomes a `view` kind:
`{ view: 'dashboard', workspace: 'selling' }` *is* Selling's Overview; the old desk workspace
page splits into the Overview surface (content) and the sidebar tree (navigation).

## Carry-over: one rule, one place

The openers rebuild surfaces from scratch (`listSurface` derives `appId` from the doctype and
discards the current surface), so `workspace` would not survive a sidebar click by itself.
Rather than threading it through every caller — where one forgotten call site silently
de-flavors the menus — **`navFocus` carries `workspace` forward when the new surface's app
matches the current one**, unless explicitly overridden (the switcher overrides; `goHome`
already reads the current window this way). Crossing apps, or arriving from global entry
points (spotlight, Finder, cross-app links), drops it: workspace-gated items simply don't
render, and the OS never guesses which workspace a doctype "belongs" to (it can sit in
several).

## Sidebar and Overview follow the coordinate

- The in-window sidebar (`Window/AppSidebar.vue`) sources its tree from ingested **Workspace
  Sidebar** data (erpnext already ships `workspace_sidebar/*.json` per workspace — sections,
  links, icons, link types), selected by the surface's `workspace`. The curated
  `AppDef.modules` becomes the fallback for apps that ship no workspace data — crm and raven
  change nothing.
- The workspace switcher lives with the sidebar and is the one UI that sets the coordinate
  explicitly.
- Single-space apps never set `workspace`; absent means "the app's one implicit space" — the
  same backward-compatible-absence pattern as ScopeBinding (ADR-0032).
- Pinning a workspace is a placement targeting a surface (`{ app: 'erpnext', workspace:
  'selling' }`), a small extension of ADR-0023's placements, not a new identity.

## Considered and rejected

- **Modules as first-class OS apps** (per-module `type:"app"` contributions). Uniform for the
  shell, dishonest about the domain: identity, updates, and the user's mental model are
  package-level. Rejected in ADR-0039's grill.
- **A new first-class layer between app and surface** (windows/dock/settings aware of it). The
  coordinate does the same work — menus, sidebar, Overview — with zero new identity plumbing.
- **Deriving workspace from the doctype** on cold entry. Ambiguous (many-to-many) and magic;
  honest absence beats a wrong guess.
- **Explicit threading through every opener call site.** Forgetting is silent; one rule in
  `navFocus` encodes the semantics where navigation already lives.

## Relationship to prior ADRs

- **Extends ADR-0012.** One more serializable surface coordinate; chrome stays agnostic.
- **Extends ADR-0032.** One more surface-tier Context key; Scope machinery untouched.
- **Composes with ADR-0039.** App menus gate on it — the answer to "who owns Selling's menus"
  is "erpnext, scoped by workspace".
- **Retires a hardcode.** `AppDef.modules`/`cards` as primary nav/Overview source (the curated
  `config/apps.ts` shortcut) degrades to fallback once Workspace Sidebar ingestion lands
  (ADR-0030 manifest channel; delivery per ADR-0028's boot/live-meta split).
