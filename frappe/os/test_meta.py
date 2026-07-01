# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the live-meta manifest projection (ADR-0030). get_doctype_meta carries the
# doctype's `os/` manifest onto live meta via the reader, keyed by the doctype's module:
#   bench run-tests --module frappe.os.test_meta
# or standalone:  ./env/bin/python -m unittest frappe.os.test_meta

import unittest
import unittest.mock

from frappe.os import meta


class TestLiveMetaManifest(unittest.TestCase):
	def test_projects_reader_output_keyed_by_module(self):
		captured = {}

		def fake_reader(doctype, module):
			captured["args"] = (doctype, module)
			return {"list": {"columns": ["status"]}}

		reader = meta.manifest.doctype_manifest
		meta.manifest.doctype_manifest = fake_reader
		try:
			doctype_meta = unittest.mock.Mock(module="Desk")
			result = meta._live_meta_manifest("ToDo", doctype_meta)
			self.assertEqual(result, {"list": {"columns": ["status"]}})
			self.assertEqual(captured["args"], ("ToDo", "Desk"))
		finally:
			meta.manifest.doctype_manifest = reader


if __name__ == "__main__":
	unittest.main()
