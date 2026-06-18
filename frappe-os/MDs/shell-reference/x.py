# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Host page + thin registry API for the "F2" shell — a fresh, metadata-driven
# frontend that runs alongside Desk at /x. Tier A only: doctypes in the registry
# light up the shell's nav and get auto-generated list + form views, no per-doctype
# frontend code. In the real system the registry comes from installed-app manifests;
# for this POC it is a curated allowlist.

from urllib.parse import urlencode

import frappe
import frappe.sessions
from frappe import _

no_cache = 1

# Tier-A registry: which doctypes light up the shell. Curated for the POC.
REGISTRY_DOCTYPES = ["ToDo", "Contact", "Note"]

# Fieldtypes that are layout-only or unsupported by the POC engine.
SKIP_FIELDTYPES = {
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Button",
	"Fold",
	"Heading",
}


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.response["status_code"] = 403
		frappe.redirect(f"/login?{urlencode({'redirect-to': frappe.request.path})}")
		raise frappe.Redirect
	# Injected into the page (as window.<key>) so the shell has the registry and
	# csrf token on first paint. Must be a dict — the boot injector iterates its keys.
	context.boot = get_boot()
	context.csrf_token = frappe.sessions.get_csrf_token()
	return context


def get_boot():
	return {
		"user": frappe.session.user,
		"csrf_token": frappe.sessions.get_csrf_token(),
		"registry": get_registry(),
	}


@frappe.whitelist()
def boot():
	"""Same payload as the injected boot — used by the Vite dev server."""
	return get_boot()


def get_registry():
	"""The contribution registry: doctypes the shell should expose, filtered by read permission."""
	items = []
	for doctype in REGISTRY_DOCTYPES:
		if not frappe.has_permission(doctype, "read"):
			continue
		meta = frappe.get_meta(doctype)
		items.append(
			{
				"doctype": doctype,
				"label": _(doctype),
				"title_field": meta.title_field or "name",
			}
		)
	return items


@frappe.whitelist()
def get_doctype_meta(doctype: str):
	"""Exactly the field descriptors the rendering engine needs — not Desk's full meta."""
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	meta = frappe.get_meta(doctype)
	fields = []
	for df in meta.fields:
		if df.fieldtype in SKIP_FIELDTYPES or df.hidden:
			continue
		fields.append(
			{
				"fieldname": df.fieldname,
				"label": df.label,
				"fieldtype": df.fieldtype,
				"options": df.options,
				"reqd": bool(df.reqd),
				"read_only": bool(df.read_only),
				"in_list_view": bool(df.in_list_view),
			}
		)

	return {
		"doctype": meta.name,
		"title_field": meta.title_field or "name",
		"can_create": frappe.has_permission(doctype, "create"),
		"can_write": frappe.has_permission(doctype, "write"),
		"fields": fields,
	}


def setup_desk_switch():
	"""Add a 'Switch to F2' entry to the Desk navbar (user dropdown). Idempotent.

	Data-driven via Navbar Settings — no Desk JS changes, no asset rebuild. The
	reverse direction (F2 -> Desk) is the 'Open Desk' link in the shell sidebar.
	Run once: bench --site <site> execute frappe.www.x.setup_desk_switch
	"""
	label = "Switch to F2 ✨"
	settings = frappe.get_doc("Navbar Settings")
	if any((i.item_label or "") == label for i in settings.settings_dropdown):
		return "already present"
	settings.append(
		"settings_dropdown",
		{
			"item_label": label,
			"item_type": "Action",
			"action": "window.location.href = '/x'",
			"is_standard": 0,
		},
	)
	settings.save()
	frappe.db.commit()
	return "added"
