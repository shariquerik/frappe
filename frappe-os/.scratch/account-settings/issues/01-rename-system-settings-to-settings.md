# Rename `system-settings` window to `Settings`

Status: ✅ DONE (Cypress pending — see acceptance criteria)

Triage: ready-for-agent (AFK)

## What to build

Rename the per-user window we ship today as **"System Settings"** to **Settings**, with no
behaviour change. Per ADR-0027, nothing in this window is site-wide — Appearance, Wallpaper,
Dock and window behaviour are all per-user preference — so the "System" label is a misnomer and
is reserved for the future **System Defaults** surface.

This is a window-id change, which touches several places at once (see `docs/summary.md`
"Conventions & gotchas"): the window id and its surface kind, the route, the
open/set-section actions, and every user-facing label in the menu bar, Dock, and context menu
(`"System settings…"` → `"Settings…"`). The window stays a singleton `system`-role window
(respawned-from-URL, never persisted) — only its identity and labels change.

End-to-end: clicking the renamed entry point opens the same window, the URL reflects the new
route, reload still respawns it, and no surface reads the old id.

## Acceptance criteria

- [x] Window id (`settings`) and surface kind (`settingsSurface`/view `settings`) renamed off
      `system-settings`/`systemSettings`; no live reference to the old id remains.
- [x] Route renamed to a bare `/settings`; cold-boot URL seeding and reload persistence still
      respawn the window (handled by the existing `applyRoute` fall-through + `restoreFromHistory`).
- [x] All menu bar / Dock / context-menu labels read "Settings…"/"Settings" (no "System settings…").
- [x] Open and set-section actions renamed (`openSettings`/`closeSettings`/`setSettingsSection`)
      and all callers updated.
- [x] Unit spec covers the new route ↔ id projection (`route-map.spec.js`): `/settings` and
      `/<app>/app-settings` both directions.
- [x] `yarn typecheck` and `yarn test --run` pass (336 tests).
- [ ] Cypress routing specs pass (URL↔focus bridge) — **not run: bench/dev server down in this
      environment; rerun `yarn dev & yarn e2e` against a logged-in bench.**

## Implementation note

The bare `settings` stem was owned by the **per-app** settings feature, so this slice also
renamed that feature's **code identifiers** to **app-settings** (`openAppSettings`/
`appSettingsSurface`/view `app-settings`/id `app-settings:<app>`) to free the name. Its **URL
stays `/<app>/settings`** — there's no collision with the singleton's bare `/settings`
(distinguished by segment count), so existing per-app settings links keep working. The
singleton's content component is now `Settings.vue` (was `SystemSettings.vue`) and the per-app
one is `AppSettings.vue` (was `SettingsDialog.vue`). The window keeps its `system` role.

## Blocked by

None - can start immediately.
