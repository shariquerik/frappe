# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# The wallpaper image-derivation seam (ADR-0036 perf, deferred-issue 03). Given a source image's bytes
# it produces the web-sized WebP derivatives every image wallpaper serves — a desktop background
# (~2560px) and a picker thumbnail (~480px) — so the gallery never loads full-resolution files and an
# upload's raw multi-megabyte original is never served as a background. One seam, run by BOTH the
# shipped-image thumbnail step at migrate (wallpapers._prepare_shipped_images) and upload_wallpaper. Pure
# Pillow, bytes in / bytes out: no frappe or filesystem knowledge, so it is testable with no site.

import io

from PIL import Image, ImageOps

# The web-sizing budget (ADR-0036) — the longest edge each derivative is fit within, so a tall portrait
# is capped by height just as a wide landscape is by width. A desktop background caps at 2560px (retina-
# crisp, a few hundred KB of WebP); a picker thumbnail at 480px (the grid tile is 78px, crisp at 2x).
DESKTOP_MAX_EDGE = 2560
DESKTOP_QUALITY = 82
THUMBNAIL_MAX_EDGE = 480
THUMBNAIL_QUALITY = 72

# The extension every derivative is written and served as — the wallpaper folders hold only web-sized WebP.
WEBP_EXTENSION = ".webp"


def derive_wallpaper_assets(content: bytes) -> tuple[bytes, bytes]:
	"""A source image's bytes → its two web-sized WebP derivatives: (desktop background, thumbnail). The
	one seam both the shipped-asset build step and upload_wallpaper run every image through (ADR-0036)."""
	source = _load(content)
	return _encode_webp(source, DESKTOP_MAX_EDGE, DESKTOP_QUALITY), _encode_webp(
		source, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY
	)


def derive_thumbnail(content: bytes) -> bytes:
	"""A source image's bytes → its picker-thumbnail WebP alone (fit to THUMBNAIL_MAX_EDGE, never
	upscaled) — for the shipped-image path, which needs only the small tile, not the desktop derivative."""
	return _encode_webp(_load(content), THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY)


def _load(content: bytes) -> Image.Image:
	"""Open the source and bake its EXIF orientation into the pixels (the tag is then dropped on save), so
	a phone photo taken sideways is stored upright."""
	return ImageOps.exif_transpose(Image.open(io.BytesIO(content)))


def _encode_webp(image: Image.Image, max_edge: int, quality: int) -> bytes:
	"""Fit the image within `max_edge` on its longest side (aspect preserved, never upscaled) and encode
	it as WebP, preserving transparency."""
	output = io.BytesIO()
	_webp_mode(_fit(image, max_edge)).save(output, "WEBP", quality=quality, method=6)
	return output.getvalue()


def _fit(image: Image.Image, max_edge: int) -> Image.Image:
	"""Scale the image down so its longest side is at most `max_edge`, preserving aspect; left untouched
	when it is already within budget (never upscaled)."""
	longest = max(image.width, image.height)
	if longest <= max_edge:
		return image
	scale = max_edge / longest
	return image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)


def _webp_mode(image: Image.Image) -> Image.Image:
	"""Normalise to a WebP-encodable mode, preserving transparency rather than flattening it onto a matte
	(WebP supports alpha): an RGB/RGBA image is left as-is, a palette or other mode becomes RGBA."""
	return image if image.mode in ("RGB", "RGBA") else image.convert("RGBA")
