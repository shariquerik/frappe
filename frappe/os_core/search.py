# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Live record search for the Command Palette: a thin OS seam over Frappe's global-search
# index (`__global_search`). The engine already permission-gates results (Global Search
# Settings doctypes ∩ the caller's can-read set, plus a per-doc has_permission check); this
# module only bounds the request and projects rows to what a palette row needs — a record
# reference plus a display title.

import frappe
from frappe.utils import cint

PALETTE_RESULT_CAP = 8
RESULT_LIMIT_MAX = 20


def search_view(rows):
	"""Pure: raw global-search rows → palette record hits. Title prefers the indexed
	title_field value, falling back to the record name; index-internal columns (content,
	rank, route) never leave the server. Testable with no site."""
	hits = []
	for row in rows:
		title = (row.get("title") or "").strip() or row.get("name")
		hits.append({"doctype": row.get("doctype"), "name": row.get("name"), "title": title})
	return hits


def match_doctypes(text, can_read, limit):
	"""Pure: case-insensitive substring match of `text` over the caller's readable doctype
	names, earliest-match-then-alphabetical, capped. Runs over the permission set directly —
	no query, and nothing the user can't read ever surfaces. Testable with no site."""
	needle = text.lower()
	scored = []
	for name in can_read:
		position = name.lower().find(needle)
		if position >= 0:
			scored.append((position, name))
	return [name for _, name in sorted(scored)[:limit]]


@frappe.whitelist()
def search_doctypes(text: str, limit: int = PALETTE_RESULT_CAP):
	"""Doctype-name search for the Command Palette: ANY doctype the caller can read — not
	just the curated OS apps' — so every list on the site is one ⌘K away. The OS opens an
	unknown doctype's list through the on-demand resolver, under the frappe app."""
	text = (text or "").strip()
	if not text:
		return []
	limit = min(max(cint(limit) or PALETTE_RESULT_CAP, 1), RESULT_LIMIT_MAX)
	return match_doctypes(text, frappe.get_user().get_can_read(), limit)


@frappe.whitelist()
def search_records(text: str, limit: int = PALETTE_RESULT_CAP):
	"""Search records for the Command Palette. Empty/blank text returns [] rather than
	querying; the limit is clamped so a client can't request an unbounded page."""
	text = (text or "").strip()
	if not text:
		return []
	from frappe.utils.global_search import search

	limit = min(max(cint(limit) or PALETTE_RESULT_CAP, 1), RESULT_LIMIT_MAX)
	return search_view(search(text, limit=limit))
