# Action/extension model — design settled, next steps

**Status:** Design grilling **complete** (`/grill-with-docs`, 2026-06-21). Q1–Q6 all resolved.
Nothing more to decide before prototyping. This file is the entry point for the two follow-up
sessions (prototype, then to-issues). Supersedes `/tmp/frappe-os-action-model-grilling-handoff.md`.

## Where the decisions live (read these first — they ARE the design)

- **`../../CONTEXT.md`** — resolved vocabulary: **Command, Action, Region, Handler
  (navigate/run), Context, Eligibility (`when`)**.
- **`../adr/0014-apps-may-override-and-remove-chrome.md`** — apps may override AND remove any
  chrome; safety = visibility + reversibility (amends ADR-0007's authority rule).
- **`./surface-and-registry.md`** — the `Contribution`/`CommandPayload` shapes this model extends.
- Most-relevant existing ADRs: **0001** (uniform contribution), **0004** (closed-but-data-driven
  extension-point types), **0007** (identity + Singleton/Collection merge), **0010** (permissions).

## The resolved model (Q1–Q6, one line each)

1. **Command** (verb, identity-bearing, placement-agnostic) vs **Action** (placement of a Command
   into a **Region**, carrying `when` + order). One Command → many Actions. Handler kinds:
   **navigate** (pure data) and **run**.
2. **Override = reuse ADR-0007** (App<Site<User layers, explicit priority, shadowed-and-logged).
   No responder chain — focus is flat (single `state.activeId`, no nesting), so runtime
   disambiguation is a fixed **3-tier `when`-specificity** tiebreak (surface > window > global).
3. **`when`** is minimal but in v1 (it scopes overrides). Context = 6 fields derivable from the
   active window: `activeApp, windowRole, doctype, recordName, view, appletId`. **`selection`
   excluded** (no backing in `OsState` yet; additive later). Form = **structured predicate**,
   equality-only, evaluated as data (no `eval`); operators additive later.
4. **Resolve-by-id, no runtime `register()`, no `activationEvents`.** navigate = data (zero load);
   run = lazy import on first invoke; `when` judged from data so eligibility never loads a handler.
   Run handlers are **fire-and-forget** — no lifecycle/teardown (deferred, see below).
5. **OS defaults become contributions** (`sourceApp:'frappe'`, dogfoods ADR-0001 — `MenuBar.vue`
   is the standing violation). Command = Singleton (global override), Action = Collection
   (contextual override). Migrate **incrementally**, not big-bang.

## Session 1 — PROTOTYPE ✅ DONE (2026-06-21)

Throwaway prototype at `../../prototypes/action-when-eval/` (`when-eval.mjs` + `NOTES.md`).
**Verdict: mechanism sound — green light for the tracer bullet.** Validated rules to carry into
the real `actions` module (copied here so they survive deleting the throwaway prototype):

- **Tier map drives everything** (plain data): `{doctype,recordName,view,appletId}` = surface,
  `{activeApp,windowRole}` = window, empty `when` = global.
- **Eligibility = equality-only, evaluated as data** (no `eval`). A `when` key whose Context
  value is `undefined` is a non-match; an **unknown** key degrades to no-match + a loud warn
  (forward-compat with additive Context fields like `selection`).
- **Specificity = the lexicographic vector `(surfaceCount, windowCount)`**, NOT a flat count —
  a 1-key *surface* predicate beats a 2-key *window* one (tier dominates count). This sharpened
  the design; it's now also in `CONTEXT.md` → Eligibility.
- **Competition is per `(region, command)`** — same verb in the same region. Different
  commands/regions never compete; all render.
- **Final tiebreaks** on equal specificity, in order: ADR-0007 layer (App<Site<User) →
  explicit `priority` (higher wins — a SEPARATE axis from the ascending render `order`) →
  genuine tie (logged as `⚠ true-tie`, never a silent coin-flip). A winning override inherits
  the slot's render placement (group + order) from the default it shadows when it sets none.
- **Always log shadows**, distinguishing a clean override from a true tie.

## Session 2 — TO-ISSUES ✅ DONE — the tracer bullet (Q6)

Sliced into two tracker items under `.scratch/action-model/issues/`:
`01-file-menu-from-contributions.md` (the resolver engine + File menu) and
`02-erpnext-overrides-new-window.md` (the erpnext server override).

**Slice 1 (issue 01) ✅ SHIPPED (2026-06-21).** The pure `actions` resolver
(`src/actions/`, decision-table-tested in `tests/actions.spec.js`) + the File menu rendered
from first-party `frappe` Commands/Actions; `New window` is now a real `run` Handler resolved
through `FIRST_PARTY_RUN`. The other six menus stay literal (incremental). Carried the
prototype-validated rules below verbatim.

**Slice 2 (issue 02) ✅ SHIPPED (2026-06-21).** The override-of-a-default (Q6 payload), end to
end: erpnext declares it via the **`os_actions` hook** (mirrors `os_applets`); `www/os.py`
`_action_contributions()` / `_command_contributions()` project `type:'action'` / `'command'`
Contributions for installed OS apps only (sourceApp + ADR-0007 identity); the client folds them
in `registry/index.ts` (`command`/`action` branches → `useRegistry().commands()/actions()`).
**The seam:** `menubar.ts` now resolves over the first-party `FILE_*` arrays **⊕** the
registry-folded contributions, so erpnext's Action actually competes. The override is an Action
sharing command id `frappe.window.new` (so it competes per `(region, command)`), gated
`when:{activeApp:'erpnext'}`, carrying a **`commandPatch:{title}`** — an ADR-0007 Patch of the
Command Singleton's presentation, applied only when it wins (no global Command mutation, no
resolver rewrite; removal stays deferred). The shadowed OS default is attributed to erpnext and
logged as a clean `override` (distinguished from a true-tie). Covered by Vitest
(`tests/registry.spec.js` fold + `tests/actions.spec.js` tiebreak) and
`cypress/e2e/action-override.cy.js` (green vs the bench-served build at `:8016`).

The tracer bullet, originally scoped here:
- Render **just the File menu** from contributions (other six menus stay hardcoded — incremental).
- The dead `"New window" → () => {}` stub becomes a **real first-party `frappe` Command + Action**
  (run handler via a static `FIRST_PARTY`-style map — no server round-trip for OS's own defaults).
- **erpnext contributes an override** of it via a **hook + server projection** (like `os_applets`),
  gated by `when:{activeApp:'erpnext'}`.
- **Assert the shadow is logged.**
Proves end-to-end: contribution shape → ADR-0007 identity → `when` evaluator → region render →
3-tier tiebreak → override-of-a-default → dogfooding. **Override only; removal deferred.**

## Deferred (NOT part of this plan — separate future work)

- **Removal slice** (ADR-0014's remove power + Customizations view + auto-flag of feature-apps) —
  reuses the same plumbing; clean follow-up after the override tracer.
- **`selection` in Context** + list-row/context-menu actions.
- **Form actions** (lean on ADR-0006 Scripts — a different axis).
- **The "silent killer" cluster** (separate grilling): singleton-vs-multi-instance, ref-counted
  eviction (share-don't-sync), teardown/disposal lifecycle. Our fire-and-forget Q4 choice
  deliberately avoids needing it now.
```
