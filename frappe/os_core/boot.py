# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# The boot payload assembly (ADR-0028): what the /os shell needs on first paint — the merged
# Registry, permission map, resolved placements and recents — gathered into one dict injected as
# window.boot (and re-fetched by the Vite dev server via the whitelisted `boot`).

import frappe
import frappe.sessions

from frappe.os_core.placements import get_placements
from frappe.os_core.recents import get_recents
from frappe.os_core.registry import get_permissions, get_registry
from frappe.os_core.wallpapers import get_selection, get_wallpapers


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
		# The wallpaper catalog (global defaults ∪ the caller's own uploads) and their chosen
		# wallpaper name — the selection roams per-user in frappe.defaults (ADR-0036).
		"wallpapers": get_wallpapers(),
		"wallpaper": get_selection(),
		# Realtime coordinates for the OS socket seam (data/realtime.ts): the per-site
		# Socket.IO namespace is `/{sitename}`; in dev the shell reaches the realtime
		# process directly on `socketio_port`, in production it rides the same origin
		# (nginx proxies /socket.io). `developer_mode` is the dev-vs-prod switch.
		"sitename": frappe.local.site,
		"socketio_port": frappe.conf.socketio_port,
		"developer_mode": bool(frappe.conf.developer_mode),
	}


@frappe.whitelist()
def boot():
	"""Same payload as the injected boot — used by the Vite dev server."""
	return get_boot()
