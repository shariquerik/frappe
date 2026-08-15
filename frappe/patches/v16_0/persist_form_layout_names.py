import frappe
from frappe.desk.doctype.form_layout.form_layout import named_layout


def execute():
	"""Write down the names every stored Form Layout was only ever given at read time.

	The names this stamps are exactly the ones `parse_layout` derives today, so nothing a
	script or a reader currently addresses moves — the identities are frozen where they
	already are. Assigning them lazily on the next save instead would leave them derived,
	and so still renameable by a label edit, until someone happened to open the layout.

	Every readable row is rewritten, not just the ones missing a name: the serialization is
	canonicalised at the same time, and `update_modified=False` keeps that invisible.
	"""
	for row in frappe.get_all("Form Layout", fields=["name", "layout"]):
		layout = named_layout(row.layout)
		if layout is not None:
			frappe.db.set_value("Form Layout", row.name, "layout", layout, update_modified=False)
