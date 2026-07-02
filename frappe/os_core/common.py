# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Cross-cutting primitives shared across the Frappe OS server package (ADR-0030): readable-meta
# gating, surface-reference identity/visibility, and the layered-config row readers. Kept in one
# small module so registry / placements / recents don't reach into each other.

import json

import frappe
from frappe.os_core import manifest


def readable_meta(doctype):
	"""Meta for a doctype the user can read, or None if it is missing or forbidden."""
	if not frappe.db.exists("DocType", doctype):
		return None
	if not frappe.has_permission(doctype, "read"):
		return None
	return frappe.get_meta(doctype)


def ref_key(ref):
	"""Canonical identity key for a surface reference — the dedup/override target. A Placement's
	identity is (region, surface-reference) (ADR-0023); this folds the reference half into a stable
	string so two layers pinning the same destination collapse to one."""
	return json.dumps(ref, sort_keys=True)


def ref_visible(ref):
	"""May the viewer see the surface a reference points at (ADR-0010)? A doctype reference is
	gated by readable meta; every other shape (bare app / dashboard / applet) needs its owning app
	to be an installed OS app the viewer participates in. A redirect never grants access."""
	if not isinstance(ref, dict):
		return False
	if ref.get("doctype"):
		return readable_meta(ref["doctype"]) is not None
	app = ref.get("app")
	return bool(app) and app in manifest.installed_os_apps()


def layer_rows(doctype, fields, filters=None):
	"""This site's stored rows for a placement layer, or [] before the DocType is migrated (boot
	must never crash). Reading the config table itself is not sensitive — the genuine gate is the
	per-reference permission check in the resolver (ADR-0010) — so this reads with permissions off
	and the resolver applies role-scoping / visibility."""
	if not frappe.db.exists("DocType", doctype):
		return []
	return frappe.get_all(doctype, filters=filters or {}, fields=fields, ignore_permissions=True)


def canonical_json(value):
	"""A surface reference / position normalised to a stable canonical JSON string. Storing the
	reference canonically (sorted keys) is what lets an upsert find an existing override by exact
	match — the same identity key the resolver dedups on (ADR-0023)."""
	if value is None:
		return None
	return json.dumps(frappe.parse_json(value) if isinstance(value, str) else value, sort_keys=True)


def upsert(doctype, name, values):
	"""Get-or-create one doc, then persist it on the right path: load `name` when the caller's
	identity lookup found an existing row, else start a fresh doc; apply `values`; save an update or
	insert a create. The User-layer override writes (placements ADR-0023, indicators ADR-0031) and
	the Recents bump (ADR-0024) are all this shape — an upstream lookup decides identity, this does
	the write under standard permissions. Returns the saved doc."""
	doc = frappe.get_doc(doctype, name) if name else frappe.new_doc(doctype)
	doc.update(values)
	doc.save() if name else doc.insert()
	return doc
