# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the OS-manifest reader (ADR-0030). The reader is data-only — it parses
# an app's co-located `os/` folder and never executes it — so these run with no site/DB:
#   bench run-tests --module frappe.oscore.test_manifest
# or standalone:  ./env/bin/python -m unittest frappe.oscore.test_manifest

import tempfile
import unittest
import unittest.mock
from pathlib import Path

from frappe.oscore import manifest


class TestReadJson(unittest.TestCase):
	"""The pure parse primitive: a JSON file → data, or None when missing/malformed."""

	def _write(self, directory, name, text):
		path = Path(directory) / name
		path.write_text(text)
		return str(path)

	def test_parses_a_valid_json_object(self):
		with tempfile.TemporaryDirectory() as directory:
			path = self._write(directory, "app.json", '{"title": "CRM"}')
			self.assertEqual(manifest._read_json(path), {"title": "CRM"})

	def test_missing_file_is_none(self):
		self.assertIsNone(manifest._read_json("/no/such/os/app.json"))

	def test_malformed_json_is_none(self):
		import frappe

		logger = frappe.logger
		frappe.logger = lambda *args, **kwargs: unittest.mock.Mock()
		try:
			with tempfile.TemporaryDirectory() as directory:
				path = self._write(directory, "app.json", "{ not json")
				self.assertIsNone(manifest._read_json(path))
		finally:
			frappe.logger = logger


class TestAppDeclaration(unittest.TestCase):
	"""`app.json` must be a dict to count; a non-dict payload is treated as no manifest."""

	def test_non_dict_declaration_is_none(self):
		manifest_read = manifest.read
		manifest.read = lambda app, *segments: ["not", "a", "dict"]
		try:
			self.assertIsNone(manifest.app_declaration("erpnext"))
		finally:
			manifest.read = manifest_read

	def test_dict_declaration_passes_through(self):
		manifest_read = manifest.read
		manifest.read = lambda app, *segments: {"title": "ERPNext"}
		try:
			self.assertEqual(manifest.app_declaration("erpnext"), {"title": "ERPNext"})
		finally:
			manifest.read = manifest_read


class TestReadDir(unittest.TestCase):
	"""A folder-of-files scope (`os/applets/`): each `*.json` file is one declaration, read as
	data, returned sorted by filename for stable order. Missing folder → []."""

	def test_missing_folder_is_empty(self):
		self.assertEqual(manifest._read_dir("/no/such/os/applets"), [])

	def test_reads_json_dicts_sorted_by_filename(self):
		with tempfile.TemporaryDirectory() as directory:
			(Path(directory) / "chat.json").write_text('{"appletId": "chat"}')
			(Path(directory) / "hello.json").write_text('{"appletId": "hello"}')
			self.assertEqual(
				manifest._read_dir(directory),
				[{"appletId": "chat"}, {"appletId": "hello"}],
			)

	def test_ignores_non_json_and_non_dict_files(self):
		with tempfile.TemporaryDirectory() as directory:
			(Path(directory) / "chat.json").write_text('{"appletId": "chat"}')
			(Path(directory) / "notes.txt").write_text("ignore me")
			(Path(directory) / "list.json").write_text('["not", "a", "dict"]')
			self.assertEqual(manifest._read_dir(directory), [{"appletId": "chat"}])


class TestReadScopes(unittest.TestCase):
	"""The doctype-scope manifest (ADR-0030): one file per scope, config-types as keys inside.
	`_read_scopes` reads `<scope>.json` for each scope into a scope-keyed dict."""

	def test_reads_present_scopes_into_scope_keyed_dict(self):
		with tempfile.TemporaryDirectory() as directory:
			(Path(directory) / "doctype.json").write_text('{"indicator": "x"}')
			(Path(directory) / "list.json").write_text('{"columns": ["status"]}')
			(Path(directory) / "form.json").write_text('{"actions": []}')
			self.assertEqual(
				manifest._read_scopes(directory, ("doctype", "list", "form")),
				{"doctype": {"indicator": "x"}, "list": {"columns": ["status"]}, "form": {"actions": []}},
			)

	def test_omits_absent_scopes(self):
		with tempfile.TemporaryDirectory() as directory:
			(Path(directory) / "list.json").write_text('{"columns": ["status"]}')
			self.assertEqual(
				manifest._read_scopes(directory, ("doctype", "list", "form")),
				{"list": {"columns": ["status"]}},
			)

	def test_missing_folder_is_empty(self):
		self.assertEqual(manifest._read_scopes("/no/such/doctype/os", ("doctype", "list", "form")), {})


class TestDoctypeManifest(unittest.TestCase):
	"""A doctype carries its own `os/` folder under `<module>/doctype/<doctype>/os/`."""

	def test_reads_folder_via_module_path(self):
		import frappe

		with tempfile.TemporaryDirectory() as directory:
			(Path(directory) / "list.json").write_text('{"columns": ["status"]}')
			module_path = frappe.get_module_path
			frappe.get_module_path = lambda *segments: directory
			try:
				self.assertEqual(manifest.doctype_manifest("ToDo", "Desk"), {"list": {"columns": ["status"]}})
			finally:
				frappe.get_module_path = module_path

	def test_shipped_todo_tracer_is_discovered(self):
		import frappe

		# The shipped tracer (ADR-0030): ToDo declares a doctype-scope manifest, discovered by
		# convention from its co-located os/ folder — no site or registration needed to read it.
		os_dir = frappe.get_app_path("frappe", "desk", "doctype", "todo", "os")
		read = manifest._read_scopes(os_dir, manifest.DOCTYPE_MANIFEST_SCOPES)
		self.assertIn("list", read)
		self.assertIn("columns", read["list"])


class TestInstalledOsApps(unittest.TestCase):
	"""Opt-in is the folder: only installed apps that ship `os/app.json` are OS apps."""

	def test_filters_to_apps_that_ship_app_json(self):
		import frappe

		installed = frappe.get_installed_apps
		declaration = manifest.app_declaration
		frappe.get_installed_apps = lambda: ["frappe", "payments", "erpnext"]
		manifest.app_declaration = lambda app: {"title": app} if app != "payments" else None
		try:
			self.assertEqual(manifest.installed_os_apps(), ["frappe", "erpnext"])
		finally:
			frappe.get_installed_apps = installed
			manifest.app_declaration = declaration


if __name__ == "__main__":
	unittest.main()
