# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Desk integration for Frappe OS (ADR-0030): the seams that let the OS shell and classic Desk hand off
# to each other. Kept in the engine package — `www/os.py` only re-exports it — because wiring Desk is a
# shell concern, not the web page that renders /os. Data-driven via Navbar Settings: no Desk JS changes,
# no asset rebuild.

import frappe


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
