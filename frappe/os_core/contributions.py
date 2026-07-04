# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Projecting an installed OS app's declarations into uniform Registry contributions (ADR-0001/0005).
# An app opts into Frappe OS by shipping an `os/` manifest (ADR-0030); this reads that manifest as
# data and emits the `app` identity, `default-surface`, applet, action, and command contributions.
# The envelope — sourceApp + ADR-0007 identity + declaration order — is uniform and lives here
# once; `registry.py` assembles these with the doctype views.

import frappe
from frappe.os_core import manifest


def _os_app_decl(app):
	"""An app's OS identity declaration — its `os/app.json` manifest (ADR-0030) — as a flat dict,
	or {} if it ships none. Pure data read from the co-located `os/` folder, never executed."""
	return manifest.app_declaration(app) or {}


def _installed_os_apps():
	"""Installed apps that opt into Frappe OS by shipping an `os/app.json` manifest (ADR-0030).
	Opt-in *is* the folder — there is no hardcoded core list; an app without one is not an OS app.
	Ordered by install order (frappe first), which drives the apps screen + contribution order."""
	return manifest.installed_os_apps()


# Optional OS-native presentation keys an app manifest may carry beyond title/logo, copied through
# to the `app` (identity) contribution when present (ADR-0021). Curated apps still overlay
# config/apps.ts client-side; an uncurated app rides on what its `app.json` declares.
_APP_PRESENTATION_KEYS = ("color", "glyph")


def _app_contribution(app, order):
	"""The `app` (identity) contribution for an OS app, projected from its `os/app.json` manifest
	(ADR-0030, amending ADR-0021): title, logo, and optional OS-native presentation. This is the
	*opt-in + identity* half; its `default_surface` field layers as a separate contribution.
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
	`default_surface` field of its `os/app.json` manifest. This is the *landing* half, kept
	SEPARATE from the `app` identity contribution so the two layer independently (App-default <
	Site < User) — a per-user default surface is just a User-layer override of this Singleton,
	touching only the landing and never the logo. The payload is the stable, app-qualified surface
	REFERENCE vocabulary; shape is validated, a malformed ref is logged and dropped (never crashes
	boot). None when the app declares no default_surface — it then rides the resolver fallback."""
	ref = _os_app_decl(app).get("default_surface")
	if ref is None:
		return None
	if not _valid_surface_ref(ref):
		frappe.logger("frappe_os").warning(f"Skipped malformed app.json default_surface from {app}: {ref!r}")
		return None
	return {"type": "default-surface", "target": app, "name": "default", "sourceApp": app, "payload": ref, "order": 0}


def _valid_contribution(spec, required, app, source):
	"""True if `spec` is a dict carrying every required key; otherwise log and skip it. A single
	malformed manifest entry must never crash the desktop boot (get_registry runs inside get_boot) —
	it degrades to one dropped contribution, logged so it is never silently lost (ADR-0014)."""
	if not isinstance(spec, dict):
		frappe.logger("frappe_os").warning(f"Skipped malformed {source} entry from {app}: not a dict")
		return False
	missing = [key for key in required if spec.get(key) is None]
	if missing:
		frappe.logger("frappe_os").warning(f"Skipped {source} contribution from {app}: missing {', '.join(missing)}")
		return False
	return True


def _project_specs(specs, required, project, app, source):
	"""Validate a list of one app's manifest specs and project each into a uniform contribution
	envelope (sourceApp + ADR-0007 identity + per-app declaration order). A malformed entry is
	skipped-with-warn (`source` names the file/folder in the log), so one bad entry never crashes
	boot. Shared by the single-file (`os/actions.json`) and folder (`os/applets/`) readers."""
	contributions = []
	for order, spec in enumerate(specs):
		if not _valid_contribution(spec, required, app, source):
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


def _manifest_contributions(filename, required, project):
	"""Project an installed-OS-app manifest file (`os/<filename>`, a JSON list) into uniform
	Registry contributions (ADR-0030) — the single-file twin of `_manifest_folder_contributions`.
	Iterate installed OS apps only (ADR-0010) and read the file as data (absent → skip, non-list →
	skip-with-warn)."""
	contributions = []
	for app in _installed_os_apps():
		specs = manifest.read(app, filename)
		if specs is None:
			continue
		if not isinstance(specs, list):
			frappe.logger("frappe_os").warning(f"Skipped OS manifest {filename} from {app}: not a list")
			continue
		contributions.extend(_project_specs(specs, required, project, app, filename))
	return contributions


def _manifest_folder_contributions(subfolder, required, project):
	"""Project an installed-OS-app manifest folder (`os/<subfolder>/`, one JSON file per
	declaration) into uniform Registry contributions (ADR-0030). Each file is one spec, read as
	data and ordered by filename; adding a declaration is adding one file. Used for `os/applets/`."""
	contributions = []
	for app in _installed_os_apps():
		specs = manifest.dir_entries(app, subfolder)
		contributions.extend(_project_specs(specs, required, project, app, subfolder))
	return contributions


def applet_contributions():
	"""Applet contributions (ADR-0009): each installed OS app declares the applets it ships as one
	file per applet in its `os/applets/` manifest folder (ADR-0030), so the OS never hardcodes
	another app's artifact. assetUrl is the app's public assets path for the declared filename,
	loaded at runtime as native ESM."""

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
			# Whether the applet wants the OS app nav rail beside it (ADR-0026) — an explicit
			# capability, orthogonal to `kind`: the applet decides, the OS never defaults it on.
			# Absent → no rail (the client defaults absent → False).
			"nav": spec.get("nav", False),
		}

	return _manifest_folder_contributions("applets", ("appletId", "fileName"), project)


def command_contributions():
	"""App-level Command contributions (Action model, CONTEXT.md → Command): each installed OS app
	declares the verbs it adds/overrides in its `os/commands.json` manifest (ADR-0030) — the App-tier
	twin of the doctype-scoped commands read off live meta. Identity (ADR-0007) is (command, '', id,
	app); the payload is the client Command shape (id/sourceApp/title/handler). The OS's own
	first-party File Commands stay bundled in the frontend (their run Handlers are compiled in) — only
	app contributions flow through here."""
	return _manifest_contributions("commands.json", ("id", "title", "handler"), _command_project)


# Optional Action fields copied through to the client payload when present (ADR-0007): `when`
# gates the placement, `order` is its ascending RENDER position within the Region, `priority` the
# competition tiebreak (higher wins — a separate axis from render `order`), `layer` its override
# layer (App<Site<User), `commandPatch` re-titles the placed Command only when this Action wins,
# `removed` makes a winning Action a suppression instead of a render (ADR-0014 — an app may remove
# shared chrome; the strip is attributed + logged client-side, never silent).
_ACTION_PAYLOAD_KEYS = ("when", "order", "priority", "group", "layer", "commandPatch", "removed")


def _const(value):
	"""A one-arg function that always returns `value`, ignoring its argument. Binds a fixed Scope
	into the action projector below, sidestepping the late-binding a loop-captured lambda suffers."""
	return lambda _app: value


def _action_project(scope_of):
	"""Build an action-spec projector that stamps the Scope its manifest tier implies (ADR-0032),
	so the client auto-derives Eligibility and picks the delivery channel. `scope_of(app)` yields
	the ScopeBinding — App scope keys on the contributing app; Doctype/View scope on the surface."""

	def project(spec, app):
		payload = {"command": spec["command"], "region": spec["region"], "sourceApp": app, "scope": scope_of(app)}
		for key in _ACTION_PAYLOAD_KEYS:
			if spec.get(key) is not None:
				payload[key] = spec[key]
		return "action", spec["region"], spec["command"], payload

	return project


def action_contributions():
	"""App-scope Action contributions (Action model, CONTEXT.md → Action): each installed OS app
	declares the placements (incl. overrides) it makes in its `os/actions.json` manifest (ADR-0030),
	delivered on boot (ADR-0028). Identity (ADR-0007) is (action, region, command, app). Because the
	action is co-located in an app's manifest, it is App-scoped (ADR-0032) — the projector stamps
	`scope: {tier:'app', app}` so the client auto-derives its `{activeApp}` Eligibility."""
	return _manifest_contributions(
		"actions.json", ("command", "region"), _action_project(lambda app: {"tier": "app", "app": app})
	)


def menu_contributions():
	"""App-declared menu-bar menu contributions (ADR-0039 rule 2): each installed OS app declares the
	menus it adds in its `os/menus.json` manifest — `[{id, title, order?, target?}]`. Each becomes an
	`app-menu` contribution whose `target` is the app whose bar the menu joins (`target` defaults to the
	declaring app — the common self case). Authorship is open (ADR-0001): an app may declare a menu into
	ANOTHER real app's band (a custom app extending erpnext), so `target` may differ from `sourceApp`;
	the client drops a target that is not a real OS app. The client qualifies id → a
	`menubar:app:<target>:<id>` Region, rendered while the target app is focused. A menu missing id/title
	is rejected loudly (never crashes boot); ordering rides the declared `order`."""

	def project(spec, app):
		return "app-menu", spec.get("target", app), spec["id"], {
			"id": spec["id"],
			"title": spec["title"],
			"order": spec.get("order", 0),
		}

	return _manifest_contributions("menus.json", ("id", "title"), project)


def _doctype_scope(scope_file, doctype):
	"""The Scope a doctype-manifest file implies (ADR-0032): `doctype.json` carries to all views
	(Doctype scope); `list.json` / `form.json` are View scope for that one view."""
	if scope_file == "doctype":
		return {"tier": "doctype", "doctype": doctype}
	return {"tier": "view", "doctype": doctype, "view": scope_file}


def _command_project(spec, app):
	"""Project a manifest Command (the verb) into a uniform `command` contribution. Scope lives on
	the Action placement, never the Command — the verb is the same whoever places it — so a Command
	is delivered unscoped, carrying the run/navigate Handler resolved lazily on invoke (ADR-0007)."""
	return "command", "", spec["id"], {"id": spec["id"], "sourceApp": app, "title": spec["title"], "handler": spec["handler"]}


def doctype_scoped_contributions(doctype, module):
	"""Doctype/View-scoped Action + Command contributions from a doctype's co-located `os/` manifest
	(ADR-0030/0032), delivered on live meta (ADR-0028) when the doctype opens — the live-meta half of
	delivery-by-scope, twinning the boot-delivered App scope. Each scope file's `actions`/`commands`
	are projected into the same uniform envelope; actions carry the file's Scope so the client
	auto-derives Eligibility. sourceApp is the app owning the doctype's module."""
	app = manifest.app_of_module(module)
	rows = []
	for scope_file, config in manifest.doctype_manifest(doctype, module).items():
		project = _action_project(_const(_doctype_scope(scope_file, doctype)))
		rows.extend(_project_specs(config.get("actions") or [], ("command", "region"), project, app, scope_file))
		rows.extend(_project_specs(config.get("commands") or [], ("id", "title", "handler"), _command_project, app, scope_file))
	return rows
