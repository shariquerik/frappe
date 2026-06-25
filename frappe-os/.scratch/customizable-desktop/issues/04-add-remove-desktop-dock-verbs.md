# "Add to / Remove from Desktop / Dock" Action verbs

Status: 📋 Ready (2026-06-25)

Triage: ready-for-agent (AFK)

## What to build

The user-facing verbs that create and hide Placements, surfaced through the existing **Action**
machinery (ADR-0001) rather than bespoke menu wiring. Four first-party Commands/Actions:
**Add to Desktop**, **Add to Dock**, and their inverses **Remove from Desktop**, **Remove from
Dock**.

- **Offered from any surface, not app-only.** The verb pins **whatever the active window shows**,
  using that window's **surface reference** (ADR-0021) — an app, an applet, a dashboard, or a
  doctype+view. Surfaced in the menu bar / context menu as resolved Actions in their Region.
- **"Add" upserts a User-layer new-pin** `OS Placement Override` (region = desktop or dock),
  targeting the desktop render/write path from #02 or the dock one from #03.
- **"Remove" is a non-destructive personal hide.** It writes a User-layer **hide (tombstone)**
  delta against a base identity, suppressing the pin **for that user's own view only**. There is
  **no `locked` concept** — admin/baseline data is always safe, so removing an inherited pin can
  never destroy it; the source row and every other user are untouched (ADR-0023).
- The inverse verb appears only when the current surface is already pinned in that region (identity
  match on `(region, surface-reference)`).

Reuses the ADR-0001 Eligibility / Region / resolve machinery wholesale — no new menu plumbing.

## Acceptance criteria

- [ ] "Add to Desktop" / "Add to Dock" appear as resolved Actions from any surface and create a
      User-layer placement for that surface's reference.
- [ ] On an already-pinned surface, the matching "Remove from Desktop/Dock" appears (keyed on
      `(region, surface-reference)`).
- [ ] "Remove" writes a personal **hide/tombstone** delta, not a delete; hiding an inherited
      (baseline/Site) pin suppresses it only for that user, leaving the source row and other users
      unaffected.
- [ ] The verbs render through the ADR-0001 Action resolver / Region machinery — no bespoke menu
      code.
- [ ] Tests cover add → resolved placement, remove-own-pin, and hide-inherited-pin (tombstone)
      semantics.

## Blocked by

- #02 (Desktop grid + drag + override write path)
- #03 (Dock pinned/transient split)
