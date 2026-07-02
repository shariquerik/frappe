# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Pure unit tests for the server-side indicator projection (ADR-0028 / ADR-0031): the OS default
# rules, the app-rules-over-defaults merge, and the auto-fetch field list. No DB — meta, workflow
# and the manifest reader are faked.
#   bench run-tests --module frappe.oscore.test_indicators
# or standalone:  ./env/bin/python -m unittest frappe.oscore.test_indicators

import unittest
import unittest.mock

from frappe.oscore import indicators


class TestDefaultIndicatorRules(unittest.TestCase):
	def test_lists_tiers_in_fallthrough_order(self):
		rules = indicators.default_indicator_rules("status", {"Paid": "green"}, True, "published", "enabled")
		self.assertEqual(
			rules,
			[
				{"condition": "status,=,Paid", "label": "Paid", "color": "green"},
				{"condition": "docstatus,=,1", "label": "Submitted", "color": "blue"},
				{"condition": "published,=,1", "label": "Published", "color": "green"},
				{"condition": "published,=,0", "label": "Not Published", "color": "gray"},
				{"condition": "enabled,=,1", "label": "Enabled", "color": "blue"},
				{"condition": "enabled,=,0", "label": "Disabled", "color": "gray"},
			],
		)

	def test_states_need_a_status_field(self):
		self.assertEqual(indicators.default_indicator_rules(None, {"Paid": "green"}, False, None, None), [])

	def test_is_private_is_inverse_polarity(self):
		rules = indicators.default_indicator_rules(None, {}, False, "is_private", None)
		self.assertEqual(
			rules,
			[
				{"condition": "is_private,=,1", "label": "Private", "color": "gray"},
				{"condition": "is_private,=,0", "label": "Public", "color": "green"},
			],
		)

	def test_disabled_polarity_is_opposite_of_enabled(self):
		rules = indicators.default_indicator_rules(None, {}, False, None, "disabled")
		self.assertEqual(
			rules,
			[
				{"condition": "disabled,=,1", "label": "Disabled", "color": "gray"},
				{"condition": "disabled,=,0", "label": "Enabled", "color": "blue"},
			],
		)

	def test_non_submittable_has_no_submitted_rule(self):
		self.assertEqual(indicators.default_indicator_rules(None, {}, False, None, None), [])


class TestAppIndicatorRules(unittest.TestCase):
	def _with_manifest(self, payload):
		reader = indicators.manifest.doctype_manifest
		indicators.manifest.doctype_manifest = lambda doctype, module: payload
		self.addCleanup(lambda: setattr(indicators.manifest, "doctype_manifest", reader))

	def test_reads_and_cleans_declared_rules(self):
		self._with_manifest({"doctype": {"indicator": [{"condition": "per_billed,<,100", "label": "To Bill", "color": "orange"}]}})
		self.assertEqual(
			indicators.app_indicator_rules("Sales Invoice", "Selling"),
			[{"condition": "per_billed,<,100", "label": "To Bill", "color": "orange"}],
		)

	def test_defaults_condition_and_color_skips_labelless(self):
		self._with_manifest({"doctype": {"indicator": [{"label": "Flag"}, {"color": "red"}, "junk"]}})
		# A label-only rule keeps its label, defaulting condition (catch-all) and color; the others drop.
		self.assertEqual(indicators.app_indicator_rules("X", "Y"), [{"condition": "", "label": "Flag", "color": "gray"}])

	def test_no_manifest_declares_no_rules(self):
		self._with_manifest({})
		self.assertEqual(indicators.app_indicator_rules("X", "Y"), [])


class TestMergeRuleLayer(unittest.TestCase):
	def _ladder(self):
		return [
			{"condition": "status,=,Paid", "label": "Paid", "color": "green"},
			{"condition": "docstatus,=,1", "label": "Submitted", "color": "blue"},
		]

	def test_matching_condition_replaces_in_place(self):
		# A recolor keeps the rule at its slot — first-match order is unchanged.
		patched = indicators.merge_rule_layer(self._ladder(), [{"condition": "status,=,Paid", "label": "Paid", "color": "teal"}])
		self.assertEqual(
			patched,
			[
				{"condition": "status,=,Paid", "label": "Paid", "color": "teal"},
				{"condition": "docstatus,=,1", "label": "Submitted", "color": "blue"},
			],
		)

	def test_hidden_drops_the_matching_rule(self):
		patched = indicators.merge_rule_layer(self._ladder(), [{"condition": "docstatus,=,1", "hidden": True}])
		self.assertEqual(patched, [{"condition": "status,=,Paid", "label": "Paid", "color": "green"}])

	def test_new_condition_is_prepended_so_it_wins(self):
		patched = indicators.merge_rule_layer(self._ladder(), [{"condition": "priority,=,High", "label": "High", "color": "red"}])
		self.assertEqual(patched[0], {"condition": "priority,=,High", "label": "High", "color": "red"})
		self.assertEqual(len(patched), 3)

	def test_empty_condition_add_is_a_bottom_floor_not_a_top_catch_all(self):
		# A label-only (empty-condition) rule matches every record, so it is a fallthrough floor:
		# it must sit LAST, below the real rules, not be prepended as a top catch-all that shadows them.
		patched = indicators.merge_rule_layer(self._ladder(), [{"condition": "", "label": "Other", "color": "gray"}])
		self.assertEqual(patched[:2], self._ladder())
		self.assertEqual(patched[-1], {"condition": "", "label": "Other", "color": "gray"})
		self.assertEqual(len(patched), 3)

	def test_spacing_variants_match_the_same_rule(self):
		patched = indicators.merge_rule_layer(self._ladder(), [{"condition": " status , = , Paid ", "label": "Paid", "color": "gold"}])
		self.assertEqual(patched[0]["color"], "gold")
		self.assertEqual(len(patched), 2)

	def test_labelless_add_is_skipped_hidden_miss_is_noop(self):
		patched = indicators.merge_rule_layer(self._ladder(), [{"condition": "x,=,1"}, {"condition": "y,=,1", "hidden": True}])
		self.assertEqual(patched, self._ladder())


class TestReferencedFields(unittest.TestCase):
	def test_unions_status_docstatus_and_condition_fields_deduped(self):
		rules = [
			{"condition": "per_billed,<,100|docstatus,=,1", "label": "To Bill", "color": "orange"},
			{"condition": "status,=,Paid", "label": "Paid", "color": "green"},
		]
		self.assertEqual(indicators.referenced_fields(rules, "status", True), ["status", "docstatus", "per_billed"])

	def test_omits_docstatus_when_not_submittable(self):
		self.assertEqual(indicators.referenced_fields([], None, False), [])


class TestIndicatorSpecTracer(unittest.TestCase):
	def _trace(self, app=None, site=None, user=None):
		"""A submittable doctype with no status/enabled/publication fields, with the App manifest
		rules and the Site/User override layers stubbed (no DB) — the spec's rule list is what we assert."""
		meta = unittest.mock.Mock(is_submittable=True, module="Selling")
		meta.get_field.return_value = None
		meta.get.return_value = []  # no DocType.states
		self._patch("_workflow_styles", lambda doctype: (None, {}))
		self._patch("site_indicator_rules", lambda doctype: site or [])
		self._patch("user_indicator_rules", lambda doctype: user or [])
		reader = indicators.manifest.doctype_manifest
		indicators.manifest.doctype_manifest = lambda doctype, module: {"doctype": {"indicator": app or []}}
		self.addCleanup(lambda: setattr(indicators.manifest, "doctype_manifest", reader))
		return indicators.indicator_spec("Sales Invoice", meta)

	def _patch(self, name, value):
		original = getattr(indicators, name)
		self.addCleanup(lambda: setattr(indicators, name, original))
		setattr(indicators, name, value)

	def test_app_rule_wins_over_defaults_and_its_field_is_auto_fetched(self):
		spec = self._trace(app=[{"condition": "per_billed,<,100", "label": "To Bill", "color": "orange"}])
		self.assertEqual(spec["rules"][0], {"condition": "per_billed,<,100", "label": "To Bill", "color": "orange"})
		self.assertEqual(spec["rules"][1], {"condition": "docstatus,=,1", "label": "Submitted", "color": "blue"})
		self.assertEqual(spec["fields"], ["docstatus", "per_billed"])
		self.assertTrue(spec["isSubmittable"])

	def test_app_site_user_chain_layers_over_each_other(self):
		# App ships "To Bill" (orange). Site recolors it red (same condition → in place). User hides
		# the Submitted default and adds its own top rule. Precedence: User new > Site > App > default.
		spec = self._trace(
			app=[{"condition": "per_billed,<,100", "label": "To Bill", "color": "orange"}],
			site=[{"condition": "per_billed,<,100", "label": "To Bill", "color": "red"}],
			user=[
				{"condition": "docstatus,=,1", "hidden": True},
				{"condition": "on_hold,=,1", "label": "On Hold", "color": "gray"},
			],
		)
		self.assertEqual(
			spec["rules"],
			[
				{"condition": "on_hold,=,1", "label": "On Hold", "color": "gray"},
				{"condition": "per_billed,<,100", "label": "To Bill", "color": "red"},
			],
		)
		self.assertEqual(spec["fields"], ["docstatus", "on_hold", "per_billed"])


if __name__ == "__main__":
	unittest.main()
