# `useAccount()` composable + Account section in Settings

Status: TODO

Triage: ready-for-agent (AFK)

## What to build

Add the logged-in user's **Account** section to the top of the **Settings** window (per
ADR-0027), backed by a `useAccount()` composable so the pane never depends on the data source.

The composable wraps `createDocumentResource('User', <self>)` and rides **own-user permission**:
a user may read and write their *own* `User` document via the website-permission path
(`self.name == frappe.session.user`), with **permlevel** still gating fields. It therefore saves
**only** the permlevel-0 fields `{first_name, last_name, user_image}` — never `roles`,
`user_type`, `enabled`, or API keys. No permission loosening and no custom self-scoped endpoints.
`full_name` is read-only/computed from first/last — edit first/last, display full_name.

The Account pane is a bespoke compact pane (consistent with the hand-built Appearance/Dock/General
panes): a header card with avatar + full name + email, an editable name, and read-only
username / roles / last-login. Avatar upload reuses frappe-ui `FileUploader` → `upload_file` →
set `user_image` → save.

End-to-end: open Settings → Account → see your real identity → edit your name and avatar → save →
the change persists on your `User` doc and re-reads correctly. Verify against a real non-admin
user that own-user read/write works without System Manager.

## Acceptance criteria

- [ ] `useAccount()` exposes the self `User` doc and a save that writes **only**
      `{first_name, last_name, user_image}`.
- [ ] Account section renders at the top of Settings: avatar + full_name + email header,
      editable name, read-only username/roles/last-login.
- [ ] Editing name and saving persists to the `User` doc and re-reads.
- [ ] Avatar upload via `FileUploader` → `upload_file` → `user_image` → save works.
- [ ] Confirmed working for a non-admin (own-user website-permission), not just System Manager.
- [ ] Unit spec asserts the save allow-list rejects/strips non-permlevel-0 fields.
- [ ] `yarn typecheck` and `yarn test --run` pass.

## Blocked by

- 01-rename-system-settings-to-settings
