# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the Command Palette record-search seam:
#   bench run-tests --module frappe.os_core.test_search
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_search

import unittest
import unittest.mock

import frappe
from frappe.os_core import search


class TestSearchView(unittest.TestCase):
	def test_projects_reference_and_title_only(self):
		rows = [frappe._dict(doctype="ToDo", name="td-1", title="Ship the demo", content="x", rank=1.2)]
		self.assertEqual(
			search.search_view(rows),
			[{"doctype": "ToDo", "name": "td-1", "title": "Ship the demo"}],
		)

	def test_title_falls_back_to_name(self):
		for title in (None, "", "   "):
			rows = [frappe._dict(doctype="ToDo", name="td-2", title=title)]
			self.assertEqual(search.search_view(rows)[0]["title"], "td-2")

	def test_empty_rows(self):
		self.assertEqual(search.search_view([]), [])


class TestMatchDoctypes(unittest.TestCase):
	def test_earliest_match_ranks_first_then_alphabetical(self):
		can_read = ["Sales Invoice", "Invoice Discounting", "Purchase Invoice", "ToDo"]
		self.assertEqual(
			search.match_doctypes("invoice", can_read, 10),
			["Invoice Discounting", "Sales Invoice", "Purchase Invoice"],
		)

	def test_case_insensitive_and_capped(self):
		can_read = ["ToDo", "Todo Settings", "Task"]
		self.assertEqual(search.match_doctypes("todo", can_read, 1), ["ToDo"])

	def test_never_surfaces_outside_the_permission_set(self):
		self.assertEqual(search.match_doctypes("user", [], 10), [])


class TestSearchRecords(unittest.TestCase):
	def test_blank_text_never_queries(self):
		with unittest.mock.patch("frappe.utils.global_search.search") as engine:
			self.assertEqual(search.search_records(""), [])
			self.assertEqual(search.search_records("   "), [])
		engine.assert_not_called()

	def test_limit_is_clamped(self):
		captured = {}

		def fake_search(text, limit=20):
			captured["limit"] = limit
			return []

		with unittest.mock.patch("frappe.utils.global_search.search", fake_search):
			search.search_records("demo", limit=999)
			self.assertEqual(captured["limit"], search.RESULT_LIMIT_MAX)
			search.search_records("demo", limit="0")
			self.assertEqual(captured["limit"], search.PALETTE_RESULT_CAP)
