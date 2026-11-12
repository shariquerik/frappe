// PROTOTYPE (#45867), throwaway: the new-DocType flow's state, in memory only (comment
// 6767773108). The dialog fills a draft, the draft page edits it, Save pretends to create it.
// Nothing reaches the server; a reload forgets every draft and every "created" DocType.

import { reactive, ref } from "vue";

export type Kind = "regular" | "child" | "single" | "submittable";

export const KINDS: { value: Kind; label: string; description: string }[] = [
	{ value: "regular", label: "Regular", description: "Many records, with a list to find them in." },
	{ value: "child", label: "Child table", description: "Rows inside another DocType's table. No list of its own." },
	{ value: "single", label: "Single", description: "One record only, like a settings page." },
	{ value: "submittable", label: "Submittable", description: "Records are drafted, then submitted and locked. Cancel and amend to change one." },
];

export interface Draft {
	name: string;
	module: string;
	kind: Kind;
}

/** The dialog's open state; the shell mounts the dialog once. */
export const dialogOpen = ref(false);

/** The draft the page at `/doctype/new` edits; null when no dialog has filled one. */
export const draft = ref<Draft | null>(null);

/** Bumped by each Continue: the draft page remounts on it, as /doctype/new may already be open. */
export const draftGeneration = ref(0);

/** DocTypes the prototype "created" this session, by name: their page stays the draft page. */
export const created = reactive(new Map<string, Draft>());

const LAST_MODULE = "proto-45867-last-module";
export const lastModule = () => localStorage.getItem(LAST_MODULE) ?? "";
export const rememberModule = (module: string) => localStorage.setItem(LAST_MODULE, module);

export function openNewDoctype() {
	dialogOpen.value = true;
}

/**
 * The name a typed one becomes: spaces collapsed, characters a DocType name refuses dropped,
 * each word capitalised ("support  ticket!" → "Support Ticket").
 */
export function deriveName(typed: string) {
	return typed
		.replace(/[^A-Za-z0-9 _-]/g, "")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(" ");
}

export const slugOf = (name: string) => name.toLowerCase().replace(/[ _]+/g, "-");
export const fieldnameOf = (label: string) =>
	label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";

export interface Guess {
	fieldtype: string;
	/** Link target, or Data's `Email` option. */
	options?: string;
	/** What in the label made the guess, for the chip's hint; empty for the Data default. */
	because: string;
}

const RULES: { test: RegExp; fieldtype: string; options?: string }[] = [
	{ test: /\be-?mail\b/i, fieldtype: "Data", options: "Email" },
	{ test: /\b(phone|mobile)\b/i, fieldtype: "Phone" },
	{ test: /\bdate\b|\S\s+on$/i, fieldtype: "Date" },
	{ test: /\b(amount|price)\b/i, fieldtype: "Currency" },
	{ test: /\b(notes?|description)\b/i, fieldtype: "Text Editor" },
];

/** The type a label suggests. A label that names an existing DocType links to it. */
export function guessType(label: string, doctypes: string[]): Guess {
	const typed = label.trim();
	if (!typed) return { fieldtype: "Data", because: "" };
	const target = doctypes.find((one) => one.toLowerCase() === typed.toLowerCase());
	if (target) return { fieldtype: "Link", options: target, because: `the DocType “${target}”` };
	for (const rule of RULES) {
		const match = typed.match(rule.test);
		if (match) return { fieldtype: rule.fieldtype, options: rule.options, because: `“${match[0].trim()}”` };
	}
	return { fieldtype: "Data", because: "" };
}

/** The chip's text: Email is Data with the Email option. */
export function typeLabel(fieldtype: string, options?: string) {
	if (fieldtype === "Data" && options === "Email") return "Email";
	return fieldtype;
}
