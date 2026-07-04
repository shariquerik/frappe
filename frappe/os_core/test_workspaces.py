# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for Workspaces (ADR-0042): the resolved boot view (visible rows grouped per app,
# ordered by sequence, hidden dropped), the seed base (one workspace per module-with-doctypes in the
# app's declared order), default resolution (manifest declares → seeder stamps, unknown warns and
# falls back, unset falls back to lowest sequence), and the insert-if-missing / stamp-once seeding
# guards (DB seams mocked, so no site):
#   bench run-tests --module frappe.os_core.test_workspaces
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_workspaces

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import workspaces


class TestWorkspacesView(unittest.TestCase):
	"""Stored rows → the boot payload: visible rows grouped per app, ordered by sequence, hidden
	rows dropped (ADR-0042). Pure — no site."""

	def test_groups_per_app_ordered_by_sequence(self):
		rows = [
			{"app": "erpnext", "workspace_id": "stock", "label": "Stock", "sequence": 1},
			{"app": "erpnext", "workspace_id": "selling", "label": "Selling", "sequence": 0},
			{"app": "crm", "workspace_id": "fcrm", "label": "FCRM", "sequence": 0},
		]
		out = workspaces.workspaces_view(rows)
		self.assertEqual([w["id"] for w in out["erpnext"]], ["selling", "stock"])
		self.assertEqual([w["id"] for w in out["crm"]], ["fcrm"])

	def test_hidden_rows_are_dropped(self):
		rows = [
			{"app": "erpnext", "workspace_id": "selling", "label": "Selling", "sequence": 0},
			{"app": "erpnext", "workspace_id": "stock", "label": "Stock", "sequence": 1, "hidden": 1},
		]
		out = workspaces.workspaces_view(rows)
		self.assertEqual([w["id"] for w in out["erpnext"]], ["selling"])

	def test_maps_id_label_and_default_flag(self):
		rows = [{"app": "crm", "workspace_id": "fcrm", "label": "Sales", "is_default": 1}]
		out = workspaces.workspaces_view(rows)
		self.assertEqual(out["crm"][0], {"id": "fcrm", "label": "Sales", "isDefault": True})


class TestAppModules(unittest.TestCase):
	"""The seed base — the app's modules that hold doctypes, in modules.txt order (ADR-0042). A
	module with no doctypes is excluded, so a single-module app seeds one workspace."""

	def test_keeps_declared_order_and_drops_empty_modules(self):
		with mock.patch.object(workspaces.frappe, "get_module_list", return_value=["Selling", "Empty", "Stock"]), \
			mock.patch.object(workspaces.frappe, "get_all", return_value=["Stock", "Selling"]):
			out = workspaces._app_modules("erpnext")
		self.assertEqual(out, ["Selling", "Stock"])

	def test_single_module_app_yields_one(self):
		with mock.patch.object(workspaces.frappe, "get_module_list", return_value=["FCRM"]), \
			mock.patch.object(workspaces.frappe, "get_all", return_value=["FCRM"]):
			self.assertEqual(workspaces._app_modules("crm"), ["FCRM"])


class TestResolveDefaultModule(unittest.TestCase):
	"""The default workspace: the manifest's declared module when seeded, else lowest sequence;
	an unknown declared module warns then falls back like unset (ADR-0042)."""

	def test_declared_module_wins(self):
		self.assertEqual(
			workspaces._resolve_default_module("erpnext", "Stock", ["Selling", "Stock"]), "Stock"
		)

	def test_unset_falls_back_to_lowest_sequence(self):
		self.assertEqual(
			workspaces._resolve_default_module("erpnext", None, ["Selling", "Stock"]), "Selling"
		)

	def test_unknown_module_warns_and_falls_back(self):
		with mock.patch.object(workspaces.frappe, "logger") as logger:
			out = workspaces._resolve_default_module("erpnext", "Ghost", ["Selling", "Stock"])
		self.assertEqual(out, "Selling")
		logger.return_value.warning.assert_called_once()

	def test_no_modules_yields_none(self):
		self.assertIsNone(workspaces._resolve_default_module("blank", None, []))


class TestSeedWorkspace(unittest.TestCase):
	"""Insert-if-missing on (app, module): an existing row is never touched, so user edits survive
	migrate; a missing one is inserted with the slugified module as its immutable id (ADR-0042)."""

	def test_skips_an_existing_row(self):
		db = mock.Mock(exists=mock.Mock(return_value="ws-hash"))
		with mock.patch.object(workspaces.frappe, "db", db), \
			mock.patch.object(workspaces.frappe, "get_doc") as get_doc:
			workspaces._seed_workspace("erpnext", "Selling", 0)
		get_doc.assert_not_called()

	def test_inserts_a_missing_row_with_slugified_id(self):
		doc = mock.Mock()
		db = mock.Mock(exists=mock.Mock(return_value=None))
		with mock.patch.object(workspaces.frappe, "db", db), \
			mock.patch.object(workspaces.frappe, "scrub", return_value="stock_entry"), \
			mock.patch.object(workspaces.frappe, "get_doc", return_value=doc) as get_doc:
			workspaces._seed_workspace("erpnext", "Stock Entry", 3)
		values = get_doc.call_args.args[0]
		self.assertEqual(values["workspace_id"], "stock_entry")
		self.assertEqual((values["app"], values["module"], values["sequence"]), ("erpnext", "Stock Entry", 3))
		doc.insert.assert_called_once()


class TestStampDefault(unittest.TestCase):
	"""Stamp is_default once: the first seed sets it; a later migrate never overrides a site's
	re-point, and a null target is a no-op (ADR-0042)."""

	def test_stamps_when_none_set_yet(self):
		db = mock.Mock(exists=mock.Mock(return_value=None), get_value=mock.Mock(return_value="ws-selling"))
		with mock.patch.object(workspaces.frappe, "db", db):
			workspaces._stamp_default("erpnext", "Selling")
		db.set_value.assert_called_once_with("OS Workspace", "ws-selling", "is_default", 1)

	def test_no_op_when_a_default_already_stamped(self):
		db = mock.Mock(exists=mock.Mock(return_value="ws-existing"))
		with mock.patch.object(workspaces.frappe, "db", db):
			workspaces._stamp_default("erpnext", "Selling")
		db.set_value.assert_not_called()

	def test_no_op_when_target_is_none(self):
		db = mock.Mock()
		with mock.patch.object(workspaces.frappe, "db", db):
			workspaces._stamp_default("blank", None)
		db.set_value.assert_not_called()


class TestWorkbenchDoctypes(unittest.TestCase):
	"""The workbench sidebar's derived doctypes (ADR-0042): a module's doctypes with child tables
	and settings singles excluded, order preserved. Pure — no site."""

	def test_excludes_child_tables_and_settings_singles(self):
		rows = [
			{"name": "Sales Order", "istable": 0, "issingle": 0},
			{"name": "Sales Order Item", "istable": 1, "issingle": 0},
			{"name": "Selling Settings", "istable": 0, "issingle": 1},
			{"name": "Quotation", "istable": 0, "issingle": 0},
		]
		self.assertEqual(workspaces.workbench_doctypes(rows), ["Sales Order", "Quotation"])

	def test_preserves_input_order(self):
		rows = [
			{"name": "Quotation", "istable": 0, "issingle": 0},
			{"name": "Customer", "istable": 0, "issingle": 0},
		]
		self.assertEqual(workspaces.workbench_doctypes(rows), ["Quotation", "Customer"])

	def test_empty_when_all_excluded(self):
		rows = [{"name": "Sales Order Item", "istable": 1, "issingle": 0}]
		self.assertEqual(workspaces.workbench_doctypes(rows), [])


class TestGetWorkspaceDoctypes(unittest.TestCase):
	"""The whitelisted workbench endpoint (ADR-0042): resolve the workspace's source module, derive
	its doctypes, permission-filter. A user-added workspace (no module) or an unknown key is empty."""

	def test_empty_when_no_source_module(self):
		db = mock.Mock(get_value=mock.Mock(return_value=None))
		with mock.patch.object(workspaces.frappe, "db", db):
			self.assertEqual(workspaces.get_workspace_doctypes("crm", "user-added"), [])

	def test_derives_and_permission_filters(self):
		db = mock.Mock(get_value=mock.Mock(return_value="Selling"))
		rows = [
			{"name": "Sales Order", "istable": 0, "issingle": 0},
			{"name": "Sales Order Item", "istable": 1, "issingle": 0},
			{"name": "Quotation", "istable": 0, "issingle": 0},
		]
		with mock.patch.object(workspaces.frappe, "db", db), \
			mock.patch.object(workspaces.frappe, "get_all", return_value=rows), \
			mock.patch.object(workspaces.frappe, "has_permission", side_effect=lambda dt, p: dt != "Quotation"):
			out = workspaces.get_workspace_doctypes("erpnext", "selling")
		self.assertEqual(out, ["Sales Order"])


if __name__ == "__main__":
	unittest.main()
