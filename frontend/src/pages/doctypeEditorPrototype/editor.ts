// PROTOTYPE (#45867), throwaway: one layout's edit state and acts, in memory only.
// Each surface that renders a layout makes its own editor for that one layout (the DocType
// page for Details, the Create dialog for Quick Entry, the record page for its row and its
// panel). Nothing here saves. Every edit runs through `act`, which logs it as `page.run` would.
// #47097: the DocType page loads every layout its kind allows (`loadAll`) and each conditional
// variant, each its own tree keyed by `state.open` ("details", "details~<row>"); `openLayout`
// swaps the canvas, and undo/redo carry the layout they happened on.

import { reactive, computed } from "vue";
import { runMethod } from "@framework/ui/api";
import { DROPPED_FIELDTYPES } from "@framework/ui/FormLayout";
import { joinLayout } from "@/recordPage/formLayoutSource/joinLayout";
import { matchesCondition } from "@/recordPage/formLayoutSource/chooseLayout";
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

/** Where a layout comes from: the app's file, a site row, the DocType's breaks, nothing yet, or Details' rows. */
export type Source = "app" | "site" | "fallback" | "none" | "details";
/** A conditional row of one layout type: its own tree under `<key>~<row>`. */
export interface Variant {
	id: string;
	key: LayoutKey;
	row: string;
	condition: string;
	/** #47098: its own name ("Passive contacts"); the crumb and the menu show it. */
	title?: string;
	/** PROTOTYPE: no conditional row exists on this site; this one is made up at load. */
	fake?: boolean;
}
export const layoutId = (key: LayoutKey, row?: string | null) => (row ? `${key}~${row}` : key);
export const keyOf = (id: string) => id.split("~")[0] as LayoutKey;

let counter = 0;
let version = 0;

interface Snapshot {
	fields: EditorField[];
	trees: Record<string, LayoutTree>;
	omitted: Record<string, string[]>;
	source: Record<string, Source>;
	forked: Record<string, boolean>;
	variants: Variant[];
	open: string;
	acted: number;
	activeTab: string | null;
}
const newKey = (kind: string) => `${kind}-new-${++counter}`;

export interface LoadOptions {
	/** The record the surface shows: its conditional row wins, as on the record page. */
	doc?: Record<string, any>;
	/** PROTOTYPE: pretend the doctype has a conditional row with this condition (none exist here). */
	fakeCondition?: string;
}

export function createEditor(doctype: string, mode: Mode, layout: LayoutKey = "details") {
	const state = reactive({
		doctype,
		mode,
		layout,
		// The tree on the canvas: a layout key, or a variant's "<key>~<row>" (#47097).
		open: layout as string,
		variants: [] as Variant[],
		// The row being edited: its condition, or none for the default row.
		row: { condition: "" as string, isNew: false },
		loading: true,
		fields: [] as EditorField[],
		trees: {} as Record<string, LayoutTree>,
		omitted: {} as Record<string, string[]>,
		// Where each layout came from: the app's file, a site row, or the break fallback.
		source: {} as Record<string, Source>,
		forked: {} as Record<string, boolean>,
		// The tab each layout last showed, so switching back lands where it was.
		tabFor: {} as Record<string, string | null>,
		selection: null as Selection,
		log: [] as { act: string; args: string; note?: string }[],
		// The edit version: every act sets a new one, and undo/redo restore the one they return to,
		// so a page can tell "unsaved" by comparing with the version it saved at.
		acted: 0,
		// The tab the canvas shows; new sections go into it.
		activeTab: null as string | null,
		// Undo and redo: snapshots of the fields and layouts (#45867 round 2026-11-12).
		past: [] as Snapshot[],
		future: [] as Snapshot[],
		dragging: null as null | "field" | "column" | "section",
		// The tab header a dragged field is over: dropping there moves it to that tab.
		dropTab: null as string | null,
	});

	async function load(meta: { fields: RawMetaField[] }, options: LoadOptions = {}) {
		state.fields = meta.fields.map((field, idx) => ({ ...field, idx }));
		const key = state.layout;
		const type = LAYOUTS.find((one) => one.key === key)!.type;
		const { data } = await runMethod<FormLayoutsResponse>(
			"frappe.desk.doctype.form_layout.form_layout.get_form_layouts",
			{ dt: doctype, type },
			{ http: "GET" }
		);
		const rows = data.layouts.slice();
		if (options.fakeCondition) {
			const base = rows.find((one) => !one.condition);
			rows.unshift({
				name: "proto-conditional",
				condition: options.fakeCondition,
				layout: structuredClone(base?.layout ?? data.fallback ?? []),
			} as any);
		}
		const conditional = options.doc
			? rows.find((one) => one.condition && matchesCondition(one.condition, options.doc!))
			: undefined;
		const row = conditional ?? rows.find((one) => !one.condition);
		const tree = row?.layout ?? (key === "side-panel" ? [] : data.fallback);
		state.row = { condition: row?.condition ?? "", isNew: !row };
		install(key, tree ?? [], row ? sourceOf(row) : key === "side-panel" ? "none" : "fallback");
		state.loading = false;
	}

	// The app's tree under each layout, for "Reset to app layout". Plain: not undo state.
	const appTrees: Record<string, LayoutTree> = {};

	function install(id: string, tree: LayoutTree, source: Source, appTree?: LayoutTree) {
		state.trees[id] = keyed(clone(tree));
		state.omitted[id] = [];
		state.source[id] = source;
		state.forked[id] = false;
		const app = appTree ?? (source === "app" ? tree : undefined);
		if (app) appTrees[id] = clone(app);
	}

	/**
	 * #47097: every layout `keys` names, read at once (the menu badges each), and their
	 * conditional rows as variants. `fake` adds one made-up variant (none exist on this site).
	 */
	async function loadAll(meta: { fields: RawMetaField[] }, keys: LayoutKey[], fake?: { key: LayoutKey; condition: string; title: string }) {
		state.fields = meta.fields.map((field, idx) => ({ ...field, idx }));
		const responses = await Promise.all(keys.map((key) => readLayouts(doctype, key)));
		const defaults: Partial<Record<LayoutKey, string>> = {};
		keys.forEach((key, i) => {
			const data = responses[i];
			const base = data.layouts.find((row) => !row.condition);
			const app = data.layouts.find((row) => !row.condition && row.name == null);
			let source: Source = base ? sourceOf(base) : key === "side-panel" ? "none" : "fallback";
			// New Record with no rows of its own gets Details' rows from the server.
			if (key === "new-record" && base && JSON.stringify(base.layout) === defaults.details) source = "details";
			if (base) defaults[key] = JSON.stringify(base.layout);
			install(key, base?.layout ?? (key === "side-panel" ? [] : data.fallback ?? []), source, app?.layout);
			if (source === "details") return;
			for (const row of data.layouts.filter((one) => one.condition)) {
				const name = String(row.name ?? "app");
				state.variants.push({ id: layoutId(key, name), key, row: name, condition: row.condition! });
				install(layoutId(key, name), row.layout, sourceOf(row));
			}
		});
		if (fake && keys.includes(fake.key)) {
			const id = layoutId(fake.key, "proto-1");
			state.variants.push({ id, key: fake.key, row: "proto-1", condition: fake.condition, title: fake.title, fake: true });
			install(id, copy(state.trees[fake.key]), state.source[fake.key] === "site" ? "site" : "app");
		}
		state.open = state.layout;
		state.activeTab = state.trees[state.open]?.[0]?.name ?? null;
		state.loading = false;
	}

	/** Swaps the canvas to a layout (or one of its variants). Not an edit: no undo step. */
	function openLayout(key: LayoutKey, row?: string | null) {
		let id = layoutId(key, row);
		if (!state.trees[id]) id = key;
		if (!state.trees[id] || id === state.open) return;
		state.tabFor[state.open] = state.activeTab;
		show(id, state.tabFor[id]);
		state.selection = null;
	}

	function show(id: string, tab?: string | null) {
		state.open = id;
		state.layout = keyOf(id);
		const tabs = state.trees[id] ?? [];
		state.activeTab = tab && tabs.some((one) => one.name === tab) ? tab : (tabs[0]?.name ?? null);
	}

	/** Customize may reset a site layout that sits over an app one. */
	const canReset = (id: string) => state.mode === "customize" && state.source[id] === "site" && Boolean(appTrees[id]);

	/** A new DocType's draft: its fields and one Details tree, nothing read from the server. */
	function loadDraft(fields: EditorField[], tree: LayoutTree) {
		state.fields = fields.map((one, idx) => ({ ...one, idx }));
		state.trees.details = keyed(tree);
		state.omitted.details = [];
		state.source.details = "app";
		state.forked.details = false;
		state.activeTab = state.trees.details[0]?.name ?? null;
		state.loading = false;
	}

	const tree = computed(() => state.trees[state.open] ?? []);
	const dataFields = computed(() =>
		state.fields.filter((field) => !DROPPED_FIELDTYPES.has(field.fieldtype))
	);
	const placed = computed(() => new Set(placedIn(tree.value)));
	const omitted = computed(() => new Set(state.omitted[state.open] ?? []));
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
		state.acted = ++version;
		state.log.unshift({ act: name, args: JSON.stringify(args), note });
		if (state.log.length > 30) state.log.pop();
	}

	// The first container edit on a layout not yet written where this mode writes makes it:
	// Customize forks a site layout off the app's (or the breaks); Design writes the app's file.
	function touchContainer() {
		const id = state.open;
		const from = state.source[id];
		if (state.mode === "customize" && from !== "site") {
			state.source[id] = "site";
			state.forked[id] = true;
		} else if (state.mode === "design" && from !== "app" && from !== "site") {
			state.source[id] = "app";
		}
	}

	// #45865: placing or moving a field on Details or New Record never forks (an anchor, or
	// `field_order` on the breaks); on the Side Panel and Quick Entry any placement does.
	function placeOnly() {
		if (state.layout === "side-panel" || state.layout === "quick-entry") touchContainer();
	}

	const acts = {
		moveField(fieldname: string, toColumn: string, index: number) {
			const from = columnOf(fieldname);
			if (from) from.fields = from.fields.filter((entry) => nameOf(entry) !== fieldname);
			state.omitted[state.open] = state.omitted[state.open].filter((one) => one !== fieldname);
			if (toColumn === MORE_FIELDS) {
				act("unplace_field", { fieldname }, "back to More fields");
			} else {
				const column = find(toColumn)?.node as LayoutTreeColumn;
				column.fields.splice(index, 0, fieldname);
				act(from ? "move_field" : "place_field", { fieldname, column: toColumn, index });
			}
			placeOnly();
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
			state.trees[state.open].push(tab);
			act("add_tab", { label: tab.label });
			touchContainer();
			state.activeTab = tab.name!;
			state.selection = { kind: "tab", key: tab.name! };
			return tab.name!;
		},
		addSection(tabKey?: string) {
			ensureTab();
			const tab = (find(tabKey ?? state.activeTab ?? "")?.node ?? tree.value[0]) as LayoutTreeTab;
			const section = newSection();
			tab.sections.push(section);
			act("add_section", { tab: tab.name });
			touchContainer();
			state.selection = { kind: "section", key: section.name! };
		},
		/** A removed tab hands its sections to the tab before it (after, for the first). */
		removeTab(key: string) {
			const list = tree.value;
			const index = list.findIndex((tab) => tab.name === key);
			if (index < 0 || list.length < 2) return;
			const [tab] = list.splice(index, 1);
			const into = list[index - 1] ?? list[0];
			into.sections.push(...tab.sections);
			if (list.length === 1) into.label = "";
			act("remove_tab", { tab: key }, "its sections move to the tab before");
			touchContainer();
			state.activeTab = into.name!;
			state.selection = null;
		},
		/** A field dropped on a tab's header goes to the end of that tab's first section. */
		moveFieldToTab(fieldname: string, tabKey: string) {
			const tab = find(tabKey)?.node as LayoutTreeTab;
			if (!tab) return;
			if (!tab.sections.length) tab.sections.push(newSection());
			const first = tab.sections[0];
			const column = first.columns[first.columns.length - 1];
			const from = columnOf(fieldname);
			if (from === column) return;
			if (from) from.fields = from.fields.filter((entry) => nameOf(entry) !== fieldname);
			column.fields.push(fieldname);
			act("move_field", { fieldname, column: column.name, index: column.fields.length - 1 }, `to the tab ${tab.label}`);
			placeOnly();
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
			state.omitted[state.open].push(fieldname);
			act("omit_field", { fieldname });
			touchContainer();
		},
		restore(fieldname: string) {
			state.omitted[state.open] = state.omitted[state.open].filter((one) => one !== fieldname);
			act("restore_field", { fieldname });
		},
		addField(fieldtype: string, column?: string, index?: number) {
			const label = `New ${fieldtype}`;
			const fieldname = `${state.mode === "customize" ? "custom_" : ""}new_${fieldtype.toLowerCase().replace(/ /g, "_")}_${++counter}`;
			state.fields.push({
				fieldname, fieldtype, label, added: true,
				custom: state.mode === "customize", idx: state.fields.length,
			});
			const target = column ?? defaultColumn();
			const fields = (find(target!)?.node as LayoutTreeColumn).fields;
			fields.splice(index ?? fields.length, 0, fieldname);
			act(state.mode === "customize" ? "add_custom_field" : "add_field", { fieldtype, column: target, index: index ?? fields.length - 1 });
			placeOnly();
			state.selection = { kind: "field", fieldname };
		},
		/** Label first, as the new-DocType flow adds a field: the type is the guess or the chip's choice. */
		addLabelled(field: { label: string; fieldtype: string; options?: string }, column: string, index?: number) {
			const customize = state.mode === "customize";
			let fieldname = `${customize ? "custom_" : ""}${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field"}`;
			const taken = new Set(state.fields.map((one) => one.fieldname));
			for (let n = 2; taken.has(fieldname); n++) fieldname = `${fieldname.replace(/_\d+$/, "")}_${n}`;
			state.fields.push({ ...field, fieldname, added: true, custom: customize, idx: state.fields.length });
			const fields = (find(column)?.node as LayoutTreeColumn).fields;
			fields.splice(index ?? fields.length, 0, fieldname);
			act(customize ? "add_custom_field" : "add_field", { label: field.label, fieldtype: field.fieldtype, options: field.options, column, index: index ?? fields.length - 1 });
			placeOnly();
			return fieldname;
		},
		/** #47097: a conditional variant of a layout type, a copy of its default or empty; it opens. */
		addVariant(key: LayoutKey, condition: string, start: "copy" | "empty", title?: string) {
			const row = `new-${++counter}`;
			const id = layoutId(key, row);
			const tree = start === "copy" ? copy(state.trees[key] ?? []) : [{ name: newKey("tab"), sections: [newSection()] }];
			state.trees[id] = keyed(tree);
			state.omitted[id] = [];
			state.source[id] = state.mode === "customize" ? "site" : "app";
			state.forked[id] = state.mode === "customize";
			state.variants.push({ id, key, row, condition, title });
			act("add_layout", { type: LAYOUTS.find((one) => one.key === key)!.type, title, condition, start });
			state.tabFor[state.open] = state.activeTab;
			show(id);
			state.selection = null;
			return id;
		},
		setCondition(id: string, condition: string) {
			const variant = state.variants.find((one) => one.id === id);
			if (!variant || variant.condition === condition) return;
			variant.condition = condition;
			act("set_layout_condition", { layout: id, condition });
		},
		/** #47098: a conditional layout's own title. */
		setTitle(id: string, title: string) {
			const variant = state.variants.find((one) => one.id === id);
			if (!variant || variant.title === title) return;
			variant.title = title;
			act("set_layout_title", { layout: id, title });
		},
		/** The variant goes; the canvas falls back to its type's default layout. */
		deleteVariant(id: string) {
			const at = state.variants.findIndex((one) => one.id === id);
			if (at < 0) return;
			const [variant] = state.variants.splice(at, 1);
			act("delete_layout", { layout: id, condition: variant.condition });
			if (state.open === id) show(variant.key, state.tabFor[variant.key]);
			state.selection = null;
		},
		/** Customize: the site's layout goes, and the app's shows again. */
		resetLayout(id: string) {
			if (!appTrees[id]) return;
			state.trees[id] = keyed(clone(appTrees[id]));
			state.omitted[id] = [];
			state.source[id] = "app";
			state.forked[id] = false;
			act("reset_layout", { layout: id }, "the site layout is deleted");
			if (state.open === id) show(id);
			state.selection = null;
		},
		deleteField(fieldname: string) {
			const column = columnOf(fieldname);
			if (column) column.fields = column.fields.filter((entry) => nameOf(entry) !== fieldname);
			state.fields = state.fields.filter((one) => one.fieldname !== fieldname);
			act("delete_field", { fieldname });
			state.selection = null;
		},
	};

	// Each act is one undo step. Typing into one input (the same act on the same target within a
	// second) folds into the step it started.
	let lastStep = { key: "", at: 0 };
	let grouping = false;
	// A JSON copy: structuredClone throws on the reactive proxies nested inside the trees.
	const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
	const snapshot = (): Snapshot => ({
		fields: copy(state.fields),
		trees: copy(state.trees),
		omitted: copy(state.omitted),
		source: copy(state.source),
		forked: copy(state.forked),
		variants: copy(state.variants),
		open: state.open,
		acted: state.acted,
		activeTab: state.activeTab,
	});
	// A step restores the layouts it saw; layouts opened since keep theirs. It lands on the
	// layout the step was taken on, so an undo is never out of sight (#47097).
	function restore(one: Snapshot) {
		state.fields = one.fields;
		state.trees = { ...state.trees, ...one.trees };
		state.omitted = { ...state.omitted, ...one.omitted };
		state.source = { ...state.source, ...one.source };
		state.forked = { ...state.forked, ...one.forked };
		state.variants = one.variants;
		state.acted = one.acted;
		if (one.open !== state.open) {
			state.tabFor[state.open] = state.activeTab;
			show(one.open, one.activeTab);
		} else if (one.activeTab && tree.value.some((tab) => tab.name === one.activeTab)) state.activeTab = one.activeTab;
		const selected = state.selection;
		if (selected?.kind === "field" && !field(selected.fieldname)) state.selection = null;
		if (selected && selected.kind !== "field" && !find(selected.key)) state.selection = null;
	}
	for (const [name, run] of Object.entries(acts) as [string, (...args: any[]) => any][]) {
		(acts as any)[name] = (...args: any[]) => {
			const before = snapshot();
			const result = run(...args);
			if (grouping || state.acted === before.acted) return result;
			const key = `${name}:${String(args[0])}:${String(args[1])}`;
			const folds = ["setContainer", "setField"].includes(name) && key === lastStep.key && Date.now() - lastStep.at < 1000;
			if (!folds) state.past.push(before);
			if (state.past.length > 50) state.past.shift();
			state.future = [];
			lastStep = { key, at: Date.now() };
			return result;
		};
	}
	const history = {
		/** Runs several acts (and the page's own tree edits around them) as one undo step. */
		group(run: () => void) {
			const before = snapshot();
			grouping = true;
			try {
				run();
			} finally {
				grouping = false;
			}
			if (state.acted === before.acted) return;
			state.past.push(before);
			state.future = [];
			lastStep = { key: "", at: 0 };
		},
		undo() {
			const one = state.past.pop();
			if (!one) return;
			state.future.push({ ...snapshot(), open: one.open });
			restore(one);
			lastStep = { key: "", at: 0 };
		},
		redo() {
			const one = state.future.pop();
			if (!one) return;
			state.past.push({ ...snapshot(), open: one.open });
			restore(one);
			lastStep = { key: "", at: 0 };
		},
	};

	function ensureTab() {
		if (!state.trees[state.open].length)
			state.trees[state.open].push({ name: newKey("tab"), sections: [] });
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
		state, tree, schema, edits: computed(() => state.log.length), placed, omitted, unplaced, autoFields, hasMoreFields, dataFields,
		load, loadDraft, loadAll, openLayout, canReset, find, field, columnOf, acts, can, history,
	};
}

export type Editor = ReturnType<typeof createEditor>;

async function readLayouts(doctype: string, key: LayoutKey) {
	const type = LAYOUTS.find((one) => one.key === key)!.type;
	const { data } = await runMethod<FormLayoutsResponse>(
		"frappe.desk.doctype.form_layout.form_layout.get_form_layouts",
		{ dt: doctype, type },
		{ http: "GET" }
	);
	return data;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? []));

/** The runtime marks an app file's entry with `name: null`; a site row has a name. */
const sourceOf = (row: { name: string | number | null }): Source => (row.name == null ? "app" : "site");

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
