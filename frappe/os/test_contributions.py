# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the OS-manifest → Registry projection (ADR-0030). The projection reads an
# app's `os/` manifest (a JSON list, or a folder of files) and emits uniform contributions; here
# both the installed-app list and the manifest read are injected, so it runs with no site/DB:
#   bench run-tests --module frappe.os.test_contributions
# or standalone:  ./env/bin/python -m unittest frappe.os.test_contributions

import unittest
import unittest.mock

import frappe
from frappe.os import contributions


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


if __name__ == "__main__":
	unittest.main()
