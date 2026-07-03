# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the wallpaper image-derivation seam (ADR-0036, deferred-issue 03). The seam is
# plain Pillow (bytes in / bytes out), so it is exercised with no site — an oversized source image is
# run through it and both derivatives are checked for format and web-sizing:
#   ./env/bin/python -m unittest frappe.os_core.test_wallpaper_images

import io
import unittest

from PIL import Image

from frappe.os_core.wallpaper_images import (
	DESKTOP_MAX_EDGE,
	THUMBNAIL_MAX_EDGE,
	derive_wallpaper_assets,
)


def source_png(width, height, mode="RGB"):
	"""An in-memory PNG of the given size/mode — a stand-in for a raw multi-megabyte upload/original."""
	fill = (40, 120, 200, 128) if mode == "RGBA" else (40, 120, 200)
	buffer = io.BytesIO()
	Image.new(mode, (width, height), fill).save(buffer, "PNG")
	return buffer.getvalue()


def open_webp(content):
	"""Reopen derived bytes as an image, asserting it decoded as WebP; returns the Image for size checks."""
	image = Image.open(io.BytesIO(content))
	assert image.format == "WEBP", f"expected WEBP, got {image.format}"
	return image


class TestWallpaperImages(unittest.TestCase):
	def test_derives_both_downscaled_webp_derivatives(self):
		content = source_png(4000, 3000)
		desktop, thumbnail = derive_wallpaper_assets(content)
		self.assertEqual(open_webp(desktop).width, DESKTOP_MAX_EDGE)  # capped to the desktop budget
		self.assertEqual(open_webp(thumbnail).width, THUMBNAIL_MAX_EDGE)  # capped to the thumbnail budget
		self.assertLess(len(thumbnail), len(desktop))  # the thumbnail is the smaller derivative

	def test_aspect_ratio_is_preserved(self):
		desktop, thumbnail = derive_wallpaper_assets(source_png(4000, 2000))
		self.assertEqual(open_webp(desktop).size, (DESKTOP_MAX_EDGE, DESKTOP_MAX_EDGE // 2))
		self.assertEqual(open_webp(thumbnail).size, (THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE // 2))

	def test_tall_portrait_is_capped_by_height(self):
		# Width (1000) is under the budget, but the longest edge (height) must still be fit.
		desktop, thumbnail = derive_wallpaper_assets(source_png(1000, 8000))
		self.assertEqual(open_webp(desktop).size, (DESKTOP_MAX_EDGE // 8, DESKTOP_MAX_EDGE))
		self.assertEqual(open_webp(thumbnail).size, (THUMBNAIL_MAX_EDGE // 8, THUMBNAIL_MAX_EDGE))

	def test_small_source_is_never_upscaled(self):
		desktop, thumbnail = derive_wallpaper_assets(source_png(300, 200))
		self.assertEqual(open_webp(desktop).size, (300, 200))  # already within budget, left at its size
		self.assertEqual(open_webp(thumbnail).size, (300, 200))

	def test_transparency_is_preserved(self):
		desktop, thumbnail = derive_wallpaper_assets(source_png(2000, 1000, mode="RGBA"))
		self.assertEqual(open_webp(desktop).mode, "RGBA")  # alpha survives, not flattened onto a matte
		self.assertEqual(open_webp(thumbnail).mode, "RGBA")


if __name__ == "__main__":
	unittest.main()
