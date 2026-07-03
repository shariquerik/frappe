# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Wallpapers (ADR-0036): the desktop-wallpaper catalog and the per-user selection. One OS Wallpaper
# table holds two scopes — shipped `is_global` defaults available to everyone (seeded here, the
# wallpaper analog of APP_DEFAULT_PLACEMENTS) and a user's own private uploads (owner-scoped). The
# resolver unions global ∪ own into the boot payload; the *selected* wallpaper roams per-user in
# frappe.defaults (like the preferred-shell choice), not on any row. The merge is pure so it is
# testable with no site. The client's only writes are its own uploads, deletes, and its selection.

import os

import frappe
from frappe.os_core.common import layer_rows, upsert
from frappe.os_core.wallpaper_images import WEBP_EXTENSION, derive_thumbnail, derive_wallpaper_assets
from frappe.utils.file_manager import save_file

# The key the user's chosen wallpaper roams under (frappe.defaults, per-user) — the wallpaper analog
# of PREFERRED_SHELL_KEY. None until the user picks one; the client then falls back to the default.
WALLPAPER_DEFAULT_KEY = "os_wallpaper"

# The section a shipped default is grouped under in the picker (ADR-0036). Gradients are Colors,
# images are Photos; a user upload leaves it blank and is grouped under "Your Wallpapers".
GRADIENT_CATEGORY = "Colors"
IMAGE_CATEGORY = "Photos"

# The built-in gradient wallpapers — the OS-owned baseline, migrated out of the frontend's
# wallpaperDefs() so the catalog has one source (ADR-0036). `dark` flips desktop chrome to the light
# palette; exactly one row is the `is_default` ground (Duotone) applied before a user chooses.
DEFAULT_GRADIENTS = [
	{
		"label": "Duotone",
		"background": "radial-gradient(150% 130% at 12% -10%, #5b54e6 0%, #2c3a9e 42%, #0f7d78 100%)",
		"dark": 1,
		"is_default": 1,
	},
	{"label": "Mist", "background": "radial-gradient(140% 130% at 0% 0%, #f8fafc 0%, #eef1f5 46%, #e1e6ec 100%)"},
	{"label": "Linen", "background": "radial-gradient(140% 130% at 0% 0%, #faf7f3 0%, #f2ece4 50%, #e8ddd0 100%)"},
	{"label": "Sky", "background": "radial-gradient(130% 130% at 100% 0%, #ecf5fe 0%, #d6e8fb 54%, #bdd6f3 100%)"},
	{"label": "Sage", "background": "radial-gradient(130% 130% at 0% 100%, #eef6f0 0%, #d9e9dd 54%, #c6dccc 100%)"},
	{"label": "Dusk", "background": "linear-gradient(155deg, #6c7fdb 0%, #5160ad 52%, #3c4884 100%)", "dark": 1},
	{"label": "Frappe", "background": "linear-gradient(155deg, #38a6fb 0%, #0d8ef8 42%, #0a62b6 100%)", "dark": 1},
	{"label": "Graphite", "background": "radial-gradient(140% 130% at 0% 0%, #34383e 0%, #25282d 54%, #191b1e 100%)", "dark": 1},
	{"label": "Ink", "background": "radial-gradient(130% 130% at 100% 0%, #2c3050 0%, #1d2032 58%, #14161f 100%)", "dark": 1},
]

# The shipped default images live in the app's static assets; a file dropped here becomes a global
# wallpaper on the next migrate (seed scans the folder, ADR-0036). Served at /assets/frappe/<folder>.
# Migrate generates each image's small `<stem>.webp` sibling under THUMBNAIL_FOLDER (the tile the picker
# grid draws instead of the full background, so the gallery never loads full-resolution files) — see
# _prepare_shipped_images. Only that thumbnail is generated: the desktop image is served as committed and
# never rewritten, so ship it already web-sized. Thumbnail generation is best-effort and tolerant of a
# read-only asset mount (ADR-0036, deferred-issue 03).
IMAGE_FOLDER = "wallpapers"
THUMBNAIL_FOLDER = "thumbnails"
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def wallpaper_dict(row):
	"""One stored row → the client wallpaper shape (id + presentation + scope). `name` is the id the
	selection stores; an image wallpaper carries `image` (the full desktop background) plus a small
	`thumbnail` the picker grid draws instead — a gradient carries `background`."""
	return {
		"name": row.get("name"),
		"label": row.get("label"),
		"image": row.get("image") or None,
		"thumbnail": row.get("thumbnail") or None,
		"background": row.get("background") or None,
		"category": row.get("category") or None,
		"dark": bool(row.get("dark")),
		"isGlobal": bool(row.get("is_global")),
		"isDefault": bool(row.get("is_default")),
	}


def wallpapers_view(rows, user):
	"""Pure: stored rows → the resolved catalog (ADR-0036) — every global wallpaper plus the given
	user's own uploads, globals first then the user's, mapped to the client shape. Testable with no
	site, like recents_view. A user never sees another user's private upload."""
	visible = [r for r in rows if r.get("is_global") or r.get("owner") == user]
	visible.sort(key=lambda r: (not r.get("is_global"), r.get("label") or ""))
	return [wallpaper_dict(r) for r in visible]


def get_wallpapers():
	"""The resolved wallpaper catalog for the boot payload (ADR-0036): global defaults ∪ the caller's
	own uploads. Tolerant like get_placements — before the DocType is migrated `layer_rows` returns
	[], so boot never crashes."""
	rows = layer_rows(
		"OS Wallpaper",
		["name", "label", "image", "thumbnail", "background", "category", "dark", "is_global", "is_default", "owner"],
		or_filters={"is_global": 1, "owner": frappe.session.user},
	)
	return wallpapers_view(rows, frappe.session.user)


def get_selection():
	"""The caller's chosen wallpaper name for the boot payload, or None when unchosen (the client
	then falls back to the is_default global). Roams per-user in frappe.defaults (ADR-0036)."""
	return frappe.defaults.get_user_default(WALLPAPER_DEFAULT_KEY) or None


def _global_values(wp):
	"""A seed entry → the full stored value set, defaulting every optional flag so an upsert overwrites
	stale presentation on re-seed rather than leaving it half-set."""
	return {
		"label": wp["label"],
		"image": wp.get("image"),
		"thumbnail": wp.get("thumbnail"),
		"background": wp.get("background"),
		"category": wp.get("category"),
		"dark": int(wp.get("dark", 0)),
		"is_global": 1,
		"is_default": int(wp.get("is_default", 0)),
	}


def _label_from_filename(filename):
	"""A shipped image's filename → a display label: the leading human-name tokens, title-cased. Stops
	at the first non-word token (an Unsplash id / the `unsplash` suffix), so `casey-horner-O0R5X...jpg`
	→ 'Casey Horner'. Falls back to the bare stem if there are no leading word tokens."""
	stem = filename.rsplit(".", 1)[0]
	tokens = []
	for token in stem.split("-"):
		if token == "unsplash" or not (token.isalpha() and token.islower()):
			break
		tokens.append(token.capitalize())
	return " ".join(tokens) or stem


def _source_images(folder):
	"""The image filenames directly under a wallpaper folder (not its thumbnails subdir), sorted — the
	shared scan the seed step and the catalog both read."""
	return sorted(
		f
		for f in os.listdir(folder)
		if f.lower().endswith(IMAGE_EXTENSIONS) and os.path.isfile(os.path.join(folder, f))
	)


def _image_defaults():
	"""The shipped image wallpapers — every image file under the app's static wallpaper folder, mapped
	to a global seed entry (ADR-0036). Scanned so dropping a file in and re-migrating publishes it; []
	when the folder is absent. `thumbnail` points at the small sibling under THUMBNAIL_FOLDER the picker
	draws, but only when that sibling actually exists — otherwise it is omitted and the picker falls back
	to the full image (the seed step normally generates it first). `dark` is on: labels read white with a
	shadow, legible over most photos."""
	folder = frappe.get_app_path("frappe", "public", IMAGE_FOLDER)
	if not os.path.isdir(folder):
		return []
	return [_image_default(folder, f) for f in _source_images(folder)]


def _image_default(folder, filename):
	"""One shipped image filename → its global seed entry. The desktop `image` is served as committed; the
	`thumbnail` is the small `<stem>.webp` sibling under THUMBNAIL_FOLDER, included only when that file
	exists so an un-generated thumbnail never becomes a 404 (the picker then falls back to the full image)."""
	thumbnail_name = f"{os.path.splitext(filename)[0]}{WEBP_EXTENSION}"
	has_thumbnail = os.path.isfile(os.path.join(folder, THUMBNAIL_FOLDER, thumbnail_name))
	return {
		"label": _label_from_filename(filename),
		"image": f"/assets/frappe/{IMAGE_FOLDER}/{filename}",
		"thumbnail": f"/assets/frappe/{IMAGE_FOLDER}/{THUMBNAIL_FOLDER}/{thumbnail_name}" if has_thumbnail else None,
		"category": IMAGE_CATEGORY,
		"dark": 1,
	}


def _prepare_shipped_images(folder):
	"""Generate each shipped image's picker thumbnail at migrate time (ADR-0036) — so dropping a photo into
	public/wallpapers/ and re-migrating publishes it with a thumbnail, no separate build step. Only the
	small thumbnail is derived; the desktop image is served exactly as committed and is never rewritten or
	deleted, so migrate never mutates a source original. Tolerant: if the asset dir is not writable (a
	read-only production mount) the whole step is skipped and the picker falls back to the full image via
	_image_defaults' existence check — a wallpaper thumbnail never fails a migrate."""
	thumbnail_dir = os.path.join(folder, THUMBNAIL_FOLDER)
	try:
		os.makedirs(thumbnail_dir, exist_ok=True)
		for filename in _source_images(folder):
			_ensure_thumbnail(folder, thumbnail_dir, filename)
	except OSError:
		pass


def _ensure_thumbnail(folder, thumbnail_dir, filename):
	"""Write one shipped image's `<stem>.webp` picker thumbnail when it is missing or older than the image,
	so a replaced photo refreshes it and an unchanged one is skipped (a normal migrate does no work)."""
	image = os.path.join(folder, filename)
	thumbnail = os.path.join(thumbnail_dir, f"{os.path.splitext(filename)[0]}{WEBP_EXTENSION}")
	if os.path.exists(thumbnail) and os.path.getmtime(thumbnail) >= os.path.getmtime(image):
		return
	with open(image, "rb") as handle:
		_write_file(thumbnail, derive_thumbnail(handle.read()))


def _write_file(path, content):
	with open(path, "wb") as handle:
		handle.write(content)


def seed_wallpapers():
	"""Idempotently publish the shipped global wallpapers (after_migrate): the built-in gradients keyed by
	label, the shipped images keyed by their asset path. Missing picker thumbnails are generated first
	(_prepare_shipped_images) so a dropped-in photo publishes with one. Re-running updates presentation in
	place and never duplicates; a user's own uploads are never touched."""
	for wp in DEFAULT_GRADIENTS:
		existing = frappe.db.get_value("OS Wallpaper", {"is_global": 1, "label": wp["label"], "image": ["is", "not set"]})
		upsert("OS Wallpaper", existing, _global_values({**wp, "category": GRADIENT_CATEGORY}))
	folder = frappe.get_app_path("frappe", "public", IMAGE_FOLDER)
	if os.path.isdir(folder):
		_prepare_shipped_images(folder)
	for wp in _image_defaults():
		existing = frappe.db.get_value("OS Wallpaper", {"is_global": 1, "image": wp["image"]})
		upsert("OS Wallpaper", existing, _global_values(wp))


def _owned_row(name):
	"""The (is_global, owner) of a wallpaper, or None if it does not exist — the visibility/ownership
	lookup the selection and delete guards share."""
	return frappe.db.get_value("OS Wallpaper", name, ["is_global", "owner"], as_dict=True)


@frappe.whitelist(methods=["POST"])
def set_wallpaper(name: str):
	"""Remember the caller's chosen wallpaper (ADR-0036), validated visible to them — a global row or
	their own upload. Roams per-user via frappe.defaults like the preferred-shell choice; writes no row.
	Rejects a name the caller may not see so the selection can never point at someone else's upload."""
	row = _owned_row(name)
	if not row or not (row.is_global or row.owner == frappe.session.user):
		frappe.throw(frappe._("Wallpaper not found"), frappe.DoesNotExistError)
	frappe.defaults.set_user_default(WALLPAPER_DEFAULT_KEY, name)
	return {"name": name}


@frappe.whitelist(methods=["POST"])
def upload_wallpaper(label: str, image: str, dark: int = 0):
	"""Catalog an uploaded image as the caller's own private wallpaper (ADR-0036) — always owner-scoped
	and non-global, so a user can never mint a global row. `image` is the URL of an already-uploaded File
	(the client uploads via the standard File flow, then calls this). The source is run through the shared
	derivation seam (deferred-issue 03) so the stored `image` is a downscaled desktop WebP and `thumbnail`
	a small picker tile — never the raw multi-megabyte upload, which is then discarded. Returns the new
	catalog row."""
	doc = frappe.new_doc("OS Wallpaper")
	doc.update({"label": label, "dark": int(dark), "is_global": 0, "is_default": 0})
	doc.insert()
	source = _own_source_file(image)
	doc.image, doc.thumbnail = _derive_upload(doc.name, image, source)
	doc.save()
	if source:
		frappe.delete_doc("File", source.name, ignore_permissions=True, delete_permanently=True)
	return wallpaper_dict(doc.as_dict())


def _own_source_file(image):
	"""The caller's OWN uploaded File at `image`, or None. Owner-scoped so upload_wallpaper can never read
	or discard another user's File by passing its URL — it only ever derives from the caller's own upload
	(a foreign or external URL matches nothing and is cataloged verbatim, without a thumbnail)."""
	name = frappe.db.get_value("File", {"file_url": image, "owner": frappe.session.user})
	return frappe.get_doc("File", name) if name else None


def _derive_upload(name, image, source):
	"""Run the caller's uploaded `source` File through the derivation seam and store its two web-sized WebP
	derivatives as private Files attached to the wallpaper, returning (desktop_url, thumbnail_url). Falls
	back to the source URL with no thumbnail when there is no own source File, so a non-derivable upload
	still catalogs (the picker then draws the full image)."""
	if not source:
		return image, None
	desktop, thumbnail = derive_wallpaper_assets(source.get_content())
	stem = (source.file_name or "wallpaper").rsplit(".", 1)[0]
	desktop_file = save_file(f"{stem}{WEBP_EXTENSION}", desktop, "OS Wallpaper", name, df="image", is_private=1)
	thumbnail_file = save_file(
		f"{stem}-thumbnail{WEBP_EXTENSION}", thumbnail, "OS Wallpaper", name, df="thumbnail", is_private=1
	)
	return desktop_file.file_url, thumbnail_file.file_url


@frappe.whitelist(methods=["POST"])
def delete_wallpaper(name: str):
	"""Delete one of the caller's own uploaded wallpapers (ADR-0036). Own, non-global rows only — the
	is_global guard and if_owner permissions protect the shipped defaults. If the removed wallpaper was
	the caller's current selection, clear it so they fall back to the default."""
	row = _owned_row(name)
	if not row or row.is_global or row.owner != frappe.session.user:
		frappe.throw(frappe._("Cannot delete this wallpaper"), frappe.PermissionError)
	frappe.delete_doc("OS Wallpaper", name)
	if get_selection() == name:
		frappe.defaults.clear_user_default(WALLPAPER_DEFAULT_KEY)
	return {"deleted": True}
