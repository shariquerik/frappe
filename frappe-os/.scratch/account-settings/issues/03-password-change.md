# Password change in the Account section

Status: TODO

Triage: ready-for-agent (AFK)

## What to build

Let a logged-in user change their own password from the Account section. Password is **not** a
normal field save — it goes through a CRM-style, **rate-limited** `change_password(old_password,
new_password)` whitelisted method that verifies the old password server-side (see the CRM
precedent for the endpoint and modal shape).

The UI is a frappe-ui Dialog launched from the Account section with three fields — current
password, new password, confirm new password — with client-side confirm-match validation and
server-side verification of the current password.

End-to-end: Account → "Change password" → enter current + new + confirm → submit → old password
verified server-side, new password set, dialog closes on success, errors (wrong current pw,
rate-limited) surface clearly.

## Acceptance criteria

- [ ] Whitelisted, rate-limited `change_password(old_password, new_password)` method that
      verifies the old password server-side.
- [ ] frappe-ui Dialog with current / new / confirm fields and confirm-match validation.
- [ ] Wrong current password and rate-limit responses surface as clear errors.
- [ ] Success closes the dialog; the new password works on next login.
- [ ] `yarn typecheck` and `yarn test --run` pass.

## Blocked by

- 02-useaccount-composable-and-account-section
