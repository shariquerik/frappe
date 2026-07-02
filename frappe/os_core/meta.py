# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Live doctype meta (ADR-0028): the lean, permission-checked field + indicator descriptors a
# doctype's list/form loads when it opens — the "live meta" half of the boot-vs-live-meta split.
# Also carries the doctype's `os/` manifest (ADR-0030) onto that live meta for the view to read.

import frappe
from frappe import _
from frappe.os_core import contributions, indicators, manifest

# Fieldtypes that are layout-only or unsupported by the rendering engine. Section Break is handled
# specially (its label groups the following fields) before this skip.
SKIP_FIELDTYPES = {
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Button",
	"Fold",
	"Heading",
}


def _live_meta_manifest(doctype, meta):
	"""The doctype's co-located `os/` manifest (ADR-0030) projected onto live meta — read as data
	when the doctype/view opens (the boot-vs-live-meta split, ADR-0028), never into boot. This
	slice only *carries* it; the later folders (indicator rules, scoped actions) evaluate and
	resolve what it declares. {} when the doctype ships no manifest."""
	return manifest.doctype_manifest(doctype, meta.module)


@frappe.whitelist()
def get_doctype_meta(doctype: str):
	"""Lean field descriptors the form needs, each tagged with its Section Break label. Carries the
	doctype's `os/` manifest (ADR-0030) alongside, and its Doctype/View-scoped Action + Command
	contributions (ADR-0032) — the live-meta half of delivery-by-scope — for the client to fold in."""
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	meta = frappe.get_meta(doctype)
	fields = []
	current_section = ""
	for df in meta.fields:
		if df.fieldtype == "Section Break":
			current_section = df.label or ""
			continue
		if df.fieldtype in SKIP_FIELDTYPES or df.hidden:
			continue
		fields.append(
			{
				"fieldname": df.fieldname,
				"label": df.label,
				"fieldtype": df.fieldtype,
				"options": df.options,
				"section": current_section,
				"reqd": bool(df.reqd),
				"read_only": bool(df.read_only),
				"in_list_view": bool(df.in_list_view),
			}
		)

	return {
		"doctype": meta.name,
		"title_field": meta.title_field or "name",
		"indicator": indicators.indicator_spec(doctype, meta),
		"can_create": frappe.has_permission(doctype, "create"),
		"can_write": frappe.has_permission(doctype, "write"),
		"fields": fields,
		"manifest": _live_meta_manifest(doctype, meta),
		"contributions": contributions.doctype_scoped_contributions(doctype, meta.module),
	}


@frappe.whitelist()
def card_value(doctype: str, filters: str | list | dict | None = None, fieldname: str | None = None):
	"""Dashboard card value: a live count, or a sum of `fieldname` when given."""
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	filters = frappe.parse_json(filters) if filters else None
	if fieldname:
		# get_list (not get_all) so the doctype's permission query conditions are applied. The dict
		# form is required — Frappe rejects raw "sum(...)" strings in `fields` (SQL-injection guard).
		rows = frappe.get_list(doctype, filters=filters or {}, fields=[{"SUM": fieldname, "as": "total"}])
		return (rows[0].total if rows else 0) or 0
	# get_count applies permission query conditions, so the card matches the visible list.
	from frappe.client import get_count

	return get_count(doctype, filters)
