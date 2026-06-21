# erpnext overrides the "New window" Command via hook + server projection

Status: ✅ DONE (2026-06-21) — shipped override-only; removal still deferred. Implementation:
erpnext `os_actions` hook → `www/os.py` `_action_contributions()`/`_command_contributions()` →
client fold in `registry/index.ts` (`command`/`action` branches) → `menubar.ts` resolves over
first-party `FILE_*` ⊕ registry-folded actions → gated `when` + commandPatch wins for an erpnext
window, shadow attributed + logged. Tests: `tests/registry.spec.js`, `tests/actions.spec.js`,
`cypress/e2e/action-override.cy.js`. See `docs/design/action-model-next-steps.md` (Slice 2).

## What to build

The second vertical slice of the Action/extension model — the override-of-a-default that proves the contribution path end-to-end: app hook → server projection → client fold → `when` evaluation → 3-tier tiebreak → attributed shadow log → dogfooding. This is the payload Q6 of `docs/design/action-model-next-steps.md` exists to prove. **Override only; removal is deferred** (ADR-0014 grants apps removal power, but this slice does not exercise it).

erpnext contributes an **override** of the first-party `frappe` `new-window` Command (or the Action placing it in `menubar:file`), declared via a hook and projected by the server — the same merge pattern as `os_applets` (`erpnext/hooks.py` → `www/os.py` `_applet_contributions` → client fold in `registry/index.ts`), not a new mechanism:

- erpnext **declares** the override via a hook (e.g. `os_commands` / `os_actions`, mirroring `os_applets` `{appletId, label, fileName}`). No OS edit per contribution.
- The server reads the hook for **installed OS apps only** (`_installed_os_apps()`) and projects one `type:'command'` / `type:'action'` Contribution each into `get_registry()`, with `sourceApp='erpnext'`, identity per ADR-0007.
- The client folds them into the actions index at boot (extend `addToIndex` in `registry/index.ts` with `command`/`action` branches, alongside the existing `app`/`display-config`/`doctype-view`/`dashboard-card`/`applet` branches).
- The Action is gated `when:{activeApp:'erpnext'}` (window tier). So it wins the `(menubar:file, new-window)` competition **only** when an erpnext window is focused; with any other app focused the OS default wins (its `when` is global, lower specificity but eligible where erpnext's is not). Doctype-wins / tier precedence falls out of the lexicographic specificity vector.
- When the override wins, the shadowed OS default is **logged and attributed** to erpnext (ADR-0007 + ADR-0014 item 1, "never silent"). Reversibility (item 2) holds for free via the layer order; the Customizations view (item 3) and the feature-app auto-flag (item 4) are deferred.

## Acceptance criteria

- [x] An erpnext hook declares a Command/Action override of `frappe`'s `new-window`; no OS source edit is needed to add it. (`erpnext/hooks.py` `os_actions`)
- [x] `www/os.py` `get_registry()` projects the hook into `command`/`action` Contributions for installed OS apps only, with `sourceApp='erpnext'`. (`_action_contributions()` / `_command_contributions()`; verified via `bench execute`)
- [x] The client folds `command`/`action` contributions into the actions index at boot. (`registry/index.ts` `addToIndex` + `commands()`/`actions()`)
- [x] With an erpnext window focused, the File menu shows erpnext's overriding item; with a non-erpnext window focused, it shows the OS default — driven by `when:{activeApp:'erpnext'}` through the specificity tiebreak. (Action shares command id + `commandPatch:{title}`)
- [x] The shadow is logged and attributed to erpnext (distinguished from a true-tie). (resolver `reason:'override'`, logged in `resolve.ts`)
- [x] Vitest covers the server-contribution fold and the tiebreak resolution; a Cypress spec asserts that focusing an erpnext window changes the File-menu item **and** that the shadow is logged.
- [x] `yarn typecheck && yarn test && yarn build` are green; Cypress passes against the bench-served build.

## Blocked by

- `01-file-menu-from-contributions.md` (the `actions` resolver, the `menubar:file` Region, and the first-party `new-window` Command it overrides).
