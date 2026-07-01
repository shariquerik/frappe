# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# The boot payload assembly (ADR-0028): what the /os shell needs on first paint — the merged
# Registry, permission map, resolved placements and recents — gathered into one dict injected as
# window.boot (and re-fetched by the Vite dev server via the whitelisted `boot`).

import frappe
import frappe.sessions

from frappe.os.placements import get_placements
from frappe.os.recents import get_recents
from frappe.os.registry import get_permissions, get_registry


def get_boot():
	return {
		"user": frappe.session.user,
		"user_fullname": frappe.utils.get_fullname(frappe.session.user),
		"csrf_token": frappe.sessions.get_csrf_token(),
		"roles": frappe.get_roles(),
		"registry": get_registry(),
		"permissions": get_permissions(),
		"placements": get_placements(),
		"recents": get_recents(),
	}


@frappe.whitelist()
def boot():
	"""Same payload as the injected boot — used by the Vite dev server."""
	return get_boot()
