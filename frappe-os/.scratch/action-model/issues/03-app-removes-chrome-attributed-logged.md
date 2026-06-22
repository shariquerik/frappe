# An app removes core chrome — attributed, logged, and reversible by layer

Status: ✅ DONE (2026-06-22) — shipped (ADR-0014 items 1 & 2). Implementation: erpnext
`os_actions` carries `removed: true` (`erpnext/hooks.py`), projected through `www/os.py`
`_action_contributions()` and folded by `registry/index.ts` unchanged; `resolve.ts` treats a
winning `removed` Action as a suppression (omitted from items) and logs `reason:'removal'`
attributed to the removing app; the App<Site<User order makes it reversible by a higher-layer
non-removal Action. Tests: `tests/actions.spec.js` (suppression + `'removal'` shadow + layer
reversal), `cypress/e2e/action-removal.cy.js` (green against the bench-served build). The
Customizations view (item 3) and feature-app flag (item 4) shipped as issues 04 / 05.

## What to build

The third vertical slice of the Action/extension model — the **removal** of a default,
implementing ADR-0014's deferred half (an app may *remove* chrome, not just override it).
It rides the exact rails the override tracer (issue 02) already shipped — app hook → server
projection → client fold → `when` evaluation → specificity tiebreak → attributed shadow log —
and adds one genuinely new directive: a removal that makes the winning Action a **suppression**
instead of a render. Design: `docs/design/action-model-next-steps.md`; authority + safety model:
ADR-0014; identity/merge invariant it leans on: ADR-0007; vocabulary: `CONTEXT.md`.

This slice covers ADR-0014's **v1 minimum — items 1 and 2** (both "nearly free"): removals are
*attributed and logged* ("never silent"), and *reversible by the human* via the layer order
(User > Site > App). The Customizations view (item 3) and the feature-app auto-flag (item 4)
are separate follow-ups (issues 04, 05).

erpnext is the actor for now (reusing its existing `os_actions` hook — no new fixture app; that
erpnext is technically a *feature* app, and so becomes the "loud" case once issue 05 lands, is
fine here where every removal is logged uniformly):

- **New directive shape.** A removal is an `os_actions` entry carrying `removed: true` instead of
  a `commandPatch` — same `{command, region, when}` identity as an override, mirroring issue 02's
  payload. It names no new presentation because the item does not render.
- **Server passes it through.** `www/os.py` projects the hook for installed OS apps only and the
  removal field flows through the existing `_action_contributions()` projection (extend the
  action payload keys to carry `removed`); `sourceApp='erpnext'`, identity per ADR-0007. No new
  validation path.
- **Client folds it unchanged.** The removal Action folds into the actions index alongside
  overrides (`registry/index.ts` `action` branch) — it is an ordinary Collection contribution.
- **Resolver suppresses + logs.** In `resolve.ts`, a removal Action still *competes* in the
  `(region, command)` contest and can *win* by specificity/layer; when the winner is `removed`,
  it is **not** added to the rendered items and a shadow is logged with a new `reason:'removal'`
  (alongside `'override'` / `'true-tie'`), attributed to the removing app — ADR-0014 item 1,
  "every removal is attributed to the app that did it and logged."
- **Reversible by layer (item 2).** Because the App < Site < User order already drives the
  tiebreak, a higher-layer Action that does *not* set `removed` beats an App-layer removal and the
  item re-renders — "an app never has the final word over a person." This slice proves the
  resolver guarantee with a test (a synthetic Site/User-layer Action shadowing the App removal);
  the human-facing *restore* surface is issue 04.
- **Render seam unchanged.** `menubar.ts` already renders only the items `resolve()` returns, so a
  suppressed item simply never reaches `appendItem` — no change to `MenuBar.vue`.

## Acceptance criteria

- [x] An erpnext `os_actions` entry declares a removal of a first-party File-menu Command via
      `removed: true`; no OS source edit is needed to add it.
- [x] `www/os.py` carries `removed` through the action projection for installed OS apps only,
      with `sourceApp='erpnext'`; verified via `bench execute`.
- [x] The client folds the removal Action into the actions index at boot (no new branch — the
      existing `action` fold handles it).
- [x] The resolver treats a winning `removed` Action as a suppression: the item is absent from
      the rendered region, and a shadow is logged with `reason:'removal'`, attributed to the
      removing app (distinguished from `'override'` and `'true-tie'`).
- [x] With an erpnext window focused, the removed File-menu item is absent; with a non-erpnext
      window focused, the OS default re-appears (the removal's `when` is not eligible there).
- [x] Reversibility holds: a Site/User-layer Action without `removed` beats the App-layer removal
      and the item re-renders, the audit log showing the restoration shadowing the removal.
- [x] Vitest covers the removal projection/fold and the resolver suppression + `'removal'` shadow
      + the layer-reversal case; a Cypress spec asserts the item vanishes for an erpnext window
      **and** that the removal shadow is logged.
- [x] `yarn typecheck && yarn test && yarn build` are green; Cypress passes against the
      bench-served build.

## Blocked by

- `02-erpnext-overrides-new-window.md` (the hook → projection → fold → resolver → menubar rails
  and the attributed shadow log this slice extends with `removed`).
