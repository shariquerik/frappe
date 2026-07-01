# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Web entry for "Frappe OS" — a metadata-driven desktop shell that runs alongside Desk at /os.
# This is the thin web layer: its own job is rendering the host page (injecting the boot payload).
# The OS engine — boot assembly, registry, live meta, placements, recents, the manifest reader, plus
# the account and Desk-integration seams — lives in the `frappe.os` package (ADR-0030).
#
# The frontend calls the engine's whitelisted methods by the path `frappe.www.os.<name>`, so this
# module re-exports them: the imported objects are the SAME functions `@frappe.whitelist` registered
# in the package, so `frappe.www.os.<name>` stays a valid, whitelisted RPC with no path change.

from urllib.parse import urlencode

import frappe
import frappe.sessions
from frappe.os.account import change_password  # noqa: F401 — re-exported RPC surface
from frappe.os.boot import boot, get_boot  # noqa: F401 — `boot` is re-exported RPC surface
from frappe.os.desk import setup_desk_switch  # noqa: F401 — re-exported ops entry point
from frappe.os.meta import card_value, get_doctype_meta  # noqa: F401 — re-exported RPC surface
from frappe.os.placements import delete_placement_override, save_placement_override  # noqa: F401
from frappe.os.recents import record_recent  # noqa: F401 — re-exported RPC surface
from frappe.os.registry import resolve_doctype  # noqa: F401 — re-exported RPC surface

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
