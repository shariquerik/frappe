# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

from frappe.model.document import Document


class OSIndicatorRuleOverride(Document):
	"""The User layer of a Record indicator (ADR-0031): an owner-scoped, one-row-per-delta override
	of a doctype's indicator rules. A row recolors/relabels a rule (addressed by its condition),
	hides one (tombstone), or adds the user's own rule — layered above the Site. A delta, never a
	frozen snapshot, so a later app/Site change still flows through. The only indicator row the
	frontend ever writes."""

	pass
