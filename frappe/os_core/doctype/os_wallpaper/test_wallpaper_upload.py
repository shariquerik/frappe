# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Integration test for the wallpaper upload path (ADR-0036, deferred-issue 03): an uploaded image is run
# through the shared derivation seam, so upload_wallpaper yields a downscaled desktop `image` and a real
# `thumbnail`, and the raw source File is discarded. Needs a site (it creates File rows), so it runs
# under the bench test runner, not the pure test_os_wallpaper unittest:
#   bench run-tests --module frappe.os_core.doctype.os_wallpaper.test_wallpaper_upload

import io

from PIL import Image

import frappe
from frappe.os_core.wallpaper_images import DESKTOP_MAX_EDGE, THUMBNAIL_MAX_EDGE
from frappe.os_core.wallpapers import upload_wallpaper
from frappe.tests import IntegrationTestCase
from frappe.utils.file_manager import save_file


def oversized_png():
	"""A 4000×3000 PNG standing in for a raw camera upload — well over both web-sizing budgets."""
	buffer = io.BytesIO()
	Image.new("RGB", (4000, 3000), (200, 120, 40)).save(buffer, "PNG")
	return buffer.getvalue()


def image_at(file_url):
	"""Reopen the stored File at a URL as a Pillow image, to check its format and dimensions."""
	return Image.open(io.BytesIO(frappe.get_doc("File", {"file_url": file_url}).get_content()))


class TestWallpaperUpload(IntegrationTestCase):
	def test_upload_yields_downscaled_image_and_thumbnail(self):
		source = save_file("beach.png", oversized_png(), None, None, is_private=1)

		row = upload_wallpaper("Beach", source.file_url, dark=1)
		self.addCleanup(frappe.delete_doc, "OS Wallpaper", row["name"], force=True)

		# The stored image is the downscaled desktop derivative, not the raw upload.
		self.assertTrue(row["image"] and row["image"] != source.file_url)
		desktop = image_at(row["image"])
		self.assertEqual(desktop.format, "WEBP")
		self.assertEqual(desktop.width, DESKTOP_MAX_EDGE)

		# A real thumbnail is set (the picker no longer falls back to the full image).
		self.assertTrue(row["thumbnail"])
		thumbnail = image_at(row["thumbnail"])
		self.assertEqual(thumbnail.format, "WEBP")
		self.assertEqual(thumbnail.width, THUMBNAIL_MAX_EDGE)

		# The uploaded owner-scoped private row is what the catalog stores.
		self.assertFalse(row["isGlobal"])

		# The raw multi-megabyte original is discarded once its derivatives are stored.
		self.assertFalse(frappe.db.exists("File", source.name))

	def test_cannot_derive_from_another_users_file(self):
		# A File owned by someone else must never be read or discarded through upload_wallpaper: the
		# owner-scoped lookup misses it, so nothing is derived from it and it is left intact.
		foreign = save_file("private.png", oversized_png(), None, None, is_private=1)
		frappe.db.set_value("File", foreign.name, "owner", "someone-else@example.com")

		row = upload_wallpaper("Stolen", foreign.file_url, dark=1)
		self.addCleanup(frappe.delete_doc, "OS Wallpaper", row["name"], force=True)

		self.assertIsNone(row["thumbnail"])  # no derivation happened
		self.assertEqual(row["image"], foreign.file_url)  # cataloged verbatim, not re-derived
		self.assertTrue(frappe.db.exists("File", foreign.name))  # the other user's File survives
