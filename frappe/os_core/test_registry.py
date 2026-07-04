# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the OS Registry assembly + merge core (ADR-0005/0010/0008): the boot
# envelope, the App-default ⊕ Site-layer display merge, and the permission map. Every DB seam
# (meta, Property Setters, contribution projection, has_permission) is injected, so it runs with
# no site/DB:
#   bench run-tests --module frappe.os_core.test_registry
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_registry

import unittest
import unittest.mock as mock

import frappe
from frappe.os_core import contributions, registry


class TestResolveDoctypeEnvelope(unittest.TestCase):
	"""resolve_doctype returns the SAME `{schemaVersion, contributions}` envelope get_registry
	emits (ADR-0008), not a bare list — so a future schema bump is negotiable on both paths."""

	def test_readable_doctype_returns_the_registry_envelope(self):
		contribs = [{"type": "display-config", "target": "Ostrich Thing", "name": "display"}]
		with mock.patch.object(registry, "readable_meta", return_value=mock.Mock()), \
			mock.patch.object(registry, "_property_setters_of", return_value=[]), \
			mock.patch.object(registry, "_doctype_contributions", return_value=contribs):
			out = registry.resolve_doctype("Ostrich Thing")
		self.assertEqual(out, {"schemaVersion": 1, "contributions": contribs})

	def test_missing_or_forbidden_doctype_returns_none(self):
		with mock.patch.object(registry, "readable_meta", return_value=None):
			self.assertIsNone(registry.resolve_doctype("Ghost Thing"))

	def test_resolve_and_boot_share_one_envelope_shape(self):
		# Both entry points wrap in the identical key set, so the client unwraps them the same way.
		contribs = [{"type": "display-config", "target": "Ostrich Thing", "name": "display"}]
		with mock.patch.object(registry, "readable_meta", return_value=mock.Mock()), \
			mock.patch.object(registry, "_property_setters_of", return_value=[]), \
			mock.patch.object(registry, "_doctype_contributions", return_value=contribs):
			resolved = registry.resolve_doctype("Ostrich Thing")
		self.assertEqual(set(resolved.keys()), {"schemaVersion", "contributions"})


class TestGetRegistryEnvelope(unittest.TestCase):
	"""get_registry wraps the merged contribution list in the same `{schemaVersion, contributions}`
	envelope and includes a doctype ONLY when the user may read it — permission gating at build
	time (ADR-0010). All projection + meta seams are injected."""

	def test_wraps_the_contribution_list_in_the_schema_envelope(self):
		with mock.patch.object(contributions, "_installed_os_apps", return_value=[]), \
			mock.patch.object(contributions, "applet_contributions", return_value=[]), \
			mock.patch.object(contributions, "command_contributions", return_value=[]), \
			mock.patch.object(contributions, "action_contributions", return_value=[]), \
			mock.patch.object(registry, "_doctype_property_setters", return_value={}), \
			mock.patch.object(registry, "readable_meta", return_value=None):
			out = registry.get_registry()
		self.assertEqual(set(out.keys()), {"schemaVersion", "contributions"})
		self.assertEqual(out["schemaVersion"], 1)

	def test_includes_only_readable_doctypes(self):
		# ToDo is readable, everything else in REGISTRY_DOCTYPES is forbidden → only ToDo's slice
		# reaches the envelope, and _doctype_contributions is invoked exactly once.
		todo_slice = [{"type": "display-config", "target": "ToDo", "name": "display"}]
		with mock.patch.object(contributions, "_installed_os_apps", return_value=[]), \
			mock.patch.object(contributions, "applet_contributions", return_value=[]), \
			mock.patch.object(contributions, "command_contributions", return_value=[]), \
			mock.patch.object(contributions, "action_contributions", return_value=[]), \
			mock.patch.object(registry, "_doctype_property_setters", return_value={}), \
			mock.patch.object(registry, "readable_meta", side_effect=lambda dt: mock.Mock() if dt == "ToDo" else None), \
			mock.patch.object(registry, "_doctype_contributions", return_value=todo_slice) as dc:
			out = registry.get_registry()
		dc.assert_called_once()
		self.assertIn(todo_slice[0], out["contributions"])


class TestDoctypeContributionsLayerMerge(unittest.TestCase):
	"""One doctype's slice is App-default ⊕ Site-layer (ADR-0007): the app-default display-config +
	list/form views, and — when this site has a mapped doctype Property Setter — a second
	display-config from __site__ at order 1, above the app default."""

	def test_base_display_and_views_without_a_site_patch(self):
		meta = mock.Mock(module="Core")
		with mock.patch.object(registry, "_app_of", return_value="frappe"), \
			mock.patch.object(registry, "_", lambda s: s):
			out = registry._doctype_contributions("ToDo", meta, [])
		self.assertEqual([c["type"] for c in out], ["display-config", "doctype-view", "doctype-view"])
		self.assertNotIn("__site__", [c["sourceApp"] for c in out])

	def test_site_property_setter_rides_as_a_site_layer_patch(self):
		meta = mock.Mock(module="Core")
		setters = [frappe._dict(doc_type="ToDo", property="some_property", value="Renamed")]
		with mock.patch.object(registry, "_app_of", return_value="frappe"), \
			mock.patch.object(registry, "_", lambda s: s), \
			mock.patch.dict(registry.DISPLAY_PATCH_PROPERTIES, {"some_property": "someField"}):
			out = registry._doctype_contributions("ToDo", meta, setters)
		patches = [c for c in out if c["sourceApp"] == "__site__"]
		self.assertEqual(len(patches), 1)
		self.assertEqual(patches[0]["payload"], {"someField": "Renamed"})
		self.assertEqual(patches[0]["order"], 1)

	def test_unmapped_property_setter_is_skipped_not_patched(self):
		# A Property Setter with no OS display field is logged and dropped (ADR-0011), never a patch.
		meta = mock.Mock(module="Core")
		setters = [frappe._dict(doc_type="ToDo", property="no_os_field", value="x")]
		with mock.patch.object(registry, "_app_of", return_value="frappe"), \
			mock.patch.object(registry, "_", lambda s: s), \
			mock.patch.object(registry.frappe, "logger"):
			out = registry._doctype_contributions("ToDo", meta, setters)
		self.assertNotIn("__site__", [c["sourceApp"] for c in out])


class TestGetPermissions(unittest.TestCase):
	"""The per-doctype read/write/create/delete map the desktop gates actions with — the server
	stays the enforcement boundary (ADR-0010). Built only over readable curated doctypes."""

	def test_permission_map_for_a_non_system_manager(self):
		# A restricted user: may read ToDo but not write/create/delete it, and may not read any
		# other curated doctype. The forbidden ones never appear; ToDo reads read-only.
		def has_perm(doctype, ptype):
			return doctype == "ToDo" and ptype == "read"

		with mock.patch.object(registry, "readable_meta", side_effect=lambda dt: object() if dt == "ToDo" else None), \
			mock.patch.object(registry.frappe, "has_permission", side_effect=has_perm):
			perms = registry.get_permissions()
		self.assertEqual(set(perms.keys()), {"ToDo"})
		self.assertEqual(perms["ToDo"], {"read": True, "write": False, "create": False, "delete": False})

	def test_only_surfaces_curated_registry_doctypes(self):
		with mock.patch.object(registry, "readable_meta", return_value=object()), \
			mock.patch.object(registry.frappe, "has_permission", return_value=True):
			perms = registry.get_permissions()
		self.assertEqual(set(perms.keys()), set(registry.REGISTRY_DOCTYPES))


class TestRegistryDoctypes(unittest.TestCase):
	"""The curated exposure list is the one place `what exists` is decided for the OS (ADR-0010),
	mirroring the frontend config — so it stays duplicate-free and covers the frappe core."""

	def test_curated_list_has_no_duplicates(self):
		self.assertEqual(len(registry.REGISTRY_DOCTYPES), len(set(registry.REGISTRY_DOCTYPES)))

	def test_covers_the_frappe_core_doctypes(self):
		for doctype in ("User", "Role", "ToDo", "File"):
			self.assertIn(doctype, registry.REGISTRY_DOCTYPES)


if __name__ == "__main__":
	unittest.main()
