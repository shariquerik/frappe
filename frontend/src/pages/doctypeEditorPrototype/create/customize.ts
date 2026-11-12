// PROTOTYPE (#47096), throwaway: Customize mode on a saved standard DocType. What the site may change
// on a field, what it has changed, and what Reset all would remove. The Custom Field and Property
// Setter rows are real reads; nothing is written.
import { computed, reactive, type ComputedRef, type InjectionKey } from "vue";
import { runMethod } from "@framework/ui/api";
import type { Editor, EditorField } from "../editor";
import { fieldIndex, typesKeepingValues } from "./savedDoctype";

export type Persona = "developer" | "manager";

/** Customize Form's ALLOWED_OPTIONS_CHANGE: the only types whose options a site may change. */
const OPTIONS_CHANGE = new Set(["Read Only", "HTML", "Data"]);
/** Properties a field keeps whatever the site does: not in Customize Form's docfield_properties. */
const FIXED: Record<string, string> = {
	fieldname: "fieldname",
	search_index: "A search index changes only in the app's DocType.",
};
/** The properties the "Changed" marks watch on a standard field. */
const WATCHED = [
	"label", "fieldtype", "options", "reqd", "default", "placeholder", "description", "depends_on", "mandatory_depends_on",
	"read_only_depends_on", "hidden", "read_only", "bold", "print_hide", "report_hide", "allow_on_submit", "translatable",
	"in_list_view", "in_standard_filter", "in_global_search", "in_preview", "fetch_from", "fetch_if_empty", "unique",
	"no_copy", "set_only_once", "non_negative", "precision", "length", "permlevel", "ignore_user_permissions",
];

const APP_TITLES: Record<string, string> = { erpnext: "ERPNext", frappe: "Frappe", hrms: "Frappe HR", helpdesk: "Helpdesk" };

/** 0, "", "0", null and undefined all mean "not set". */
const norm = (value: unknown) => (value === undefined || value === null || value === 0 || value === "0" ? "" : String(value));

interface CustomFieldRow {
	fieldname: string;
	is_system_generated: number;
}
interface SetterRow {
	field_name: string | null;
	property: string;
	value: string;
	is_system_generated: number;
}

export interface CustomizeUi {
	persona: Persona;
	/** The app the DocType ships in, as people know it ("ERPNext"). */
	app: string;
	/** Rows read at load: the Custom Fields by fieldname, the Property Setters the site made. */
	customFields: Record<string, CustomFieldRow>;
	siteSetters: SetterRow[];
	appSetters: number;
	/** A field the site owns: added here, or a Custom Field nobody's app made. */
	isCustom: (fieldname: string) => boolean;
	/** A Custom Field an app installed (ERPNext's regional fields): standard for Customize. */
	fromApp: (fieldname: string) => boolean;
	isStandard: (fieldname: string) => boolean;
	/** The properties of a standard field the site has changed, saved or in this session. */
	changed: (fieldname: string) => string[];
	isChanged: (fieldname: string, prop: string) => boolean;
	reset: (fieldname: string, prop: string) => void;
	/** The value the app ships for this property, normalised ("" for not set). */
	shipped: (fieldname: string, prop: string) => string;
	/** Why the site may not change this property of this field; "" when it may. */
	lock: (field: EditorField, prop: string) => string;
	/** The field a custom field sits after, which is how it keeps its place (#45865). */
	anchor: (fieldname: string) => { label: string; fieldname: string } | null;
	/** What Save writes, and what Reset all would remove. */
	counts: { customFields: number; propertyChanges: number; layouts: number };
	/** What the next Save writes. */
	pending: { customFields: number; propertyChanges: number };
	/** Marks everything changed so far as saved. */
	markSaved: () => void;
}

export const CustomizeKey: InjectionKey<ComputedRef<CustomizeUi | null>> = Symbol("CustomizeUi");

export async function createCustomizeUi(editor: Editor, doctype: string, module: string, persona: Persona): Promise<CustomizeUi> {
	const [customFields, setters, app] = await Promise.all([
		list<CustomFieldRow>("Custom Field", { dt: doctype }, ["fieldname", "is_system_generated"]),
		list<SetterRow>("Property Setter", { doc_type: doctype }, ["field_name", "property", "value", "is_system_generated"]),
		runMethod<{ message?: string } | string>(
			"frappe.client.get_value",
			{ doctype: "Module Def", filters: module, fieldname: "app_name" },
			{ http: "GET" }
		).then(({ data }: any) => String(data?.app_name ?? "")),
	]);
	// What the apps ship (the DocType plus their own setters) is the baseline a "Changed" mark is against.
	const shipped: Record<string, Record<string, string>> = {};
	for (const field of editor.state.fields) shipped[field.fieldname] = Object.fromEntries(WATCHED.map((key) => [key, norm((field as any)[key])]));
	const siteSetters = setters.filter((one) => !one.is_system_generated);
	await baselineUnderSiteSetters(doctype, siteSetters, shipped);
	const loaded = new Set(editor.state.fields.map((one) => one.fieldname));
	const byName = Object.fromEntries(customFields.map((one) => [one.fieldname, one]));
	// Changes already saved in this session count like the site's rows, for Reset all.
	const saved = reactive({ fields: new Set<string>(), props: {} as Record<string, string> });

	const field = (fieldname: string) => editor.field(fieldname);
	const ui: CustomizeUi = reactive({
		persona,
		app: APP_TITLES[app] ?? app,
		customFields: byName,
		siteSetters,
		appSetters: setters.length - siteSetters.length,
		isCustom: (fieldname: string) => {
			const row = byName[fieldname];
			if (row) return !row.is_system_generated;
			return Boolean(field(fieldname)?.custom) || !loaded.has(fieldname);
		},
		fromApp: (fieldname: string) => Boolean(byName[fieldname]?.is_system_generated),
		isStandard: (fieldname: string) => !ui.isCustom(fieldname),
		changed(fieldname: string) {
			const now = field(fieldname);
			const base = shipped[fieldname];
			if (!now || !base || ui.isCustom(fieldname)) return [];
			return WATCHED.filter((key) => norm((now as any)[key]) !== base[key]);
		},
		isChanged: (fieldname: string, prop: string) => ui.changed(fieldname).includes(prop),
		reset(fieldname: string, prop: string) {
			const base = shipped[fieldname]?.[prop] ?? "";
			const now = (field(fieldname) as any)?.[prop];
			editor.acts.setField(fieldname, prop, typeof now === "number" ? Number(base) || 0 : base);
		},
		shipped: (fieldname: string, prop: string) => shipped[fieldname]?.[prop] ?? "",
		lock(one: EditorField, prop: string) {
			if (ui.isCustom(one.fieldname)) return "";
			const base = shipped[one.fieldname] ?? {};
			const owner = ui.app || "the app";
			if (prop === "fieldname") return `A standard field keeps its fieldname. ${owner}'s code and reports read it.`;
			if (FIXED[prop]) return FIXED[prop];
			if (prop === "fieldtype" && typesKeepingValues(base.fieldtype || one.fieldtype).length === 1)
				return `A standard ${base.fieldtype || one.fieldtype} field keeps its type. ${owner}'s code reads its values as they are.`;
			if (prop === "options" && !OPTIONS_CHANGE.has(one.fieldtype))
				return `${owner} reads this ${one.fieldtype} field's ${one.fieldtype === "Select" ? "options" : "target"}; a site cannot change it.`;
			if (prop === "reqd" && base.reqd) return `${owner} needs a value here. A site can make a field required, not optional.`;
			if (prop === "read_only" && base.read_only) return `${owner} sets this field itself. A site can make a field read only, not editable.`;
			if (prop === "allow_on_submit" && !base.allow_on_submit) return "Only a custom field can be edited after submit.";
			return "";
		},
		anchor(fieldname: string) {
			const rows = fieldIndex(editor);
			const at = rows.findIndex((one) => one.fieldname === fieldname);
			return at > 0 ? { label: rows[at - 1].label, fieldname: rows[at - 1].fieldname } : null;
		},
		counts: computed(() => {
			const fields = Object.values(byName).filter((one) => !one.is_system_generated).length + saved.fields.size;
			const props = siteSetters.filter((one) => one.property !== "options" && one.field_name !== "naming_series").length;
			const layouts = Object.values(editor.state.forked).filter(Boolean).length;
			return { customFields: fields, propertyChanges: props + Object.keys(saved.props).length, layouts };
		}),
		pending: computed(() => {
			let fields = 0;
			let props = 0;
			for (const one of editor.state.fields) {
				if (ui.isCustom(one.fieldname) && !byName[one.fieldname] && !saved.fields.has(one.fieldname)) fields++;
				for (const prop of ui.changed(one.fieldname)) if (saved.props[`${one.fieldname}.${prop}`] !== String((one as any)[prop])) props++;
			}
			return { customFields: fields, propertyChanges: props };
		}),
		markSaved() {
			for (const one of editor.state.fields) {
				if (ui.isCustom(one.fieldname) && !byName[one.fieldname]) saved.fields.add(one.fieldname);
				for (const prop of ui.changed(one.fieldname)) saved.props[`${one.fieldname}.${prop}`] = String((one as any)[prop]);
			}
		},
	}) as unknown as CustomizeUi;
	return ui;
}

/** Under a setter the site made, the shipped value is the DocField's own. */
async function baselineUnderSiteSetters(doctype: string, setters: SetterRow[], shipped: Record<string, Record<string, string>>) {
	const names = [...new Set(setters.map((one) => one.field_name).filter(Boolean))] as string[];
	if (!names.length) return;
	const rows = await list<Record<string, unknown>>("DocField", { parent: doctype, fieldname: ["in", names] }, ["*"], "DocType");
	for (const setter of setters) {
		const row = rows.find((one) => one.fieldname === setter.field_name);
		if (row && shipped[setter.field_name!]) shipped[setter.field_name!][setter.property] = norm(row[setter.property]);
	}
}

async function list<T>(doctype: string, filters: Record<string, unknown>, fields: string[], parent?: string) {
	const { data } = await runMethod<T[]>(
		"frappe.client.get_list",
		{ doctype, filters: JSON.stringify(filters), fields: JSON.stringify(fields), limit_page_length: 0, ...(parent ? { parent } : {}) },
		{ http: "GET" }
	);
	return data ?? [];
}

/** "1 custom field, 2 property changes" */
export function summary(counts: { customFields: number; propertyChanges: number; layouts?: number }) {
	const parts = [];
	if (counts.customFields) parts.push(`${counts.customFields} custom field${counts.customFields === 1 ? "" : "s"}`);
	if (counts.propertyChanges) parts.push(`${counts.propertyChanges} property change${counts.propertyChanges === 1 ? "" : "s"}`);
	if (counts.layouts) parts.push(`${counts.layouts} site layout${counts.layouts === 1 ? "" : "s"}`);
	return parts.join(", ");
}
