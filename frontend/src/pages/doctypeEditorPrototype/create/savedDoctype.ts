// PROTOTYPE (#47095), throwaway: what the editor knows about a DocType that is already saved and
// has records (Design mode). Counts are real reads; nothing is written.
import { nextTick, reactive, type ComputedRef, type InjectionKey } from "vue";
import { runMethod } from "@framework/ui/api";
import type { Editor } from "../editor";
import { nameOf } from "../editor";

export interface SavedUi {
	doctype: string;
	/** A custom DocType renames a field's column; a standard one keeps its fieldnames. */
	custom: boolean;
	records: number;
	/** Each field's type at load, so a type change is judged against the column as it is. */
	loadedType: Record<string, string>;
	/** Records that hold a value in the field (by its fieldname at load), read once; undefined while loading. */
	counts: Record<string, number | undefined>;
	count: (fieldname: string) => void;
	/** A renamed field's fieldname at load, keyed by its new one. */
	renamed: Record<string, string>;
	original: (fieldname: string) => string;
	/** Fields that existed at load: their column holds data, so they get the warnings. */
	isSaved: (fieldname: string) => boolean;
	jumpTo: (fieldname: string) => void;
}

/** Provided by the saved-DocType page only; null until its meta loads. A draft page provides none. */
export const SavedUiKey: InjectionKey<ComputedRef<SavedUi | null>> = Symbol("SavedUi");

/** Customize Form's ALLOWED_FIELDTYPE_CHANGE: the changes that keep a column's values. */
const KEEPS_VALUES = [
	["Currency", "Float", "Percent"],
	["Small Text", "Data"],
	["Text", "Data"],
	["Text", "Text Editor", "Code", "Signature", "HTML Editor"],
	["Data", "Select"],
	["Text", "Small Text", "Long Text"],
	["Text", "Data", "Barcode"],
	["Code", "Geolocation"],
	["Table", "Table MultiSelect"],
];

/** The types a field can change to while its column holds values, its own type first. */
export function typesKeepingValues(from: string) {
	const out = new Set([from]);
	for (const group of KEEPS_VALUES) if (group.includes(from)) group.forEach((one) => out.add(one));
	return [...out];
}

const NO_COLUMN = new Set(["Table", "Table MultiSelect", "Button", "HTML", "Image", "Heading", "Fold"]);

export function createSavedUi(editor: Editor, doctype: string, custom: boolean): SavedUi {
	const loaded = new Set(editor.state.fields.map((one) => one.fieldname));
	const ui: SavedUi = reactive({
		doctype,
		custom,
		records: 0,
		loadedType: Object.fromEntries(editor.state.fields.map((one) => [one.fieldname, one.fieldtype])),
		counts: {},
		renamed: {},
		original: (fieldname: string) => ui.renamed[fieldname] ?? fieldname,
		count(name: string) {
			const fieldname = ui.original(name);
			if (fieldname in ui.counts || !loaded.has(fieldname)) return;
			ui.counts[fieldname] = undefined;
			if (NO_COLUMN.has(ui.loadedType[fieldname])) return void (ui.counts[fieldname] = 0);
			void runMethod<number>(
				"frappe.client.get_count",
				{ doctype, filters: JSON.stringify({ [fieldname]: ["is", "set"] }) },
				{ http: "GET" }
			)
				.then(({ data }) => (ui.counts[fieldname] = data))
				.catch(() => (ui.counts[fieldname] = 0));
		},
		isSaved: (fieldname: string) => loaded.has(ui.original(fieldname)),
		jumpTo(fieldname: string) {
			const tab = editor.tree.value.find((one) =>
				one.sections.some((section) => section.columns.some((column) => column.fields.some((entry) => nameOf(entry) === fieldname)))
			);
			if (tab) editor.state.activeTab = tab.name!;
			editor.state.selection = { kind: "field", fieldname };
			void nextTick(() =>
				requestAnimationFrame(() =>
					document
						.querySelector(`[data-editor-canvas] [data-fieldname="${fieldname}"]`)
						?.scrollIntoView({ block: "center" })
				)
			);
		},
	});
	void runMethod<number>("frappe.client.get_count", { doctype }, { http: "GET" }).then(({ data }) => (ui.records = data));
	return ui;
}

/** "1,204 records" */
export const plural = (n: number, one: string) => `${n.toLocaleString()} ${n === 1 ? one : `${one}s`}`;

/** Every placed field, in form order, with where it sits: for the finders. */
export function fieldIndex(editor: Editor) {
	const rows: { fieldname: string; label: string; fieldtype: string; options?: string; tab: string; tabKey: string; section: string }[] = [];
	for (const tab of editor.tree.value)
		for (const section of tab.sections)
			for (const column of section.columns)
				for (const entry of column.fields) {
					const field = editor.field(nameOf(entry));
					if (!field) continue;
					rows.push({
						fieldname: field.fieldname,
						label: field.label || field.fieldname,
						fieldtype: field.fieldtype,
						options: field.options,
						tab: tab.label || "Details",
						tabKey: tab.name!,
						section: section.label || "",
					});
				}
	return rows;
}

export function matches(row: { label: string; fieldname: string }, query: string) {
	const q = query.trim().toLowerCase();
	return !q || row.label.toLowerCase().includes(q) || row.fieldname.includes(q.replace(/\s+/g, "_"));
}
