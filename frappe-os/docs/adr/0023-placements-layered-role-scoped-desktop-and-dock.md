# Placements: a layered, role-scoped desktop and dock

> **Status:** Proposed (2026-06-25). Grilled but not yet implemented. Introduces the
> **Placement** concept (CONTEXT.md) and two DocTypes (`OS Placement`, `OS Placement Override`).

The desktop icons and dock are no longer hardcoded. A user can pin a destination to the
**desktop** or the **dock**, drag it where they want, and the arrangement they see is
**derived from their role(s)** and **personally customisable**. We model this as one concept —
a **Placement** — resolved across the existing **App < Site < User** layers, stored server-side
so it roams across devices.

A Placement is a user-arrangeable pin of a **surface reference** into a **Region**. The desktop
and dock are the only two placement regions; every other Region (menu bar, toolbar, context
menu, command palette) hosts **Actions**, which are conditional and app-authored — Placements
are unconditional and user-arranged, so they never enter the Action resolver.

## What a Placement carries

- **region** — `desktop` | `dock`. (Broadens Region to host Actions *and* Placements.)
- **surface reference** — the same app-qualified, permission-gated reference Default surface uses
  (ADR-0021): an app, an applet, a dashboard, or a doctype + view (list). Not app-only — "Add to
  Desktop / Add to Dock" is offered from *any* surface and pins whatever that window shows.
- **position** — region-appropriate: the desktop a resolution-independent **edge-anchored grid
  cell** `(column, row)`; the dock a 1-D **order**. Never raw pixels (see below).
- **identity** — `(region, surface-reference)`. This is what dedups a baseline pin against a Site
  pin to the same destination, and what a User override points at (cf. ADR-0007).

## The three layers and how they resolve

The effective desktop/dock for a user is, in precedence order:

1. **App-default baseline** — shipped in OS code/config (like `APP_ORDER` today), so a fresh
   user's dock matches today's. App-contributed pins are a possible additive future; OS-owned for
   v1.
2. **Site layer** — `OS Placement` rows, **admin-managed**, each **scoped to role(s)**. A user
   receives the **union** of every role-scoped placement they qualify for, de-duped by identity.
   Role is a *scope on the Site layer*, **not** a fourth precedence rung — the same server-side
   visibility filter the Registry already applies (ADR-0010).
3. **User layer** — `OS Placement Override` rows, **owner-scoped**, one row per **delta**: a move
   (position override), a hide (tombstone referencing a base identity), or a brand-new user pin.

Resolution happens **server-side at boot** (in `os.py`'s projection) and the frontend receives
the already-merged placement list in the boot/Registry payload — honouring "the frontend sees
only the resolved result, never the layers." The frontend's **only write path is its own
User-layer override rows** (drag an icon → upsert an `OS Placement Override`).

## Why these choices

- **"Removing" an inherited pin is a non-destructive personal hide — so there is no locking.** A
  user can never destroy an admin's (Site) or baseline placement; removing one only writes a User
  *hide* delta that suppresses it **for that user's own view**. The admin's row and every other
  user are untouched. Because the data is therefore always safe, the only thing a "locked" flag
  could add is *forcing a user to keep seeing a pin they want gone* — and that compliance need is
  not present. So v1 has **no `locked` concept at all**: every pin is hideable, and admin data is
  safe regardless. (If a hard "must stay visible" rule ever appears, locking is an additive
  follow-up — a Site flag whose only effect is to make the resolver drop a User hide that targets
  it.)
- **Override layer, not a frozen snapshot.** A user's customisation stores per-member *deltas*,
  so when an admin later adds a shortcut to a role's desktop it still flows through to customised
  users. A snapshot (the literal "copy" intuition, and old Frappe's `Desktop Icon`) detaches the
  user permanently — an admin's company-wide rollout silently misses everyone who has customised.
  This is the same reasoning that makes Patch beat replace (ADR-0007).
- **One Placement concept, not separate shortcut/dock-pin types.** They differ only by region and
  position shape; unifying gives one DocType pair, one resolution path, one verb family.
- **Grid cells, not pixels.** Placements now roam across devices (server-side) and role defaults
  are authored by an admin for *unknown* screens. A pixel layout from a 4K monitor breaks on a
  laptop and can't be authored sanely once; an edge-anchored grid cell reconstitutes on any
  screen. Drops snap to a cell; collisions flow to the next free cell deterministically.
- **Only configuration is server-side and role-layered — not session state.** Which windows are
  open, their geometry, z-order, split, theme and wallpaper stay device-local in the existing
  localStorage blob. Configuration (which pins exist, where) is identity-level and roams; session
  state is per-device. Theme/wallpaper are identity-ish but left device-local for this slice.

## Considered and rejected

- **Model placements as Actions in the dock/desktop Regions.** Tempting — the dock is already a
  Region and `navigate` Commands exist. Rejected: Actions are *conditional* (Eligibility,
  specificity contest) and 1-D ordered; placements are *unconditional* and the desktop needs 2-D
  position. The resolver would run a competition that never competes.
- **Plain localStorage desktop state** (the first proposal). Rejected the moment the requirement
  became multi-user, role-based, copy-on-write — localStorage can't roam, can't be role-scoped,
  can't be admin-authored.
- **A new `Role` precedence rung (App < Site < Role < User).** Rejected: role is a *targeting
  scope* on Site members, resolved by the existing per-user visibility filter — not a new layer.
- **Pick-one-by-role-priority** instead of union for multi-role users. Rejected: a Sales+Support
  user would be blind to one set, and it needs a role-priority order to define and maintain. The
  Collection model already merges; union falls out for free, and the override layer hides clutter.
- **Frozen-snapshot copy-on-write** (see Why). Rejected for detachment from admin updates.
- **Blob-per-scope / single DocType with a `layer` field.** Rejected: a blob re-creates snapshot
  behaviour on every edit; a single mixed DocType makes permissions painful (a user must create
  *only* self-scoped rows). Row-per-placement + per-layer DocTypes enforce both structurally.
- **Raw pixels clamped to the viewport.** Rejected — breaks cross-device roaming (see Why).

## Open questions (deferred)

- **Locking** ("a user must keep seeing a pin") is intentionally **not** built — see Why. It is an
  additive follow-up only if a real "must stay visible" requirement appears.
- **App-contributed default pins.** Whether an app can declare a default desktop/dock pin
  (making the App layer real contributions, not just OS config) is additive and out of scope.
- **The "Add to Desktop/Dock" verbs** are first-party Commands/Actions surfaced in the context
  menu / menu bar (and their inverse "Remove from…" on an icon's context menu). Their exact
  region placement reuses the ADR-0001 Action machinery and isn't re-decided here.

## Relationship to prior ADRs

- **Applies ADR-0005/0007/0010.** Layered merge, identity/Patch, and permission gating are reused
  wholesale; Placements add no new merge machinery, only a new Collection and its position shape.
- **Reuses ADR-0021's surface reference.** A pin stores the same stable, app-qualified,
  permission-gated reference as the default surface — a dock pin to another app's list is honoured
  only if the viewer may see it.
- **Broadens ADR-0004's Region.** A Region now hosts Actions *and* Placements; the set stays
  closed-but-data-driven and the dock/desktop were already named regions.
