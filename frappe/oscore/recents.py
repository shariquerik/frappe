# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Recents (ADR-0024): a per-user, server-side log of record opens — a surface reference + timestamp.
# The OS owns the definition of "recent" (record opens only, deduped by reference, capped) rather
# than projecting Desk's route log. One row per reference (a re-open bumps its timestamp), so there
# is no whole-blob rewrite per open; it roams like Placements. The client only records an open and
# reads this list.

import frappe

from frappe.oscore.common import canonical_json, layer_rows, ref_key, ref_visible, upsert

RECENTS_CAP = 50


def recents_view(refs, can_see, cap=RECENTS_CAP):
	"""Pure: a newest-first list of references → the resolved Recents view (ADR-0024) — deduped by
	reference (newest wins), permission-gated (the injected `can_see(ref) -> bool`, ADR-0010), and
	capped at `cap`. Writes already keep one row per reference, but re-deduping on read keeps the
	projection honest, and the cap is the trim guarantee. Testable with no site, like merge_placements."""
	seen, out = set(), []
	for ref in refs:
		key = ref_key(ref)
		if key in seen or not can_see(ref):
			continue
		seen.add(key)
		out.append({"ref": ref})
		if len(out) >= cap:
			break
	return out


def get_recents():
	"""The caller's recent record-opens for the boot payload (ADR-0024): their own OS Recent rows,
	newest-first, deduped + permission-gated + capped. Tolerant like get_placements — before the
	DocType is migrated `layer_rows` returns [], so boot never crashes."""
	rows = layer_rows("OS Recent", ["surface_ref", "opened_at"], filters={"owner": frappe.session.user})
	rows = sorted(rows, key=lambda row: row.opened_at or "", reverse=True)
	return recents_view([frappe.parse_json(row.surface_ref) for row in rows], ref_visible)


@frappe.whitelist(methods=["POST"])
def record_recent(surface_ref: str):
	"""Record a record-open into the caller's owner-scoped Recents log (ADR-0024): bump the existing
	row for this reference or insert one, then trim to the RECENTS_CAP newest. The client writes only
	record opens, debounced; the server is the trim guarantee. `surface_ref` arrives as a JSON string
	and is stored canonically so a re-open finds its existing row by exact match."""
	ref = canonical_json(surface_ref)
	existing = frappe.db.get_value("OS Recent", {"owner": frappe.session.user, "surface_ref": ref})
	doc = upsert("OS Recent", existing, {"surface_ref": ref, "opened_at": frappe.utils.now()})
	_trim_recents()
	return {"name": doc.name}


def _trim_recents():
	"""Keep only the caller's RECENTS_CAP newest recents — the server-side trim guarantee (ADR-0024)."""
	stale = frappe.get_all(
		"OS Recent",
		filters={"owner": frappe.session.user},
		fields=["name"],
		order_by="opened_at desc",
		pluck="name",
	)[RECENTS_CAP:]
	for name in stale:
		frappe.delete_doc("OS Recent", name, ignore_permissions=True)
