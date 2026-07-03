# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the wallpaper catalog projection (ADR-0036). `wallpapers_view` takes stored rows
# plus the viewing user and returns the resolved catalog, so scope (global ∪ own), the globals-first
# ordering, and the client shape are exercised with no site or DB (like recents_view / merge_placements):
#   bench run-tests --module frappe.os_core.doctype.os_wallpaper.test_os_wallpaper
# or standalone:  ./env/bin/python -m unittest frappe.os_core.doctype.os_wallpaper.test_os_wallpaper

import os
import shutil
import tempfile
import unittest

from PIL import Image

from frappe.os_core.wallpaper_images import THUMBNAIL_MAX_EDGE
from frappe.os_core.wallpapers import (
	THUMBNAIL_FOLDER,
	_ensure_thumbnail,
	_label_from_filename,
	wallpapers_view,
)


def row(name, label, owner="Administrator", is_global=1, **extra):
	return {"name": name, "label": label, "owner": owner, "is_global": is_global, **extra}


class TestWallpapersView(unittest.TestCase):
	def test_globals_are_visible_to_everyone(self):
		rows = [row("g1", "Duotone"), row("g2", "Mist")]
		names = [w["name"] for w in wallpapers_view(rows, "alice@example.com")]
		self.assertEqual(names, ["g1", "g2"])

	def test_own_uploads_are_included(self):
		rows = [row("g1", "Duotone"), row("u1", "Beach", owner="alice@example.com", is_global=0)]
		names = [w["name"] for w in wallpapers_view(rows, "alice@example.com")]
		self.assertEqual(set(names), {"g1", "u1"})

	def test_other_users_uploads_are_hidden(self):
		rows = [row("g1", "Duotone"), row("u1", "Beach", owner="bob@example.com", is_global=0)]
		names = [w["name"] for w in wallpapers_view(rows, "alice@example.com")]
		self.assertEqual(names, ["g1"])  # bob's private upload never leaks to alice

	def test_globals_sort_before_own_uploads(self):
		rows = [
			row("u1", "Aardvark", owner="alice@example.com", is_global=0),
			row("g1", "Zephyr"),
		]
		result = wallpapers_view(rows, "alice@example.com")
		self.assertEqual([w["name"] for w in result], ["g1", "u1"])  # global first despite later label

	def test_client_shape_maps_flags_and_presentation(self):
		rows = [row("g1", "Ink", background="linear-gradient(...)", category="Colors", dark=1, is_default=1)]
		self.assertEqual(
			wallpapers_view(rows, "alice@example.com"),
			[{"name": "g1", "label": "Ink", "image": None, "thumbnail": None, "background": "linear-gradient(...)",
			  "category": "Colors", "dark": True, "isGlobal": True, "isDefault": True}],
		)

	def test_image_wallpaper_carries_its_thumbnail(self):
		rows = [row("g1", "Beach", image="/assets/frappe/wallpapers/b.webp",
		            thumbnail="/assets/frappe/wallpapers/thumbnails/b.webp")]
		mapped = wallpapers_view(rows, "alice@example.com")[0]
		self.assertEqual(mapped["image"], "/assets/frappe/wallpapers/b.webp")
		self.assertEqual(mapped["thumbnail"], "/assets/frappe/wallpapers/thumbnails/b.webp")

	def test_label_from_filename_strips_unsplash_id(self):
		self.assertEqual(_label_from_filename("casey-horner-O0R5XZfKUGQ-unsplash.jpg"), "Casey Horner")
		self.assertEqual(_label_from_filename("urban-vintage-78A265wPiO4-unsplash.jpg"), "Urban Vintage")
		self.assertEqual(_label_from_filename("jms-kFHz9Xh3PPU-unsplash.jpg"), "Jms")


def write_png(folder, filename, width, height, fmt="PNG"):
	"""Drop a real image file of the given size into `folder` — a stand-in shipped source asset."""
	path = os.path.join(folder, filename)
	Image.new("RGB", (width, height), (40, 120, 200)).save(path, fmt)
	return path


class TestShippedThumbnails(unittest.TestCase):
	"""Migrate-time thumbnail generation (_ensure_thumbnail), exercised against a temp folder so it never
	touches the committed assets. Pure filesystem + Pillow, no site."""

	def setUp(self):
		self.folder = tempfile.mkdtemp()
		self.thumbnails = os.path.join(self.folder, THUMBNAIL_FOLDER)
		os.makedirs(self.thumbnails)
		self.addCleanup(shutil.rmtree, self.folder)

	def test_generates_thumbnail_without_touching_the_original(self):
		write_png(self.folder, "beach.png", 2000, 1000)
		_ensure_thumbnail(self.folder, self.thumbnails, "beach.png")

		self.assertTrue(os.path.isfile(os.path.join(self.folder, "beach.png")))  # desktop original untouched
		with Image.open(os.path.join(self.thumbnails, "beach.webp")) as thumb:
			self.assertEqual(thumb.format, "WEBP")
			self.assertEqual(thumb.width, THUMBNAIL_MAX_EDGE)  # downscaled tile

	def test_fresh_thumbnail_is_skipped_and_stale_one_refreshed(self):
		image = write_png(self.folder, "hill.png", 2000, 1000)
		_ensure_thumbnail(self.folder, self.thumbnails, "hill.png")
		thumbnail = os.path.join(self.thumbnails, "hill.webp")

		# A thumbnail newer than its image is left as-is (a normal migrate does no work).
		os.utime(thumbnail, (2000, 2000))
		os.utime(image, (1000, 1000))
		_ensure_thumbnail(self.folder, self.thumbnails, "hill.png")
		self.assertEqual(os.path.getmtime(thumbnail), 2000)

		# A replaced (newer) image refreshes the stale thumbnail.
		os.utime(image, (3000, 3000))
		_ensure_thumbnail(self.folder, self.thumbnails, "hill.png")
		self.assertGreater(os.path.getmtime(thumbnail), 2000)


if __name__ == "__main__":
	unittest.main()
