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

from frappe.os_core import manifest
from frappe.os_core.common import layer_rows, upsert

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
	label is required; condition defaults to "" (a bottom fallthrough floor — `merge_rule_layer`
	appends it below the real rules), color to gray. Lenient by design — one bad rule is skipped,
	never fatal (ADR-0014)."""
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


def _clause_key(clause):
	"""Canonicalize one `field,op,value` clause: trim each part. For `in` / `not in`, also trim
	and de-blank each item of the comma value list — mirroring the client's `valueList`
	(frappe-os/src/indicators/indicator.ts) — so `Open,Overdue` and `Open, Overdue` collapse to
	one key. Any other operator keeps its value verbatim (its space is significant to `=`). `""`
	stays `""` — the fallthrough-floor key."""
	parts = [part.strip() for part in clause.split(",", 2)]
	if len(parts) > 2 and parts[1] in ("in", "not in"):
		parts[2] = ",".join(item.strip() for item in parts[2].split(",") if item.strip())
	return ",".join(parts)


def _condition_key(condition):
	"""A rule's identity — its condition, canonicalized so spacing variants collapse to one key
	(ADR-0031: a rule is addressed by what it matches, like a Placement by its ref). Each
	`field,op,value` clause is canonicalized; `""` is the fallthrough-floor key."""
	return "|".join(_clause_key(clause) for clause in str(condition or "").split("|"))


def merge_rule_layer(ladder, patches):
	"""Fold one override layer over an ordered rule ladder, keyed by condition (ADR-0031). A patch
	whose condition matches a ladder rule replaces it in place (same slot — a recolor never changes
	which rule wins first-match); a `hidden` patch drops the matching rule (tombstone); a patch with
	a new non-empty condition is prepended ahead of the ladder, so a higher layer wins. A new
	empty-condition (`""`) patch matches every record, so it is *appended* as a bottom fallthrough
	floor, not prepended as a top catch-all that would shadow every real rule. Malformed patches are
	skipped (ADR-0014). Layers are applied lowest-to-highest."""
	slots = {_condition_key(rule["condition"]): index for index, rule in enumerate(ladder)}
	resolved = list(ladder)
	prepended = []
	appended = []
	for patch in patches:
		key = _condition_key(patch.get("condition"))
		if patch.get("hidden"):
			if key in slots:
				resolved[slots[key]] = None
			continue
		rule = _clean_rule(patch)
		if not rule:
			continue
		if key in slots:
			resolved[slots[key]] = rule
		elif key == "":
			appended.append(rule)
		else:
			prepended.append(rule)
	return prepended + [rule for rule in resolved if rule is not None] + appended


def _layer_row_rule(row):
	"""One stored Site/User override row → a patch dict the merge understands ({condition, label,
	color, hidden}); `hidden` marks a tombstone that drops the matching rule."""
	return {"condition": row.condition or "", "label": row.label, "color": row.color, "hidden": bool(row.hidden)}


def site_indicator_rules(doctype):
	"""The Site layer: OS Indicator Rule rows for this doctype — site-supplied rules that add to,
	replace, or hide the app/default rules (ADR-0031). [] before the DocType is migrated."""
	rows = layer_rows("OS Indicator Rule", ["condition", "label", "color", "hidden"], filters={"document_type": doctype})
	return [_layer_row_rule(row) for row in rows]


def user_indicator_rules(doctype):
	"""The User layer: this user's own OS Indicator Rule Override rows for the doctype, layered
	above the Site (ADR-0031)."""
	rows = layer_rows(
		"OS Indicator Rule Override",
		["condition", "label", "color", "hidden"],
		filters={"document_type": doctype, "owner": frappe.session.user},
	)
	return [_layer_row_rule(row) for row in rows]


def _own_indicator_override(doctype, condition):
	"""The caller's existing OS Indicator Rule Override row for one (doctype, condition) identity, or
	None — the upsert/delete target. Owner-scoped: a user only ever touches their own."""
	return frappe.db.get_value(
		"OS Indicator Rule Override",
		{"owner": frappe.session.user, "document_type": doctype, "condition": condition},
	)


@frappe.whitelist(methods=["POST"])
def save_indicator_override(
	document_type: str, condition: str, label: str | None = None, color: str | None = None, hidden: int = 0
) -> dict:
	"""Upsert the caller's own User-layer indicator override for one (doctype, condition) identity
	(ADR-0031) — the frontend's only indicator write path. A recolor/relabel supplies label + color;
	a personal hide sets `hidden` to drop the matching app/default rule from this user's view. The
	condition is stored canonically so the identity match holds; only the caller's own row is touched."""
	key = _condition_key(condition)
	existing = _own_indicator_override(document_type, key)
	doc = upsert(
		"OS Indicator Rule Override",
		existing,
		{"document_type": document_type, "condition": key, "label": label, "color": color, "hidden": int(hidden)},
	)
	return {"name": doc.name}


@frappe.whitelist(methods=["POST"])
def delete_indicator_override(document_type: str, condition: str) -> dict:
	"""Clear the caller's own indicator override for a (doctype, condition) — resetting that rule
	back to the resolved Site/app/default. No-op if none exists."""
	name = _own_indicator_override(document_type, _condition_key(condition))
	if name:
		frappe.delete_doc("OS Indicator Rule Override", name)
	return {"deleted": bool(name)}


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
	and styles, whether the doctype is submittable, the effective Indicator rule list (App, Site and
	User layers folded over the OS default rules), and the fields those rules reference for
	auto-fetch. The active workflow's state field wins as the status field, else a Select named
	status/stage."""
	workflow_field, workflow_styles = _workflow_styles(doctype)
	status_field = workflow_field or _status_field(meta)
	is_submittable = bool(meta.is_submittable)
	rules = default_indicator_rules(
		status_field, _state_colors(meta), is_submittable, _publication_field(meta), _enabled_field(meta)
	)
	for layer in (
		app_indicator_rules(doctype, meta.module),
		site_indicator_rules(doctype),
		user_indicator_rules(doctype),
	):
		rules = merge_rule_layer(rules, layer)
	return {
		"statusField": status_field,
		"workflow": workflow_styles,
		"isSubmittable": is_submittable,
		"rules": rules,
		"fields": referenced_fields(rules, status_field, is_submittable),
	}
