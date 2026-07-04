# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for Placements (ADR-0023): the App < Site < User merge core (injected permission
# gate, no site) and the whitelisted write path's owner-scoping (DB seams mocked):
#   bench run-tests --module frappe.os_core.test_placements
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_placements

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import placements


def always(ref):
	return True


def never(ref):
	return False


class TestMergePlacements(unittest.TestCase):
	"""Fold the three layers in precedence order (ADR-0023): union+dedup App-default ∪ Site, then
	apply each User delta in place (hide / move / new pin), then drop refs the viewer can't see."""

	def test_baseline_alone_is_marked_inherited(self):
		base = [{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 0}}]
		out = placements.merge_placements(base, [], [], always)
		self.assertEqual(len(out), 1)
		self.assertTrue(out[0]["inherited"])
		self.assertEqual(out[0]["ref"], {"app": "frappe"})

	def test_site_layer_unions_and_dedupes_by_identity_layer_wins(self):
		base = [{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 0}}]
		site = [
			{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 9}},  # same identity
			{"region": "dock", "ref": {"app": "crm"}, "position": {"order": 1}},
		]
		out = placements.merge_placements(base, site, [], always)
		self.assertEqual([p["ref"] for p in out], [{"app": "frappe"}, {"app": "crm"}])
		# Layer — not position — is authoritative, so the baseline row keeps its own position.
		self.assertEqual(out[0]["position"], {"order": 0})

	def test_user_hide_tombstones_a_baseline_pin(self):
		base = [{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 0}}]
		overrides = [{"region": "dock", "ref": {"app": "frappe"}, "hidden": True}]
		self.assertEqual(placements.merge_placements(base, [], overrides, always), [])

	def test_user_position_override_moves_a_baseline_pin_but_keeps_inherited(self):
		base = [{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 0}}]
		overrides = [{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 5}}]
		out = placements.merge_placements(base, [], overrides, always)
		self.assertEqual(out[0]["position"], {"order": 5})
		self.assertTrue(out[0]["inherited"])

	def test_user_new_pin_is_appended_without_inherited(self):
		overrides = [{"region": "desktop", "ref": {"app": "crm"}, "position": {"column": 1, "row": 0}}]
		out = placements.merge_placements([], [], overrides, always)
		self.assertEqual(len(out), 1)
		self.assertNotIn("inherited", out[0])
		self.assertEqual(out[0]["ref"], {"app": "crm"})

	def test_invisible_reference_is_dropped(self):
		base = [{"region": "dock", "ref": {"app": "frappe"}, "position": {"order": 0}}]
		self.assertEqual(placements.merge_placements(base, [], [], never), [])


class TestSavePlacementOverride(unittest.TestCase):
	"""The frontend's only placement write — always the caller's own User-layer row (ADR-0023).
	The reference is canonicalised so the identity match holds; the DB write is stubbed."""

	def test_upserts_the_callers_own_row_and_returns_its_name(self):
		doc = mock.Mock()
		doc.name = "ovr-1"
		with mock.patch.object(placements, "_own_override", return_value=None) as own, \
			mock.patch.object(placements, "upsert", return_value=doc) as upsert:
			result = placements.save_placement_override("dock", '{"app":"frappe"}', position='{"order":0}', hidden=0)
		# Identity lookup uses the canonicalised reference (sorted keys), owner-scoped in _own_override.
		own.assert_called_once_with("dock", '{"app": "frappe"}')
		values = upsert.call_args.args[2]
		self.assertEqual(values["region"], "dock")
		self.assertEqual(values["surface_ref"], '{"app": "frappe"}')
		self.assertEqual(values["hidden"], 0)
		self.assertEqual(result, {"name": "ovr-1"})

	def test_own_override_lookup_is_owner_scoped(self):
		db = mock.Mock()
		db.get_value.return_value = None
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(frappe, "db", db):
			placements._own_override("dock", '{"app": "frappe"}')
		db.get_value.assert_called_once_with(
			"OS Placement Override",
			{"owner": "alice@example.com", "region": "dock", "surface_ref": '{"app": "frappe"}'},
		)


class TestDeletePlacementOverride(unittest.TestCase):
	def test_deletes_only_the_callers_own_row(self):
		with mock.patch.object(placements, "_own_override", return_value="ovr-1"), \
			mock.patch.object(placements.frappe, "delete_doc") as delete_doc:
			result = placements.delete_placement_override("dock", '{"app":"frappe"}')
		delete_doc.assert_called_once_with("OS Placement Override", "ovr-1")
		self.assertEqual(result, {"deleted": True})

	def test_is_a_noop_when_the_caller_has_no_own_row(self):
		with mock.patch.object(placements, "_own_override", return_value=None), \
			mock.patch.object(placements.frappe, "delete_doc") as delete_doc:
			result = placements.delete_placement_override("dock", '{"app":"frappe"}')
		delete_doc.assert_not_called()
		self.assertEqual(result, {"deleted": False})


if __name__ == "__main__":
	unittest.main()
