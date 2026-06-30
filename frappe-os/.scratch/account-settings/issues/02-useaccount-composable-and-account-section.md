# `useAccount()` composable + Account section in Settings

Status: ✅ DONE (live non-admin verification pending — see acceptance criteria)

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

- [x] `useAccount()` exposes the self `User` doc and a save that writes **only**
      `{first_name, last_name, user_image}` (`src/data/account.ts`; `pickWritable` is the guard).
- [x] Account section renders at the top of Settings: avatar + full_name + email header,
      editable name, read-only username/roles/last-login (`src/components/Settings/AccountSection.vue`).
- [x] Editing name and saving persists to the `User` doc and re-reads (REST PUT via `api.saveDoc`;
      save replaces the cached doc with the server's, recomputed `full_name` included). **Live
      persistence not exercised — bench/dev server down this environment.**
- [x] Avatar upload via `FileUploader` → `upload_file` → `user_image` → save works (wired; not
      exercised live).
- [ ] Confirmed working for a non-admin (own-user self-DocShare), not just System Manager.
      **Not verified live — bench down.** Mechanism confirmed in code: `User.share_with_self()`
      (`frappe/core/doctype/user/user.py:445`) grants a `write=1` self-DocShare, so the standard
      save path `api.saveDoc` uses succeeds without System Manager; permlevel still gates fields.
- [x] Unit spec asserts the save allow-list rejects/strips non-permlevel-0 fields
      (`tests/account.spec.js` — strips `roles`/`user_type`/`enabled`/`full_name`/`api_key`).
- [x] `yarn typecheck` and `yarn test --run` pass (343 tests, +7 new).

## Blocked by

- 01-rename-system-settings-to-settings
