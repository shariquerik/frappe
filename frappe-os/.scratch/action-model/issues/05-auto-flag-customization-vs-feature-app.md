# Auto-flag a feature app that removes chrome (vs a pure-customization app)

Status: ✅ DONE (2026-06-22) — shipped (ADR-0014 item 4). Implementation: `registry/classify.ts`
`classifyApp` labels an app *feature* if it contributes any of display-config/doctype-view/
dashboard-card/applet, else *pure-customization*, derived from the folded registry's per-app kinds
(`appKinds` in `registry/index.ts`, surfaced as `useRegistry().appKind`); `actions/removals.ts`
`warnFeatureAppRemovals` emits the loud, attributed warning only for a feature app's winning
removal (pure-customization removals pass quiet), wired into `menubar.ts`. Tests:
`tests/classify.spec.js` (classifier decision table) and the warn/quiet branch in
`tests/actions.spec.js`. The in-context badge lives in the Customizations view (issue 04).

## What to build

ADR-0014 **item 4**: distinguish the *expected* case from the *surprising* one when an app removes
chrome. "A **pure customization app** (contributes only overrides/removals/patches) removing chrome
is expected and listed quietly; a **feature app** (ships doctypes/views/applets) that *also*
removes chrome is the surprising case and is warned about loudly." Design: ADR-0014; the removal
mechanism this classifies: issue 03.

The classification is largely settled by the ADR, so this is AFK:

- **Classifier.** An app is *pure customization* if its OS contributions are **only** of the
  command/action/patch kind (overrides, removals, `commandPatch`) and it ships **no** doctypes,
  views, applets, or cards; otherwise it is a *feature app*. The Registry already knows every
  contribution and its `sourceApp`, so the classifier reads the folded registry — a server-side
  check over the projection in `www/os.py` (mirroring `_installed_os_apps()` introspection) or the
  client registry index, whichever owns the full picture at the point the warning is emitted.
- **Loud warning, quiet pass.** When a *feature* app contributes a removal, emit a loud warning
  (build-time / boot console warning, attributed: which feature app removed what) — the surprising
  case. A pure-customization app's removals pass quietly (no warning; they are its whole job). The
  v1 surface is the loud log; the richer in-context badge belongs with the Customizations view
  (issue 04) and is out of scope here.

## Acceptance criteria

- [x] A classifier labels each contributing app *pure-customization* (only command/action/patch
      contributions, no doctypes/views/applets/cards) or *feature app*, derived from the Registry —
      no per-app configuration.
- [x] When a *feature* app contributes a removal, a loud warning is emitted and attributed (which
      app, which region/command removed); a *pure-customization* app's removals emit no warning.
- [x] erpnext (a feature app) removing a File-menu item via issue 03's `removed: true` triggers the
      loud warning; a synthetic pure-customization app contributing the same removal does not.
- [x] Vitest covers the classifier decision table (pure-customization vs feature) and the
      warn/quiet branch; the warning is asserted (not just visually checked).
- [x] `yarn typecheck && yarn test && yarn build` are green.

## Blocked by

- `03-app-removes-chrome-attributed-logged.md` (the removal directive and attribution this slice
  classifies).
