# Row open-target is a per-user preference (inline default, flippable to new window)

Triage: ready-for-agent (AFK)

## What to build

Make the list-row **left-click open-target** a **User-layer preference** (ADR-0018 update to
ADR-0017). The default stays **inline** (open the record in the same window — which now swaps
that window's sidebar to the Aspect rail). A user may flip the preference to **open in a new
window**, in which case a plain left-click mints an ordinary app **instance** whose Surface
starts on that record's form (the existing `newAppWindow` path from ADR-0017).

The preference is persisted per user via the existing persistence path (`desktop/persistence.ts`,
the same mechanism that persists `sidebarHidden`) and is exposed as a toggle in the existing
Settings surface (`components/Settings/SettingsDialog.vue`).

The right-click **context menu is unchanged**: it always offers **both** Open (same window)
and Open in New Window, regardless of the preference — it is the explicit per-row escape hatch
(see ADR-0018). Only plain left-click follows the preference.

## Acceptance criteria

- [x] A row open-target preference exists with values `inline` (default) and `new-window`,
      persisted per user across reloads.
- [x] A toggle for it appears in the Settings surface.
- [x] With the default (`inline`), left-clicking a list row opens the record in the same
      window (unchanged from today).
- [x] With `new-window`, left-clicking a list row mints a new app instance whose Surface is
      that record's form.
- [x] The right-click context menu still lists both Open and Open in New Window under either
      preference value.
- [x] Vitest covers the preference-governed left-click target decision; existing routing /
      instance behaviour is unaffected.

## Blocked by

- None — independent of issues 01 and 02 (can start immediately).
