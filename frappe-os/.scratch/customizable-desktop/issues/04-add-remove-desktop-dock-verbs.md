# "Add to / Remove from Desktop / Dock" Action verbs

Status: ✅ DONE (2026-06-25)

Triage: ready-for-agent (AFK)

Implementation note: `src/actions/placement-verbs.ts` is the whole slice — four first-party Commands
(`Add to Desktop/Dock`, `Remove from Desktop/Dock`) placed by Actions into the `menubar:file` Region,
so they ride the SAME ADR-0001 resolver the File menu dogfoods (no bespoke menu plumbing). `activeRef`
maps the focused window's Surface → a pinnable reference (`surfaceToRef`, ADR-0021: list→doctype-list,
dashboard, applet; a form/empty pins the bare app) and returns **null for non-`app` windows** (the
Finder / System Settings are OS chrome, never pinned). `addToDesktop`/`addToDock` upsert a User-layer
pin into the next free grid cell (`nextFreeCell`) / past the max dock `order` (`nextDockOrder`). The
resolver is equality-only, so the Add↔Remove toggle is a projection-time decision:
`suppressedPlacementCommands` drops the dead half of each pair (and all four on a bare/chrome surface),
which `fileMenuOptions` (`menubar.ts`) filters through. **Remove** routes through the shared
`removeResolvedPlacement` (in `placements/index.ts`): own pin → delete its override row; INHERITED pin
→ `hidden` tombstone. Own-vs-inherited keys off a server-stamped **`inherited`** flag (added to
`merge_placements` in `frappe/www/os.py`), NOT position — the baseline ships positions too, so the
position heuristic silently failed to hide moved/default pins. Favorites (#05) reuses the same path.

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

- [x] "Add to Desktop" / "Add to Dock" appear as resolved Actions from any surface and create a
      User-layer placement for that surface's reference.
- [x] On an already-pinned surface, the matching "Remove from Desktop/Dock" appears (keyed on
      `(region, surface-reference)`).
- [x] "Remove" writes a personal **hide/tombstone** delta, not a delete; hiding an inherited
      (baseline/Site) pin suppresses it only for that user, leaving the source row and other users
      unaffected.
- [x] The verbs render through the ADR-0001 Action resolver / Region machinery — no bespoke menu
      code.
- [x] Tests cover add → resolved placement, remove-own-pin, and hide-inherited-pin (tombstone)
      semantics.

## Blocked by

- #02 (Desktop grid + drag + override write path)
- #03 (Dock pinned/transient split)
