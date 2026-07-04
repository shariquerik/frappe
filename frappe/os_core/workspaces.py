# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Workspaces (ADR-0042): a workspace is a window, not a surface coordinate. Each OS app's `OS
# Workspace` rows are the workbenches its hub lists (erpnext → Selling, Stock, Accounts…); opening
# one opens its own window. The site-layer rows are seeded one-per-module from the data Frappe
# already has — `after_migrate`, insert-if-missing on (app, module), so a user's renames, re-orders,
# and hides all survive every migrate (the seeder never updates or deletes). The default workspace
# the hub opens onto is declared in `os/app.json` and stamped into `is_default` at seed time, so a
# site can re-point it without forking the app's manifest. Boot delivers the ordered visible list
# per app. The merge is a pure function (`workspaces_view`) so it is testable with no site, and it
# is the seam the future per-user `OS Workspace Override` layer folds into (placements precedent).

import frappe
from frappe.os_core import manifest
from frappe.os_core.common import layer_rows

WORKSPACE_FIELDS = ["app", "workspace_id", "label", "module", "sequence", "hidden", "is_default"]


def workspace_dict(row):
	"""One stored row → the client workspace shape (identity + label + default flag). `id` is the
	immutable `workspace_id` the window identity, URLs, and `when` gates key on; `label` is the
	renamable display name."""
	return {
		"id": row.get("workspace_id"),
		"label": row.get("label"),
		"isDefault": bool(row.get("is_default")),
	}


def workspaces_view(rows):
	"""Pure: stored rows → the resolved boot payload — visible workspaces grouped per app, each
	group ordered by sequence (ADR-0042). Hidden rows are dropped. Pure so it is testable with no
	site, and the seam the per-user override layer will fold into (placements precedent)."""
	grouped = {}
	for row in sorted(rows, key=lambda r: (r.get("app") or "", r.get("sequence") or 0)):
		if row.get("hidden"):
			continue
		grouped.setdefault(row.get("app"), []).append(workspace_dict(row))
	return grouped


def get_workspaces():
	"""The per-app visible workspace lists for the boot payload (ADR-0042). Tolerant like
	get_placements — before the DocType is migrated `layer_rows` returns [], so boot never crashes."""
	return workspaces_view(layer_rows("OS Workspace", WORKSPACE_FIELDS))


def _app_modules(app):
	"""The app's modules that actually hold doctypes, in the app's declared (modules.txt) order —
	the seed base per ADR-0042 ('one workspace per DocType.module'). A module with no doctypes gets
	no workspace, so a single-module app (crm) seeds one workspace and a suite (erpnext) many."""
	ordered = frappe.get_module_list(app)
	with_doctypes = set(frappe.get_all("DocType", filters={"module": ["in", ordered]}, pluck="module", distinct=True))
	return [module for module in ordered if module in with_doctypes]


def _resolve_default_module(app, declared, modules):
	"""The module whose workspace should be the app's default (ADR-0042): the manifest's
	`default_workspace` when it names a seeded module, else the lowest-sequence module as fallback.
	A declared-but-unknown module is skipped with a warning, then falls back like an unset one."""
	if declared and declared in modules:
		return declared
	if declared:
		frappe.logger("frappe_os").warning(
			f"OS Workspace: default_workspace '{declared}' for {app} is not a seeded module; falling back"
		)
	return modules[0] if modules else None


def seed_workspaces():
	"""Idempotently seed each OS app's workspaces (after_migrate, ADR-0042): one row per module the
	app owns, keyed (app, module), inserted only when missing — a user's renames, re-orders, and
	hides all survive, and a module added later gains its workspace on the next migrate. Then stamp
	the app's default from `os/app.json`'s `default_workspace` (or the lowest-sequence module),
	unless a default is already stamped — so a site's re-point is never overridden."""
	for app in manifest.installed_os_apps():
		modules = _app_modules(app)
		for sequence, module in enumerate(modules):
			_seed_workspace(app, module, sequence)
		declared = (manifest.app_declaration(app) or {}).get("default_workspace")
		_stamp_default(app, _resolve_default_module(app, declared, modules))


def _seed_workspace(app, module, sequence):
	"""Insert one seeded workspace when its (app, module) key is missing; never touch an existing
	row (ADR-0042). `workspace_id` is the module name slugified — unique per app since modules are."""
	if frappe.db.exists("OS Workspace", {"app": app, "module": module}):
		return
	frappe.get_doc(
		{
			"doctype": "OS Workspace",
			"app": app,
			"module": module,
			"workspace_id": frappe.scrub(module),
			"label": module,
			"sequence": sequence,
		}
	).insert(ignore_permissions=True)


def _stamp_default(app, module):
	"""Stamp `is_default` on the app's default workspace row (ADR-0042). No-op when the app already
	has a default stamped — the first seed sets it and a later site re-point survives every migrate."""
	if not module or frappe.db.exists("OS Workspace", {"app": app, "is_default": 1}):
		return
	name = frappe.db.get_value("OS Workspace", {"app": app, "module": module})
	if name:
		frappe.db.set_value("OS Workspace", name, "is_default", 1)
