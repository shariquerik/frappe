import type { Doc, Scene } from "./scene";

const MANAGER = [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }];

/** A custom DocType with the permissions a form needs to open. */
export function customDoctype(name: string, fields: Doc[], extra: Doc = {}): Doc {
	return { name, module: "Custom", custom: 1, fields, permissions: MANAGER, ...extra };
}

/** Removes a left-over DocType from a run that was killed before its scene closed. */
async function dropStale(scene: Scene, name: string): Promise<void> {
	await scene.api.delete(`/api/resource/DocType/${encodeURIComponent(name)}`, { failOnStatusCode: false });
}

/**
 * "Sales Invoice" on a site without ERPNext: the shape of the real one (four tabs, sections with
 * columns, a child Table, Link, Currency, Check and Select fields, depends_on rules) under the
 * name "UI Sales Invoice". Seeds "UI Customer" and "UI Sales Invoice Item" first and deletes all
 * three when the scene closes. Returns the DocType's name.
 */
export async function seedSalesInvoice(scene: Scene): Promise<string> {
	for (const name of ["UI Sales Invoice", "UI Sales Invoice Item", "UI Customer"]) await dropStale(scene, name);
	await scene.insert(
		"DocType",
		customDoctype("UI Customer", [
			{ fieldname: "customer_name", fieldtype: "Data", label: "Customer name", reqd: 1 },
			{ fieldname: "territory", fieldtype: "Select", label: "Territory", options: "\nNorth\nSouth\nEast\nWest" },
		], { autoname: "field:customer_name", title_field: "customer_name" }),
	);
	await scene.insert(
		"DocType",
		customDoctype("UI Sales Invoice Item", [
			{ fieldname: "item_name", fieldtype: "Data", label: "Item", in_list_view: 1, reqd: 1, columns: 3 },
			{ fieldname: "qty", fieldtype: "Float", label: "Quantity", in_list_view: 1, default: "1", columns: 1 },
			{ fieldname: "rate", fieldtype: "Currency", label: "Rate", in_list_view: 1, columns: 2 },
			{ fieldname: "amount", fieldtype: "Currency", label: "Amount", in_list_view: 1, read_only: 1, columns: 2 },
		], { istable: 1 }),
	);
	await scene.insert(
		"DocType",
		customDoctype(
			"UI Sales Invoice",
			[
				{ fieldname: "details_tab", fieldtype: "Tab Break", label: "Details" },
				{ fieldname: "customer_section", fieldtype: "Section Break", label: "Customer" },
				{ fieldname: "naming_series", fieldtype: "Select", label: "Series", options: "SINV-.YYYY.-", reqd: 1 },
				{ fieldname: "customer", fieldtype: "Link", label: "Customer", options: "UI Customer", reqd: 1, in_list_view: 1 },
				{ fieldname: "posting_date", fieldtype: "Date", label: "Posting date", reqd: 1, default: "Today" },
				{ fieldname: "details_column", fieldtype: "Column Break" },
				{ fieldname: "due_date", fieldtype: "Date", label: "Payment due date" },
				{ fieldname: "is_return", fieldtype: "Check", label: "Is return (credit note)" },
				{ fieldname: "return_against", fieldtype: "Link", label: "Return against", options: "UI Sales Invoice", depends_on: "eval:doc.is_return" },
				{ fieldname: "items_tab", fieldtype: "Tab Break", label: "Items" },
				{ fieldname: "items", fieldtype: "Table", label: "Items", options: "UI Sales Invoice Item", reqd: 1 },
				{ fieldname: "totals_section", fieldtype: "Section Break", label: "Totals" },
				{ fieldname: "apply_discount", fieldtype: "Check", label: "Apply discount" },
				{ fieldname: "discount_amount", fieldtype: "Currency", label: "Discount amount", depends_on: "eval:doc.apply_discount" },
				{ fieldname: "totals_column", fieldtype: "Column Break" },
				{ fieldname: "net_total", fieldtype: "Currency", label: "Net total", read_only: 1 },
				{ fieldname: "grand_total", fieldtype: "Currency", label: "Grand total", read_only: 1, in_list_view: 1 },
				{ fieldname: "payments_tab", fieldtype: "Tab Break", label: "Payments" },
				{ fieldname: "is_pos", fieldtype: "Check", label: "Include payment (POS)" },
				{ fieldname: "payments_section", fieldtype: "Section Break", label: "Payment details", depends_on: "eval:doc.is_pos" },
				{ fieldname: "mode_of_payment", fieldtype: "Select", label: "Mode of payment", options: "\nCash\nCard\nBank transfer" },
				{ fieldname: "payments_column", fieldtype: "Column Break" },
				{ fieldname: "paid_amount", fieldtype: "Currency", label: "Paid amount", mandatory_depends_on: "eval:doc.is_pos" },
				{ fieldname: "more_tab", fieldtype: "Tab Break", label: "More information" },
				{ fieldname: "status", fieldtype: "Select", label: "Status", options: "Draft\nUnpaid\nPaid\nOverdue", default: "Draft", in_list_view: 1 },
				{ fieldname: "remarks", fieldtype: "Small Text", label: "Remarks" },
			],
			{ autoname: "naming_series:", title_field: "customer", quick_entry: 1 },
		),
	);
	for (const name of ["UI Sales Invoice", "UI Sales Invoice Item", "UI Customer"]) scene.track("DocType", name);
	return "UI Sales Invoice";
}

/** Two invoices and the customers they belong to, for the Preview tab. */
export async function seedInvoiceRecords(scene: Scene): Promise<string[]> {
	const customers = ["Northwind Traders", "Acme Fabrication"];
	for (const customer_name of customers) await scene.insert("UI Customer", { customer_name, territory: "North" });
	const names: string[] = [];
	for (const customer of customers) {
		const invoice = await scene.insert("UI Sales Invoice", {
			customer,
			naming_series: "SINV-.YYYY.-",
			status: "Unpaid",
			items: [
				{ item_name: "Standing desk", qty: 2, rate: 640, amount: 1280 },
				{ item_name: "Monitor arm", qty: 4, rate: 85, amount: 340 },
			],
			net_total: 1620,
			grand_total: 1620,
		});
		names.push(String(invoice.name));
	}
	return names;
}

/** The stand-in for "Customize: Sales Invoice": a standard DocType that Customize Form accepts. */
export const CUSTOMIZE_TARGET = "Event";

/** Deletes what a Customize Form save left on the target (Property Setters, Custom Fields, layouts), when the scene closes. */
export function resetCustomizations(scene: Scene, doctype = CUSTOMIZE_TARGET): void {
	scene.onClose(async () => {
		const rows: Array<[string, string]> = [
			["Property Setter", "doc_type"],
			["Custom Field", "dt"],
			["DocType Layout", "document_type"],
		];
		for (const [kind, field] of rows) {
			const res = await scene.api.get(`/api/resource/${kind}`, {
				params: { filters: JSON.stringify([[field, "=", doctype]]), limit_page_length: 500 },
			});
			const { data } = (await res.json()) as { data: Array<{ name: string }> };
			for (const { name } of data)
				await scene.api.delete(`/api/resource/${kind}/${encodeURIComponent(name)}`, { failOnStatusCode: false });
		}
	});
}
