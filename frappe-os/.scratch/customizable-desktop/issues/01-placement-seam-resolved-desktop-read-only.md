# Placement seam: OS Placement DocTypes + server resolver + read-only resolved desktop

Status: ✅ DONE (2026-06-25)

Triage: ready-for-agent (AFK)

Implementation note: Two DocTypes in the `Desk` module — `OS Placement` (Site,
System-Manager-managed, optional `role` Link for scope) and `OS Placement Override` (User,
`Desk User` + `if_owner`, with a `hidden` tombstone Check). Both carry `region` (Select
desktop/dock), `surface_ref` (JSON), `position` (JSON). The resolver is a **pure**
`merge_placements(baseline, site, overrides, can_see)` in `frappe/www/os.py` (App-baseline ∪
role-scoped Site, dedup by `(region, ref)` identity, ⊕ User move/hide/new-pin, then
`_ref_visible` gate), emitted as a new top-level **`placements`** boot key — flat and resolved,
NOT a registry Contribution[] (the client never re-merges). The ADR-0021 `SurfaceRef` gained a
**bare-app** shape `{app}` ("open the app's default surface"), which the App-default baseline uses
for its two seed desktop pins (frappe, erpnext). Client: a new `src/placements/` module
(`initPlacements`/`usePlacements`/`placementView`) mirroring `initRegistry`; `App.vue` renders the
desktop from `usePlacements().desktop()` (the hardcoded `desktopIcons` array is gone); `@/surface`
gained `placementSurface(ref)` + `isAppRef(ref)`. Tests: pure Python `test_os_placement.py` (8,
the merge) + vitest `placements.spec.js` (seam + projection + ref→surface). Gates: typecheck /
test (245) / build / Cypress (20) green; live boot + Site/User DB read-paths verified on
`f2.localhost`. The placeholder "Frappe Cloud"/"Reports" labels (unrelated to the apps they opened)
are retired in favour of real app branding derived from the reference.

## What to build

The foundational vertical slice of **Placements** (design: ADR-0023). It cuts
DocTypes → server resolver → boot payload → rendered desktop, end-to-end and **read-only**:
the desktop icons stop being hardcoded and instead come from a per-role, server-resolved
placement list. No drag, no grid math, no write path yet — those land in #02. The point of this
slice is to prove the layered seam everything else builds on.

Introduce the **Placement** concept — a user-arrangeable pin of a **surface reference** into a
**Region** (here, `desktop`). Its **identity is `(region, surface-reference)`**, which is what
dedups across layers and what a later override targets.

Two DocTypes (one per layer; per-layer DocTypes enforce the permission shape structurally — see
ADR-0023 "rejected: single DocType with a `layer` field"):

- **`OS Placement`** — the **Site** layer, **admin-managed**, each row **scoped to role(s)**.
- **`OS Placement Override`** — the **User** layer, **owner-scoped**, one row per delta (move /
  hide / new pin). Only its read path is exercised in this slice.

Resolution is **server-side at boot**, in `frappe/www/os.py`'s projection, folding the three
layers into one list in precedence order **App < Site < User**:

1. **App-default baseline** — OS-shipped in code/config, reproducing today's desktop set for a
   fresh user (the desktop analog of `APP_ORDER`).
2. **Site layer** — `OS Placement` rows; a user receives the **union** of every role-scoped
   placement they qualify for, de-duped by identity. Role is a *scope on the Site layer*, applied
   by the same per-user visibility filter the Registry already uses (ADR-0010) — **not** a fourth
   precedence rung.
3. **User layer** — `OS Placement Override` rows (read-only here).

The frontend receives the **already-merged** placement list in the boot/Registry payload and
**never sees the layers**. It renders the desktop from that list, replacing the hardcoded
`desktopIcons` array in `src/App.vue`. Positions may be naive/auto for this slice.

The surface reference is the existing ADR-0021 vocabulary (app / applet / dashboard / doctype+view)
reused verbatim; a pin to a surface the viewer may not see is dropped from their resolved list.

## Acceptance criteria

- [x] `OS Placement` (Site, role-scoped) and `OS Placement Override` (User, owner-scoped) DocTypes
      exist; placement identity is `(region, surface-reference)` over the ADR-0021 surface-reference
      vocabulary.
- [x] An OS-shipped App-default baseline reproduces today's desktop icons for a fresh user.
- [x] `os.py` resolves App-baseline ∪ role-scoped Site (union, de-duped by identity) ⊕ User
      overrides into a single permission-gated placement list in the boot payload.
- [x] The frontend receives only the resolved result (never the layers) and renders the desktop
      from it; the hardcoded `desktopIcons` array is removed.
- [x] A surface reference the viewer may not see is dropped from their resolved list.
- [x] Tests cover the resolver merge (baseline ∪ role-Site ⊕ override, dedup by identity,
      permission filter) and that the desktop renders from resolved data.

## Blocked by

None - can start immediately.

(The drag → User-override **write** path is intentionally deferred to #02, where drag exercises it.)
