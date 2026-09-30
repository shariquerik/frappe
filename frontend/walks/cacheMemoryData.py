# Test data for the cache memory walk (cacheMemory.js); how to run it: see CACHE_MEMORY.md.
# ACTION is `create`, `delete` or `count`; every record made carries MARKER.

import frappe
from frappe.utils import add_days, nowdate

MARKER = "cache-memory-research"
COMPANY = frappe.conf.get("cache_memory_company") or "Xamper"
ITEM_ROWS = 100
COMMENTS = 5

# Kept apart so each walk step fills one store with documents no other step holds.
RECORDS = 51
LIST_GROUPS = 21
LIST_ROWS = 20
FIELD_READS = 51

ACTION = globals().get("ACTION", "count")


def main():
	frappe.flags.mute_emails = True
	actions = {"create": create, "delete": delete, "count": count}
	actions[ACTION]()
	frappe.db.commit()


def create():
	if frappe.db.exists("Sales Invoice", {"remarks": MARKER}):
		raise Exception("Test data already exists; run ACTION=delete first")
	masters = make_masters()
	make_invoices(masters)
	make_todos()
	count()


def make_masters():
	company = frappe.get_doc("Company", COMPANY)
	customer = make_customer()
	items = [make_item(index) for index in range(1, ITEM_ROWS + 1)]
	taxes = [make_tax_account(company, label) for label in ("A", "B", "C")]
	frappe.db.commit()
	return {"company": company, "customer": customer, "items": items, "taxes": taxes}


def make_customer():
	name = f"{MARKER} customer"
	if not frappe.db.exists("Customer", name):
		frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": name,
				"customer_details": MARKER,
				"customer_group": first("Customer Group"),
				"territory": first("Territory"),
			}
		).insert()
	return name


def make_item(index):
	code = f"CMR-ITEM-{index:03d}"
	if not frappe.db.exists("Item", code):
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": code,
				"item_name": f"Cache memory research item {index:03d}",
				"description": f"{MARKER}: a stock-free sales item used to fill invoice rows",
				"item_group": first("Item Group"),
				"stock_uom": "Nos",
				"is_stock_item": 0,
				"is_sales_item": 1,
				"standard_rate": 100 + index,
			}
		).insert()
	return code


def make_tax_account(company, label):
	name = f"CMR Output Tax {label} - {company.abbr}"
	if not frappe.db.exists("Account", name):
		parent = frappe.db.get_value(
			"Account", {"company": company.name, "account_name": "Duties and Taxes", "is_group": 1}
		)
		frappe.get_doc(
			{
				"doctype": "Account",
				"account_name": f"CMR Output Tax {label}",
				"company": company.name,
				"parent_account": parent,
				"account_type": "Tax",
				"root_type": "Liability",
			}
		).insert()
	return name


def first(doctype):
	return frappe.get_all(doctype, filters={"is_group": 0}, pluck="name", limit=1)[0]


def make_invoices(masters):
	for index in range(1, RECORDS + 1):
		invoice = insert_invoice(masters, f"cmr-record-{index:02d}", ITEM_ROWS, taxes=True)
		for number in range(1, COMMENTS + 1):
			invoice.add_comment("Comment", comment_text(number))
		frappe.db.commit()
	for group in range(1, LIST_GROUPS + 1):
		for _ in range(LIST_ROWS):
			insert_invoice(masters, f"cmr-list-{group:02d}", 1)
		frappe.db.commit()
	for index in range(1, FIELD_READS + 1):
		insert_invoice(masters, f"cmr-field-{index:02d}", 1)
	frappe.db.commit()


def insert_invoice(masters, po_no, rows, taxes=False):
	company = masters["company"]
	doc = frappe.get_doc(
		{
			"doctype": "Sales Invoice",
			"company": company.name,
			"customer": masters["customer"],
			"posting_date": nowdate(),
			"due_date": add_days(nowdate(), 30),
			"po_no": po_no,
			"remarks": MARKER,
			"debit_to": company.default_receivable_account,
			"items": [item_row(company, masters["items"][index % ITEM_ROWS], index) for index in range(rows)],
			"taxes": [tax_row(company, account) for account in masters["taxes"]] if taxes else [],
		}
	)
	return doc.insert()


def item_row(company, item_code, index):
	return {
		"item_code": item_code,
		"qty": 1 + index % 7,
		"rate": 100 + index,
		"income_account": company.default_income_account,
		"cost_center": company.cost_center,
	}


def tax_row(company, account):
	return {
		"charge_type": "On Net Total",
		"account_head": account,
		"description": account,
		"rate": 3,
		"cost_center": company.cost_center,
	}


def comment_text(number):
	return (
		f"<p>Follow-up {number} on this invoice: the customer asked about delivery dates and the "
		f"payment terms. Checked with accounts and replied the same day. ({MARKER})</p>"
	)


def make_todos():
	# A list group is one date in 2001; `field` rows are in 2002.
	for index in range(1, RECORDS + 1):
		insert_todo(f"record {index:02d}", None)
	for group in range(1, LIST_GROUPS + 1):
		for row in range(LIST_ROWS):
			insert_todo(f"list {group:02d} row {row:02d}", f"2001-01-{group:02d}")
	for index in range(1, FIELD_READS + 1):
		insert_todo(f"field {index:02d}", "2002-01-01")
	frappe.db.commit()


def insert_todo(label, date):
	frappe.get_doc(
		{
			"doctype": "ToDo",
			"description": f"<p>{MARKER} {label}</p>",
			"date": date,
			"priority": "Medium",
			"status": "Open",
		}
	).insert()


def count():
	invoices = frappe.get_all("Sales Invoice", filters={"remarks": MARKER}, pluck="name")
	heavy = frappe.get_all(
		"Sales Invoice", filters={"remarks": MARKER, "po_no": "cmr-record-01"}, pluck="name"
	)
	todos = frappe.db.count("ToDo", {"description": ["like", f"%{MARKER}%"]})
	print(f"sales invoices: {len(invoices)}; todos: {todos}")
	if heavy:
		name = heavy[0]
		print(f"record {name}: item rows", frappe.db.count("Sales Invoice Item", {"parent": name}))
		print("  tax rows", frappe.db.count("Sales Taxes and Charges", {"parent": name}))
		for doctype in ("Comment", "Version", "Communication"):
			field = "reference_name" if doctype != "Version" else "docname"
			print(f"  {doctype} rows", frappe.db.count(doctype, {field: name}))


def delete():
	for name in frappe.get_all("Sales Invoice", filters={"remarks": MARKER}, pluck="name"):
		frappe.delete_doc("Sales Invoice", name, force=True, ignore_permissions=True)
	frappe.db.commit()
	for name in frappe.get_all("ToDo", filters={"description": ["like", f"%{MARKER}%"]}, pluck="name"):
		frappe.delete_doc("ToDo", name, force=True, ignore_permissions=True)
	for name in frappe.get_all("Item", filters={"description": ["like", f"{MARKER}%"]}, pluck="name"):
		frappe.delete_doc("Item", name, force=True, ignore_permissions=True)
	for name in frappe.get_all(
		"Account", filters={"account_name": ["like", "CMR Output Tax %"]}, pluck="name"
	):
		frappe.delete_doc("Account", name, force=True, ignore_permissions=True)
	if frappe.db.exists("Customer", f"{MARKER} customer"):
		frappe.delete_doc("Customer", f"{MARKER} customer", force=True, ignore_permissions=True)
	frappe.db.delete("Comment", {"content": ["like", f"%{MARKER}%"]})
	for pattern in (f"%{MARKER}%", "%CMR Output Tax%", "%CMR-ITEM-%"):
		frappe.db.delete("Deleted Document", {"data": ["like", pattern]})
	count()


main()
