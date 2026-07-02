# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Guards the `frappe.www.os` facade (ADR-0030): the OS engine lives in the `frappe.os_core` package, and
# `www/os.py` re-exports the whitelisted methods the frontend calls by the path `frappe.www.os.<name>`.
# A re-export must stay callable AND whitelisted, else the RPC 404s or 403s at runtime. Pure — no site:
#   bench run-tests --module frappe.www.test_os

import unittest

import frappe
from frappe.www import os as facade

# The whitelisted RPCs the frontend calls as `frappe.www.os.<name>` (verified against the client).
FRONTEND_RPCS = (
	"boot",
	"get_doctype_meta",
	"resolve_doctype",
	"card_value",
	"save_placement_override",
	"delete_placement_override",
	"record_recent",
	"change_password",
)


class TestFacadeSurface(unittest.TestCase):
	def test_every_frontend_rpc_resolves_and_stays_whitelisted(self):
		for name in FRONTEND_RPCS:
			method = getattr(facade, name, None)
			self.assertIsNotNone(method, f"frappe.www.os.{name} is missing — the RPC path would 404")
			self.assertIn(
				method,
				frappe.whitelisted,
				f"frappe.www.os.{name} is not whitelisted — the RPC path would 403",
			)

	def test_setup_desk_switch_stays_reachable(self):
		# Documented ops entry point: `bench execute frappe.www.os.setup_desk_switch`.
		self.assertTrue(callable(getattr(facade, "setup_desk_switch", None)))


if __name__ == "__main__":
	unittest.main()
