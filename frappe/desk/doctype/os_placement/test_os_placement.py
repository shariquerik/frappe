# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the Placement resolver merge (ADR-0023). `merge_placements` takes its
# permission gate injected, so the layered fold is exercised with no site/DB:
#   bench run-tests --module frappe.desk.doctype.os_placement.test_os_placement
# or standalone:  ./env/bin/python -m unittest frappe.desk.doctype.os_placement.test_os_placement

import unittest

from frappe.www.os import merge_placements


def desktop(ref, position=None, **extra):
	return {"region": "desktop", "ref": ref, "position": position, **extra}


SEE_ALL = lambda ref: True


class TestPlacementResolver(unittest.TestCase):
	def test_baseline_passes_through(self):
		baseline = [desktop({"app": "frappe"}), desktop({"app": "erpnext"})]
		resolved = merge_placements(baseline, [], [], SEE_ALL)
		self.assertEqual([p["ref"] for p in resolved], [{"app": "frappe"}, {"app": "erpnext"}])

	def test_site_unions_over_baseline(self):
		baseline = [desktop({"app": "frappe"})]
		site = [desktop({"app": "crm"})]
		resolved = merge_placements(baseline, site, [], SEE_ALL)
		self.assertEqual([p["ref"] for p in resolved], [{"app": "frappe"}, {"app": "crm"}])

	def test_dedup_by_identity_collapses_same_destination(self):
		# A Site row pinning the same (region, reference) as a baseline pin is one resolved pin.
		baseline = [desktop({"app": "frappe"})]
		site = [desktop({"app": "frappe"})]
		resolved = merge_placements(baseline, site, [], SEE_ALL)
		self.assertEqual(len(resolved), 1)

	def test_identity_is_region_scoped(self):
		# Same reference, different region — two distinct identities, both survive.
		baseline = [desktop({"app": "frappe"}), {"region": "dock", "ref": {"app": "frappe"}, "position": None}]
		resolved = merge_placements(baseline, [], [], SEE_ALL)
		self.assertEqual({p["region"] for p in resolved}, {"desktop", "dock"})

	def test_user_position_override_moves_in_place(self):
		baseline = [desktop({"app": "frappe"}, {"column": 0, "row": 0})]
		overrides = [desktop({"app": "frappe"}, {"column": 2, "row": 1})]
		resolved = merge_placements(baseline, [], overrides, SEE_ALL)
		self.assertEqual(resolved[0]["position"], {"column": 2, "row": 1})

	def test_user_hide_tombstones_an_inherited_pin(self):
		# Hiding a baseline/Site pin drops it from this user's view; the source rows are untouched
		# (the resolver never mutates baseline/site — they are passed by value).
		baseline = [desktop({"app": "frappe"}), desktop({"app": "erpnext"})]
		overrides = [desktop({"app": "frappe"}, hidden=True)]
		resolved = merge_placements(baseline, [], overrides, SEE_ALL)
		self.assertEqual([p["ref"] for p in resolved], [{"app": "erpnext"}])
		self.assertEqual(len(baseline), 2)  # source untouched

	def test_user_new_pin_appends(self):
		baseline = [desktop({"app": "frappe"})]
		overrides = [desktop({"doctype": "ToDo", "view": "list"}, {"column": 1, "row": 0})]
		resolved = merge_placements(baseline, [], overrides, SEE_ALL)
		self.assertEqual([p["ref"] for p in resolved], [{"app": "frappe"}, {"doctype": "ToDo", "view": "list"}])

	def test_permission_filter_drops_invisible_refs(self):
		baseline = [desktop({"app": "frappe"}), desktop({"app": "erpnext"})]
		can_see = lambda ref: ref.get("app") != "erpnext"
		resolved = merge_placements(baseline, [], [], can_see)
		self.assertEqual([p["ref"] for p in resolved], [{"app": "frappe"}])


if __name__ == "__main__":
	unittest.main()
