# Per-user Settings window, with Account folded in

> **Status:** Accepted / Implemented (2026-07-01). Renames the existing `system-settings`
> window to **Settings** (CONTEXT.md), introduces the **Account** pane, and reserves the
> **System Defaults** name for a future site-wide surface. The Settings/Account panes and
> URL-addressable panes (`/settings/<pane>`) have landed.

The window we ship today as **"System Settings"** is a misnomer: everything in it
(Appearance, Wallpaper, Dock, window behaviour) is **per-user** preference, not site-wide
configuration. Nothing in it is "system". We rename it to **Settings** (per-user) and fold the
logged-in user's **Account** — identity (full name, avatar) + credentials (password) — into it
as a pane, alongside the existing preference panes. The genuinely site-wide, admin-scoped
surface ("System Defaults") does not exist yet; we **reserve that name** so it can claim the
"System" label cleanly when it arrives, rather than colliding with a per-user window (and with
Frappe's own `System Settings` single-DocType).

This mirrors macOS, where the account card sits at the **top of System Settings** with the
personal-preference panes below it — one per-user surface, not a separate "Account" app.

## Why one window, not two

The earlier instinct was a **separate `account` window** (mirroring how Finder and System
Settings were each added), justified by "server-backed account vs. local desktop prefs". That
justification collapsed under two facts surfaced while grilling:

1. **The current prefs are also per-user**, and will become per-user **server-backed** rows
   (the **User-preference** layer — the same `App < Site < User` machinery `OS Placement
   Override` already uses). So the seam is not local-vs-server; it is **preferences vs.
   identity/credentials** — and both are per-user.
2. With both sides per-user and server-backed, the only thing separating them is *kind*, which
   a **pane** expresses as well as a window — and macOS itself keeps them in one surface.

So Account is a **pane** of the per-user **Settings** window, not its own `system`-role
window. Settings stays a singleton `system`-role window (respawned-from-URL, never persisted),
exactly as before.

## Considered options

- **Separate `account` window** (rejected) — extra window plumbing (new surface kind, id,
  route) for a split macOS doesn't make and that the per-user/per-user scope doesn't justify.
- **Keep the name "System Settings", add Account inside** (rejected) — leaves a per-user window
  wearing the "System" label, which then **collides** with the future site-wide "System
  Defaults" surface and with Frappe's `System Settings` DocType. The rename pays off twice.

## How Account reads and writes (self-service, all users)

Account is a **bespoke compact pane** (consistent with the hand-built Appearance/Dock/General
panes), backed by a **`useAccount()` composable** so components don't depend on the data source:

- **Read + name + avatar** ride **own-user permission**: a user may read/write their *own* `User`
  document, with **permlevel** still gating fields — `first_name` / `last_name` / `user_image` are
  permlevel 0 (self-writable); `roles` / `user_type` / `enabled` / API keys are not. So the composable
  wraps `createDocumentResource('User', <self>)` and saves only those permlevel-0 fields. **No
  permission loosening and no custom self-scoped endpoints are needed** for these.

  > **Correction (2026-07-01):** this ADR originally attributed the own-user write to
  > `User.has_website_permission` (`self.name == frappe.session.user`). That method is real but is
  > **only** consulted in website-render contexts (web_form, printview, document_page) — **not** in
  > the REST/RPC save path the `/os` page takes. The actual grant is the `write=1` **self-DocShare**
  > created by `User.share_with_self()`, which `frappe.permissions.has_permission` honors on the
  > standard save. Outcome is identical (non-admin self-write works; permlevel still gates to
  > level 0). Verified by code, not yet live.
- **Avatar** reuses frappe-ui `FileUploader` → `upload_file` → set `user_image` → save.
- **Password** uses a CRM-style **rate-limited** `change_password(old_password, new_password)`
  whitelisted method (verifies the old password server-side), not a plain doc save.
- **Theme** (the Appearance section) uses frappe-ui's theme switcher + `switch_theme`.

This deliberately deviates from the first reading of permissions (the **Desk role table** grants
`User` write to System Manager only). That path is real but is **not** the one a `/os` www page
takes for an own-user doc — the **self-DocShare** path is (see the correction above) — which is why
self-service works for non-admins without weakening the doctype.

## Consequences

- The rename touches several places at once (like any window-id change, per `docs/summary.md`):
  the `system-settings` window id + `systemSettingsSurface` kind, the `/system-settings` route,
  `openSystemSettings`/`setSystemSettingsSection`, and the menu/dock/context-menu labels
  (`"System settings…"` → `"Settings…"`). How that rename is staged is an implementation detail,
  not part of this decision.
- The **avatar pill** (menu bar) becomes the entry point: it opens Settings focused on Account.
  `"Log out…"` becomes a real action (`POST /api/method/logout` → `/login`). `"Lock screen"` and
  `"About this workspace"` stay stubbed.
- "System Defaults" remains **reserved** — when it ships it is a *separate* surface (site-wide
  scope), and the per-user window stays named **Settings**.
