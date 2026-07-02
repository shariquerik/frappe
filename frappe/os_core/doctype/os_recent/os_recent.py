# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

from frappe.model.document import Document


class OSRecent(Document):
	"""A per-user, owner-scoped log of recently opened surfaces (ADR-0024): one row per
	reference, its timestamp bumped on re-open, the set trimmed to the newest by the server.
	The OS owns the definition of "recent" (record opens only, dedup + cap) rather than
	projecting Desk's route log. It roams like Placements; the client only records an open
	and reads the resolved list (frappe/www/os.py)."""

	pass
