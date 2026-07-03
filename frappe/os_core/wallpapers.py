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
# Each desktop image has a small sibling under THUMBNAIL_FOLDER (same filename) that the picker grid
# draws instead of the full background — see scripts that generate the web-sized assets. Ship WebP:
# the originals are downscaled at build time, so the folder holds only web-sized files, never raw
# multi-megabyte camera JPEGs (ADR-0036 perf).
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


def _image_defaults():
	"""The shipped image wallpapers — every image file under the app's static wallpaper folder, mapped
	to a global seed entry (ADR-0036). Scanned so dropping a file in and re-migrating publishes it; []
	when the folder is absent. Each carries a `thumbnail` (the small sibling under THUMBNAIL_FOLDER the
	picker draws) so the gallery never loads full backgrounds. `dark` is on: labels read white with a
	shadow, legible over most photos."""
	folder = frappe.get_app_path("frappe", "public", IMAGE_FOLDER)
	if not os.path.isdir(folder):
		return []
	files = sorted(
		f
		for f in os.listdir(folder)
		if f.lower().endswith(IMAGE_EXTENSIONS) and os.path.isfile(os.path.join(folder, f))
	)
	return [
		{
			"label": _label_from_filename(f),
			"image": f"/assets/frappe/{IMAGE_FOLDER}/{f}",
			"thumbnail": f"/assets/frappe/{IMAGE_FOLDER}/{THUMBNAIL_FOLDER}/{f}",
			"category": IMAGE_CATEGORY,
			"dark": 1,
		}
		for f in files
	]


def seed_wallpapers():
	"""Idempotently publish the shipped global wallpapers (after_migrate): the built-in gradients keyed
	by label, the shipped images keyed by their asset path. Re-running updates presentation in place and
	never duplicates; a user's own uploads are never touched."""
	for wp in DEFAULT_GRADIENTS:
		existing = frappe.db.get_value("OS Wallpaper", {"is_global": 1, "label": wp["label"], "image": ["is", "not set"]})
		upsert("OS Wallpaper", existing, _global_values({**wp, "category": GRADIENT_CATEGORY}))
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
	and non-global, so a user can never mint a global row. `image` is the URL of an already-uploaded
	File (the client uploads via the standard File flow, then calls this). Returns the new catalog row."""
	doc = frappe.new_doc("OS Wallpaper")
	doc.update({"label": label, "image": image, "dark": int(dark), "is_global": 0, "is_default": 0})
	doc.insert()
	return wallpaper_dict(doc.as_dict())


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
