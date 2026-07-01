# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# The Record-indicator spec the server projects onto live meta (ADR-0028 / ADR-0031). A doctype's
# records resolve to a status pill from an ordered list of Indicator rules — `{condition, label,
# color}` where the condition reuses Frappe's own filter grammar. This module OWNS the rule list:
# it builds the OS default rules (the generic status tiers, as data), merges an app's manifest
# rules over them (ADR-0030's `os/doctype.json → indicator`), and names the fields the rules
# reference so the surface auto-fetches them. The client resolver stays pure — it evaluates the
# projected list, it does not decide it ("server owns the meaning; client resolver stays pure").
#
# Keyword-guess (frappe.utils.guess_style) is deliberately NOT a rule: it computes a color from an
# open status string, so by ADR-0031's line it is client-side behavior, not projected data.

import frappe

from frappe.os import manifest

# Publication/visibility field -> its (on, off) pill, on = truthy. Each field's own polarity is
# baked in (is_private truthy = Private). The generic desk `listview_settings.get_indicator` tier,
# as data (ADR-0028).
PUBLICATION_RULES = {
	"published": (("Published", "green"), ("Not Published", "gray")),
	"is_published": (("Published", "green"), ("Not Published", "gray")),
	"public": (("Public", "green"), ("Private", "gray")),
	"is_public": (("Public", "green"), ("Private", "gray")),
	"is_private": (("Private", "gray"), ("Public", "green")),
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
	inactive), else None. Opposite polarities; the default rule reads which from the name."""
	for name in ("enabled", "disabled"):
		if meta.get_field(name):
			return name
	return None


def _publication_field(meta):
	"""The publication/visibility Check field — 'published'/'is_published', 'public'/'is_public',
	or 'is_private' (inverse polarity), else None. Desk expresses these per-doctype in
	listview_settings.get_indicator; the OS generalizes them into one default-rule tier (ADR-0028)."""
	for name in PUBLICATION_RULES:
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
	"""The active workflow's (state field, {state -> Workflow State.style}). (None, {}) when the
	doctype has no workflow — the client then falls back to the status field."""
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


def _state_rules(status_field, states):
	"""The DocType.states tier: each status value -> its curated color, as an equality rule."""
	if not status_field:
		return []
	return [{"condition": f"{status_field},=,{title}", "label": title, "color": color} for title, color in states.items()]


def _submitted_rules(is_submittable):
	"""The Submitted tier: docstatus 1. Draft/Cancelled (0/2) stay built-in above the rule list
	(ADR-0031) — only Submitted is open to override, so only it is a rule."""
	return [{"condition": "docstatus,=,1", "label": "Submitted", "color": "blue"}] if is_submittable else []


def _publication_rules(publication_field):
	"""The publication/visibility tier: the field's on (truthy) and off (falsy) rules."""
	pair = PUBLICATION_RULES.get(publication_field) if publication_field else None
	if not pair:
		return []
	(on_label, on_color), (off_label, off_color) = pair
	return [
		{"condition": f"{publication_field},=,1", "label": on_label, "color": on_color},
		{"condition": f"{publication_field},=,0", "label": off_label, "color": off_color},
	]


def _enabled_rules(enabled_field):
	"""The enabled/disabled tier: opposite polarities read from the field name."""
	if enabled_field == "enabled":
		return [
			{"condition": "enabled,=,1", "label": "Enabled", "color": "blue"},
			{"condition": "enabled,=,0", "label": "Disabled", "color": "gray"},
		]
	if enabled_field == "disabled":
		return [
			{"condition": "disabled,=,1", "label": "Disabled", "color": "gray"},
			{"condition": "disabled,=,0", "label": "Enabled", "color": "blue"},
		]
	return []


def default_indicator_rules(status_field, states, is_submittable, publication_field, enabled_field):
	"""The OS default rule list, ADR-0028 fallthrough order (first match wins): DocType.states ->
	Submitted -> publication -> enabled/disabled. Supplied at the lowest precedence — an app rule
	overrides it (ADR-0031's "one format for base and override")."""
	return [
		*_state_rules(status_field, states),
		*_submitted_rules(is_submittable),
		*_publication_rules(publication_field),
		*_enabled_rules(enabled_field),
	]


def _clean_rule(rule):
	"""A manifest-declared rule normalized to {condition, label, color}, or None if malformed. A
	label is required; condition defaults to "" (a catch-all), color to gray. Lenient by design —
	one bad rule is skipped, never fatal (ADR-0014)."""
	if not isinstance(rule, dict) or not rule.get("label"):
		return None
	return {
		"condition": str(rule.get("condition") or ""),
		"label": str(rule["label"]),
		"color": str(rule.get("color") or "gray"),
	}


def app_indicator_rules(doctype, module):
	"""The app's own Indicator rules, declared in the doctype manifest (`os/doctype.json ->
	indicator`, ADR-0030). Read as data, malformed rules skipped; [] when none are declared."""
	scopes = manifest.doctype_manifest(doctype, module)
	declared = (scopes.get("doctype") or {}).get("indicator")
	if not isinstance(declared, list):
		return []
	return [rule for rule in (_clean_rule(entry) for entry in declared) if rule]


def _condition_fields(condition):
	"""The record fields a condition reads — the first token of each `field,op,value` clause."""
	fields = []
	for clause in str(condition or "").split("|"):
		field = clause.split(",")[0].strip()
		if field:
			fields.append(field)
	return fields


def referenced_fields(rules, status_field, is_submittable):
	"""The fields the surface must fetch for the indicator to resolve: the status field (workflow /
	keyword), docstatus when submittable (Draft/Cancelled), and every field a rule condition reads.
	Ordered, de-duplicated — retires desk's manual `add_fields` chore (ADR-0031)."""
	fields = []
	if status_field:
		fields.append(status_field)
	if is_submittable:
		fields.append("docstatus")
	for rule in rules:
		fields.extend(_condition_fields(rule["condition"]))
	return list(dict.fromkeys(fields))


def indicator_spec(doctype, meta):
	"""The normalized Record-indicator spec (ADR-0028 / ADR-0031): the built-in workflow state field
	and styles, whether the doctype is submittable, the effective Indicator rule list (app rules
	over OS default rules), and the fields those rules reference for auto-fetch. The active
	workflow's state field wins as the status field, else a Select named status/stage."""
	workflow_field, workflow_styles = _workflow_styles(doctype)
	status_field = workflow_field or _status_field(meta)
	is_submittable = bool(meta.is_submittable)
	rules = app_indicator_rules(doctype, meta.module) + default_indicator_rules(
		status_field, _state_colors(meta), is_submittable, _publication_field(meta), _enabled_field(meta)
	)
	return {
		"statusField": status_field,
		"workflow": workflow_styles,
		"isSubmittable": is_submittable,
		"rules": rules,
		"fields": referenced_fields(rules, status_field, is_submittable),
	}
