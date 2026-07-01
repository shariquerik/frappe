# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Web entry for "Frappe OS" — a metadata-driven desktop shell that runs alongside Desk at /os.
# This is the thin web layer: it renders the host page (injecting the boot payload) and hosts the
# shell's account / Desk-integration endpoints. The OS engine — boot assembly, registry, live
# meta, placements, recents, the manifest reader — lives in the `frappe.os` package (ADR-0030).
#
# The frontend calls the engine's whitelisted methods by the path `frappe.www.os.<name>`, so this
# module re-exports them: the imported objects are the SAME functions `@frappe.whitelist` registered
# in the package, so `frappe.www.os.<name>` stays a valid, whitelisted RPC with no path change.

from urllib.parse import urlencode

import frappe
import frappe.sessions
from frappe import _
from frappe.os.boot import boot, get_boot  # noqa: F401 — `boot` is re-exported RPC surface
from frappe.os.meta import card_value, get_doctype_meta  # noqa: F401 — re-exported RPC surface
from frappe.os.placements import delete_placement_override, save_placement_override  # noqa: F401
from frappe.os.recents import record_recent  # noqa: F401 — re-exported RPC surface
from frappe.os.registry import resolve_doctype  # noqa: F401 — re-exported RPC surface
from frappe.rate_limiter import rate_limit

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.response["status_code"] = 403
		frappe.redirect(f"/login?{urlencode({'redirect-to': frappe.request.path})}")
		raise frappe.Redirect
	# Injected as window.<key> so the shell has the registry, permissions and csrf
	# token on first paint. Must be a dict — the boot injector iterates its keys.
	context.boot = get_boot()
	context.csrf_token = frappe.sessions.get_csrf_token()
	return context


def setup_desk_switch():
	"""Add a 'Switch to Frappe OS' entry to the Desk navbar (user dropdown). Idempotent.

	Data-driven via Navbar Settings — no Desk JS changes, no asset rebuild.
	Run once: bench --site <site> execute frappe.www.os.setup_desk_switch
	"""
	label = "Switch to Frappe OS ✨"
	settings = frappe.get_doc("Navbar Settings")
	if any((i.item_label or "") == label for i in settings.settings_dropdown):
		return "already present"
	settings.append(
		"settings_dropdown",
		{
			"item_label": label,
			"item_type": "Action",
			"action": "window.location.href = '/os'",
			"is_standard": 0,
		},
	)
	settings.save()
	frappe.db.commit()
	return "added"


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
