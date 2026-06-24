# Client default-surface resolver: declared → dashboard → empty-app pane

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

Replace the hardcoded landing priority in `initialSurface()` (`src/surface/index.ts`) with a
**resolver** over the `default-surface` contribution from the previous slice. A window's opening
Surface is resolved top-down, first match wins (ADR-0021):

1. **Declared custom default** — the `default-surface` reference after layered merge
   (App/Site/User), resolved into a Surface for **own-app** references in this slice
   (`{applet}`, `{dashboard}`; the doctype-list reference may resolve too if trivial).
2. **Dashboard** — the app's dashboard, if any.
3. **First doctype list** — **DORMANT**: depends on the deferred nav-source decision; this rung is
   intentionally skipped/stubbed and slots in additively later.
4. **Empty-app pane** — a new OS-owned placeholder ("no default screen configured for *App*") so
   every declared OS app stays openable rather than blank.

Scope:
- **Own-app references only** here (`app` defaults to the opened app). Cross-app (`app:`-qualified)
  references, permission gating, and window-identity-≠-surface-ownership are the next slice (#07).
- New **empty-app pane** component (the terminal fallback / rung 4).
- frappe/crm/erpnext continue to land on their dashboard — but now **via rung 2 of the resolver**,
  not a hardcode; an app with neither a declared default nor a dashboard lands on the empty-app
  pane.
- Keep geometry/focus/URL projection surface-agnostic (ADR-0012); the resolver only chooses *which*
  Surface a Window opens on.

## Acceptance criteria

- [x] `initialSurface()` resolves the opening Surface through the resolver, not a hardcoded
      priority.
- [x] A declared own-app `default-surface` reference (`{applet}` / `{dashboard}`) opens that
      Surface (rung 1). (`{doctype, view:'list'}` also resolves; other doctype views fall through.)
- [x] frappe/crm/erpnext open on their dashboard via rung 2 (no behavioural change for the user).
- [x] An app with no declared default and no dashboard opens on the new **empty-app pane** naming
      the app (rung 4).
- [x] Rung 3 (first doctype list) is present as a documented DORMANT no-op pending the nav-source
      decision.
- [x] Vitest covers the resolver's first-match-wins decision table across rungs 1/2/4.

## Blocked by

- #04 (`default-surface` extension-point + server projection)
