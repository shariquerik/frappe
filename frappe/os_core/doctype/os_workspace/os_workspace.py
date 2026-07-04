# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

import frappe
from frappe import _
from frappe.model.document import Document


class OSWorkspace(Document):
	"""One workspace of an OS app — the workbench a window opens onto (ADR-0042). The window's
	identity is (app, workspace_id): the app owns the dock, the workspace owns the window. Seeded
	one-per-module from the data Frappe already has (insert-if-missing on (app, module), so user
	renames/re-orders survive migrate), plus user-added rows carrying no module. `workspace_id` is
	the immutable identity slug — unique per app — while `label` is the freely renamable display
	name; the split is what lets a rename leave open windows, saved URLs, and menu gates intact."""

	def validate(self):
		self._require_unique_workspace_id()

	def _require_unique_workspace_id(self):
		"""The identity slug is unique per app (ADR-0042) — it keys window ids, URLs, and `when`
		gates, so a clash would make two workspaces the same window. Uniqueness is per app, not
		global: two apps may each have a `selling`."""
		clash = frappe.db.get_value(
			"OS Workspace",
			{"app": self.app, "workspace_id": self.workspace_id, "name": ["!=", self.name or ""]},
		)
		if clash:
			frappe.throw(
				_("Workspace id {0} already exists for app {1}").format(self.workspace_id, self.app),
				frappe.DuplicateEntryError,
			)
