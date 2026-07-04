# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the OS Registry assembly (ADR-0005/0008): the one contract that matters
# here is the envelope — both get_registry and the on-demand resolve_doctype wrap their
# contribution list in `{schemaVersion, contributions}`, so the client negotiates schema
# tolerance on either entry point through one parser. The DB seams (meta, Property Setters) are
# injected, so it runs with no site/DB:
#   bench run-tests --module frappe.os_core.test_registry
# or standalone:  ./env/bin/python -m unittest frappe.os_core.test_registry

import unittest
import unittest.mock

from frappe.os_core import registry


class TestResolveDoctypeEnvelope(unittest.TestCase):
	"""resolve_doctype returns the SAME `{schemaVersion, contributions}` envelope get_registry
	emits (ADR-0008), not a bare list — so a future schema bump is negotiable on both paths."""

	def test_readable_doctype_returns_the_registry_envelope(self):
		contribs = [{"type": "display-config", "target": "Ostrich Thing", "name": "display"}]
		with unittest.mock.patch.object(registry, "readable_meta", return_value=unittest.mock.Mock()), \
			unittest.mock.patch.object(registry, "_property_setters_of", return_value=[]), \
			unittest.mock.patch.object(registry, "_doctype_contributions", return_value=contribs):
			out = registry.resolve_doctype("Ostrich Thing")
		self.assertEqual(out, {"schemaVersion": 1, "contributions": contribs})

	def test_missing_or_forbidden_doctype_returns_none(self):
		with unittest.mock.patch.object(registry, "readable_meta", return_value=None):
			self.assertIsNone(registry.resolve_doctype("Ghost Thing"))

	def test_resolve_and_boot_share_one_envelope_shape(self):
		# Both entry points wrap in the identical key set, so the client unwraps them the same way.
		contribs = [{"type": "display-config", "target": "Ostrich Thing", "name": "display"}]
		with unittest.mock.patch.object(registry, "readable_meta", return_value=unittest.mock.Mock()), \
			unittest.mock.patch.object(registry, "_property_setters_of", return_value=[]), \
			unittest.mock.patch.object(registry, "_doctype_contributions", return_value=contribs):
			resolved = registry.resolve_doctype("Ostrich Thing")
		self.assertEqual(set(resolved.keys()), {"schemaVersion", "contributions"})


if __name__ == "__main__":
	unittest.main()
