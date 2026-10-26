// PROTOTYPE (#45253), throwaway: what else the index could hold, each switched on by `?extras=a,b`.
import { computed } from "vue";
import { useRoute } from "vue-router";

export const EXTRAS = {
	keys: "Arrow keys",
	recent: "Recent",
	pinned: "Pinned",
	arrange: "Arrange & hide",
	default: "Default app",
	resume: "Resume",
	create: "Quick create",
	setup: "Setup nudge",
	news: "What's new",
} as const;
export type Extra = keyof typeof EXTRAS;

export function useExtras() {
	const route = useRoute();
	return computed(() => new Set(String(route.query.extras ?? "").split(",").filter(Boolean) as Extra[]));
}

// Made up, but shaped like this site's records: v2 keeps no visit history yet.
export const RECENT = [
	{ app: "erpnext", title: "ACC-SINV-2026-00042", kind: "Sales Invoice", when: "2 min ago" },
	{ app: "crm", title: "Globex Corporation", kind: "CRM Deal", when: "18 min ago" },
	{ app: "erpnext", title: "Monthly Sales Analytics", kind: "Report", when: "1 hr ago" },
	{ app: "gameplan", title: "Q4 roadmap review", kind: "Discussion", when: "3 hr ago" },
	{ app: "frappe", title: "Sales Manager", kind: "Role", when: "Yesterday" },
	{ app: "crm", title: "Initech", kind: "CRM Lead", when: "Yesterday" },
];

export const PINNED = [
	{ app: "crm", label: "Open deals" },
	{ app: "erpnext", label: "Unpaid invoices" },
	{ app: "erpnext", label: "Stock balance" },
	{ app: "frappe", label: "Users" },
	{ app: "gameplan", label: "My tasks" },
];

export const RESUME: Record<string, string> = {
	erpnext: "Sales Invoice ACC-SINV-2026-00042",
	crm: "the Deals list",
	frappe: "the Role list",
};

export const DOCTYPES = [
	{ app: "erpnext", name: "Sales Invoice" },
	{ app: "erpnext", name: "Purchase Invoice" },
	{ app: "erpnext", name: "Sales Order" },
	{ app: "erpnext", name: "Customer" },
	{ app: "erpnext", name: "Item" },
	{ app: "crm", name: "CRM Deal" },
	{ app: "crm", name: "CRM Lead" },
	{ app: "frappe", name: "User" },
	{ app: "frappe", name: "ToDo" },
	{ app: "gameplan", name: "GP Discussion" },
];
