# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Placements (ADR-0023): a layered, role-scoped desktop and dock. Resolves the App-default
# baseline ∪ role-scoped Site ⊕ User overrides into the boot payload, and owns the user's only
# placement write path. The merge is pure (injected permission gate) so it is testable with no site.

import frappe

from frappe.os_core.common import canonical_json, layer_rows, ref_key, ref_visible, upsert

# The App-default baseline — OS-shipped pins reproducing today's desktop set for a fresh user
# (the desktop analog of APP_ORDER). OS-owned for v1; each is a structural placement (region +
# surface reference + position), its presentation overlaid client-side from the reference. The
# two seed icons land on the frappe and erpnext apps; a ref to an app the viewer can't see is
# dropped by the resolver, so an uninstalled app simply yields one fewer icon.
APP_DEFAULT_PLACEMENTS = [
	{"region": "desktop", "ref": {"app": "frappe"}, "position": {"column": 0, "row": 0}},
	{"region": "desktop", "ref": {"app": "erpnext"}, "position": {"column": 0, "row": 1}},
	# Dock baseline — reproduces today's APP_ORDER (frappe, crm, erpnext) as pinned dock items
	# for a fresh user. Bare-app refs; the resolver drops any app the viewer can't see.
	{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 0}},
	{"region": "dock", "ref": {"app": "crm"}, "position": {"order": 1}},
	{"region": "dock", "ref": {"app": "erpnext"}, "position": {"order": 2}},
]


def merge_placements(baseline, site, overrides, can_see):
	"""Fold the three Placement layers into one resolved list in precedence order App < Site <
	User (ADR-0023). Pure — `can_see(ref) -> bool` is the injected permission gate (ADR-0010), so
	the merge logic is testable without a site. Baseline ∪ role-scoped Site are unioned and
	de-duped by identity (region, ref); then each User override mutates the matching base entry in
	place — a hide (tombstone) drops it, a position delta moves it, a reference not already present
	is a brand-new user pin appended at the end. A user override never mutates a baseline/Site row,
	only the user's own resolved view. Finally drop any pin whose reference the viewer may not see."""
	by_key, order = {}, []
	for placement in [*baseline, *site]:
		key = (placement["region"], ref_key(placement["ref"]))
		if key not in by_key:
			# `inherited`: this pin is backed by the App-default/Site layer, so the client's Remove
			# suppresses it with a hide tombstone rather than deleting a (non-existent) own row. A
			# baseline pin carries a position too (ADR-0023), so layer — not position — is authoritative.
			by_key[key] = {**dict(placement), "inherited": True}
			order.append(key)
	for override in overrides:
		key = (override["region"], ref_key(override["ref"]))
		if override.get("hidden"):
			by_key.pop(key, None)
		elif key in by_key:
			if override.get("position") is not None:
				by_key[key]["position"] = override["position"]
		else:
			# A reference not in any base layer is the user's OWN new pin (no `inherited`): Remove
			# deletes its row outright.
			by_key[key] = {"region": override["region"], "ref": override["ref"], "position": override.get("position")}
			order.append(key)
	return [by_key[key] for key in order if key in by_key and can_see(by_key[key]["ref"])]


def _parse_placement(row, hidden=False):
	"""One stored row → the resolver's dict shape, parsing its JSON reference and position."""
	placement = {"region": row.region, "ref": frappe.parse_json(row.surface_ref)}
	placement["position"] = frappe.parse_json(row.position) if row.position else None
	if hidden:
		placement["hidden"] = bool(row.hidden)
	return placement


def _site_placements():
	"""The Site layer for this user: every OS Placement row scoped to a role they hold (or to no
	role — offered to all). Role is a scope applied here by the same per-user visibility filter the
	Registry uses (ADR-0010), NOT a fourth precedence rung."""
	roles = set(frappe.get_roles())
	rows = layer_rows("OS Placement", ["region", "surface_ref", "position", "role"])
	return [_parse_placement(row) for row in rows if not row.role or row.role in roles]


def _user_overrides():
	"""The User layer: this user's own OS Placement Override deltas (move / hide / new pin)."""
	rows = layer_rows(
		"OS Placement Override",
		["region", "surface_ref", "position", "hidden"],
		filters={"owner": frappe.session.user},
	)
	return [_parse_placement(row, hidden=True) for row in rows]


def get_placements():
	"""The resolved desktop/dock placement list for the boot payload (ADR-0023): App-default
	baseline ∪ role-scoped Site ⊕ User overrides, permission-gated. The frontend receives only this
	merged result and never sees the layers; its sole write path is its own User-layer overrides."""
	return merge_placements(APP_DEFAULT_PLACEMENTS, _site_placements(), _user_overrides(), ref_visible)


def _own_override(region, ref):
	"""The current user's existing OS Placement Override row for one (region, surface-reference)
	identity, or None — the upsert/delete target. Owner-scoped: a user only ever touches their own."""
	return frappe.db.get_value(
		"OS Placement Override", {"owner": frappe.session.user, "region": region, "surface_ref": ref}
	)


@frappe.whitelist(methods=["POST"])
def save_placement_override(region: str, surface_ref: str, position: str | None = None, hidden: int = 0):
	"""Upsert the current user's User-layer OS Placement Override for one (region, surface-reference)
	identity — the frontend's ONLY placement write path (ADR-0023). A move carries `position`, a
	personal hide sets `hidden`, a brand-new pin carries both a fresh reference and a position. Only
	the caller's own row is ever created/updated; baseline and Site rows are untouched. `surface_ref`
	and `position` arrive as JSON strings and are stored canonically so the identity match holds."""
	ref = canonical_json(surface_ref)
	existing = _own_override(region, ref)
	doc = upsert(
		"OS Placement Override",
		existing,
		{"region": region, "surface_ref": ref, "position": canonical_json(position), "hidden": int(hidden)},
	)
	return {"name": doc.name}


@frappe.whitelist(methods=["POST"])
def delete_placement_override(region: str, surface_ref: str):
	"""Clear the caller's own override delta for a (region, surface-reference) — e.g. un-hiding a pin
	or resetting a personal move back to the resolved baseline/Site position. No-op if none exists."""
	name = _own_override(region, canonical_json(surface_ref))
	if name:
		frappe.delete_doc("OS Placement Override", name)
	return {"deleted": bool(name)}
