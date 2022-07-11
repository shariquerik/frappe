# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
import re

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils.html_utils import clean_html
from frappe.website.doctype.blog_settings.blog_settings import get_comment_limit, get_like_limit
from frappe.website.utils import clear_cache

URLS_COMMENT_PATTERN = re.compile(
	r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", re.IGNORECASE
)
EMAIL_PATTERN = re.compile(r"(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)", re.IGNORECASE)


@frappe.whitelist(allow_guest=True)
@rate_limit(key="reference_name", limit=get_comment_limit, seconds=60 * 60)
def add_comment(comment, comment_email, comment_by, reference_doctype, reference_name, route):
	doc = frappe.get_doc(reference_doctype, reference_name)

	if frappe.session.user == "Guest" and doc.doctype not in ["Blog Post", "Web Page"]:
		return

	if not comment.strip():
		frappe.msgprint(_("The comment cannot be empty"))
		return False

	if URLS_COMMENT_PATTERN.search(comment) or EMAIL_PATTERN.search(comment):
		frappe.msgprint(_("Comments cannot have links or email addresses"))
		return False

	comment = doc.add_comment(
		text=clean_html(comment), comment_email=comment_email, comment_by=comment_by
	)

	comment.db_set("published", 1)

	# since comments are embedded in the page, clear the web cache
	if route:
		clear_cache(route)

	content = (
		comment.content
		+ "<p><a href='{}/app/Form/Comment/{}' style='font-size: 80%'>{}</a></p>".format(
			frappe.utils.get_request_site_address(), comment.name, _("View Comment")
		)
	)

	if doc.doctype == "Blog Post" and not doc.enable_email_notification:
		pass
	else:
		# notify creator
		frappe.sendmail(
			recipients=frappe.db.get_value("User", doc.owner, "email") or doc.owner,
			subject=_("New Comment on {0}: {1}").format(doc.doctype, doc.name),
			message=content,
			reference_doctype=doc.doctype,
			reference_name=doc.name,
		)

	# revert with template if all clear (no backlinks)
	template = frappe.get_template("templates/includes/comments/comment.html")
	return template.render({"comment": comment.as_dict()})


@frappe.whitelist(allow_guest=True)
@rate_limit(key="reference_name", limit=get_like_limit, seconds=60 * 60)
def like(reference_doctype, reference_name, like, route):
	like = frappe.parse_json(like)
	ref_doc = frappe.get_doc(reference_doctype, reference_name)
	if ref_doc.disable_feedback == 1:
		return

	if like:
		add_like(reference_doctype, reference_name)
	else:
		delete_like(reference_doctype, reference_name)

	# since likes are embedded in the page, clear the web cache
	if route:
		clear_cache(route)

	if ref_doc.enable_email_notification:
		subject = _("Like on {0}: {1}").format(reference_doctype, reference_name)
		if like:
			message = "<p>Hey, </p><p>You have received a ❤️ like on your blog post <b>{}</b></p>".format(
				reference_name
			)
		else:
			return

		# notify creator
		frappe.sendmail(
			recipients=frappe.db.get_value("User", ref_doc.owner, "email") or ref_doc.owner,
			subject=subject,
			message=message,
			reference_doctype=ref_doc.doctype,
			reference_name=ref_doc.name,
		)

def add_like(reference_doctype, reference_name):
	user = frappe.session.user

	like = frappe.new_doc("Comment")
	like.comment_type = 'Like'
	like.comment_email = user
	like.reference_doctype = reference_doctype
	like.reference_name = reference_name
	like.content = "Liked by: " + user
	if user == "Guest":
		like.ip_address = frappe.local.request_ip
	like.save(ignore_permissions=True)

def delete_like(reference_doctype, reference_name):
	user = frappe.session.user

	filters = {
		"comment_type": "Like",
		"comment_email": user,
		"reference_doctype": reference_doctype,
		"reference_name": reference_name,
	}

	if user == "Guest":
		filters["ip_address"] = frappe.local.request_ip
	
	frappe.db.delete("Comment", filters)