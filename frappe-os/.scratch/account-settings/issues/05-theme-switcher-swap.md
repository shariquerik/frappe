# Theme switcher swap in the Appearance section

Status: TODO

Triage: ready-for-agent (AFK)

## What to build

Replace the Appearance section's current theme control with frappe-ui's theme switcher backed by
the `switch_theme` API, so theme selection rides the standard frappe-ui mechanism rather than a
bespoke control. Optional / nice-to-have for this first cut — may be folded into the rename slice
or dropped.

End-to-end: Settings → Appearance → pick a theme → frappe-ui applies it and `switch_theme`
persists the choice; it survives reload.

## Acceptance criteria

- [ ] Appearance section uses the frappe-ui theme switcher.
- [ ] Selecting a theme calls `switch_theme` and applies immediately.
- [ ] Choice persists across reload.
- [ ] `yarn typecheck` and `yarn test --run` pass.

## Blocked by

- 01-rename-system-settings-to-settings
