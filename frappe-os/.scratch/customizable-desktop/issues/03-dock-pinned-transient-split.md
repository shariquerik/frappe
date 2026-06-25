# Dock: pinned Placements + transient running apps (retire APP_ORDER)

Status: ✅ DONE (2026-06-25)

Triage: ready-for-agent (AFK)

Implementation note: `src/desktop/dock-model.ts` is the DOM-free partition/reorder model.
**Pinned** = `usePlacements().dock()` sorted by `position.order` (`orderedDockPins`), each projected
via `placementView` with its running windows matched by the pin's resolved app. **Transient** =
`transientAppIds(dock, openAppIds)` — open apps (first-opened order, de-duped) minus any app already
covered by a **bare-app** dock pin (a doctype/applet pin does NOT suppress its app's transient
item); rendered after a separator, gone when the last window closes. **Reorder** = native HTML drag
on a pinned item → `reorderDeltas` recomputes each changed pin's `order` (the dragged pin takes the
drop target's slot) and persists one User-layer `order` override per changed pin via
`writePlacementOverride({region:'dock', …})` — current user's own rows only. `Dock.vue` retired the
hardcoded `APP_ORDER`. Server: added `dock` baseline rows to `APP_DEFAULT_PLACEMENTS` in
`frappe/www/os.py` (frappe/crm/erpnext, orders 0–2 — bare-app refs reproducing today's `APP_ORDER`)
so a fresh user's pinned dock matches today's; the resolver drops any app the viewer can't see.
Review fixes: `openAppIds` is filtered to KNOWN apps so a window with no/unknown appId yields no
blank transient tile; dropped a dead `placementKey` import. Tests: `dock-model.spec.js` (pinned
order, transient partition incl. bare-app vs doctype-pin suppression, reorder→deltas, baseline
parity through the seam). Gates green: typecheck / 274 unit / build / Cypress 20.

## What to build

Bring the **dock** into the Placement model. Today `src/components/Dock/Dock.vue` renders every app
from a hardcoded `APP_ORDER`. Replace that with a resolved, customisable dock that distinguishes
**pinned** placements from **transient** running apps.

The dock becomes, in order:

- **Pinned dock placements** — the resolved Placement list for `region = dock`, whose position is a
  1-D **order** (the dock's region-appropriate position shape; the desktop's is a 2-D cell).
  Resolved through the same App < Site < User path as the desktop (#01); only the region differs.
- **a separator**
- **Transient running-but-unpinned apps** — currently-open apps that aren't pinned, shown so a user
  can still reach them; they disappear when closed.
- **the launcher button** (repurposed to open the Finder in #05; unchanged here).

Reordering a pinned item writes a dock-**order** `OS Placement Override`, reusing the User-layer
write seam from #02. A fresh user's dock still matches today's via the App-default baseline (#01).

## Acceptance criteria

- [x] The dock renders its pinned items from resolved `dock` placements, not `APP_ORDER`.
- [x] Running apps that are not pinned render as transient items after a separator and disappear
      when their window closes.
- [x] Reordering a pinned item writes a dock-order `OS Placement Override`; the order roams across
      devices.
- [x] A fresh user's dock reproduces today's app set via the App-default baseline.
- [x] A user's reorder writes only their own override row; baseline / Site rows are untouched.
- [x] Tests cover the pinned/transient partition, reorder → override, and baseline parity.

## Blocked by

- #01 (Placement seam: DocTypes + resolver + read-only desktop)
