// PROTOTYPE (#47098), throwaway: the Settings tab's data and rules. The DocType row, its DocPerm and
// Custom DocPerm rows and its doctype-level Property Setters are real reads; every edit stays in
// memory until the header's Save, which writes nothing. Design edits the DocType itself; Customize
// edits the site's layer (a Property Setter per changed setting, Custom DocPerm for permissions).
import { computed, inject, onBeforeUnmount, reactive, watchEffect, type InjectionKey, type Ref } from "vue";
import { runMethod } from "@framework/ui/api";

export const SECTION_LABELS: Record<string, string> = { naming: "Naming", form: "Form", list: "List and search", permissions: "Permissions", danger: "Danger zone" };

export type SettingsKind = "regular" | "submittable" | "tree" | "child" | "single";
export type Rule = "hash" | "autoincrement" | "field" | "format" | "naming_series" | "prompt" | "script";
export type Act = "" | "rename" | "move" | "standard" | "delete";
export type Right = (typeof RIGHTS)[number];

export const KINDS: { value: SettingsKind; label: string; description: string }[] = [
	{ value: "regular", label: "Regular", description: "Many records, with a list to find them in." },
	{ value: "submittable", label: "Submittable", description: "Records are drafted, then submitted and locked." },
	{ value: "tree", label: "Tree", description: "Records nest under each other, like groups and their members." },
	{ value: "child", label: "Child table", description: "Rows inside another DocType's table. No list of its own." },
	{ value: "single", label: "Single", description: "One record only, like a settings page." },
];

export const RULES: { value: Rule; label: string; naming_rule: string }[] = [
	{ value: "hash", label: "Random ID", naming_rule: "Random" },
	{ value: "autoincrement", label: "Number in order", naming_rule: "Autoincrement" },
	{ value: "field", label: "From a field", naming_rule: "By fieldname" },
	{ value: "format", label: "By pattern", naming_rule: "Expression" },
	{ value: "naming_series", label: "Naming Series", naming_rule: 'By "Naming Series" field' },
	{ value: "prompt", label: "Ask for it on create", naming_rule: "Set by user" },
	{ value: "script", label: "Set by the app's code", naming_rule: "By script" },
];

export const RIGHTS = ["read", "write", "create", "delete", "submit", "cancel", "amend", "select", "report", "export", "import", "print", "email", "share", "if_owner"] as const;
export const RIGHT_LABELS: Record<Right, string> = {
	read: "Read", write: "Write", create: "Create", delete: "Delete", submit: "Submit", cancel: "Cancel", amend: "Amend",
	select: "Select", report: "Report", export: "Export", import: "Import", print: "Print", email: "Email", share: "Share",
	if_owner: "Only if creator",
};
/** A right ticks what it needs; unticking a need unticks what needs it (dt.py's permission rules). */
const NEEDS: Partial<Record<Right, Right[]>> = { submit: ["write"], cancel: ["submit"], amend: ["write", "create"], import: ["create"] };
/** What a level > 0 rule cannot hold. */
const LEVEL_ZERO_ONLY = new Set<Right>(["create", "submit", "cancel", "amend", "if_owner"]);

/** Customize Form's doctype_properties (customize_form.py): the settings a site may change. */
const CUSTOMIZABLE = new Set([
	"search_fields", "title_field", "image_field", "sort_field", "sort_order", "hide_toolbar", "allow_copy", "quick_entry",
	"queue_in_background", "editable_grid", "max_attachments", "make_attachments_public", "force_private_attachments",
	"protect_attached_files", "track_changes", "track_views", "allow_auto_repeat", "allow_import", "allow_bulk_edit",
	"show_name_in_global_search", "show_preview_popup", "naming_rule", "autoname", "show_title_field_in_link",
	"is_calendar_and_gantt", "translated_doctype", "show_image_in_link", "default_view",
]);

/** The DocType's own settings the tab shows. */
const PROPS = [
	"istable", "issingle", "is_tree", "is_submittable", "naming_rule", "autoname", "allow_rename", "title_field",
	"show_title_field_in_link", "search_fields", "sort_field", "sort_order", "image_field", "quick_entry", "track_changes",
	"track_views", "track_seen", "editable_grid", "allow_import", "show_name_in_global_search", "allow_copy", "allow_bulk_edit",
	"allow_auto_repeat", "is_calendar_and_gantt", "queue_in_background", "max_attachments", "make_attachments_public",
	"force_private_attachments", "protect_attached_files", "hide_toolbar", "show_image_in_link", "translated_doctype",
	"show_preview_popup", "read_only", "in_create", "default_view",
];
const TEXT_PROPS = new Set(["naming_rule", "autoname", "title_field", "search_fields", "sort_field", "sort_order", "image_field", "default_view"]);

export interface PermRow {
	id: number;
	role: string;
	permlevel: number;
	[right: string]: number | string;
}

export interface FieldInfo {
	fieldname: string;
	label: string;
	fieldtype: string;
	options?: string;
}

export interface SettingsSource {
	doctype: string;
	/** A new DocType (DraftPage): defaults, all kinds allowed, no counts, no Danger zone. */
	draft?: { kind: SettingsKind; module: string };
	fields: () => FieldInfo[];
	records: () => number | null;
	customizing: () => boolean;
	/** The page's title field and description (the Editor edits them too); Design reads and writes them. */
	titleField: Ref<string>;
	description: Ref<string>;
	/** The app the DocType ships in, as people know it ("ERPNext"); Customize's wording. */
	app: () => string;
}

const norm = (value: unknown) => (value === undefined || value === null || value === 0 || value === "0" ? "" : String(value));
let nextId = 1;
const asRow = (one: Record<string, any>): PermRow => ({
	id: nextId++,
	role: one.role,
	permlevel: Number(one.permlevel) || 0,
	...Object.fromEntries(RIGHTS.map((right) => [right, Number(one[right]) || 0])),
});
const clone = (rows: PermRow[]) => rows.map((one) => ({ ...one, id: nextId++ }));

export function kindOf(values: Record<string, any>): SettingsKind {
	if (Number(values.issingle)) return "single";
	if (Number(values.istable)) return "child";
	if (Number(values.is_tree)) return "tree";
	return Number(values.is_submittable) ? "submittable" : "regular";
}

export function ruleOf(values: Record<string, any>): Rule {
	const by = RULES.find((one) => one.naming_rule === values.naming_rule);
	if (by) return by.value;
	const autoname = String(values.autoname ?? "");
	if (values.naming_rule === "Expression (old style)") return "format";
	if (autoname.startsWith("field:")) return "field";
	if (autoname.startsWith("naming_series:")) return "naming_series";
	if (["hash", "autoincrement", "prompt"].includes(autoname)) return autoname as Rule;
	if (autoname.startsWith("format:") || autoname.includes("#")) return "format";
	return "hash";
}

export type SettingsUi = ReturnType<typeof createSettingsUi>;
/** The section a row sits in, for the search's "hide a section with no match". */
export const SettingsSectionKey: InjectionKey<string> = Symbol("SettingsSection");
/** The group (inside a section) a row sits in, so a group with no match hides too. */
export const SettingsGroupKey: InjectionKey<string> = Symbol("SettingsGroup");

/** Every word of the query is in the text. */
export const matches = (text: string, query: string) =>
	query.trim().toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.toLowerCase().includes(word));

let searchId = 1;
/** Registers a row's searchable text with its section; true while the search keeps it. The panel (C) does not filter. */
export function useSearchable(text: () => string, label = text, el: () => HTMLElement | null = () => null) {
	const ui = inject(SettingsKey)!;
	const section = inject(SettingsSectionKey, "");
	const group = inject(SettingsGroupKey, "");
	if (inject(SettingsPlaceKey, "page") === "panel") return computed(() => true);
	const id = searchId++;
	watchEffect(() => ui.search.rows.set(id, { section, group, text: text(), label: label(), el }));
	onBeforeUnmount(() => ui.search.rows.delete(id));
	return computed(() => !ui.search.query.trim() || matches(text(), ui.search.query));
}
export const SettingsKey: InjectionKey<SettingsUi> = Symbol("SettingsUi");
/** Where a row draws: in the page's column, or stacked in the 380px panel (variant C). */
export const SettingsPlaceKey: InjectionKey<"page" | "panel"> = Symbol("SettingsPlace");

export function createSettingsUi(source: SettingsSource) {
	const design = reactive<Record<string, any>>({});
	const shippedSetters: Record<string, string> = {};
	const site = reactive<Record<string, string>>({});
	const perms = reactive({ app: [] as PermRow[], site: null as PermRow[] | null, siteAtLoad: 0, copied: false });
	const loaded = reactive({ done: false, savedKind: "regular" as SettingsKind, rule: "hash" as Rule, roles: [] as string[], linkFields: null as number | null, submitted: 0, modules: [] as { name: string; app: string }[] });
	let saved = "";

	const ui = reactive({
		doctype: source.doctype,
		draft: Boolean(source.draft),
		custom: Boolean(source.draft),
		module: source.draft?.module ?? "",
		loaded,
		perms,
		/** The Danger zone act whose dialog is open; the header's ⋯ menu opens the same ones. */
		act: "" as Act,
		/** The search box's text, and each mounted row's searchable text by section. */
		search: { query: "", rows: new Map<number, { section: string; group: string; text: string; label: string; el: () => HTMLElement | null }>() },
		groupMatches(section: string, group: string) {
			if (!ui.search.query.trim()) return true;
			for (const row of ui.search.rows.values()) if (row.section === section && row.group === group && matches(row.text, ui.search.query)) return true;
			return false;
		},
		sectionMatches(section: string) {
			if (!ui.search.query.trim()) return true;
			for (const row of ui.search.rows.values()) if (row.section === section && matches(row.text, ui.search.query)) return true;
			return false;
		},
		customizing: computed(source.customizing),
		app: computed(() => source.app() || "the app"),
		records: computed(() => (source.draft ? null : source.records())),
		fields: computed(source.fields),
		kind: computed(() => kindOf({ istable: ui.value("istable"), issingle: ui.value("issingle"), is_tree: ui.value("is_tree"), is_submittable: ui.value("is_submittable") })),
		rule: computed(() => ruleOf({ naming_rule: ui.value("naming_rule"), autoname: ui.value("autoname") })),

		value(prop: string): any {
			if (prop === "title_field" && !ui.customizing) return source.titleField.value;
			if (prop === "description") return source.description.value;
			if (!ui.customizing || !(prop in site)) return prop === "title_field" ? (shippedSetters[prop] ?? design.title_field ?? "") : design[prop];
			return TEXT_PROPS.has(prop) ? site[prop] : Number(site[prop]) || 0;
		},
		set(prop: string, next: any) {
			if (!ui.customizing) {
				if (prop === "title_field") source.titleField.value = next;
				else if (prop === "description") source.description.value = next;
				else design[prop] = next;
				return;
			}
			if (norm(next) === ui.shipped(prop)) delete site[prop];
			else site[prop] = String(next ?? "");
		},
		/** What the app ships (the DocType and its own setters), normalised: Customize's baseline. */
		shipped: (prop: string): string => {
			if (prop === "naming") return RULES.find((one) => one.value === ruleOf({ naming_rule: ui.shipped("naming_rule"), autoname: ui.shipped("autoname") }))!.label;
			return norm(shippedSetters[prop] ?? design[prop]);
		},
		changed: (prop: string): boolean => (prop === "naming" ? ui.changed("naming_rule") || ui.changed("autoname") : ui.customizing && prop in site),
		reset(prop: string) {
			for (const one of prop === "naming" ? ["naming_rule", "autoname"] : [prop]) delete site[one];
		},
		/** Why this setting cannot change here; "" when it can. */
		lock(prop: string): string {
			if (!ui.customizing || !prop) return "";
			if (["istable", "issingle", "is_tree", "is_submittable", "kind"].includes(prop)) return "Kind changes only in Design.";
			if (CUSTOMIZABLE.has(prop) || prop === "naming") return "";
			return `Only ${ui.app}'s DocType sets this. Customize cannot change it.`;
		},

		/** The rows the grid edits: the site's own in Customize when it has them, else the app's. */
		rows: computed<PermRow[]>(() => (ui.customizing ? (perms.site ?? perms.app) : perms.app)),
		siteRules: computed(() => ui.customizing && perms.site !== null),
		/** The first Customize edit copies the app's rules into Custom DocPerm. */
		editable(): PermRow[] {
			if (!ui.customizing) return perms.app;
			if (!perms.site) {
				perms.site = clone(perms.app);
				perms.copied = true;
			}
			return perms.site;
		},
		columns: computed<Right[]>(() => {
			if (ui.kind === "single") return ["read", "write"];
			return ui.kind === "submittable" ? ["read", "write", "create", "delete", "submit", "cancel", "amend"] : ["read", "write", "create", "delete"];
		}),
		more: computed<Right[]>(() => {
			const all: Right[] = ["select", "report", "export", "import", "print", "email", "share", "if_owner"];
			return ui.kind === "single" ? all.filter((one) => !["report", "export", "import", "if_owner"].includes(one)) : all;
		}),
		/** Why a cell cannot be ticked; "" when it can. */
		refuse(row: PermRow, right: Right): string {
			if (row.permlevel > 0 && LEVEL_ZERO_ONLY.has(right)) return `A level ${row.permlevel} rule only reads and writes the fields at that level.`;
			if (right === "import" && !Number(ui.value("allow_import"))) return "Turn on Allow import in Form and list first.";
			return "";
		},
		toggle(row: PermRow, right: Right, on: boolean) {
			// The first Customize edit copies the rows; the same place in the copy is this row.
			const at = ui.rows.indexOf(row);
			const target = ui.editable()[at];
			if (!target) return;
			const tick = (one: Right) => {
				target[one] = 1;
				for (const need of NEEDS[one] ?? []) tick(need);
			};
			const untick = (one: Right) => {
				target[one] = 0;
				for (const [dependent, needs] of Object.entries(NEEDS)) if (needs!.includes(one) && target[dependent]) untick(dependent as Right);
			};
			if (on) tick(right);
			else untick(right);
			// Report with "Only if creator" is refused (dt.py): one replaces the other.
			if (on && right === "if_owner") target.report = 0;
			if (on && right === "report") target.if_owner = 0;
		},
		addRole(role: string) {
			ui.editable().push(asRow({ role, permlevel: 0, read: 1, ...(ui.kind !== "single" ? { report: 1, print: 1, email: 1, share: 1 } : {}) }));
		},
		removeRow(row: PermRow) {
			const at = ui.rows.indexOf(row);
			ui.editable().splice(at, 1);
		},
		resetPerms() {
			perms.site = null;
			perms.copied = false;
		},

		/** Sets the four kind flags; a child table drops its permissions and import (dt.py). */
		setKind(next: SettingsKind) {
			const was = ui.kind;
			design.issingle = next === "single" ? 1 : 0;
			design.istable = next === "child" ? 1 : 0;
			design.is_tree = next === "tree" ? 1 : 0;
			design.is_submittable = next === "submittable" ? 1 : 0;
			if (next === "child") {
				perms.app.splice(0);
				design.allow_import = 0;
			} else if (was === "child" && !perms.app.length) {
				perms.app.push(asRow({ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, share: 1, print: 1, email: 1 }));
			}
			if (next === "single") design.allow_rename = 0;
		},
		setRule(rule: Rule, autoname: string) {
			ui.set("naming_rule", RULES.find((one) => one.value === rule)!.naming_rule);
			ui.set("autoname", autoname);
		},

		dirty: computed(() => loaded.done && snapshot() !== saved),
		markSaved() {
			saved = snapshot();
		},
	});

	function snapshot() {
		const { title_field: _title, ...rest } = design;
		return JSON.stringify([rest, site, perms.app.map(strip), perms.site?.map(strip) ?? null]);
	}
	const strip = ({ id: _id, ...rest }: PermRow) => rest;

	void load();
	async function load() {
		if (source.draft) fillDraft(source.draft.kind);
		else await fillSaved();
		loaded.savedKind = ui.kind;
		loaded.rule = ui.rule;
		ui.markSaved();
		loaded.done = true;
		const roles = await list<{ name: string }>("Role", { disabled: 0 }, ["name"]);
		loaded.roles = roles.map((one) => one.name).sort();
	}

	function fillDraft(kind: SettingsKind) {
		Object.assign(design, { naming_rule: "Random", autoname: "hash", allow_rename: kind === "single" ? 0 : 1, sort_field: "creation", sort_order: "DESC", show_title_field_in_link: 0, track_changes: 1 });
		ui.setKind(kind);
		if (kind !== "child") perms.app.push(asRow({ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, share: 1, print: 1, email: 1, ...(kind === "submittable" ? { submit: 1, cancel: 1, amend: 1 } : {}) }));
	}

	async function fillSaved() {
		const name = source.doctype;
		const [doc, sitePerms, setters, modules] = await Promise.all([
			runMethod<Record<string, any>>("frappe.client.get", { doctype: "DocType", name }, { http: "GET" }).then(({ data }) => data ?? {}),
			list<Record<string, any>>("Custom DocPerm", { parent: name }, ["*"]),
			list<{ property: string; value: string; is_system_generated: number }>("Property Setter", { doc_type: name, doctype_or_field: "DocType" }, ["property", "value", "is_system_generated"]),
			list<{ name: string; app_name: string }>("Module Def", {}, ["name", "app_name"]),
		]);
		for (const prop of PROPS) design[prop] = doc[prop] ?? (TEXT_PROPS.has(prop) ? "" : 0);
		ui.custom = Boolean(doc.custom);
		ui.module = doc.module ?? "";
		perms.app.push(...(doc.permissions ?? []).sort((a: any, b: any) => a.permlevel - b.permlevel || a.idx - b.idx).map(asRow));
		if (sitePerms.length) perms.site = sitePerms.sort((a, b) => a.permlevel - b.permlevel || a.idx - b.idx).map(asRow);
		perms.siteAtLoad = sitePerms.length;
		for (const one of setters) {
			if (!(PROPS as string[]).includes(one.property)) continue;
			if (one.is_system_generated) shippedSetters[one.property] = one.value;
			else site[one.property] = one.value;
		}
		loaded.modules = modules.map((one) => ({ name: one.name, app: one.app_name })).sort((a, b) => a.name.localeCompare(b.name));
		// For the Danger zone and Change kind: fields that point here, and records that are submitted.
		// Counting DocFields needs DocField read; without it the count stays null and Rename hides its line.
		void runMethod<number>("frappe.client.get_count", { doctype: "DocField", filters: JSON.stringify({ options: name, fieldtype: ["in", ["Link", "Table", "Table MultiSelect"]] }) }, { http: "GET" })
			.then(({ data }) => (loaded.linkFields = data ?? 0))
			.catch(() => {});
		if (doc.is_submittable)
			void runMethod<number>("frappe.client.get_count", { doctype: name, filters: JSON.stringify({ docstatus: 1 }) }, { http: "GET" })
				.then(({ data }) => (loaded.submitted = data ?? 0))
				.catch(() => {});
	}

	return ui;
}

async function list<T>(doctype: string, filters: Record<string, unknown>, fields: string[]) {
	const { data } = await runMethod<T[]>(
		"frappe.client.get_list",
		{ doctype, filters: JSON.stringify(filters), fields: JSON.stringify(fields), limit_page_length: 0 },
		{ http: "GET" }
	);
	return data ?? [];
}

/** Why the DocType cannot become `next`, from what it is saved as; "" when it can. */
export function kindRefusal(ui: SettingsUi, next: SettingsKind): string {
	if (ui.draft) return "";
	const from = ui.loaded.savedKind;
	if (next === from) return "";
	if (from === "single") return "Set when the DocType was made. A Single keeps its one record apart from any table.";
	if (next === "single") return "Set when a DocType is made. Make a new Single instead.";
	const records = ui.records ?? 0;
	if ((from === "child" || next === "child") && records)
		return `Not while ${ui.doctype} has ${records.toLocaleString()} record${records === 1 ? "" : "s"}: ${from === "child" ? "its rows belong to parent records" : "a child table's rows need a parent record"}.`;
	return "";
}

/** What changing to `next` does, said under the radio list. */
export function kindConsequence(ui: SettingsUi, next: SettingsKind): string {
	const from = ui.loaded.savedKind;
	if (next === from) return "";
	const notes: string[] = [];
	if (from === "submittable" && ui.loaded.submitted)
		notes.push(`${ui.loaded.submitted} submitted record${ui.loaded.submitted === 1 ? " stays" : "s stay"} submitted and locked; nobody can cancel or amend them.`);
	if (from === "tree") notes.push("The tree fields (lft, rgt, Is Group, Old Parent, Parent) stay. Remove them in the Editor.");
	if (next === "submittable") notes.push("Adds an Amended From field. Submit, Cancel and Amend join the permissions grid.");
	if (next === "tree") notes.push(`Adds 5 fields: lft, rgt, Is Group, Old Parent and Parent ${ui.doctype}.`);
	if (next === "child") notes.push("Drops its permissions and Allow import: rows take both from the parent. Adds the parent columns.");
	if (from === "child") notes.push("Adds a System Manager rule, so someone can open the list.");
	return notes.join(" ");
}

/** Why a naming rule cannot be picked; "" when it can. */
export function ruleRefusal(ui: SettingsUi, rule: Rule): string {
	const current = ui.loaded.rule;
	const records = ui.records ?? 0;
	if (current === "script" && rule !== "script" && !ui.draft) return `${ui.doctype}'s code names its records; another rule would be ignored.`;
	if (rule === "autoincrement" && ui.customizing) return "Numbers in order change the name column's type: Design only.";
	if ((rule === "autoincrement") !== (current === "autoincrement") && records && !ui.draft)
		return current === "autoincrement"
			? `Not while ${records.toLocaleString()} records have numbers for names.`
			: `Not while ${records.toLocaleString()} records exist: their names are not numbers.`;
	if (rule === "naming_series" && !ui.fields.some((one) => one.fieldname === "naming_series")) return "Add a Select field named naming_series first.";
	return "";
}

export const TOKENS = ["{YYYY}", "{MM}", "{DD}", "{#####}", "{field}"];

/**
 * The next name a pattern gives, as text and gray placeholders. FAKED: the server keeps the real
 * counter per prefix (tabSeries); here it is the record count + 1, padded to the #'s length, and
 * a {field} shows as <Field label>.
 */
export function previewName(pattern: string, counter: number, labelOf: (fieldname: string) => string) {
	const parts: { text: string; gray?: boolean }[] = [];
	const now = new Date();
	const pad = (n: number, width: number) => String(n).padStart(width, "0");
	const token = (raw: string, braced: boolean) => {
		if (/^#+$/.test(raw)) return { text: pad(counter, raw.length) };
		const dates: Record<string, string> = {
			YYYY: String(now.getFullYear()), YY: String(now.getFullYear()).slice(2), MM: pad(now.getMonth() + 1, 2), DD: pad(now.getDate(), 2),
		};
		if (dates[raw]) return { text: dates[raw] };
		if (braced) return { text: `<${labelOf(raw)}>`, gray: true };
		return { text: raw };
	};
	if (pattern.startsWith("format:")) {
		for (const piece of pattern.slice(7).split(/(\{[^}]*\})/)) if (piece) parts.push(piece.startsWith("{") ? token(piece.slice(1, -1), true) : { text: piece });
		return parts;
	}
	// Dot style (a Naming Series, an Expression): PRE-.YYYY.-.#####; no # appends five.
	const pieces = pattern.split(".");
	if (!pieces.some((one) => one.startsWith("#"))) pieces.push("#####");
	for (const piece of pieces)
		if (piece) parts.push(piece.startsWith("{") && piece.endsWith("}") ? token(piece.slice(1, -1), true) : token(piece, false));
	return parts;
}

/** Why a Danger zone act cannot run; "" when it can. The header's ⋯ menu hides a refused act. */
export function actRefusal(ui: SettingsUi, act: Act): string {
	if (act === "rename" && ui.loaded.savedKind === "single") return "A Single cannot be renamed.";
	if (act === "standard" && !ui.custom) return `${ui.doctype} is already standard.`;
	return "";
}

/** Where a standard DocType's files live in its app: frappe/contacts/doctype/contact. */
export function folderOf(ui: SettingsUi, module: string, doctype = ui.doctype) {
	const app = ui.loaded.modules.find((one) => one.name === module)?.app ?? "app";
	const slug = (text: string) => text.toLowerCase().replace(/[ -]+/g, "_");
	return `${app}/${slug(module)}/doctype/${slug(doctype)}`;
}
