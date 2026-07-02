# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

from frappe.model.document import Document


class OSIndicatorRule(Document):
	"""The Site layer of a Record indicator (ADR-0031): a site-supplied indicator rule for a
	doctype, in the same {condition, label, color} format as the app's shipped rules. Layered over
	the app and OS-default rules and addressed by its condition — a matching condition replaces that
	rule, a new one adds, `hidden` drops it. A delta, never a frozen snapshot, so an app upgrade
	still flows through."""

	pass
