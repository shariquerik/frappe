# Apps may override and remove any chrome; safety is visibility + reversibility, not prohibition

---
Status: accepted
Amends: ADR-0007 (which reserved *hiding* a contribution to a higher layer)
---

For Frappe OS chrome (menu-bar items, toolbar buttons, context-menu and palette
entries — modeled as Commands and Actions, ADR-0007 identity), **any app may override
*and* remove a Command or Action contributed by the OS core or by another app.** An app
is not restricted to adding or to overriding only within its own context; it may shadow,
replace, or delete shared chrome outright.

We allow this because in the Frappe ecosystem a **customization app** — an installed app
with no doctypes, views, or applets, existing solely to tailor a site to one client's
use case — is a first-class, everyday pattern. Reserving removal to the Site/User layer
(ADR-0007's original rule) would break that entire category: removing a menu item it
doesn't want *is the whole job* of such an app. So the App layer gains the power to hide,
not just override.

The danger was never removal — it is *silent* removal (a marketplace feature-app quietly
stripping "Log out" from the menu bar). The safety model is therefore **visibility +
reversibility, not prohibition**:

1. **Never silent.** Every override and every removal is attributed to the app that did it
   and logged — extending ADR-0007's "shadowed, never silently dropped" to removals.
2. **Always reversible by the human.** User > Site > App still holds (ADR-0007 layers), so
   whatever an app removes, the user or the site admin can restore. An app never has the
   final word over a person.
3. **Surfaced, not buried.** App-originated changes/removals are listed in one
   "Customizations" view (the OS analogue of Frappe's Property Setter / Customize Form
   listing), so a human sees them rather than discovering them in a log.
4. **Auto-flagged by app kind.** The registry already reveals what each app contributes, so
   the OS distinguishes the two cases by itself, with nothing required from the author: a
   **pure customization app** (contributes only overrides/removals/patches) removing chrome
   is expected and listed quietly; a **feature app** (ships doctypes/views/applets) that
   *also* removes chrome is the surprising case and is warned about loudly.

## Considered alternatives

- **Keep ADR-0007's rule (only Site/User may hide; apps may only add/override).** Rejected:
  it forbids the customization-app pattern that the Frappe ecosystem depends on.
- **Let apps remove chrome, but require an explicit manifest declaration / capability grant.**
  Rejected for v1: the app *kind* (customization vs feature) is already derivable from its
  contributions, so an explicit declaration is redundant ceremony.

## Consequences

- ADR-0007's identity/merge machinery is reused unchanged for the *mechanism*; only the
  *authority* rule (who may hide) is widened, plus removals join overrides in the audit log.
- v1 / tracer-bullet scope is items 1–2 only (attributed-and-logged + reversible-by-layering),
  both essentially free. The Customizations view (3) and the auto-flag (4) are follow-ups.
- **Update:** items 3 and 4 are now settled by **ADR-0015** — the Customizations view is a
  read-only *structural catalog* of declared customizations (grouped by app, surfacing the
  feature-app flag), built from the contribution set rather than the resolver's ephemeral
  live output. Item 2's human-facing *restore button* (reversible-by-a-human, not just by
  layering) is deferred to a named write-path slice, with its authority ("restore at the layer
  you operate at") and persistence (Projection-backed Site/User Action record) settled there.
