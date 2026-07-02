# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the Desk ↔ OS handoff seams (ADR-0030): the per-user "preferred shell" that
# decides where login lands, and the navbar-entry reconciliation. Site-free — every frappe boundary
# is mocked:
#   bench run-tests --module frappe.os_core.test_desk
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_desk

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import desk


class TestSetPreferredShell(unittest.TestCase):
	def test_rejects_unknown_shell(self):
		# Validation happens before any write, so no defaults/cache mocking is needed. `_` is patched
		# to identity so the message doesn't reach the site-bound translation cache.
		with (
			mock.patch.object(desk, "_", lambda s: s),
			mock.patch.object(frappe, "throw", side_effect=ValueError) as throw,
		):
			with self.assertRaises(ValueError):
				desk.set_preferred_shell("phone")
		throw.assert_called_once()

	def test_stores_choice_and_busts_home_page_cache(self):
		with (
			mock.patch.object(frappe.defaults, "set_user_default") as set_default,
			mock.patch.object(frappe, "cache", mock.Mock()) as cache,
			mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")),
		):
			result = desk.set_preferred_shell("os")

		self.assertEqual(result, "os")
		set_default.assert_called_once_with("preferred_shell", "os")
		# The stale login-landing cache for this user must be dropped, or the next login ignores the switch.
		cache.hdel.assert_called_once_with("home_page", "alice@example.com")


class TestPreferredShell(unittest.TestCase):
	def test_guest_has_no_preference(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="Guest")):
			self.assertIsNone(desk.preferred_shell())

	def test_reads_user_default(self):
		with (
			mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")),
			mock.patch.object(frappe.defaults, "get_user_default", return_value="os") as get_default,
		):
			self.assertEqual(desk.preferred_shell(), "os")
		get_default.assert_called_once_with("preferred_shell")

	def test_unset_default_is_none(self):
		with (
			mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")),
			mock.patch.object(frappe.defaults, "get_user_default", return_value=None),
		):
			self.assertIsNone(desk.preferred_shell())


class TestLandingPath(unittest.TestCase):
	def test_os_preference_lands_on_os(self):
		with mock.patch.object(desk, "preferred_shell", return_value="os"):
			self.assertEqual(desk.landing_path(), "/os")

	def test_desk_preference_lands_on_desk(self):
		with mock.patch.object(desk, "preferred_shell", return_value="desk"):
			self.assertEqual(desk.landing_path(), "/desk")

	def test_no_preference_falls_back_to_desk(self):
		with mock.patch.object(desk, "preferred_shell", return_value=None):
			self.assertEqual(desk.landing_path(), "/desk")


class TestSetupDeskSwitch(unittest.TestCase):
	def _fake_settings(self, rows):
		settings = mock.Mock()
		# A plain list stands in for the child table — both support append()/remove().
		settings.settings_dropdown = list(rows)
		return settings

	def test_appends_when_absent(self):
		settings = self._fake_settings([])
		with (
			mock.patch.object(frappe, "get_doc", return_value=settings),
			mock.patch.object(frappe, "db", mock.Mock()),
		):
			outcome = desk.setup_desk_switch()

		self.assertEqual(outcome, "added")
		settings.append.assert_called_once()
		_, appended = settings.append.call_args[0]
		self.assertEqual(appended["item_label"], "Switch to OS")
		self.assertEqual(appended["icon"], "grid")

	def test_reconciles_stale_row_in_place(self):
		# The historical "Switch to F2 ✨" row (plain window.location action) is matched by its /os
		# target, then relabelled + re-actioned — not duplicated.
		stale = frappe._dict(
			action="window.location.href = '/os'", item_label="Switch to F2 ✨", icon=None
		)
		settings = self._fake_settings([stale])
		with (
			mock.patch.object(frappe, "get_doc", return_value=settings),
			mock.patch.object(frappe, "db", mock.Mock()),
		):
			outcome = desk.setup_desk_switch()

		self.assertEqual(outcome, "updated")
		self.assertEqual(stale.item_label, "Switch to OS")
		self.assertEqual(stale.icon, "grid")
		self.assertEqual(stale.action, desk.SWITCH_ACTION)
		settings.append.assert_not_called()

	def test_dedupes_stale_x_row_beside_new_os_row(self):
		# A legacy "/x" row left beside the current "/os" row: the first is canonicalised, the extra dropped.
		legacy = frappe._dict(action="window.location.href = '/x'", item_label="Switch to F2 ✨", icon=None)
		current = frappe._dict(action=desk.SWITCH_ACTION, item_label="Switch to OS", icon="grid")
		settings = self._fake_settings([legacy, current])
		with (
			mock.patch.object(frappe, "get_doc", return_value=settings),
			mock.patch.object(frappe, "db", mock.Mock()),
		):
			outcome = desk.setup_desk_switch()

		self.assertEqual(outcome, "updated")
		self.assertEqual(len(settings.settings_dropdown), 1)
		self.assertEqual(settings.settings_dropdown[0].action, desk.SWITCH_ACTION)

	def test_already_present_is_noop(self):
		current = frappe._dict(action=desk.SWITCH_ACTION, item_label="Switch to OS", icon="grid")
		settings = self._fake_settings([current])
		with (
			mock.patch.object(frappe, "get_doc", return_value=settings),
			mock.patch.object(frappe, "db", mock.Mock()),
		):
			outcome = desk.setup_desk_switch()

		self.assertEqual(outcome, "already present")
		settings.append.assert_not_called()


if __name__ == "__main__":
	unittest.main()
