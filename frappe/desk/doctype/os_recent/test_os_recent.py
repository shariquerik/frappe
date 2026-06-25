# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the Recents read projection (ADR-0024). `recents_view` takes a newest-first
# list of references plus an injected permission gate, so dedup / cap / visibility are exercised
# with no site or DB (the same shape as merge_placements' tests):
#   bench run-tests --module frappe.desk.doctype.os_recent.test_os_recent
# or standalone:  ./env/bin/python -m unittest frappe.desk.doctype.os_recent.test_os_recent

import unittest

from frappe.www.os import recents_view


def form_ref(name):
	return {"doctype": "ToDo", "name": name, "view": "form"}


SEE_ALL = lambda ref: True


class TestRecentsView(unittest.TestCase):
	def test_orders_newest_first_passthrough(self):
		refs = [form_ref("c"), form_ref("b"), form_ref("a")]  # caller passes newest-first
		resolved = recents_view(refs, SEE_ALL)
		self.assertEqual([r["ref"]["name"] for r in resolved], ["c", "b", "a"])

	def test_dedup_by_reference_newest_wins(self):
		# A reference repeated (a re-open whose old row lingered) collapses to one — its newest (first)
		# position. Writes keep one row per reference; this is the defensive read-side dedup.
		refs = [form_ref("a"), form_ref("b"), form_ref("a")]
		resolved = recents_view(refs, SEE_ALL)
		self.assertEqual([r["ref"]["name"] for r in resolved], ["a", "b"])

	def test_cap_trims_to_newest(self):
		refs = [form_ref(str(i)) for i in range(60)]
		resolved = recents_view(refs, SEE_ALL, cap=50)
		self.assertEqual(len(resolved), 50)
		self.assertEqual(resolved[0]["ref"]["name"], "0")  # newest kept, oldest dropped

	def test_permission_filter_drops_invisible_refs(self):
		refs = [form_ref("a"), {"doctype": "Secret", "name": "x", "view": "form"}, form_ref("b")]
		can_see = lambda ref: ref.get("doctype") != "Secret"
		resolved = recents_view(refs, can_see)
		self.assertEqual([r["ref"]["name"] for r in resolved], ["a", "b"])

	def test_each_recent_carries_only_its_reference(self):
		# The resolved shape mirrors a placement's {ref}; presentation is derived client-side.
		resolved = recents_view([form_ref("a")], SEE_ALL)
		self.assertEqual(resolved, [{"ref": form_ref("a")}])


if __name__ == "__main__":
	unittest.main()
