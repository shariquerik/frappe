# Avatar-pill entry point + real Log out

Status: TODO

Triage: ready-for-agent (AFK)

## What to build

Wire the real entry points to the renamed **Settings** window and make Log out work. Per
ADR-0027 the menu bar **avatar pill** (currently inert) becomes the entry point: clicking it
opens Settings focused on the **Account** section.

Make `"Log out…"` a real action: `POST /api/method/logout` → redirect to `/login`, no confirm
dialog. Leave `"Lock screen"` and `"About this workspace"` stubbed.

End-to-end: click the avatar pill → Settings opens focused on Account; click "Log out…" → session
ends and the browser lands on `/login`.

## Acceptance criteria

- [ ] Avatar pill opens Settings focused on the Account section.
- [ ] "Log out…" calls `POST /api/method/logout` and redirects to `/login`, no confirm.
- [ ] "Lock screen" and "About this workspace" remain stubbed (no regression).
- [ ] `yarn typecheck` and `yarn test --run` pass; Cypress passes if the entry point touches the
      URL↔focus bridge.

## Blocked by

- 01-rename-system-settings-to-settings
- 02-useaccount-composable-and-account-section
