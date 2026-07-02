# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Desk integration for Frappe OS (ADR-0030): the seams that let the OS shell and classic Desk hand off
# to each other. Kept in the engine package — `www/os.py` only re-exports it — because wiring Desk is a
# shell concern, not the web page that renders /os. Data-driven via Navbar Settings: no Desk JS changes,
# no asset rebuild.

import frappe
import frappe.defaults
from frappe import _

# The two shells a system user can land on after login. Stored as a per-user default (Frappe's
# standard per-user settings store) — absent means classic Desk, so no migration is needed to give
# every existing user the historical default.
PREFERRED_SHELL_KEY = "preferred_shell"
SHELLS = {
	"os": "/os",
	"desk": "/desk",
}

# Navbar entry that switches Desk → OS. Matched by the shell path its action navigates to (not its
# label) so a rename — or the earlier `/x` prototype-shell action — reconciles in place. `/x` is the
# OS shell's former mount point; recognising it lets an old "Switch to F2" row fold into the new one.
SWITCH_PATHS = ("'/os'", "'/x'")
SWITCH_LABEL = "Switch to OS"
SWITCH_ICON = "grid"
# One JS expression (Desk evals it as `return <action>`): remember the choice, then land on /os.
SWITCH_ACTION = "frappe.xcall('frappe.os_core.desk.set_preferred_shell', {shell: 'os'}).then(() => window.location.href = '/os')"


def _is_switch_row(item) -> bool:
	"""A Desk → OS switch entry, past or present: its action navigates to the OS shell's mount point."""
	action = item.action or ""
	return any(path in action for path in SWITCH_PATHS)


@frappe.whitelist()
def set_preferred_shell(shell: str) -> str:
	"""Remember which shell (os|desk) this user lands on after login, and bust the cached home page.

	Called by the Desk "Switch to OS" navbar action and the OS shell's "Switch to Desk" menu item, so
	the two switches are symmetric — each writes the same per-user default the login redirect reads.
	"""
	if shell not in SHELLS:
		frappe.throw(_("Unknown shell: {0}").format(shell))
	frappe.defaults.set_user_default(PREFERRED_SHELL_KEY, shell)
	# get_home_page() caches per user; the next login would otherwise read the stale shell.
	frappe.cache.hdel("home_page", frappe.session.user)
	return shell


def preferred_shell() -> str | None:
	"""The session user's chosen shell, or None for Guest / an unset default (→ classic Desk)."""
	if frappe.session.user == "Guest":
		return None
	return frappe.defaults.get_user_default(PREFERRED_SHELL_KEY) or None


def landing_path() -> str:
	"""Absolute path the user should land on after login — /os when they prefer it, else /desk."""
	return SHELLS.get(preferred_shell(), "/desk")


def setup_desk_switch():
	"""Add (or reconcile) the "Switch to OS" entry in the Desk navbar (user dropdown). Idempotent.

	Data-driven via Navbar Settings — no Desk JS changes, no asset rebuild. Matches an existing row by
	its action so a label/icon change updates in place rather than appending a duplicate.
	Run once: bench --site <site> execute frappe.os_core.desk.setup_desk_switch
	"""
	settings = frappe.get_doc("Navbar Settings")
	matches = [i for i in settings.settings_dropdown if _is_switch_row(i)]
	if not matches:
		settings.append(
			"settings_dropdown",
			{
				"item_label": SWITCH_LABEL,
				"item_type": "Action",
				"action": SWITCH_ACTION,
				"icon": SWITCH_ICON,
				"is_standard": 0,
			},
		)
		outcome = "added"
	else:
		# Keep the first switch row, canonicalise it, and drop any duplicates (e.g. a stale `/x` row
		# left beside a newer `/os` one) so the dropdown never shows the switch twice.
		keep, *duplicates = matches
		was_canonical = not duplicates and (keep.item_label, keep.icon, (keep.action or "").strip()) == (
			SWITCH_LABEL,
			SWITCH_ICON,
			SWITCH_ACTION,
		)
		keep.item_label = SWITCH_LABEL
		keep.icon = SWITCH_ICON
		keep.action = SWITCH_ACTION
		for row in duplicates:
			settings.settings_dropdown.remove(row)
		outcome = "already present" if was_canonical else "updated"
	settings.save()
	frappe.db.commit()
	return outcome
