# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

from frappe.model.document import Document


class OSPlacementOverride(Document):
	"""The User layer of a Placement (ADR-0023): an owner-scoped, one-row-per-delta override
	of the resolved desktop/dock. A row is a move (position), a personal hide (tombstone), or a
	brand-new user pin — a delta, never a frozen snapshot, so an admin's later baseline/Site
	change still flows through to a customised user. The only row the frontend ever writes."""

	pass
