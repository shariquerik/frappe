# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

from frappe.model.document import Document


class OSWallpaper(Document):
	"""A desktop wallpaper — an image or a CSS gradient (ADR-0036). Two scopes share one table: a
	shipped `is_global` default available to every user (seeded, owned by Administrator), and a
	user's own private upload (owner-scoped). The catalog resolver unions global ∪ own for boot; the
	selected wallpaper roams per-user in frappe.defaults, not on the row. The upload path forces
	`is_global` off, so only seeding/admins mint global rows."""

	pass
