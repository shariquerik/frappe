# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the live-meta manifest projection (ADR-0030). get_doctype_meta carries the
# doctype's `os/` manifest onto live meta via the reader, keyed by the doctype's module:
#   bench run-tests --module frappe.oscore.test_meta
# or standalone:  ./env/bin/python -m unittest frappe.oscore.test_meta

import unittest
import unittest.mock

import frappe
from frappe.oscore import meta


class TestCardValue(unittest.TestCase):
	"""card_value must sum via the dict field form — Frappe rejects raw "sum(...)" strings in
	`fields` as a SQL-injection guard (regression: the 417 the dashboard cards hit)."""

	def test_sum_uses_dict_field_form(self):
		captured = {}

		def fake_get_list(doctype, filters=None, fields=None):
			captured["fields"] = fields
			return [frappe._dict(total=42)]

		with (
			unittest.mock.patch.object(frappe, "has_permission", return_value=True),
			unittest.mock.patch.object(frappe, "get_list", fake_get_list),
		):
			result = meta.card_value("CRM Deal", fieldname="annual_revenue")

		self.assertEqual(result, 42)
		self.assertEqual(captured["fields"], [{"SUM": "annual_revenue", "as": "total"}])


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
