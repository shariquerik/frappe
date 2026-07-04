# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for Wallpapers (ADR-0036): the resolved catalog view (globals ∪ own uploads,
# never another user's private, no site) and the whitelisted select/delete guards — visibility on
# set, owner-scoping on delete (DB/defaults seams mocked):
#   bench run-tests --module frappe.os_core.test_wallpapers
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_wallpapers

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import wallpapers


class TestWallpapersView(unittest.TestCase):
	"""Stored rows → the catalog: every global plus the given user's own uploads, globals first,
	another user's private upload never shown (ADR-0036). Pure — no site."""

	def test_globals_first_then_own_uploads_never_another_users(self):
		rows = [
			{"name": "w-own", "label": "Mine", "is_global": 0, "owner": "alice@example.com"},
			{"name": "w-glob", "label": "Duotone", "is_global": 1, "owner": "Administrator"},
			{"name": "w-other", "label": "Theirs", "is_global": 0, "owner": "bob@example.com"},
		]
		out = wallpapers.wallpapers_view(rows, "alice@example.com")
		self.assertEqual([w["name"] for w in out], ["w-glob", "w-own"])
		self.assertTrue(out[0]["isGlobal"])
		self.assertFalse(out[1]["isGlobal"])


class TestSetWallpaper(unittest.TestCase):
	"""set_wallpaper remembers a choice only when the caller may see it — a global row or their own
	upload — so the selection can never point at someone else's private upload (ADR-0036)."""

	def test_accepts_a_global_wallpaper(self):
		with mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=1, owner="Administrator")), \
			mock.patch.object(wallpapers.frappe.defaults, "set_user_default") as set_default:
			result = wallpapers.set_wallpaper("w-glob")
		set_default.assert_called_once_with(wallpapers.WALLPAPER_DEFAULT_KEY, "w-glob")
		self.assertEqual(result, {"name": "w-glob"})

	def test_accepts_the_callers_own_upload(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=0, owner="alice@example.com")), \
			mock.patch.object(wallpapers.frappe.defaults, "set_user_default") as set_default:
			wallpapers.set_wallpaper("w-own")
		set_default.assert_called_once()

	def test_rejects_a_wallpaper_the_caller_may_not_see(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=0, owner="bob@example.com")), \
			mock.patch.object(wallpapers.frappe.defaults, "set_user_default") as set_default, \
			mock.patch.object(frappe, "_", lambda s: s), \
			mock.patch.object(wallpapers.frappe, "throw", side_effect=frappe.DoesNotExistError):
			with self.assertRaises(frappe.DoesNotExistError):
				wallpapers.set_wallpaper("w-bob")
		set_default.assert_not_called()

	def test_rejects_a_missing_wallpaper(self):
		with mock.patch.object(wallpapers, "_owned_row", return_value=None), \
			mock.patch.object(wallpapers.frappe.defaults, "set_user_default") as set_default, \
			mock.patch.object(frappe, "_", lambda s: s), \
			mock.patch.object(wallpapers.frappe, "throw", side_effect=frappe.DoesNotExistError):
			with self.assertRaises(frappe.DoesNotExistError):
				wallpapers.set_wallpaper("ghost")
		set_default.assert_not_called()


class TestDeleteWallpaper(unittest.TestCase):
	"""delete_wallpaper removes only the caller's OWN non-global uploads (ADR-0036) — the shipped
	globals and another user's uploads are protected — and clears a dangling selection."""

	def test_deletes_the_callers_own_upload(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=0, owner="alice@example.com")), \
			mock.patch.object(wallpapers.frappe, "delete_doc") as delete_doc, \
			mock.patch.object(wallpapers, "get_selection", return_value="something-else"):
			result = wallpapers.delete_wallpaper("w-own")
		delete_doc.assert_called_once_with("OS Wallpaper", "w-own")
		self.assertEqual(result, {"deleted": True})

	def test_clears_the_selection_when_deleting_the_selected(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=0, owner="alice@example.com")), \
			mock.patch.object(wallpapers.frappe, "delete_doc"), \
			mock.patch.object(wallpapers, "get_selection", return_value="w-own"), \
			mock.patch.object(wallpapers.frappe.defaults, "clear_user_default") as clear_default:
			wallpapers.delete_wallpaper("w-own")
		clear_default.assert_called_once_with(wallpapers.WALLPAPER_DEFAULT_KEY)

	def test_rejects_a_global_wallpaper(self):
		with mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=1, owner="Administrator")), \
			mock.patch.object(frappe, "_", lambda s: s), \
			mock.patch.object(wallpapers.frappe, "throw", side_effect=frappe.PermissionError), \
			mock.patch.object(wallpapers.frappe, "delete_doc") as delete_doc:
			with self.assertRaises(frappe.PermissionError):
				wallpapers.delete_wallpaper("w-glob")
		delete_doc.assert_not_called()

	def test_rejects_another_users_upload(self):
		with mock.patch.object(frappe, "session", frappe._dict(user="alice@example.com")), \
			mock.patch.object(wallpapers, "_owned_row", return_value=frappe._dict(is_global=0, owner="bob@example.com")), \
			mock.patch.object(frappe, "_", lambda s: s), \
			mock.patch.object(wallpapers.frappe, "throw", side_effect=frappe.PermissionError), \
			mock.patch.object(wallpapers.frappe, "delete_doc") as delete_doc:
			with self.assertRaises(frappe.PermissionError):
				wallpapers.delete_wallpaper("w-bob")
		delete_doc.assert_not_called()


if __name__ == "__main__":
	unittest.main()
