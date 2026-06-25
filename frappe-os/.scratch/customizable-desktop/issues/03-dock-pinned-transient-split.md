# Dock: pinned Placements + transient running apps (retire APP_ORDER)

Status: 📋 Ready (2026-06-25)

Triage: ready-for-agent (AFK)

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

- [ ] The dock renders its pinned items from resolved `dock` placements, not `APP_ORDER`.
- [ ] Running apps that are not pinned render as transient items after a separator and disappear
      when their window closes.
- [ ] Reordering a pinned item writes a dock-order `OS Placement Override`; the order roams across
      devices.
- [ ] A fresh user's dock reproduces today's app set via the App-default baseline.
- [ ] A user's reorder writes only their own override row; baseline / Site rows are untouched.
- [ ] Tests cover the pinned/transient partition, reorder → override, and baseline parity.

## Blocked by

- #01 (Placement seam: DocTypes + resolver + read-only desktop)
