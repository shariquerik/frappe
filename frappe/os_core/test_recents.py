# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for Recents (ADR-0024): the newest-first dedup/gate/cap view (injected
# permission gate, no site) and the whitelisted write path's owner-scoping (DB seams mocked):
#   bench run-tests --module frappe.os_core.test_recents
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_recents

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import recents


def always(ref):
	return True


class TestRecentsView(unittest.TestCase):
	"""Newest-first refs → the resolved view: deduped by reference (newest wins), permission-gated,
	capped (ADR-0024). Pure — testable with no site."""

	def test_dedupes_by_reference_newest_wins(self):
		refs = [
			{"doctype": "ToDo", "name": "a"},
			{"doctype": "ToDo", "name": "a"},
			{"doctype": "ToDo", "name": "b"},
		]
		self.assertEqual(
			recents.recents_view(refs, always),
			[{"ref": {"doctype": "ToDo", "name": "a"}}, {"ref": {"doctype": "ToDo", "name": "b"}}],
		)

	def test_permission_gate_drops_invisible_references(self):
		refs = [{"doctype": "Secret", "name": "x"}, {"doctype": "ToDo", "name": "y"}]
		out = recents.recents_view(refs, lambda ref: ref["doctype"] != "Secret")
		self.assertEqual(out, [{"ref": {"doctype": "ToDo", "name": "y"}}])

	def test_capped_at_cap(self):
		refs = [{"doctype": "ToDo", "name": str(i)} for i in range(10)]
		self.assertEqual(len(recents.recents_view(refs, always, cap=3)), 3)


class TestRecordRecent(unittest.TestCase):
	"""record_recent bumps or inserts the caller's OWN row for a reference, then trims (ADR-0024).
	DB seams stubbed."""

	def test_bumps_the_callers_own_row_and_trims(self):
		doc = mock.Mock()
		doc.name = "rec-1"
		db = mock.Mock()
		db.get_value.return_value = None
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch("frappe.utils.now", return_value="2026-07-04 00:00:00"), \
			mock.patch.object(frappe, "db", db), \
			mock.patch.object(recents, "upsert", return_value=doc) as upsert, \
			mock.patch.object(recents, "_trim_recents") as trim:
			result = recents.record_recent('{"doctype":"ToDo","name":"a"}')
		# Owner-scoped identity lookup on the canonicalised reference.
		db.get_value.assert_called_once_with(
			"OS Recent", {"owner": "alice@example.com", "surface_ref": '{"doctype": "ToDo", "name": "a"}'}
		)
		self.assertEqual(upsert.call_args.args[2]["surface_ref"], '{"doctype": "ToDo", "name": "a"}')
		trim.assert_called_once()
		self.assertEqual(result, {"name": "rec-1"})

	def test_trim_is_owner_scoped(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(recents.frappe, "get_all", return_value=[]) as get_all, \
			mock.patch.object(recents.frappe, "delete_doc") as delete_doc:
			recents._trim_recents()
		self.assertEqual(get_all.call_args.kwargs["filters"], {"owner": "alice@example.com"})
		delete_doc.assert_not_called()


if __name__ == "__main__":
	unittest.main()
