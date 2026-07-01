# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# The OS manifest reader (ADR-0030). An app — or a doctype — declares everything it contributes
# to Frappe OS in a co-located `os/` folder, discovered by convention. This reads that folder as
# pure data (JSON) and never executes it; an app is an OS app *because it ships* `os/app.json`.
# Retires the scattered `os_app` / `os_actions` / `os_applets` hooks (ADR-0030, amending ADR-0021).

import json
import os

import frappe
from frappe.utils.caching import request_cache

# The manifest folder's fixed name, co-located under an app or a doctype.
MANIFEST_DIR = "os"

# A doctype's manifest scopes (ADR-0030): `doctype` carries to all views; `list`/`form` are the
# per-view files. One file per scope, config-types as keys inside — adding a view is one file.
DOCTYPE_MANIFEST_SCOPES = ("doctype", "list", "form")


def _read_json(path):
	"""Parse a JSON file at `path`, or None if it is missing or malformed. Read as data — the
	file is never imported or executed. A malformed file degrades to None (logged, never lost),
	so one bad manifest never crashes boot (ADR-0014)."""
	try:
		with open(path) as manifest_file:
			return json.load(manifest_file)
	except FileNotFoundError:
		return None
	except (json.JSONDecodeError, OSError, UnicodeDecodeError) as error:
		frappe.logger("frappe_os").warning(f"Skipped malformed OS manifest {path}: {error}")
		return None


def read(app, *segments):
	"""Parse a JSON file inside an app's `os/` manifest folder, or None if absent/malformed.
	`segments` name the file below `os/` — e.g. read("erpnext", "app.json")."""
	return _read_json(frappe.get_app_path(app, MANIFEST_DIR, *segments))


def _read_dir(directory):
	"""Parse every `*.json` file in `directory` as data, returned sorted by filename for stable
	order. A missing folder yields []; a non-dict or malformed file is skipped. This is the
	folder-of-files scope (`os/applets/`) where each file is one declaration (ADR-0030)."""
	if not os.path.isdir(directory):
		return []
	entries = []
	for name in sorted(os.listdir(directory)):
		if not name.endswith(".json"):
			continue
		parsed = _read_json(os.path.join(directory, name))
		if isinstance(parsed, dict):
			entries.append(parsed)
	return entries


def dir_entries(app, *segments):
	"""Every declaration in a manifest subfolder (`os/<segments>/`), each a dict, sorted by
	filename — e.g. dir_entries("raven", "applets"). Missing folder → []."""
	return _read_dir(frappe.get_app_path(app, MANIFEST_DIR, *segments))


@request_cache
def app_declaration(app):
	"""The app's `os/app.json` as a dict, or None if it ships no OS manifest. Presence of
	`os/app.json` is the opt-in — an app is an OS app because it ships one (ADR-0030). A payload
	that is not a dict is treated as no manifest. Request-cached: it is read many times per boot
	(every projection re-derives the OS-app set), but the file changes only on deploy."""
	declaration = read(app, "app.json")
	return declaration if isinstance(declaration, dict) else None


def _read_scopes(directory, scopes):
	"""Parse each `<scope>.json` in `directory` into a scope-keyed dict, omitting absent or
	non-dict scopes. The doctype-scope manifest (ADR-0030): one file per view/scope, config-types
	as keys inside. A missing folder yields {} (each file read returns None)."""
	scoped = {}
	for scope in scopes:
		data = _read_json(os.path.join(directory, f"{scope}.json"))
		if isinstance(data, dict):
			scoped[scope] = data
	return scoped


def doctype_manifest(doctype, module):
	"""A doctype's co-located `os/` manifest (ADR-0030), keyed by scope — `doctype` (carries to all
	views), `list`, `form`. Read as data from `<module>/doctype/<doctype>/os/`; {} when the doctype
	ships none. The later folders (indicator rules, scoped actions) consume this off live meta."""
	directory = frappe.get_module_path(module, "doctype", frappe.scrub(doctype), MANIFEST_DIR)
	return _read_scopes(directory, DOCTYPE_MANIFEST_SCOPES)


@request_cache
def installed_os_apps():
	"""Installed apps that opt into Frappe OS by shipping `os/app.json` (ADR-0030). Opt-in is the
	folder; there is no central list. Ordered by install order (frappe first), which drives the
	apps screen and contribution order. Request-cached — every boot re-derives this set several
	times."""
	return [app for app in frappe.get_installed_apps() if app_declaration(app)]
