# Copyright (c) 2023, Frappe Technologies and Contributors
# See LICENSE

import time
from unittest.mock import patch

import frappe
from frappe.core.doctype.doctype.test_doctype import new_doctype
from frappe.desk.doctype.bulk_update.bulk_update import submit_cancel_or_update_docs
from frappe.tests import IntegrationTestCase, timeout


class TestBulkUpdate(IntegrationTestCase):
	@classmethod
	def setUpClass(cls) -> None:
		super().setUpClass()
		cls.doctype = new_doctype(is_submittable=1, custom=1).insert().name
		cls.child_doctype = new_doctype(istable=1, custom=1).insert().name
		frappe.db.commit()
		for _ in range(50):
			frappe.new_doc(cls.doctype, some_fieldname=frappe.mock("name")).insert()

	@timeout()
	def wait_for_assertion(self, assertion):
		"""Wait till an assertion becomes True"""
		while True:
			if assertion():
				break
			time.sleep(0.2)

	def test_bulk_submit_in_background(self):
		unsubmitted = frappe.get_all(self.doctype, {"docstatus": 0}, limit=5, pluck="name")
		failed = submit_cancel_or_update_docs(self.doctype, unsubmitted, action="submit")
		self.assertEqual(failed, [])

		def check_docstatus(docs, status):
			frappe.db.rollback()
			matching_docs = frappe.get_all(
				self.doctype, {"docstatus": status, "name": ("in", docs)}, pluck="name"
			)
			return set(matching_docs) == set(docs)

		unsubmitted = frappe.get_all(self.doctype, {"docstatus": 0}, limit=20, pluck="name")
		submit_cancel_or_update_docs(self.doctype, unsubmitted, action="submit")

		self.wait_for_assertion(lambda: check_docstatus(unsubmitted, 1))

		submitted = frappe.get_all(self.doctype, {"docstatus": 1}, limit=20, pluck="name")
		submit_cancel_or_update_docs(self.doctype, submitted, action="cancel")
		self.wait_for_assertion(lambda: check_docstatus(submitted, 2))

	def test_bulk_update_parent_fields(self):
		docnames = frappe.get_all(self.doctype, {"docstatus": 0}, limit=5, pluck="name")
		failed = submit_cancel_or_update_docs(
			self.doctype, docnames, action="update", data={"some_fieldname": "_Test Sync"}
		)
		self.assertEqual(failed, [])

		def check_field_values(docs, expected):
			frappe.db.rollback()
			values = frappe.get_all(self.doctype, {"name": ["in", docs]}, ["name", "some_fieldname"])
			return all(v.some_fieldname == expected for v in values)

		docnames_bg = frappe.get_all(self.doctype, {"docstatus": 0}, limit=20, pluck="name")
		submit_cancel_or_update_docs(
			self.doctype, docnames_bg, action="update", data={"some_fieldname": "_Test Background"}
		)

		self.wait_for_assertion(lambda: check_field_values(docnames_bg, "_Test Background"))

	def test_bulk_update_child_fields(self):
		doctype_doc = frappe.get_doc("DocType", self.doctype)
		doctype_doc.append(
			"fields", {"fieldname": "child_table", "fieldtype": "Table", "options": self.child_doctype}
		)
		doctype_doc.save()
		frappe.db.commit()

		existing_docs = frappe.get_all(self.doctype, {"docstatus": 0}, pluck="name")
		for docname in existing_docs:
			doc = frappe.get_doc(self.doctype, docname)
			doc.append("child_table", {"some_fieldname": "_Test Child Value"})
			doc.save()
		frappe.db.commit()

		update_data = {
			"child_table_updates": {
				self.child_doctype: {"some_fieldname": "_Test Child Updated"},
			}
		}

		def check_child_field(docs, expected):
			frappe.db.rollback()
			for docname in docs:
				doc = frappe.get_doc(self.doctype, docname)
				if not doc.child_table or doc.child_table[0].some_fieldname != expected:
					return False
			return True

		docnames = frappe.get_all(self.doctype, {"docstatus": 0}, limit=5, pluck="name")
		failed = submit_cancel_or_update_docs(self.doctype, docnames, action="update", data=update_data)
		self.assertEqual(failed, [])

		docnames_bg = frappe.get_all(self.doctype, {"docstatus": 0}, limit=20, pluck="name")
		submit_cancel_or_update_docs(self.doctype, docnames_bg, action="update", data=update_data)
		self.wait_for_assertion(lambda: check_child_field(docnames_bg, "_Test Child Updated"))

	def test_bulk_action_emits_task_complete_with_failed_list(self):
		"""The terminal `task_complete` event fires with the run's `failed` list, so an enqueued
		client learns completion + failures from one event (a `percent >= 100` tick can't carry it)."""
		docnames = frappe.get_all(self.doctype, {"docstatus": 0}, limit=5, pluck="name")
		with patch.object(frappe, "publish_task_complete") as emit:
			failed = submit_cancel_or_update_docs(
				self.doctype, docnames, action="update", data={"some_fieldname": "_Test Emit"}, task_id="tid-1"
			)
		self.assertEqual(failed, [])
		emit.assert_called_once_with(result={"failed": failed}, task_id="tid-1")

	def test_task_complete_scopes_to_actor_not_the_whole_site(self):
		"""Without a task_id the terminal event must reach only the actor's room (mirroring
		publish_progress), never get_site_room() — a broadcast to every Desk user."""
		with patch("frappe.realtime.publish_realtime") as pub:
			frappe.publish_task_complete(result={"failed": []})
		_, kwargs = pub.call_args
		self.assertEqual(kwargs.get("user"), frappe.session.user)
		self.assertIsNone(kwargs.get("task_id"))

	def test_bulk_update_conditions(self):
		"""Test the whitelisted bulk update method"""
		todo_names = []
		for i in range(5):
			doc = frappe.get_doc(
				{
					"doctype": "ToDo",
					"description": f"Bulk Update Status Test {i}",
					"status": "Open" if i < 3 else "Closed",
				}
			).insert()
			todo_names.append(doc.name)

		try:
			condition_json = frappe.as_json({"status": "Open", "name": ["in", todo_names]})

			bulk_upd = frappe.get_doc(
				{
					"doctype": "Bulk Update",
					"document_type": "ToDo",
					"field": "status",
					"update_value": "Closed",
					"condition": condition_json,
					"limit": 5,
				}
			)

			bulk_upd.bulk_update()

			updated_docs = frappe.get_all("ToDo", filters={"name": ["in", todo_names]}, fields=["status"])

			for doc in updated_docs:
				self.assertEqual(doc.status, "Closed")

			remaining_open_count = frappe.db.count("ToDo", {"name": ["in", todo_names], "status": "Open"})
			self.assertEqual(remaining_open_count, 0)

		finally:
			for name in todo_names:
				frappe.delete_doc("ToDo", name)
			frappe.db.commit()
