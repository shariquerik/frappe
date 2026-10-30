// PROTOTYPE (#45867), throwaway: the DocType editor's state and acts, in memory only.
// Nothing here saves. Every edit runs through `act`, which logs it the way `page.run` would.

import { reactive, computed } from "vue";
import { runMethod } from "@framework/ui/api";
import { DROPPED_FIELDTYPES } from "@framework/ui/FormLayout";
import { joinLayout } from "@/recordPage/formLayoutSource/joinLayout";
import type {
	FormLayoutsResponse,
	LayoutTree,
	LayoutTreeColumn,
	LayoutTreeSection,
	LayoutTreeTab,
} from "@/recordPage/formLayoutSource/types";
import type { FormLayoutSchema, RawMetaField } from "@framework/ui/FormLayout/types";

export type Mode = "design" | "customize";
export type LayoutKey = "details" | "side-panel" | "quick-entry" | "new-record";
export type EditorField = RawMetaField & { custom?: boolean; added?: boolean; idx?: number };
export type Selection =
	| { kind: "field"; fieldname: string }
	| { kind: "tab" | "section" | "column"; key: string }
	| null;

export const LAYOUTS: { key: LayoutKey; type: string; label: string }[] = [
	{ key: "details", type: "Details", label: "Details" },
	{ key: "side-panel", type: "Side Panel", label: "Side panel" },
	{ key: "quick-entry", type: "Quick Entry", label: "Quick entry" },
	{ key: "new-record", type: "New Record", label: "New record" },
];

export const MORE_FIELDS = "__more_fields__";

let counter = 0;
const newKey = (kind: string) => `${kind}-new-${++counter}`;

export function createEditor(doctype: string, mode: Mode) {
	const state = reactive({
		doctype,
		mode,
		layout: "details" as LayoutKey,
		loading: true,
		fields: [] as EditorField[],
		trees: {} as Record<LayoutKey, LayoutTree>,
		omitted: {} as Record<LayoutKey, string[]>,
		// Where each layout came from: a site row, the app's file, or the break fallback.
		source: {} as Record<LayoutKey, "row" | "fallback" | "none">,
		forked: {} as Record<LayoutKey, boolean>,
		selection: null as Selection,
		log: [] as { act: string; args: string; note?: string }[],
		dragging: null as null | "field" | "column" | "section",
	});

	async function load(meta: { fields: RawMetaField[] }) {
		state.fields = meta.fields.map((field, idx) => ({ ...field, idx }));
		await Promise.all(
			LAYOUTS.map(async ({ key, type }) => {
				const { data } = await runMethod<FormLayoutsResponse>(
					"frappe.desk.doctype.form_layout.form_layout.get_form_layouts",
					{ dt: doctype, type },
					{ http: "GET" }
				);
				const row = data.layouts.find((one) => !one.condition);
				const tree = row?.layout ?? (key === "side-panel" ? [] : data.fallback);
				state.trees[key] = keyed(structuredClone(tree ?? []));
				state.omitted[key] = [];
				state.source[key] = row ? "row" : key === "side-panel" ? "none" : "fallback";
				state.forked[key] = false;
			})
		);
		state.loading = false;
	}

	const tree = computed(() => state.trees[state.layout] ?? []);
	const dataFields = computed(() =>
		state.fields.filter((field) => !DROPPED_FIELDTYPES.has(field.fieldtype))
	);
	const placed = computed(() => new Set(placedIn(tree.value)));
	const omitted = computed(() => new Set(state.omitted[state.layout] ?? []));
	const unplaced = computed(() =>
		dataFields.value.filter(
			(field) => !placed.value.has(field.fieldname) && !omitted.value.has(field.fieldname)
		)
	);
	// Ruling 11 of #45864: the automatic section exists on Details and New Record only.
	const hasMoreFields = computed(
		() => state.layout === "details" || state.layout === "new-record"
	);
	const autoFields = computed(() => {
		if (hasMoreFields.value) return unplaced.value.filter((field) => !field.hidden);
		if (state.layout === "quick-entry") return unplaced.value.filter(isMandatory);
		return [];
	});

	/** The schema the canvas draws: the tree joined against the meta, plus the automatic section. */
	const schema = computed<FormLayoutSchema>(() => {
		const tabs = tree.value.length ? tree.value : [{ name: newKey("tab"), sections: [] }];
		const joined = joinLayout(tabs, state.fields);
		// joinLayout drops `description`, which the renderer is learning in this prototype.
		forEachSection(tabs, (section, t, s) => {
			joined[t].sections[s].description = (section as any).description;
		});
		if (autoFields.value.length && joined[0]) {
			joined[0].sections.push({
				name: MORE_FIELDS,
				label: state.layout === "quick-entry" ? "Mandatory fields" : "More fields",
				columns: [
					{ name: MORE_FIELDS, fields: joinLayout(
						[{ sections: [{ columns: [{ fields: autoFields.value.map((f) => f.fieldname) }] }] }],
						state.fields
					)[0].sections[0].columns[0].fields },
				],
			});
		}
		return joined;
	});

	const field = (fieldname: string) => state.fields.find((one) => one.fieldname === fieldname);

	function find(key: string) {
		for (const tab of tree.value) {
			if (tab.name === key) return { kind: "tab" as const, node: tab, list: tree.value };
			for (const section of tab.sections ?? []) {
				if (section.name === key)
					return { kind: "section" as const, node: section, list: tab.sections, parent: tab };
				for (const column of section.columns ?? [])
					if (column.name === key)
						return { kind: "column" as const, node: column, list: section.columns, parent: section };
			}
		}
		return null;
	}

	function columnOf(fieldname: string) {
		for (const tab of tree.value)
			for (const section of tab.sections ?? [])
				for (const column of section.columns ?? [])
					if (column.fields.some((entry) => nameOf(entry) === fieldname)) return column;
		return null;
	}

	function act(name: string, args: Record<string, unknown>, note?: string) {
		state.log.unshift({ act: name, args: JSON.stringify(args), note });
		if (state.log.length > 30) state.log.pop();
	}

	// The first container edit on a layout still drawn from the app's breaks forks a site row.
	function touchContainer() {
		if (state.mode === "customize" && state.source[state.layout] === "fallback") {
			state.source[state.layout] = "row";
			state.forked[state.layout] = true;
		}
		if (state.layout === "side-panel" && state.source["side-panel"] === "none")
			state.source["side-panel"] = "row";
	}

	const acts = {
		moveField(fieldname: string, toColumn: string, index: number) {
			const from = columnOf(fieldname);
			if (from) from.fields = from.fields.filter((entry) => nameOf(entry) !== fieldname);
			state.omitted[state.layout] = state.omitted[state.layout].filter((one) => one !== fieldname);
			if (toColumn === MORE_FIELDS) {
				act("unplace_field", { fieldname }, "back to More fields");
			} else {
				const column = find(toColumn)?.node as LayoutTreeColumn;
				column.fields.splice(index, 0, fieldname);
				act(from ? "move_field" : "place_field", { fieldname, column: toColumn, index });
			}
			touchContainer();
			state.selection = { kind: "field", fieldname };
		},
		moveContainer(key: string, toParent: string, index: number) {
			const found = find(key);
			if (!found) return;
			found.list.splice(found.list.indexOf(found.node as any), 1);
			const parent = find(toParent)?.node as any;
			(found.kind === "section" ? parent.sections : parent.columns).splice(index, 0, found.node);
			act(`move_${found.kind}`, { [found.kind]: key, to: toParent, index });
			touchContainer();
		},
		moveTab(key: string, delta: number) {
			const list = tree.value;
			const from = list.findIndex((tab) => tab.name === key);
			const to = from + delta;
			if (to < 0 || to >= list.length) return;
			list.splice(to, 0, list.splice(from, 1)[0]);
			act("move_tab", { tab: key, index: to });
			touchContainer();
		},
		addTab() {
			ensureTab();
			// A form with one unlabelled tab grows a strip: the first tab needs a name to show.
			if (tree.value.length === 1 && !tree.value[0].label) tree.value[0].label = "Details";
			const tab: LayoutTreeTab = { name: newKey("tab"), label: "New tab", sections: [] };
			tab.sections.push(newSection());
			state.trees[state.layout].push(tab);
			act("add_tab", { label: tab.label });
			touchContainer();
			state.selection = { kind: "tab", key: tab.name! };
			return tab.name!;
		},
		addSection(tabKey?: string) {
			ensureTab();
			const tab = (tabKey ? find(tabKey)?.node : tree.value[0]) as LayoutTreeTab;
			const section = newSection();
			tab.sections.push(section);
			act("add_section", { tab: tab.name });
			touchContainer();
			state.selection = { kind: "section", key: section.name! };
		},
		addColumn(sectionKey: string) {
			const section = find(sectionKey)?.node as LayoutTreeSection;
			const column = { name: newKey("column"), fields: [] };
			section.columns.push(column);
			act("add_column", { section: sectionKey });
			touchContainer();
			state.selection = { kind: "column", key: column.name };
		},
		removeContainer(key: string) {
			const found = find(key);
			if (!found) return;
			found.list.splice(found.list.indexOf(found.node as any), 1);
			act(`remove_${found.kind}`, { [found.kind]: key }, "its fields become unplaced");
			touchContainer();
			state.selection = null;
		},
		setContainer(key: string, prop: string, value: unknown) {
			const node = find(key)?.node as any;
			if (!node || node[prop] === value) return;
			node[prop] = value;
			act("set_container_property", { container: key, [prop]: value });
			touchContainer();
		},
		setField(fieldname: string, prop: string, value: unknown) {
			const one = field(fieldname) as any;
			if (!one || one[prop] === value) return;
			one[prop] = value;
			act("set_field_property", { fieldname, [prop]: value },
				state.mode === "customize" && !one.custom ? "Property Setter" : undefined);
		},
		omit(fieldname: string) {
			const column = columnOf(fieldname);
			if (column) column.fields = column.fields.filter((entry) => nameOf(entry) !== fieldname);
			state.omitted[state.layout].push(fieldname);
			act("omit_field", { fieldname });
			touchContainer();
		},
		restore(fieldname: string) {
			state.omitted[state.layout] = state.omitted[state.layout].filter((one) => one !== fieldname);
			act("restore_field", { fieldname });
		},
		addField(fieldtype: string, column?: string) {
			const label = `New ${fieldtype}`;
			const fieldname = `${state.mode === "customize" ? "custom_" : ""}new_${fieldtype.toLowerCase().replace(/ /g, "_")}_${++counter}`;
			state.fields.push({
				fieldname, fieldtype, label, added: true,
				custom: state.mode === "customize", idx: state.fields.length,
			});
			const target = column ?? defaultColumn();
			if (target) (find(target)?.node as LayoutTreeColumn).fields.push(fieldname);
			act(state.mode === "customize" ? "add_custom_field" : "add_field", { fieldtype, column: target });
			state.selection = { kind: "field", fieldname };
		},
		deleteField(fieldname: string) {
			const column = columnOf(fieldname);
			if (column) column.fields = column.fields.filter((entry) => nameOf(entry) !== fieldname);
			state.fields = state.fields.filter((one) => one.fieldname !== fieldname);
			act("delete_field", { fieldname });
			state.selection = null;
		},
	};

	function ensureTab() {
		if (!state.trees[state.layout].length)
			state.trees[state.layout].push({ name: newKey("tab"), sections: [] });
	}

	function defaultColumn() {
		const selected = state.selection;
		if (selected?.kind === "column") return selected.key;
		if (selected?.kind === "field") return columnOf(selected.fieldname)?.name;
		ensureTab();
		const tab = tree.value[0];
		if (!tab.sections.length) tab.sections.push(newSection());
		return tab.sections[0].columns[0].name;
	}

	/** Whether the mode allows this edit; Customize only adds and overrides. */
	function can(what: "delete-field" | "rename-field" | "change-type", fieldname?: string) {
		if (state.mode === "design") return true;
		const one = fieldname ? field(fieldname) : null;
		if (what === "delete-field") return Boolean(one?.custom);
		return Boolean(one?.added);
	}

	return {
		state, tree, schema, placed, omitted, unplaced, autoFields, hasMoreFields, dataFields,
		load, find, field, columnOf, acts, can,
	};
}

export type Editor = ReturnType<typeof createEditor>;

export function isMandatory(field: RawMetaField) {
	return (Boolean(field.reqd) && !field.default) || Boolean(field.mandatory_depends_on);
}

export function nameOf(entry: string | { fieldname: string }) {
	return typeof entry === "string" ? entry : entry.fieldname;
}

function newSection(): LayoutTreeSection {
	return { name: newKey("section"), columns: [{ name: newKey("column"), fields: [] }] };
}

/** Container names are fixed at save; the editor keys every container so new ones are addressable. */
function keyed(tree: LayoutTree): LayoutTree {
	const seen = new Set<string>();
	const unique = (name: string | undefined, kind: string) => {
		const key = name && !seen.has(name) ? name : newKey(kind);
		seen.add(key);
		return key;
	};
	for (const tab of tree) {
		tab.name = unique(tab.name, "tab");
		for (const section of tab.sections ?? []) {
			section.name = unique(section.name, "section");
			for (const column of section.columns ?? []) column.name = unique(column.name, "column");
		}
	}
	return tree;
}

function placedIn(tree: LayoutTree) {
	return tree.flatMap((tab) =>
		(tab.sections ?? []).flatMap((section) =>
			(section.columns ?? []).flatMap((column) => column.fields.map(nameOf))
		)
	);
}

function forEachSection(
	tree: LayoutTree,
	visit: (section: LayoutTreeSection, tab: number, index: number) => void
) {
	tree.forEach((tab, t) => (tab.sections ?? []).forEach((section, s) => visit(section, t, s)));
}
