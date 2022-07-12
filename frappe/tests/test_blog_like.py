# Copyright (c) 2021, Frappe Technologies and Contributors
# License: MIT. See LICENSE

import unittest

import frappe


class TestLike(unittest.TestCase):
	def tearDown(self):
		frappe.form_dict.reference_doctype = None
		frappe.form_dict.reference_name = None
		frappe.form_dict.like = None
		frappe.local.request_ip = None

	def test_blog_like_creation_updation(self):
		from frappe.website.doctype.blog_post.test_blog_post import make_test_blog

		test_blog = make_test_blog()

		frappe.db.delete("Comment", {"comment_type": "Like", "reference_doctype": "Blog Post"})

		from frappe.templates.includes.likes.likes import like

		frappe.form_dict.reference_doctype = "Blog Post"
		frappe.form_dict.reference_name = test_blog.name
		frappe.form_dict.like = True
		frappe.local.request_ip = "127.0.0.1"

		liked = like()

		self.assertEqual(liked, True)

		frappe.form_dict.like = False

		disliked = like()

		self.assertEqual(disliked, False)

		frappe.db.delete("Comment", {"comment_type": "Like", "reference_doctype": "Blog Post"})

		test_blog.delete()