// PROTOTYPE (#45263): hard-coded rows for the palette's look. No dispatcher, no search, no server.
// Throw this folder away once the look is approved.

export type SampleRow = {
	id: string;
	icon: string;
	label: string;
	/** Gray text after the label: the doctype for a record, the app for a place or an app act. */
	description?: string;
	/** The act's key, drawn on the right. */
	combo?: string;
	/** Hidden words the filter also reads (a doctype's name, the app's name). */
	keywords?: string[];
	/** A doctype row: Tab narrows the search to it. */
	doctype?: string;
	/** An act that asks for one value in a second step. */
	argument?: "user";
	avatar?: string;
};

export const CURRENT_DOCTYPE = "CRM Deal";

export const recent: SampleRow[] = [
	{ id: "r1", icon: "lucide-file-text", label: "TechStart Inc", description: "CRM Deal" },
	{ id: "r2", icon: "lucide-list", label: "Leads", description: "CRM" },
	{ id: "r3", icon: "lucide-file-text", label: "Acme Corp", description: "CRM Organization" },
	{ id: "r4", icon: "lucide-list", label: "Sales Invoice", description: "ERPNext" },
	{ id: "r5", icon: "lucide-file-text", label: "Henry Walsh", description: "CRM Contact" },
];

// The record page's header acts, in header order, then one "Go to tab" row per tab.
export const thisPage: SampleRow[] = [
	{ id: "p-save", icon: "lucide-save", label: "Save", combo: "Mod+S" },
	{ id: "p-email", icon: "lucide-mail", label: "Send an email", combo: "Mod+Shift+E" },
	{ id: "p-comment", icon: "lucide-message-square", label: "Add a comment", combo: "Mod+Shift+M" },
	{ id: "p-assign", icon: "lucide-user-plus", label: "Assign to…", combo: "Mod+Shift+A", argument: "user" },
	{ id: "p-attach", icon: "lucide-paperclip", label: "Attach a file" },
	{ id: "p-print", icon: "lucide-printer", label: "Print" },
	{ id: "p-link", icon: "lucide-link", label: "Copy link" },
	{ id: "p-tag", icon: "lucide-tag", label: "Add a tag" },
	{ id: "p-dup", icon: "lucide-copy", label: "Duplicate" },
	{ id: "p-del", icon: "lucide-trash-2", label: "Delete" },
	{ id: "t-activity", icon: "lucide-activity", label: "Go to tab: Activity", combo: "Alt+Digit1" },
	{ id: "t-emails", icon: "lucide-mail", label: "Go to tab: Emails", combo: "Alt+Digit2" },
	{ id: "t-details", icon: "lucide-table-2", label: "Go to tab: Details", combo: "Alt+Digit3" },
	{ id: "t-files", icon: "lucide-paperclip", label: "Go to tab: Files", combo: "Alt+Digit4" },
];

// Rows only a typed query shows. Each carries the words a "deal" query would match.
export const thisPageTyped: SampleRow[] = [
	{ id: "p-won", icon: "lucide-circle-check", label: "Mark deal as won" },
	{ id: "p-lost", icon: "lucide-circle-x", label: "Mark deal as lost" },
	...thisPage.filter((row) => ["p-assign", "p-dup"].includes(row.id)).map((row) => ({
		...row,
		keywords: ["deal"],
	})),
];

export const desk: SampleRow[] = [
	{ id: "d-call", icon: "lucide-phone", label: "Log a call", description: "CRM", keywords: ["deal"] },
	{ id: "d-note", icon: "lucide-notebook-pen", label: "Add a note to a deal", description: "CRM" },
	{
		id: "d-settings",
		icon: "lucide-settings",
		label: "Open settings: Deal Statuses",
		keywords: ["deal"],
	},
	{ id: "d-sidebar", icon: "lucide-panel-left", label: "Toggle sidebar", combo: "Mod+B" },
	{ id: "d-theme", icon: "lucide-sun-moon", label: "Switch theme" },
];

export const goTo: SampleRow[] = [
	{ id: "g-deals", icon: "lucide-list", label: "Deals", description: "CRM", doctype: "CRM Deal", keywords: ["CRM Deal"] },
	{ id: "g-crm-deal", icon: "lucide-list", label: "CRM Deal", description: "CRM", doctype: "CRM Deal" },
	{ id: "g-status", icon: "lucide-list", label: "CRM Deal Status", description: "CRM", doctype: "CRM Deal Status" },
	{ id: "g-lost", icon: "lucide-list", label: "CRM Lost Reason", description: "CRM", doctype: "CRM Lost Reason", keywords: ["deal"] },
];

export const create: SampleRow[] = [
	{ id: "c-deal", icon: "lucide-plus", label: "New CRM Deal", description: "CRM" },
	{ id: "c-status", icon: "lucide-plus", label: "New CRM Deal Status", description: "CRM" },
];

export const records: SampleRow[] = [
	{ id: "rec-1", icon: "lucide-file-text", label: "PivotTech Solutions", description: "CRM Deal", keywords: ["CRM-DEAL-2026-00003"] },
	{ id: "rec-2", icon: "lucide-file-text", label: "TechStart Inc", description: "CRM Deal", keywords: ["CRM-DEAL-2026-00002"] },
	{ id: "rec-3", icon: "lucide-file-text", label: "Meridian Systems", description: "CRM Deal", keywords: ["CRM-DEAL-2026-00005"] },
	{ id: "rec-4", icon: "lucide-file-text", label: "Deal Desk review", description: "ToDo" },
	{ id: "rec-5", icon: "lucide-file-text", label: "Q4 deal pipeline", description: "Note" },
];

// What Tab on "CRM Deal" searches: that doctype only, through its own search route.
export const scopedRecords: SampleRow[] = [
	{ id: "s-00003", icon: "lucide-file-text", label: "PivotTech Solutions", description: "CRM-DEAL-2026-00003" },
	{ id: "s-00002", icon: "lucide-file-text", label: "TechStart Inc", description: "CRM-DEAL-2026-00002" },
	{ id: "s-00004", icon: "lucide-file-text", label: "ScaleUp Labs", description: "CRM-DEAL-2026-00004" },
	{ id: "s-00006", icon: "lucide-file-text", label: "Vertex Analytics", description: "CRM-DEAL-2026-00006" },
	{ id: "s-00001", icon: "lucide-file-text", label: "Acme Corp", description: "CRM-DEAL-2026-00001" },
	{ id: "s-00005", icon: "lucide-file-text", label: "Meridian Systems", description: "CRM-DEAL-2026-00005" },
	{ id: "s-00007", icon: "lucide-file-text", label: "Forge Digital", description: "CRM-DEAL-2026-00007" },
];

// The argument step's list for "Assign to…". The deal is already assigned to two of them.
export const users: SampleRow[] = [
	{ id: "u-john", icon: "", label: "John Parker", description: "john.demo@example.com", avatar: "John Parker" },
	{ id: "u-emily", icon: "", label: "Emily Chen", description: "emily.demo@example.com", avatar: "Emily Chen" },
	{ id: "u-sarah", icon: "", label: "Sarah Connor", description: "sarah.demo@example.com", avatar: "Sarah Connor" },
	{ id: "u-shariq", icon: "", label: "Shariq Ansari", description: "shariq@frappe.io", avatar: "Shariq Ansari" },
	{ id: "u-admin", icon: "", label: "Administrator", description: "admin@example.com", avatar: "Administrator" },
];

export const ALREADY_ASSIGNED = new Set(["u-john", "u-emily"]);

/** The ruled three tiers, cut short: does the label or a hidden keyword contain the query? */
export function matching(rows: SampleRow[], query: string, cap?: number) {
	const q = query.trim().toLowerCase();
	const found = rows.filter((row) =>
		[row.label, row.description ?? "", ...(row.keywords ?? [])]
			.join(" ")
			.toLowerCase()
			.includes(q)
	);
	return cap ? found.slice(0, cap) : found;
}
