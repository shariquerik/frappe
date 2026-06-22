# Customizations view — list app-originated overrides and removals

Status: ✅ DONE (2026-06-22) — read-only catalog shipped. Implementation: pure projection
`src/actions/customizations.ts` (`customizationGroups` over `useRegistry().actions()`, no
`resolve()`/Context; `describeWhen`; `isUnexpectedRemoval` reusing removals.ts's predicate) →
first-party applet `src/applets/Customizations/` at `/os/frappe/customizations` (registered in
`registry/index.ts` `FIRST_PARTY`), rendering per-app groups with `useRegistry().appKind` and the
feature-app removal marker. Restore/revert deferred (rows already carry sourceApp/region/command/
layer/removed — additive). Tests: `tests/customizations.spec.js`, `cypress/e2e/customizations-view.cy.js`
(green against the bench-served build). Design: ADR-0015; vocabulary: `CONTEXT.md` → "Customizations view".

## What to build

ADR-0014 **item 3**: one "Customizations" view — the OS analogue of Frappe's Property
Setter / Customize Form listing — that surfaces, rather than buries, the overrides and
removals apps impose on this site. **Read-only this slice.** Design: ADR-0015; vocabulary:
`CONTEXT.md` (Command/Action/Region/`commandPatch`, the `'override'`/`'removal'` reasons,
"Customizations view").

## Settled design (the resolved forks)

1. **Read-only, structural catalog — NOT a live `resolve()` replay.** `resolve()` runs
   per-Region against the *current* Context and only `console.warn`s its `ShadowEvent`s;
   there is **no stored shadow ledger**, and contextual customizations (e.g. the erpnext
   "New window" re-title, scoped `when activeApp = 'erpnext'`) never surface under a
   non-matching Context. So the view does **not** call `resolve()`. It reads the full declared
   Action set (`useRegistry().actions()`) and **describes the customizations structurally**.

2. **What counts as a customizing contender.** Group Actions by competition identity
   `(region, command)`. Within each competition, a contender is a customization when it
   carries `removed`, carries a `commandPatch`, or is a non-`app`-layer same-identity Action.
   List **every** such contender — there is no single "winner" to filter to (the winner is
   Context-dependent).

3. **Each row shows:** `sourceApp`, `layer`, the **reason** (`removal` if `removed`, else
   `override`), the `region`/`command` it targets, and the **`when` scope it applies under**
   (render an empty/absent `when` as "always"; otherwise e.g. "when activeApp = erpnext").

4. **Grouping:** by overriding **app** (primary). Region and reason are secondary sort /
   columns, not the top level.

5. **Feature-app flag (ADR-0014 item 4) is surfaced here.** Each app group shows its kind from
   `useRegistry().appKind(appId)` (feature / pure-customization). A **feature app whose row is
   a removal** carries a visible "unexpected — review this" marker (the human-facing twin of
   the `removals.ts` console warning, same predicate). Pure-customization removals list
   quietly.

6. **Editable is deferred** to a named write-path slice (per-row Restore / Revert). Shape the
   projection so that affordance is *additive* (the rows already carry `sourceApp` / `region`
   / `command` / `layer` / `removed`). When it ships: restore = author a Site/User-layer
   counter-Action **at the layer the human operates at** (no admin-only gate — ADR-0015 §2),
   persisted via the **Projection seam** as an ordinary `Action` record (DocType TBD in that
   slice — ADR-0015 §3), folding through `addToIndex` and winning by the existing tiebreak. No
   new client merge path.

## Acceptance criteria

- [x] The UX/authority/grouping forks are resolved and recorded (ADR-0015; ADR-0014 amended;
      `CONTEXT.md` → "Customizations view").
- [x] A Customizations view, built as a **pure structural projection over
      `useRegistry().actions()`** (no `resolve()` call, no Context dependency), lists app
      customizations grouped by app; each row shows source app, region/command, reason
      (override/removal), and the `when` scope.
- [x] Each app group shows its kind (`useRegistry().appKind`); feature-app removal rows carry
      the "review this" marker; pure-customization removals are quiet.
- [x] Read-only — no restore/revert action in this slice; the projection's row shape leaves
      room for one to be added additively later.
- [x] Vitest covers the projection as a pure function over an `Action[]` fixture (a contextual
      override, an always-on removal, a feature-app removal, a pure-customization removal);
      a Cypress spec asserts the view lists a known erpnext override and a known removal.
- [x] `yarn typecheck && yarn test && yarn build` are green; Cypress passes against the
      bench-served build.

## Blocked by

- `03-app-removes-chrome-attributed-logged.md` (the removal `removed`-flag + reason
  vocabulary this view reads from the contribution set).
