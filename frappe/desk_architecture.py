# PROTOTYPE (frappe/frappe#43434): throwaway. Serves the desk v2 architecture diagram at
# /desk-architecture on a site in developer mode. The real route is a build task.
#
# Each request runs research/desk-v2-architecture-diagram/build-diagram.mjs, so the page
# shows the working tree as it is, edits not yet committed included.

import os
import shutil
import subprocess
import tempfile

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer

ROUTE = "desk-architecture"
SCRIPT = "research/desk-v2-architecture-diagram/build-diagram.mjs"


class DeskArchitecturePage(BaseRenderer):
	def can_render(self):
		# Outside developer mode the route does not exist, like the pages under www/_test.
		return self.path == ROUTE and bool(frappe.conf.developer_mode)

	def render(self):
		frappe.local.no_cache = 1
		if frappe.session.user == "Guest":
			frappe.local.flags.redirect_location = f"/login?redirect-to=/{ROUTE}"
			raise frappe.Redirect
		if "System Manager" not in frappe.get_roles():
			frappe.throw(frappe._("Only a System Manager can see the architecture diagram."), frappe.PermissionError)
		return self.build_response(build_diagram(), 200)


def build_diagram() -> str:
	repo = os.path.dirname(frappe.get_app_path("frappe"))
	with tempfile.TemporaryDirectory() as out:
		# Exit code 1 means a new break. The page is still built, and shows it in red.
		run = subprocess.run(
			[shutil.which("node") or "node", os.path.join(repo, SCRIPT), "--out", out],
			cwd=repo,
			capture_output=True,
			text=True,
			timeout=60,
		)
		page = os.path.join(out, "diagram.html")
		if not os.path.exists(page):
			frappe.throw(f"<pre>{frappe.utils.escape_html(run.stderr or run.stdout)}</pre>", title="Diagram Not Built")
		with open(page) as f:
			return f.read()
