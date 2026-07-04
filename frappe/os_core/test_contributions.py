# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the OS-manifest → Registry projection (ADR-0030). The projection reads an
# app's `os/` manifest (a JSON list, or a folder of files) and emits uniform contributions; here
# both the installed-app list and the manifest read are injected, so it runs with no site/DB:
#   bench run-tests --module frappe.os_core.test_contributions
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_contributions

import json
import os
import unittest
import unittest.mock

import frappe
from frappe.os_core import contributions


def _echo_project(spec, app):
	"""A trivial projector: identity as (type, region, command), payload the raw spec."""
	return "action", spec["region"], spec["command"], spec


class TestManifestContributions(unittest.TestCase):
	def setUp(self):
		self._apps = contributions._installed_os_apps
		self._read = contributions.manifest.read
		self._logger = frappe.logger
		contributions._installed_os_apps = lambda: ["erpnext"]
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()

	def tearDown(self):
		contributions._installed_os_apps = self._apps
		contributions.manifest.read = self._read
		frappe.logger = self._logger

	def _read_returns(self, value):
		contributions.manifest.read = lambda app, *segments: value

	def test_projects_each_spec_with_uniform_envelope(self):
		self._read_returns([{"command": "c1", "region": "r1"}, {"command": "c2", "region": "r2"}])
		out = contributions._manifest_contributions("actions.json", ("command", "region"), _echo_project)
		self.assertEqual([c["target"] for c in out], ["r1", "r2"])
		self.assertEqual([c["order"] for c in out], [0, 1])
		self.assertTrue(all(c["sourceApp"] == "erpnext" for c in out))

	def test_absent_manifest_yields_nothing(self):
		self._read_returns(None)
		self.assertEqual(contributions._manifest_contributions("actions.json", ("command",), _echo_project), [])

	def test_non_list_manifest_is_skipped(self):
		self._read_returns({"command": "c1", "region": "r1"})
		self.assertEqual(contributions._manifest_contributions("actions.json", ("command",), _echo_project), [])

	def test_invalid_spec_is_skipped(self):
		self._read_returns([{"region": "r1"}])  # missing required "command"
		self.assertEqual(contributions._manifest_contributions("actions.json", ("command",), _echo_project), [])


class TestManifestFolderContributions(unittest.TestCase):
	"""A folder-of-files scope (`os/applets/`): each file is one declaration; the same validate +
	project + envelope as the single-file list scope, read from a folder instead."""

	def setUp(self):
		self._apps = contributions._installed_os_apps
		self._entries = contributions.manifest.dir_entries
		self._logger = frappe.logger
		contributions._installed_os_apps = lambda: ["raven"]
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()

	def tearDown(self):
		contributions._installed_os_apps = self._apps
		contributions.manifest.dir_entries = self._entries
		frappe.logger = self._logger

	def test_projects_each_folder_entry(self):
		contributions.manifest.dir_entries = lambda app, *segments: [
			{"command": "c1", "region": "r1"},
			{"command": "c2", "region": "r2"},
		]
		out = contributions._manifest_folder_contributions("applets", ("command", "region"), _echo_project)
		self.assertEqual([c["target"] for c in out], ["r1", "r2"])
		self.assertTrue(all(c["sourceApp"] == "raven" for c in out))

	def test_empty_folder_yields_nothing(self):
		contributions.manifest.dir_entries = lambda app, *segments: []
		self.assertEqual(contributions._manifest_folder_contributions("applets", ("command",), _echo_project), [])


class TestCommandContributions(unittest.TestCase):
	"""App-level Commands load from the `os/commands.json` manifest (ADR-0030) — the App-tier twin
	of the doctype-scoped commands read off live meta. The installed-app list and the manifest read
	are injected, so it runs with no site/DB."""

	def setUp(self):
		self._apps = contributions._installed_os_apps
		self._read = contributions.manifest.read
		self._logger = frappe.logger
		contributions._installed_os_apps = lambda: ["erpnext"]
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()

	def tearDown(self):
		contributions._installed_os_apps = self._apps
		contributions.manifest.read = self._read
		frappe.logger = self._logger

	def test_projects_commands_json_into_the_client_command_shape(self):
		handler = {"kind": "run", "ref": "erpnext-new-invoice"}
		contributions.manifest.read = lambda app, *segments: [
			{"id": "erpnext.new-invoice", "title": "New Invoice", "handler": handler}
		]
		out = contributions.command_contributions()
		self.assertEqual(len(out), 1)
		self.assertEqual(out[0]["type"], "command")
		self.assertEqual(out[0]["name"], "erpnext.new-invoice")
		self.assertEqual(out[0]["sourceApp"], "erpnext")
		# Delivered unscoped — the verb is the same whoever places it (ADR-0007).
		self.assertNotIn("scope", out[0]["payload"])
		self.assertEqual(
			out[0]["payload"],
			{"id": "erpnext.new-invoice", "sourceApp": "erpnext", "title": "New Invoice", "handler": handler},
		)

	def test_reads_commands_json_by_that_filename(self):
		seen = []
		contributions.manifest.read = lambda app, *segments: seen.append(segments) or None
		contributions.command_contributions()
		self.assertEqual(seen, [("commands.json",)])

	def test_command_missing_a_required_key_is_skipped(self):
		contributions.manifest.read = lambda app, *segments: [{"id": "x", "title": "X"}]  # no handler
		self.assertEqual(contributions.command_contributions(), [])

	def test_absent_manifest_declares_no_commands(self):
		contributions.manifest.read = lambda app, *segments: None
		self.assertEqual(contributions.command_contributions(), [])


class TestMenuContributions(unittest.TestCase):
	"""App-declared menu-bar menus load from the `os/menus.json` manifest (ADR-0039 rule 2). Any app
	may declare a menu into another REAL app's bar (cross-app extension), so `target` defaults to the
	declaring app but may name another; a menu missing id/title is rejected. Injected app list +
	manifest read, so it runs with no site/DB."""

	def setUp(self):
		self._apps = contributions._installed_os_apps
		self._read = contributions.manifest.read
		self._logger = frappe.logger
		contributions._installed_os_apps = lambda: ["erpnext"]
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()

	def tearDown(self):
		contributions._installed_os_apps = self._apps
		contributions.manifest.read = self._read
		frappe.logger = self._logger

	def test_projects_menus_json_targeting_the_declaring_app_by_default(self):
		contributions.manifest.read = lambda app, *segments: [{"id": "reports", "title": "Reports", "order": 20}]
		out = contributions.menu_contributions()
		self.assertEqual(len(out), 1)
		self.assertEqual(out[0]["type"], "app-menu")
		self.assertEqual(out[0]["name"], "reports")
		self.assertEqual(out[0]["target"], "erpnext")  # defaults to the declaring app (the self case)
		self.assertEqual(out[0]["sourceApp"], "erpnext")
		self.assertEqual(out[0]["payload"], {"id": "reports", "title": "Reports", "order": 20})

	def test_an_explicit_target_declares_into_another_app_bar(self):
		contributions.manifest.read = lambda app, *segments: [{"id": "pricing", "title": "Pricing", "target": "shopify"}]
		out = contributions.menu_contributions()
		self.assertEqual(out[0]["target"], "shopify")  # cross-app: joins another app's bar
		self.assertEqual(out[0]["sourceApp"], "erpnext")  # authored by the declaring app
		self.assertEqual(out[0]["payload"]["order"], 0)  # order defaults to 0

	def test_reads_menus_json_by_that_filename(self):
		seen = []
		contributions.manifest.read = lambda app, *segments: seen.append(segments) or None
		contributions.menu_contributions()
		self.assertEqual(seen, [("menus.json",)])

	def test_menu_missing_a_required_key_is_skipped(self):
		contributions.manifest.read = lambda app, *segments: [{"id": "reports"}]  # no title
		self.assertEqual(contributions.menu_contributions(), [])

	def test_absent_manifest_declares_no_menus(self):
		contributions.manifest.read = lambda app, *segments: None
		self.assertEqual(contributions.menu_contributions(), [])


class TestScopeStamping(unittest.TestCase):
	"""Delivery-by-scope (ADR-0032): the projector stamps the Scope a manifest tier implies. An
	app's `os/actions.json` is App scope (boot); a doctype's `os/` manifest is Doctype/View scope
	(live meta). Both the installed-app list and the manifest reads are injected — no site/DB."""

	def setUp(self):
		self._apps = contributions._installed_os_apps
		self._read = contributions.manifest.read
		self._doctype_manifest = contributions.manifest.doctype_manifest
		self._app_of_module = contributions.manifest.app_of_module
		self._logger = frappe.logger
		contributions._installed_os_apps = lambda: ["erpnext"]
		contributions.manifest.app_of_module = lambda module: "erpnext"
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()

	def tearDown(self):
		contributions._installed_os_apps = self._apps
		contributions.manifest.read = self._read
		contributions.manifest.doctype_manifest = self._doctype_manifest
		contributions.manifest.app_of_module = self._app_of_module
		frappe.logger = self._logger

	def test_app_scope_stamped_on_actions_json(self):
		contributions.manifest.read = lambda app, *segments: [{"command": "c1", "region": "menubar:file"}]
		out = contributions.action_contributions()
		self.assertEqual(out[0]["payload"]["scope"], {"tier": "app", "app": "erpnext"})

	def test_doctype_scope_carries_to_all_views(self):
		contributions.manifest.doctype_manifest = lambda doctype, module: {
			"doctype": {"actions": [{"command": "c1", "region": "menubar:file"}]},
		}
		out = contributions.doctype_scoped_contributions("Sales Order", "Selling")
		self.assertEqual(out[0]["payload"]["scope"], {"tier": "doctype", "doctype": "Sales Order"})
		self.assertEqual(out[0]["sourceApp"], "erpnext")

	def test_view_scope_keys_on_the_view_file(self):
		contributions.manifest.doctype_manifest = lambda doctype, module: {
			"list": {"actions": [{"command": "set-open", "region": "list:selection"}]},
		}
		out = contributions.doctype_scoped_contributions("Sales Order", "Selling")
		self.assertEqual(out[0]["payload"]["scope"], {"tier": "view", "doctype": "Sales Order", "view": "list"})

	def test_manifest_command_is_delivered_unscoped_with_its_handler(self):
		handler = {"kind": "run", "ref": "so-set-open"}
		contributions.manifest.doctype_manifest = lambda doctype, module: {
			"list": {"commands": [{"id": "erpnext.so.set-open", "title": "Set as Open", "handler": handler}]},
		}
		out = contributions.doctype_scoped_contributions("Sales Order", "Selling")
		self.assertEqual(out[0]["type"], "command")
		self.assertNotIn("scope", out[0]["payload"])
		self.assertEqual(out[0]["payload"]["handler"], handler)

	def test_empty_doctype_manifest_yields_nothing(self):
		contributions.manifest.doctype_manifest = lambda doctype, module: {}
		self.assertEqual(contributions.doctype_scoped_contributions("Sales Order", "Selling"), [])


class TestTodoBulkTracer(unittest.TestCase):
	"""The ADR-0032 slice-04 tracer: ToDo's REAL `os/list.json` (read DB-free off frappe.__file__)
	declares the "Set as Open" bulk verb as data — one View-scoped Action into `list:selection` plus
	one unscoped run Command. Projecting it must yield exactly that, locking the manifest against a
	future edit that silently breaks the tracer."""

	def setUp(self):
		self._apps = contributions._installed_os_apps
		self._doctype_manifest = contributions.manifest.doctype_manifest
		self._app_of_module = contributions.manifest.app_of_module
		self._logger = frappe.logger
		contributions._installed_os_apps = lambda: ["frappe"]
		contributions.manifest.app_of_module = lambda module: "frappe"
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()
		# Read the real manifest file directly (no site/DB), and hand it to the projector as the
		# doctype's scoped manifest — the exact bytes shipped in the repo drive the assertion.
		manifest_path = os.path.join(os.path.dirname(frappe.__file__), "desk", "doctype", "todo", "os", "list.json")
		with open(manifest_path) as manifest_file:
			list_manifest = json.load(manifest_file)
		contributions.manifest.doctype_manifest = lambda doctype, module: {"list": list_manifest}

	def tearDown(self):
		contributions._installed_os_apps = self._apps
		contributions.manifest.doctype_manifest = self._doctype_manifest
		contributions.manifest.app_of_module = self._app_of_module
		frappe.logger = self._logger

	def test_todo_manifest_projects_the_bulk_verb_as_data(self):
		out = contributions.doctype_scoped_contributions("ToDo", "Desk")
		action = next(c for c in out if c["type"] == "action")
		command = next(c for c in out if c["type"] == "command")
		# The placement — View-scoped into the selection Region, no hand-written `when` (auto-derived).
		self.assertEqual(action["payload"]["region"], "list:selection")
		self.assertEqual(action["payload"]["scope"], {"tier": "view", "doctype": "ToDo", "view": "list"})
		self.assertNotIn("when", action["payload"])
		# The verb — delivered unscoped, carrying its lazily-resolved run Handler ref (ADR-0007).
		self.assertEqual(command["payload"]["handler"], {"kind": "run", "ref": "todo-set-open"})
		self.assertNotIn("scope", command["payload"])


if __name__ == "__main__":
	unittest.main()
