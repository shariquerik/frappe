# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Live doctype meta (ADR-0028): the lean, permission-checked field + indicator descriptors a
# doctype's list/form loads when it opens — the "live meta" half of the boot-vs-live-meta split.
# Also carries the doctype's `os/` manifest (ADR-0030) onto that live meta for the view to read.

import frappe
from frappe import _
from frappe.os import manifest

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


def _status_field(meta):
	"""A Select field named status/stage — Desk's status convention (None if absent). The
	indicator-spec fallback status field when the doctype has no active workflow (ADR-0028)."""
	for name in ("status", "stage"):
		df = meta.get_field(name)
		if df and df.fieldtype == "Select":
			return name
	return None


def _enabled_field(meta):
	"""The enabled-state field name — 'enabled' (truthy = active) or 'disabled' (truthy =
	inactive), else None. Opposite polarities; the client resolver reads which from the name."""
	for name in ("enabled", "disabled"):
		if meta.get_field(name):
			return name
	return None


def _publication_field(meta):
	"""The publication/visibility Check field — 'published'/'is_published' (Published vs Not
	Published), 'public'/'is_public' (Public vs Private), or 'is_private' (Private, inverse
	polarity), else None. Desk expresses these per-doctype in listview_settings.get_indicator
	(Note.public, Web Page.published, File.is_private); the OS generalizes them into one tier,
	the client owning the label/color per field name (ADR-0028)."""
	for name in ("published", "is_published", "public", "is_public", "is_private"):
		df = meta.get_field(name)
		if df and df.fieldtype == "Check":
			return name
	return None


def _state_colors(meta):
	"""DocType.states: status value -> a Frappe color token, scrubbed to a lowercase token
	(ADR-0028). The client normalizes it onto a Badge token; empty when the doctype has none."""
	colors = {}
	for state in meta.get("states") or []:
		if state.color:
			colors[state.title] = state.color.lower().replace(" ", "-")
	return colors


def _workflow_styles(doctype):
	"""The active workflow's (state field, {state -> Workflow State.style}). (None, {}) when
	the doctype has no workflow — the client then falls back to the status field."""
	from frappe.model.workflow import get_workflow_name

	workflow_name = get_workflow_name(doctype)
	if not workflow_name:
		return None, {}
	workflow = frappe.get_cached_doc("Workflow", workflow_name)
	styles = {}
	for row in workflow.states:
		style = frappe.get_cached_value("Workflow State", row.state, "style")
		if style:
			styles[row.state] = style
	return workflow.workflow_state_field, styles


def _indicator_spec(doctype, meta):
	"""Normalized Record-indicator spec (ADR-0028): how to resolve this doctype's records to a
	status pill, from the site's own workflow/states/docstatus/enabled data. The active workflow's
	state field wins as the status field, else a Select named status/stage."""
	workflow_field, workflow_styles = _workflow_styles(doctype)
	return {
		"statusField": workflow_field or _status_field(meta),
		"workflow": workflow_styles,
		"states": _state_colors(meta),
		"isSubmittable": bool(meta.is_submittable),
		"enabledField": _enabled_field(meta),
		"publicationField": _publication_field(meta),
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
	doctype's `os/` manifest (ADR-0030) alongside, projected onto live meta for the view to read."""
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
		"indicator": _indicator_spec(doctype, meta),
		"can_create": frappe.has_permission(doctype, "create"),
		"can_write": frappe.has_permission(doctype, "write"),
		"fields": fields,
		"manifest": _live_meta_manifest(doctype, meta),
	}


@frappe.whitelist()
def card_value(doctype: str, filters: str | list | dict | None = None, fieldname: str | None = None):
	"""Dashboard card value: a live count, or a sum of `fieldname` when given."""
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	filters = frappe.parse_json(filters) if filters else None
	if fieldname:
		# get_list (not get_all) so the doctype's permission query conditions are applied.
		rows = frappe.get_list(doctype, filters=filters or {}, fields=[f"sum(`{fieldname}`) as total"])
		return (rows[0].total if rows else 0) or 0
	# get_count applies permission query conditions, so the card matches the visible list.
	from frappe.client import get_count

	return get_count(doctype, filters)
