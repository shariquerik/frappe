# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Web entry for "Frappe OS" — a metadata-driven desktop shell that runs alongside Desk at /os.
# This is the thin web layer: its only job is rendering the host page (injecting the boot payload).
# The OS engine — boot assembly, registry, live meta, placements, recents, the manifest reader, plus
# the account and Desk-integration seams — lives in the `frappe.os_core` package (ADR-0030), and the
# frontend calls those whitelisted methods at their real path `frappe.os_core.<module>.<name>`.

from urllib.parse import urlencode

import frappe
import frappe.sessions
from frappe.os_core.boot import get_boot

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
