# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the Account pane's self-service password change (ADR-0030). change_password
# takes NO target user — it acts only on frappe.session.user — so a caller can never change another
# user's password; it verifies the current password server-side first, and rejects Guest. Every
# frappe boundary is mocked; no site:
#   bench run-tests --module frappe.os_core.test_account
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_account

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import account


class TestChangePassword(unittest.TestCase):
	def test_success_verifies_current_then_updates_the_session_user(self):
		# Both the verify and the write target frappe.session.user — the only user the caller can
		# ever act on, so there is no cross-user surface to reach.
		local = mock.Mock()
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(frappe, "local", local), \
			mock.patch("frappe.utils.password.update_password") as update_password:
			account.change_password("current-secret", "new-secret")
		local.login_manager.check_password.assert_called_once_with("alice@example.com", "current-secret")
		update_password.assert_called_once_with("alice@example.com", "new-secret")

	def test_wrong_current_password_blocks_the_update(self):
		# check_password raises AuthenticationError on a bad current password; the update must not run.
		local = mock.Mock()
		local.login_manager.check_password.side_effect = frappe.AuthenticationError
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(frappe, "local", local), \
			mock.patch("frappe.utils.password.update_password") as update_password:
			with self.assertRaises(frappe.AuthenticationError):
				account.change_password("wrong-secret", "new-secret")
		update_password.assert_not_called()

	def test_guest_is_rejected_before_any_password_check(self):
		local = mock.Mock()
		with mock.patch.object(frappe, "session", frappe._dict(user="Guest")), \
			mock.patch.object(frappe, "local", local), \
			mock.patch.object(account, "_", lambda s: s), \
			mock.patch.object(frappe, "throw", side_effect=frappe.PermissionError) as throw, \
			mock.patch("frappe.utils.password.update_password") as update_password:
			with self.assertRaises(frappe.PermissionError):
				account.change_password("x", "y")
		throw.assert_called_once()
		local.login_manager.check_password.assert_not_called()
		update_password.assert_not_called()


if __name__ == "__main__":
	unittest.main()
