# Render the File menu from first-party contributions (actions engine + client render)

Status: ✅ DONE (2026-06-21) — shipped. Implementation: the pure `actions` engine
(`src/actions/` — `eligibility.ts`, `specificity.ts`, `resolve.ts`, `context.ts`,
`contributions.ts` first-party `FILE_*` Commands/Actions + `RUN_HANDLERS`, `menubar.ts`
`fileMenuOptions`); `MenuBar.vue`'s File menu renders from `resolve('menubar:file', context)`, the
other six menus stay literal. Tests: `tests/actions.spec.js` (eligibility, the specificity vector,
the tiebreak chain, shadow logging, `invoke`, and the File-menu render). See
`docs/design/action-model-next-steps.md` (Slice 1).

## What to build

The first vertical slice of the Action/extension model (design: `docs/design/action-model-next-steps.md`, vocabulary: `CONTEXT.md` → Command/Action/Region/Handler/Context/Eligibility). It cuts contribution-data → resolver → rendered region → run handler, end-to-end on the client, with the other six menu-bar menus left hardcoded (incremental migration — `MenuBar.vue` is the standing ADR-0001 violation we start dogfooding here).

Two halves:

**The `actions` resolver module.** A pure-data engine, no `eval`, carrying the rules the throwaway prototype (`docs/design/action-model-next-steps.md` → Session 1) validated:

- **Tier map drives everything** (plain data): `{doctype, recordName, view, appletId}` = the *surface* tier, `{activeApp, windowRole}` = the *window* tier, an empty `when` = *global*.
- **Eligibility = equality-only, evaluated as data.** A `when` key whose Context value is `undefined` is a non-match; an **unknown** `when` key degrades to no-match **plus a loud warn** (forward-compat with additive Context fields like a future `selection`).
- **Specificity = the lexicographic vector `(surfaceCount, windowCount)`** — NOT a flat key count. A 1-key *surface* predicate beats a 2-key *window* one (tier dominates count).
- **Competition is per `(region, command)`** — the same verb in the same region. Different commands or regions never compete; all render.
- **Final tiebreaks** on equal specificity, in order: ADR-0007 layer (App < Site < User) → explicit `order` → genuine tie (logged as `⚠ true-tie`, never a silent coin-flip).
- **Always log shadows**, distinguishing a clean override from a true tie (ADR-0007 "shadowed, never silently dropped"; ADR-0014 attribution).

**The File menu, dogfooded.** The OS's own File-menu items become first-party `frappe` **Commands** placed by **Actions** into a `menubar:file` **Region**:

- `New window` — today a dead `() => {}` stub — becomes a real Command with a **run** Handler resolved via a `FIRST_PARTY`-style static map (no server round-trip for the OS's own defaults; mirrors `FIRST_PARTY` applets in `registry/index.ts`). A **navigate** Handler is pure data (a `Surface`); a **run** Handler is a reference resolved lazily and is fire-and-forget (no lifecycle/teardown — deferred).
- `Open…` / `Close window` wrap the existing OS actions (`openPalette`, close-active) as Commands so the whole File region renders from resolved Actions.
- `MenuBar.vue` renders **only** the File menu from `actions.resolve('menubar:file', context)`; the Apple/App/Edit/View/Window/Help menus stay literal arrays for now.

Context is the 6 fields derivable from the active window (`activeApp, windowRole, doctype, recordName, view, appletId`); `selection` is excluded (no backing in the window model yet — additive later).

## Acceptance criteria

- [x] An `actions` module exposes a pure resolver that, given a region id + Context, returns the eligible Actions per `(region, command)` with the winner chosen by `(surfaceCount, windowCount)` specificity → layer → `order` → logged true-tie.
- [x] Eligibility is equality-only and evaluated as data; an `undefined`-valued Context key is a non-match; an **unknown** `when` key yields no-match **and** emits a loud warning.
- [x] Shadowed Actions are logged (attributed), distinguishing a clean override from a `⚠ true-tie`.
- [x] `New window` is a first-party `frappe` Command + Action with a real **run** handler resolved through a `FIRST_PARTY`-style map; it no longer no-ops.
- [x] `MenuBar.vue`'s File menu renders from resolved Actions; the other six menus are unchanged and still hardcoded.
- [x] Vitest decision-table specs cover eligibility, the lexicographic specificity vector, the tiebreak chain, and shadow logging; a render test asserts the File menu's items come from the resolver.
- [x] `yarn typecheck && yarn test && yarn build` are green.

## Blocked by

None - can start immediately.
