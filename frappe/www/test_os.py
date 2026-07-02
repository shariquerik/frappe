# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
#
# Guards the OS RPC contract (ADR-0030): the engine lives in `frappe.os_core`, and the frontend calls
# its whitelisted methods at their real path `frappe.os_core.<module>.<name>`. Each such path must stay
# resolvable AND whitelisted, else the RPC 404s or 403s at runtime. Pure — no site:
#   bench run-tests --module frappe.www.test_os

import unittest

import frappe

# The whitelisted RPC paths the frontend calls, verbatim from the client (frappe-os/src). Keep this
# tuple in lockstep with the `call`/`callPost` strings — a rename here without one there breaks the RPC.
FRONTEND_RPCS = (
	"frappe.os_core.boot.boot",
	"frappe.os_core.meta.get_doctype_meta",
	"frappe.os_core.meta.card_value",
	"frappe.os_core.registry.resolve_doctype",
	"frappe.os_core.placements.save_placement_override",
	"frappe.os_core.placements.delete_placement_override",
	"frappe.os_core.recents.record_recent",
	"frappe.os_core.desk.set_preferred_shell",
	"frappe.os_core.account.change_password",
)


class TestOSRPCContract(unittest.TestCase):
	def test_every_frontend_rpc_resolves_and_stays_whitelisted(self):
		for path in FRONTEND_RPCS:
			method = frappe.get_attr(path)
			self.assertIn(
				method,
				frappe.whitelisted,
				f"{path} is not whitelisted — the RPC path would 403",
			)

	def test_setup_desk_switch_stays_reachable(self):
		# Documented ops entry point: `bench execute frappe.os_core.desk.setup_desk_switch`.
		self.assertTrue(callable(frappe.get_attr("frappe.os_core.desk.setup_desk_switch")))


if __name__ == "__main__":
	unittest.main()
