# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Account self-service for the OS shell's Account pane (ADR-0030): the logged-in user acting on their
# own credentials, no System Manager required. Kept in the engine package — `www/os.py` only re-exports
# it — because it is a shell concern, not the web page that renders /os. Delegates to Frappe's own
# password primitives; this module only wires them for the shell.

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=5, seconds=60 * 60, methods="POST")
def change_password(old_password: str, new_password: str) -> None:
	"""Change the logged-in user's own password after verifying the current one.

	Self-service (no System Manager): the old password is checked server-side, so
	possessing the session alone isn't enough. Rate-limited to blunt brute-forcing the
	current password. Delegates to Frappe's own primitives — this only wires them for the
	OS shell's Account pane.
	"""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("You must be logged in to change your password."), frappe.PermissionError)

	# Raises frappe.AuthenticationError ("Incorrect User or Password") on a wrong current password.
	frappe.local.login_manager.check_password(user, old_password)

	from frappe.utils.password import update_password

	update_password(user, new_password)
