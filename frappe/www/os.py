# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Host page + thin metadata API for "Frappe OS" — a metadata-driven desktop shell
# that runs alongside Desk at /os. Doctypes in the registry get auto-generated list
# and form views from live meta; the curated display config (icons, grouping,
# dashboard cards) lives in the frontend. Modeled on the /x shell host page (x.py).

import json
from urllib.parse import urlencode

import frappe
import frappe.sessions
from frappe import _

no_cache = 1

# Doctypes Frappe OS should expose, mirroring the curated frontend config
# (frappe-os/src/config/doctypes.js). Each is permission- and existence-checked at
# registry build time, so entries for an app that isn't installed are skipped quietly.
REGISTRY_DOCTYPES = [
	# Frappe
	"User",
	"Role",
	"ToDo",
	"File",
	"Notification Log",
	"Comment",
	"Web Page",
	"Blog Post",
	# CRM
	"CRM Lead",
	"CRM Deal",
	"CRM Organization",
	"CRM Task",
	"Contact",
	"Note",
	# ERPNext
	"Sales Invoice",
	"Sales Order",
	"Quotation",
	"Customer",
	"Item",
	"Warehouse",
	"Stock Entry",
	"Delivery Note",
	"Payment Entry",
	"Journal Entry",
]

# Fieldtypes that are layout-only or unsupported by the rendering engine. Section
# Break is handled specially (its label groups the following fields) before this skip.
SKIP_FIELDTYPES = {
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Button",
	"Fold",
	"Heading",
}


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.response["status_code"] = 403
		frappe.redirect(f"/login?{urlencode({'redirect-to': frappe.request.path})}")
		raise frappe.Redirect
	# Injected as window.<key> so the shell has the registry, permissions and csrf
	# token on first paint. Must be a dict — the boot injector iterates its keys.
	context.boot = get_boot()
	context.csrf_token = frappe.sessions.get_csrf_token()
	return context


def get_boot():
	return {
		"user": frappe.session.user,
		"csrf_token": frappe.sessions.get_csrf_token(),
		"roles": frappe.get_roles(),
		"registry": get_registry(),
		"permissions": get_permissions(),
		"placements": get_placements(),
	}


@frappe.whitelist()
def boot():
	"""Same payload as the injected boot — used by the Vite dev server."""
	return get_boot()


def _readable_meta(doctype):
	"""Meta for a doctype the user can read, or None if it is missing or forbidden."""
	if not frappe.db.exists("DocType", doctype):
		return None
	if not frappe.has_permission(doctype, "read"):
		return None
	return frappe.get_meta(doctype)


def _unwrap_hook(value):
	"""Reverse `append_hook`'s shape: it list-wraps each scalar leaf and recurses into nested
	dicts (e.g. `default_surface`). So a list → its last-declared element, a dict → recursed,
	anything else → itself. Keeps `_os_app_decl` correct for nested-dict os_app fields."""
	if isinstance(value, dict):
		return {key: _unwrap_hook(inner) for key, inner in value.items()}
	if isinstance(value, list):
		return _unwrap_hook(value[-1]) if value else None
	return value


def _os_app_decl(app):
	"""An app's OS-native `os_app` hook (ADR-0021) as a flat dict, or {} if it ships none.
	`get_hooks` list-wraps each leaf and recurses into nested dicts (append_hook), so unwrap
	recursively to the last-declared value (handles flat identity + nested `default_surface`)."""
	raw = frappe.get_hooks("os_app", app_name=app) or {}
	return _unwrap_hook(raw)


def _installed_os_apps():
	"""Installed apps that opt into Frappe OS by shipping an `os_app` hook (ADR-0021). Opt-in
	*is* the declaration — there is no hardcoded core list; an app without `os_app` is not an OS
	app. Ordered by install order (frappe first), which drives the apps screen + contribution order."""
	return [app for app in frappe.get_installed_apps() if _os_app_decl(app)]


def _app_of(doctype):
	"""The app that ships a doctype (via its module), defaulting to frappe."""
	module = frappe.db.get_value("DocType", doctype, "module")
	app = frappe.db.get_value("Module Def", module, "app_name") if module else None
	return app or "frappe"


# Optional OS-native presentation keys an `os_app` may carry beyond title/logo, copied through
# to the `app` (identity) contribution when present (ADR-0021). Curated apps still overlay
# config/apps.ts client-side; an uncurated app rides on what its `os_app` declares.
_APP_PRESENTATION_KEYS = ("color", "glyph")


def _app_contribution(app, order):
	"""The `app` (identity) contribution for an OS app, projected from its `os_app` hook
	(ADR-0021): title, logo, and optional OS-native presentation. This is the *opt-in + identity*
	half of `os_app`; its `default_surface` field layers as a separate contribution (see slice 04).
	A logo/presentation key is carried only when declared, so a curated app keeps its config/apps.ts
	value (the client merges curated ⊕ server)."""
	decl = _os_app_decl(app)
	payload = {"id": app, "name": decl.get("title") or app.title()}
	if decl.get("logo"):
		payload["logo"] = decl["logo"]
	for key in _APP_PRESENTATION_KEYS:
		if decl.get(key):
			payload[key] = decl[key]
	return {"type": "app", "target": "", "name": app, "sourceApp": app, "payload": payload, "order": order}


def _valid_surface_ref(ref):
	"""True if `ref` is one of the stable surface-reference shapes (ADR-0021) — an applet, a
	doctype+view, or the dashboard — with an optional `app:` qualifier. Shape only: the value is
	carried through as data and the *client* resolver parses/resolves it (slice 05), so the server
	never leaks an internal Surface descriptor here. A ref failing every shape is malformed."""
	if not isinstance(ref, dict):
		return False
	if ref.get("applet"):
		return True
	if ref.get("doctype") and ref.get("view"):
		return True
	if ref.get("dashboard"):
		return True
	# A bare-app reference ({"app": "frappe"}, no applet/doctype/dashboard) — "open the app's
	# default surface". ADR-0023 lists "an app" as a surface-reference kind; here `app` carries
	# it alone rather than only qualifying one of the others.
	if ref.get("app"):
		return True
	return False


def _default_surface_contribution(app):
	"""The `default-surface` contribution for an OS app (ADR-0021), projected from the optional
	`default_surface` field of its `os_app` hook. This is the *landing* half of `os_app`, kept
	SEPARATE from the `app` identity contribution so the two layer independently (App-default <
	Site < User) — a per-user default surface is just a User-layer override of this Singleton,
	touching only the landing and never the logo. The payload is the stable, app-qualified surface
	REFERENCE vocabulary; shape is validated, a malformed ref is logged and dropped (never crashes
	boot). None when the app declares no default_surface — it then rides the resolver fallback."""
	ref = _os_app_decl(app).get("default_surface")
	if ref is None:
		return None
	if not _valid_surface_ref(ref):
		frappe.logger("frappe_os").warning(f"Skipped malformed os_app.default_surface from {app}: {ref!r}")
		return None
	return {"type": "default-surface", "target": app, "name": "default", "sourceApp": app, "payload": ref, "order": 0}


def _valid_contribution(spec, required, app, hook):
	"""True if `spec` is a dict carrying every required key; otherwise log and skip it. A single
	malformed hook entry must never crash the desktop boot (get_registry runs inside get_boot) —
	it degrades to one dropped contribution, logged so it is never silently lost (ADR-0014)."""
	if not isinstance(spec, dict):
		frappe.logger("frappe_os").warning(f"Skipped malformed {hook} entry from {app}: not a dict")
		return False
	missing = [key for key in required if spec.get(key) is None]
	if missing:
		frappe.logger("frappe_os").warning(f"Skipped {hook} contribution from {app}: missing {', '.join(missing)}")
		return False
	return True


def _view_contribution(doctype, name, label, app, order):
	return {
		"type": "doctype-view",
		"target": doctype,
		"name": name,
		"sourceApp": app,
		"payload": {"view": name, "label": label, "builtin": True},
		"order": order,
	}


def _hook_contributions(hook, required, project):
	"""Project an installed-OS-app `os_*` hook into uniform Registry contributions (ADR-0001):
	iterate installed OS apps only (ADR-0010), validate each entry (skip-with-warn, so one
	malformed entry never crashes boot), and delegate the per-extension-point shape to `project`,
	which returns the (type, target, name, payload) for one validated spec. The envelope
	(sourceApp + ADR-0007 identity + per-app declaration order) is uniform and lives here once."""
	contributions = []
	for app in _installed_os_apps():
		for order, spec in enumerate(frappe.get_hooks(hook, app_name=app) or []):
			if not _valid_contribution(spec, required, app, hook):
				continue
			contribution_type, target, name, payload = project(spec, app)
			contributions.append(
				{
					"type": contribution_type,
					"target": target,
					"name": name,
					"sourceApp": app,
					"payload": payload,
					"order": order,
				}
			)
	return contributions


def _applet_contributions():
	"""Applet contributions (ADR-0009): each installed OS app declares the applets it ships
	via the `os_applets` hook, so the OS never hardcodes another app's artifact. assetUrl is
	the app's public assets path for the declared filename, loaded at runtime as native ESM."""

	def project(spec, app):
		applet_id = spec["appletId"]
		return "applet", "", applet_id, {
			"appletId": applet_id,
			"appId": app,
			"assetUrl": f"/assets/{app}/os-applets/{spec['fileName']}",
			"label": spec.get("label", applet_id),
			"minOsApi": spec.get("minOsApi", 1),
			# How the window content is produced (ADR-0020): "native" Vue component vs "framed"
			# iframe. The client defaults absent → native, so only emit when the app declares it.
			"kind": spec.get("kind", "native"),
		}

	return _hook_contributions("os_applets", ("appletId", "fileName"), project)


def _command_contributions():
	"""Command contributions (Action model, CONTEXT.md → Command): each installed OS app declares
	the verbs it adds/overrides via the `os_commands` hook. Identity (ADR-0007) is
	(command, '', id, app); the payload is the client Command shape (id/sourceApp/title/handler).
	The OS's own first-party File Commands stay bundled in the frontend (their run Handlers are
	compiled in) — only app contributions flow through here."""

	def project(spec, app):
		return "command", "", spec["id"], {
			"id": spec["id"],
			"sourceApp": app,
			"title": spec["title"],
			"handler": spec["handler"],
		}

	return _hook_contributions("os_commands", ("id", "title", "handler"), project)


# Optional Action fields copied through to the client payload when present (ADR-0007): `when`
# gates the placement, `order` is its ascending RENDER position within the Region, `priority` the
# competition tiebreak (higher wins — a separate axis from render `order`), `layer` its override
# layer (App<Site<User), `commandPatch` re-titles the placed Command only when this Action wins,
# `removed` makes a winning Action a suppression instead of a render (ADR-0014 — an app may remove
# shared chrome; the strip is attributed + logged client-side, never silent).
_ACTION_PAYLOAD_KEYS = ("when", "order", "priority", "group", "layer", "commandPatch", "removed")


def _action_contributions():
	"""Action contributions (Action model, CONTEXT.md → Action): each installed OS app declares
	the placements (incl. overrides) it makes via the `os_actions` hook. Identity (ADR-0007) is
	(action, region, command, app); the payload is the client Action shape. `when` gates the
	placement contextually and `commandPatch` re-titles the placed Command only when this Action
	wins its (region, command) competition — the override-of-a-default this slice ships."""

	def project(spec, app):
		payload = {"command": spec["command"], "region": spec["region"], "sourceApp": app}
		for key in _ACTION_PAYLOAD_KEYS:
			if spec.get(key) is not None:
				payload[key] = spec[key]
		return "action", spec["region"], spec["command"], payload

	return _hook_contributions("os_actions", ("command", "region"), project)


# Fieldtype → the list column "type" the renderer themes (DocView). Plain text otherwise.
COLUMN_TYPES = {"Currency": "currency", "Int": "int"}


def _status_field(meta):
	"""A Select field named status/stage — Desk's status convention (None if absent)."""
	for name in ("status", "stage"):
		df = meta.get_field(name)
		if df and df.fieldtype == "Select":
			return name
	return None


def _list_column(df, status_field):
	"""One list column projected from a meta field; a status field renders as a pill."""
	column = {"key": df.fieldname, "label": df.label or df.fieldname}
	column_type = "status" if df.fieldname == status_field else COLUMN_TYPES.get(df.fieldtype)
	if column_type:
		column["type"] = column_type
	return column


def _list_columns(meta, status_field, title_field):
	"""List columns from the doctype's in_list_view fields (ADR-0011), the title first."""
	columns = [{"key": title_field, "label": _("Name"), "primary": True}]
	seen = {columns[0]["key"]}
	for df in meta.fields:
		if not df.in_list_view or df.fieldtype in SKIP_FIELDTYPES or df.fieldname in seen:
			continue
		seen.add(df.fieldname)
		columns.append(_list_column(df, status_field))
		if len(columns) >= 5:
			break
	return columns


def _title_default(doctype):
	"""The app-shipped title field (DocType row), ignoring this site's Property Setters —
	so the base display-config is the honest App-default layer a Site patch merges over."""
	return frappe.db.get_value("DocType", doctype, "title_field") or "name"


def _display_payload(doctype, meta):
	"""Display-config payload projected from Desk meta (ADR-0011): label, title, columns,
	status. OS-native presentation (icons, colors, status palettes) is overlaid client-side."""
	status_field = _status_field(meta)
	title_field = _title_default(doctype)
	payload = {
		"label": _(doctype),
		"titleField": title_field,
		"listColumns": _list_columns(meta, status_field, title_field),
	}
	if status_field:
		payload["statusField"] = status_field
	return payload


# Property Setter property → DisplayConfigPayload field (ADR-0011 Site layer). Only
# doctype-level scalar properties with a faithful OS equivalent map; the rest are skipped.
DISPLAY_PATCH_PROPERTIES = {"title_field": "titleField"}


def _doctype_property_setters():
	"""This site's doctype-level Property Setters for the registry doctypes, grouped by
	doctype. Field-level setters stay baked into meta (not patched here) — see ADR-0007."""
	rows = frappe.get_all(
		"Property Setter",
		filters={"doc_type": ["in", REGISTRY_DOCTYPES], "doctype_or_field": "DocType"},
		fields=["doc_type", "property", "value"],
	)
	grouped = {}
	for row in rows:
		grouped.setdefault(row.doc_type, []).append(row)
	return grouped


def _display_patch(doctype, setters):
	"""A partial display-config patch from a doctype's Property Setters (ADR-0007). A property
	with no OS payload field is logged and skipped — never silently dropped (ADR-0011)."""
	patch = {}
	for setter in setters:
		field = DISPLAY_PATCH_PROPERTIES.get(setter.property)
		if field:
			patch[field] = setter.value
		else:
			frappe.logger("frappe_os").info(f"Skipped Property Setter {doctype}.{setter.property}: no display field")
	return patch


def get_registry():
	"""The merged, permission-filtered Registry (ADR-0005/0010): app + default-surface +
	display-config + doctype-view contributions the user may see. An app's os_app projects two
	independent contributions — `app` (identity) and `default-surface` (landing, ADR-0021).
	Identity tuple per ADR-0007; tolerant
	schemaVersion per ADR-0008. Display-config payloads are projected from Desk meta
	(label/title/columns/status, ADR-0011); the client overlays OS-native presentation
	(branding, icons, status palettes, curated cards) Desk has no equivalent for. This
	site's doctype Property Setters ride along as a partial __site__ display-config patch
	(ADR-0007 App-default ⊕ Site-layer), the base carrying the app-default title."""
	contributions = []
	for order, app in enumerate(_installed_os_apps()):
		contributions.append(_app_contribution(app, order))
		surface = _default_surface_contribution(app)
		if surface:
			contributions.append(surface)
	property_setters = _doctype_property_setters()
	for doctype in REGISTRY_DOCTYPES:
		meta = _readable_meta(doctype)
		if not meta:
			continue
		app = _app_of(doctype)
		contributions.append(
			{
				"type": "display-config",
				"target": doctype,
				"name": "display",
				"sourceApp": app,
				"payload": _display_payload(doctype, meta),
			}
		)
		patch = _display_patch(doctype, property_setters.get(doctype, []))
		if patch:
			contributions.append(
				{
					"type": "display-config",
					"target": doctype,
					"name": "patch",
					"sourceApp": "__site__",
					"payload": patch,
					"order": 1,
				}
			)
		contributions.append(_view_contribution(doctype, "list", "List", app, 0))
		contributions.append(_view_contribution(doctype, "form", "Form", app, 1))
	contributions.extend(_applet_contributions())
	contributions.extend(_command_contributions())
	contributions.extend(_action_contributions())
	return {"schemaVersion": 1, "contributions": contributions}


# ── Placements (ADR-0023): a layered, role-scoped desktop and dock ────────────────
# The App-default baseline — OS-shipped pins reproducing today's desktop set for a fresh user
# (the desktop analog of APP_ORDER). OS-owned for v1; each is a structural placement (region +
# surface reference + position), its presentation overlaid client-side from the reference. The
# two seed icons land on the frappe and erpnext apps; a ref to an app the viewer can't see is
# dropped by the resolver, so an uninstalled app simply yields one fewer icon.
APP_DEFAULT_PLACEMENTS = [
	{"region": "desktop", "ref": {"app": "frappe"}, "position": {"column": 0, "row": 0}},
	{"region": "desktop", "ref": {"app": "erpnext"}, "position": {"column": 0, "row": 1}},
]


def _ref_key(ref):
	"""Canonical identity key for a surface reference — the dedup/override target. A Placement's
	identity is (region, surface-reference) (ADR-0023); this folds the reference half into a stable
	string so two layers pinning the same destination collapse to one."""
	return json.dumps(ref, sort_keys=True)


def merge_placements(baseline, site, overrides, can_see):
	"""Fold the three Placement layers into one resolved list in precedence order App < Site <
	User (ADR-0023). Pure — `can_see(ref) -> bool` is the injected permission gate (ADR-0010), so
	the merge logic is testable without a site. Baseline ∪ role-scoped Site are unioned and
	de-duped by identity (region, ref); then each User override mutates the matching base entry in
	place — a hide (tombstone) drops it, a position delta moves it, a reference not already present
	is a brand-new user pin appended at the end. A user override never mutates a baseline/Site row,
	only the user's own resolved view. Finally drop any pin whose reference the viewer may not see."""
	by_key, order = {}, []
	for placement in [*baseline, *site]:
		key = (placement["region"], _ref_key(placement["ref"]))
		if key not in by_key:
			by_key[key] = dict(placement)
			order.append(key)
	for override in overrides:
		key = (override["region"], _ref_key(override["ref"]))
		if override.get("hidden"):
			by_key.pop(key, None)
		elif key in by_key:
			if override.get("position") is not None:
				by_key[key]["position"] = override["position"]
		else:
			by_key[key] = {"region": override["region"], "ref": override["ref"], "position": override.get("position")}
			order.append(key)
	return [by_key[key] for key in order if key in by_key and can_see(by_key[key]["ref"])]


def _ref_visible(ref):
	"""May the viewer see the surface a reference points at (ADR-0010)? A doctype reference is
	gated by readable meta; every other shape (bare app / dashboard / applet) needs its owning app
	to be an installed OS app the viewer participates in. A redirect never grants access."""
	if not isinstance(ref, dict):
		return False
	if ref.get("doctype"):
		return _readable_meta(ref["doctype"]) is not None
	app = ref.get("app")
	return bool(app) and app in _installed_os_apps()


def _layer_rows(doctype, fields, filters=None):
	"""This site's stored rows for a placement layer, or [] before the DocType is migrated (boot
	must never crash). Reading the config table itself is not sensitive — the genuine gate is the
	per-reference permission check in the resolver (ADR-0010) — so this reads with permissions off
	and the resolver applies role-scoping / visibility."""
	if not frappe.db.exists("DocType", doctype):
		return []
	return frappe.get_all(doctype, filters=filters or {}, fields=fields, ignore_permissions=True)


def _parse_placement(row, hidden=False):
	"""One stored row → the resolver's dict shape, parsing its JSON reference and position."""
	placement = {"region": row.region, "ref": frappe.parse_json(row.surface_ref)}
	placement["position"] = frappe.parse_json(row.position) if row.position else None
	if hidden:
		placement["hidden"] = bool(row.hidden)
	return placement


def _site_placements():
	"""The Site layer for this user: every OS Placement row scoped to a role they hold (or to no
	role — offered to all). Role is a scope applied here by the same per-user visibility filter the
	Registry uses (ADR-0010), NOT a fourth precedence rung."""
	roles = set(frappe.get_roles())
	rows = _layer_rows("OS Placement", ["region", "surface_ref", "position", "role"])
	return [_parse_placement(row) for row in rows if not row.role or row.role in roles]


def _user_overrides():
	"""The User layer: this user's own OS Placement Override deltas (move / hide / new pin)."""
	rows = _layer_rows(
		"OS Placement Override",
		["region", "surface_ref", "position", "hidden"],
		filters={"owner": frappe.session.user},
	)
	return [_parse_placement(row, hidden=True) for row in rows]


def get_placements():
	"""The resolved desktop/dock placement list for the boot payload (ADR-0023): App-default
	baseline ∪ role-scoped Site ⊕ User overrides, permission-gated. The frontend receives only this
	merged result and never sees the layers; its sole write path is its own User-layer overrides."""
	return merge_placements(APP_DEFAULT_PLACEMENTS, _site_placements(), _user_overrides(), _ref_visible)


def _canonical_json(value):
	"""A surface reference / position normalised to a stable canonical JSON string. Storing the
	reference canonically (sorted keys) is what lets the upsert below find an existing override by
	exact match — the same identity key the resolver dedups on (ADR-0023)."""
	if value is None:
		return None
	return json.dumps(frappe.parse_json(value) if isinstance(value, str) else value, sort_keys=True)


def _own_override(region, ref):
	"""The current user's existing OS Placement Override row for one (region, surface-reference)
	identity, or None — the upsert/delete target. Owner-scoped: a user only ever touches their own."""
	return frappe.db.get_value(
		"OS Placement Override", {"owner": frappe.session.user, "region": region, "surface_ref": ref}
	)


@frappe.whitelist(methods=["POST"])
def save_placement_override(region: str, surface_ref: str, position: str | None = None, hidden: int = 0):
	"""Upsert the current user's User-layer OS Placement Override for one (region, surface-reference)
	identity — the frontend's ONLY placement write path (ADR-0023). A move carries `position`, a
	personal hide sets `hidden`, a brand-new pin carries both a fresh reference and a position. Only
	the caller's own row is ever created/updated; baseline and Site rows are untouched. `surface_ref`
	and `position` arrive as JSON strings and are stored canonically so the identity match holds."""
	ref = _canonical_json(surface_ref)
	existing = _own_override(region, ref)
	doc = frappe.get_doc("OS Placement Override", existing) if existing else frappe.new_doc("OS Placement Override")
	doc.update({"region": region, "surface_ref": ref, "position": _canonical_json(position), "hidden": int(hidden)})
	doc.save() if existing else doc.insert()
	return {"name": doc.name}


@frappe.whitelist(methods=["POST"])
def delete_placement_override(region: str, surface_ref: str):
	"""Clear the caller's own override delta for a (region, surface-reference) — e.g. un-hiding a pin
	or resetting a personal move back to the resolved baseline/Site position. No-op if none exists."""
	name = _own_override(region, _canonical_json(surface_ref))
	if name:
		frappe.delete_doc("OS Placement Override", name)
	return {"deleted": bool(name)}


def get_permissions():
	"""Standard per-doctype permission map (read/write/create/delete) so the desktop can
	gate actions upfront; the server stays the enforcement boundary (ADR-0010)."""
	perms = {}
	for doctype in REGISTRY_DOCTYPES:
		if not _readable_meta(doctype):
			continue
		perms[doctype] = {
			ptype: frappe.has_permission(doctype, ptype)
			for ptype in ("read", "write", "create", "delete")
		}
	return perms


@frappe.whitelist()
def get_doctype_meta(doctype: str):
	"""Lean field descriptors the form needs, each tagged with its Section Break label."""
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	meta = frappe.get_meta(doctype)
	fields = []
	current_section = ""
	for df in meta.fields:
		if df.fieldtype == "Section Break":
			current_section = df.label or ""
			continue
		if df.fieldtype in SKIP_FIELDTYPES or df.hidden:
			continue
		fields.append(
			{
				"fieldname": df.fieldname,
				"label": df.label,
				"fieldtype": df.fieldtype,
				"options": df.options,
				"section": current_section,
				"reqd": bool(df.reqd),
				"read_only": bool(df.read_only),
				"in_list_view": bool(df.in_list_view),
			}
		)

	return {
		"doctype": meta.name,
		"title_field": meta.title_field or "name",
		"can_create": frappe.has_permission(doctype, "create"),
		"can_write": frappe.has_permission(doctype, "write"),
		"fields": fields,
	}


@frappe.whitelist()
def card_value(doctype: str, filters: str | list | dict | None = None, fieldname: str | None = None):
	"""Dashboard card value: a live count, or a sum of `fieldname` when given."""
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted to read {0}").format(doctype), frappe.PermissionError)

	filters = frappe.parse_json(filters) if filters else None
	if fieldname:
		rows = frappe.get_all(doctype, filters=filters or {}, fields=[f"sum(`{fieldname}`) as total"])
		return (rows[0].total if rows else 0) or 0
	return frappe.db.count(doctype, filters)


def setup_desk_switch():
	"""Add a 'Switch to Frappe OS' entry to the Desk navbar (user dropdown). Idempotent.

	Data-driven via Navbar Settings — no Desk JS changes, no asset rebuild.
	Run once: bench --site <site> execute frappe.www.os.setup_desk_switch
	"""
	label = "Switch to Frappe OS ✨"
	settings = frappe.get_doc("Navbar Settings")
	if any((i.item_label or "") == label for i in settings.settings_dropdown):
		return "already present"
	settings.append(
		"settings_dropdown",
		{
			"item_label": label,
			"item_type": "Action",
			"action": "window.location.href = '/os'",
			"is_standard": 0,
		},
	)
	settings.save()
	frappe.db.commit()
	return "added"
