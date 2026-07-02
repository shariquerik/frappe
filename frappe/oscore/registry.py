# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# The OS Registry (ADR-0005/0010): the merged, permission-filtered contribution list the desktop
# boots with. This module assembles it — app identity + default surface and each app's applet /
# command / action contributions (projected in `contributions.py`) joined with the curated
# doctypes' display-config + view contributions — and serves one doctype on demand (resolve_doctype).

import frappe
from frappe import _
from frappe.oscore import contributions, manifest
from frappe.oscore.common import readable_meta

# Doctypes Frappe OS should expose, mirroring the curated frontend config
# (frappe-os/src/config/doctypes.js). Each is permission- and existence-checked at
# registry build time, so entries for an app that isn't installed are skipped quietly.
REGISTRY_DOCTYPES = [
	# Frappe
	"User",
	"Role",
	"ToDo",
	"File",
	"Notification Log",
	"Comment",
	"Web Page",
	"Blog Post",
	# CRM
	"CRM Lead",
	"CRM Deal",
	"CRM Organization",
	"CRM Task",
	"Contact",
	"Note",
	# ERPNext
	"Sales Invoice",
	"Sales Order",
	"Quotation",
	"Customer",
	"Item",
	"Warehouse",
	"Stock Entry",
	"Delivery Note",
	"Payment Entry",
	"Journal Entry",
]


def _app_of(doctype):
	"""The app that ships a doctype (via its module), defaulting to frappe — through the shared
	safe module→app seam, so a custom-module doctype resolves instead of raising."""
	return manifest.app_of_module(frappe.db.get_value("DocType", doctype, "module"))


def _view_contribution(doctype, name, label, app, order):
	return {
		"type": "doctype-view",
		"target": doctype,
		"name": name,
		"sourceApp": app,
		"payload": {"view": name, "label": label, "builtin": True},
		"order": order,
	}


def _display_payload(doctype, meta):
	"""Identity the boot Registry carries for a doctype (ADR-0028): its label only. Presentation
	semantics — title field, status field/colors, list columns — moved to live meta
	(get_doctype_meta), so the Registry no longer projects them. OS-native look (icons, colors)
	is overlaid client-side."""
	return {"label": _(doctype)}


# Property Setter property → DisplayConfigPayload field (ADR-0011 Site layer). Empty since
# ADR-0028 moved presentation semantics (title/status/columns) to live meta — which already
# reflects this site's Property Setters — so no doctype-level scalar property has an OS display
# equivalent to patch. The Site-layer patch seam stays for any property that gains one.
DISPLAY_PATCH_PROPERTIES = {}


def _doctype_property_setters():
	"""This site's doctype-level Property Setters for the registry doctypes, grouped by
	doctype. Field-level setters stay baked into meta (not patched here) — see ADR-0007."""
	rows = frappe.get_all(
		"Property Setter",
		filters={"doc_type": ["in", REGISTRY_DOCTYPES], "doctype_or_field": "DocType"},
		fields=["doc_type", "property", "value"],
	)
	grouped = {}
	for row in rows:
		grouped.setdefault(row.doc_type, []).append(row)
	return grouped


def _property_setters_of(doctype):
	"""One doctype's doctype-level Property Setters — the on-demand analog of
	_doctype_property_setters (which batches the whole curated registry at boot)."""
	return frappe.get_all(
		"Property Setter",
		filters={"doc_type": doctype, "doctype_or_field": "DocType"},
		fields=["doc_type", "property", "value"],
	)


def _display_patch(doctype, setters):
	"""A partial display-config patch from a doctype's Property Setters (ADR-0007). A property
	with no OS payload field is logged and skipped — never silently dropped (ADR-0011)."""
	patch = {}
	for setter in setters:
		field = DISPLAY_PATCH_PROPERTIES.get(setter.property)
		if field:
			patch[field] = setter.value
		else:
			frappe.logger("frappe_os").info(f"Skipped Property Setter {doctype}.{setter.property}: no display field")
	return patch


def _doctype_contributions(doctype, meta, setters):
	"""The display-config + view contributions for ONE doctype (ADR-0011), shared by the boot
	registry and on-demand resolution (resolve_doctype). The base display-config carries the
	app-default projection; this site's doctype Property Setters ride along as a __site__ patch
	(ADR-0007 App-default ⊕ Site-layer)."""
	app = _app_of(doctype)
	out = [
		{
			"type": "display-config",
			"target": doctype,
			"name": "display",
			"sourceApp": app,
			"payload": _display_payload(doctype, meta),
		}
	]
	patch = _display_patch(doctype, setters)
	if patch:
		out.append(
			{
				"type": "display-config",
				"target": doctype,
				"name": "patch",
				"sourceApp": "__site__",
				"payload": patch,
				"order": 1,
			}
		)
	out.append(_view_contribution(doctype, "list", "List", app, 0))
	out.append(_view_contribution(doctype, "form", "Form", app, 1))
	return out


def get_registry():
	"""The merged, permission-filtered Registry (ADR-0005/0010): app + default-surface +
	display-config + doctype-view contributions the user may see. An app's manifest projects two
	independent contributions — `app` (identity) and `default-surface` (landing, ADR-0021).
	Identity tuple per ADR-0007; tolerant schemaVersion per ADR-0008. Display-config payloads are
	projected from Desk meta (label, ADR-0011); the client overlays OS-native presentation
	(branding, icons, status palettes, curated cards) Desk has no equivalent for. This site's
	doctype Property Setters ride along as a partial __site__ display-config patch (ADR-0007
	App-default ⊕ Site-layer)."""
	rows = []
	for order, app in enumerate(contributions._installed_os_apps()):
		rows.append(contributions._app_contribution(app, order))
		surface = contributions._default_surface_contribution(app)
		if surface:
			rows.append(surface)
	property_setters = _doctype_property_setters()
	for doctype in REGISTRY_DOCTYPES:
		meta = readable_meta(doctype)
		if not meta:
			continue
		rows.extend(_doctype_contributions(doctype, meta, property_setters.get(doctype, [])))
	rows.extend(contributions.applet_contributions())
	rows.extend(contributions.command_contributions())
	rows.extend(contributions.action_contributions())
	return {"schemaVersion": 1, "contributions": rows}


@frappe.whitelist()
def resolve_doctype(doctype: str):
	"""Registry contributions for ONE doctype, resolved on demand — the deep-link path for a
	real doctype the curated boot registry omits, so /os/<app>/<Any DocType> opens its list.
	Returns the same display-config + view shapes get_registry emits (the client folds them into
	its live index), or None when the doctype is missing or the user may not read it — letting
	the client fall back to the app's default window. Permission-gated like the boot registry
	(ADR-0010); the owning app rides on each contribution's sourceApp (_app_of)."""
	meta = readable_meta(doctype)
	if not meta:
		return None
	return _doctype_contributions(doctype, meta, _property_setters_of(doctype))


def get_permissions():
	"""Standard per-doctype permission map (read/write/create/delete) so the desktop can
	gate actions upfront; the server stays the enforcement boundary (ADR-0010)."""
	perms = {}
	for doctype in REGISTRY_DOCTYPES:
		if not readable_meta(doctype):
			continue
		perms[doctype] = {
			ptype: frappe.has_permission(doctype, ptype)
			for ptype in ("read", "write", "create", "delete")
		}
	return perms
