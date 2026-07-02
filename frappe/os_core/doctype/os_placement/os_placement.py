# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

from frappe.model.document import Document


class OSPlacement(Document):
	"""The Site layer of a Placement (ADR-0023): an admin-managed, role-scoped pin of a
	surface reference into the desktop or dock. Per-layer DocTypes keep the permission shape
	structural — this one is System-Manager-managed, while the User layer (OS Placement
	Override) is owner-scoped. The server resolver (frappe/www/os.py) folds these under the
	App-default baseline and over the User overrides."""

	pass
