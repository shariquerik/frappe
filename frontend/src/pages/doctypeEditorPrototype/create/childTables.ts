// PROTOTYPE (#47099), throwaway: a Table field's child DocType, edited from its parent's editor.
// Each child the page touches gets its own editor (fields and Details layout, real reads), and a
// Customize UI when the parent is customized and the child is standard. A new child table is a
// draft that saves before its parent. Nothing is written.
// ?child= picks where the child's fields are edited: A inline (the canvas grid), B in the panel,
// C a jump to the child's own editor. &table=<fieldname> opens that jump (any variant's "Edit row form").
import { computed, markRaw, reactive, ref, watch, type InjectionKey } from "vue";
import { runMethod } from "@framework/ui/api";
import { DROPPED_FIELDTYPES } from "@framework/ui/FormLayout";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import { createEditor, nameOf, type Editor, type EditorField, type Mode } from "../editor";
import { createCustomizeUi, type CustomizeUi, type Persona } from "./customize";
import type { DraftUi } from "./draftUi";
import { createSavedUi, type SavedUi } from "./savedDoctype";

export type ChildVariant = "A" | "B" | "C";

/** v1's grid (grid.js:21-34, since d0f94ba3c6): a field's `columns` as a pixel width. */
export const COLUMN_PX: Record<number, number> = { 1: 60, 2: 100, 3: 140, 4: 200, 5: 250, 6: 300, 7: 350, 8: 400, 9: 450, 10: 500 };
/** v1's width for a column with no `columns` (grid.js:10-19), else 140. */
const TYPE_PX: Record<string, number> = {
	Text: 200,
	"Small Text": 200,
	"Long Text": 200,
	Check: 60,
	Int: 100,
	Float: 100,
	Currency: 100,
	Percent: 100,
};
/** The grid's own tracks: checkbox, row number and row menu, 40px each (Grid.vue FIXED_COL). */
export const GRID_FIXED_PX = 120;
/** The record page's Details column (#47097): 728px of content. */
export const FORM_PX = 728;
/** Types a grid column cannot hold: no value to show (doctype.py get_fields_not_allowed_in_list_view; a child allows Button and HTML). */
const NOT_A_COLUMN = new Set([...DROPPED_FIELDTYPES].filter((one) => one !== "Button" && one !== "HTML").concat(["Table", "Table MultiSelect"]));

export const columnPx = (field: EditorField) => COLUMN_PX[Number((field as any).columns) || 0] ?? TYPE_PX[field.fieldtype] ?? 140;
export const canBeColumn = (field: EditorField) => !NOT_A_COLUMN.has(field.fieldtype);

export interface ChildTable {
	name: string;
	module: string;
	/** A custom DocType (the site's own); Customize Form refuses it, the DocType save edits it. */
	custom: boolean;
	/** Made in this session: saved before its parent, in the same Save. */
	isNew: boolean;
	editor: Editor;
	draftUi: DraftUi;
	/** Plain (markRaw) editor and draft UI: their refs must not unwrap inside this reactive object. */
	saved: SavedUi | null;
	customize: CustomizeUi | null;
	/** Other DocTypes whose Table fields hold this child (a child may have many parents). */
	alsoIn: string[];
	/** The edit version at the last save, to tell what is unsaved. */
	savedAt: number;
}

export interface ChildOption {
	name: string;
	module: string;
	custom: boolean;
}

export interface ChildUi {
	variant: ChildVariant;
	parent: string;
	parentModule: string;
	/** Every child DocType on the site, and the drafts made here. */
	options: ChildOption[];
	tables: Record<string, ChildTable>;
	/** The child field open in the panel (A, B): the Table field's fieldname and the child's field. */
	focus: { table: string; fieldname: string } | null;
	/** The Table field whose child's editor fills the page (C, and every "Edit row form"). */
	jumped: string | null;
	/** "+ New child table…": the Table field it is for. */
	newFor: string | null;
	ensure: (name: string) => Promise<ChildTable>;
	get: (name?: string) => ChildTable | undefined;
	makeChild: (name: string, module: string, table: string) => void;
	columns: (child: ChildTable) => EditorField[];
	addColumn: (child: ChildTable, fieldname: string) => void;
	newColumn: (child: ChildTable, table: string, asColumn?: boolean) => string;
	moveColumn: (child: ChildTable, fieldname: string, toColumn: number) => void;
	/** What the next Save writes on child tables, in the order it writes them. */
	pending: () => { name: string; isNew: boolean; edits: number }[];
	markSaved: () => void;
	dirty: () => boolean;
	/** #47100: the parent's fields, for a row condition's "Parent: …" (`parent.x`), and whether it submits. */
	parentFields: () => EditorField[];
	parentSubmittable: () => boolean;
}

export const ChildUiKey: InjectionKey<ChildUi> = Symbol("ChildUi");
/** Set inside a child's scope (its editor, or its field in the parent's panel). */
export const ChildScopeKey: InjectionKey<ChildTable> = Symbol("ChildScope");

export function createChildUi(options: {
	parent: string;
	parentModule: () => string;
	parentEditor: Editor;
	variant: ChildVariant;
	persona: Persona;
	customizing: () => boolean;
	metas?: () => Record<string, any>;
	jumped?: string | null;
	parentKind?: () => string;
}): ChildUi {
	const { parentEditor, persona } = options;
	const loading: Record<string, Promise<ChildTable>> = {};
	const ui: ChildUi = reactive({
		variant: options.variant,
		parent: options.parent,
		get parentModule() {
			return options.parentModule();
		},
		options: [] as ChildOption[],
		tables: {} as Record<string, ChildTable>,
		focus: null,
		jumped: options.jumped ?? null,
		newFor: null,
		get: (name?: string) => (name ? ui.tables[name] : undefined),
		parentFields: () => parentEditor.state.fields,
		parentSubmittable: () => options.parentKind?.() === "submittable",
		ensure(name: string) {
			if (ui.tables[name]) return Promise.resolve(ui.tables[name]);
			return (loading[name] ??= load(name));
		},
		makeChild(name: string, module: string, table: string) {
			const editor = createEditor(name, "design", "details");
			editor.loadDraft([], [{ name: "tab-details", sections: [{ name: "section-main", columns: [{ name: "column-main", fields: [] }] }] }]);
			// A child made while customizing is a custom DocType: the site owns it, so it is edited as in Design.
			const custom = options.customizing();
			ui.tables[name] = scope({ name, module, custom, isNew: true, editor, customize: null, alsoIn: [], savedAt: -1 });
			ui.options.unshift({ name, module, custom });
			parentEditor.acts.setField(table, "options", name);
		},
		columns: (child: ChildTable) => child.editor.state.fields.filter((one) => one.in_list_view && !one.hidden && canBeColumn(one)),
		addColumn(child: ChildTable, fieldname: string) {
			child.editor.acts.setField(fieldname, "in_list_view", 1);
		},
		/** A new field of the child, in its grid, after its last column; its label takes the caret in the panel. */
		newColumn(child: ChildTable, table: string, asColumn = true) {
			const editor = child.editor;
			const tree = editor.tree.value;
			const section = tree[0]?.sections[tree[0].sections.length - 1];
			const column = section?.columns[section.columns.length - 1];
			let fieldname = "";
			editor.history.group(() => {
				fieldname = editor.acts.addLabelled({ label: asColumn ? "New column" : "New field", fieldtype: "Data" }, column!.name!);
				if (asColumn) editor.acts.setField(fieldname, "in_list_view", 1);
			});
			if (ui.jumped) editor.state.selection = { kind: "field", fieldname };
			else ui.focus = { table, fieldname };
			child.draftUi.labelFocus.value = fieldname;
			return fieldname;
		},
		moveColumn(child: ChildTable, fieldname: string, toColumn: number) {
			// Grid columns keep the child's field order (grid.js setup_visible_columns), so a column
			// moves by moving its field to just before (or after) the column it lands on.
			const columns = ui.columns(child).filter((one) => one.fieldname !== fieldname);
			const fields = child.editor.state.fields;
			const anchor = columns[toColumn];
			const at = anchor ? fields.indexOf(anchor) : fields.indexOf(columns[columns.length - 1]) + 1;
			const from = fields.findIndex((one) => one.fieldname === fieldname);
			child.editor.acts.reorderField(fieldname, from < at ? at - 1 : at);
		},
		pending: () =>
			Object.values(ui.tables)
				.map((child) => ({ name: child.name, isNew: child.isNew && child.savedAt < 0, edits: child.editor.state.acted !== child.savedAt ? 1 : 0 }))
				.filter((one) => one.isNew || one.edits),
		markSaved() {
			for (const child of Object.values(ui.tables)) {
				child.savedAt = child.editor.state.acted;
				for (const field of child.editor.state.fields) field.added = false;
				child.customize?.markSaved();
			}
		},
		dirty: () => Object.values(ui.tables).some((child) => child.editor.state.acted !== child.savedAt),
	}) as unknown as ChildUi;

	void runMethod<ChildOption[]>(
		"frappe.client.get_list",
		{
			doctype: "DocType",
			filters: JSON.stringify({ istable: 1 }),
			fields: JSON.stringify(["name", "module", "custom"]),
			order_by: "name asc",
			limit_page_length: 0,
		},
		{ http: "GET" }
	).then(({ data }) => ui.options.push(...(data ?? []).filter((one) => !ui.tables[one.name])));

	// Selecting anything but the Table field closes its child field in the panel.
	watch(
		() => parentEditor.state.selection,
		(selection) => {
			if (ui.focus && !(selection?.kind === "field" && selection.fieldname === ui.focus.table)) ui.focus = null;
		}
	);

	async function load(name: string): Promise<ChildTable> {
		const meta = options.metas?.()[name] ?? (await metaOf(name));
		const editor = createEditor(name, "design", "details");
		await editor.loadAll(meta, ["details"]);
		const child = scope({
			name,
			module: meta.module,
			custom: Boolean(meta.custom),
			isNew: false,
			editor,
			customize: null,
			alsoIn: [],
			savedAt: editor.state.acted,
		});
		ui.tables[name] = child;
		// Customize works on a standard child (Customize Form opens a child DocType); a custom one is the site's own.
		if (!child.custom) {
			editor.state.mode = options.customizing() ? "customize" : "design";
			child.customize = await createCustomizeUi(editor, name, meta.module, persona);
			watch(options.customizing, (on) => (editor.state.mode = on ? "customize" : "design"));
		}
		void parentsOf(name).then((parents) => (child.alsoIn = parents.filter((one) => one !== options.parent)));
		return ui.tables[name];
	}

	/** The keys a child's scope provides: its own draft UI and a saved UI that reads no counts. */
	function scope(base: Omit<ChildTable, "draftUi" | "saved">): ChildTable {
		const editor = base.editor;
		const labelFocus = ref<string | null>(null);
		const child = reactive({ ...base, editor: markRaw(base.editor), saved: null, draftUi: null }) as unknown as ChildTable;
		const saved = base.isNew ? null : createSavedUi(editor, base.name, base.custom, true);
		if (saved) {
			// A child's rows are counted through its parents; the prototype shows no count.
			saved.count = () => {};
			saved.counts = {};
		}
		child.saved = saved;
		child.draftUi = markRaw({
			kind: "child",
			titleField: ref(""),
			description: ref(""),
			draft: computed(() => child.isNew),
			rename(from: string, to: string) {
				const taken = new Set(editor.state.fields.map((one) => one.fieldname).filter((one) => one !== from));
				if (editor.state.mode === "customize" && !to.startsWith("custom_")) to = `custom_${to}`;
				let fieldname = to;
				for (let n = 2; taken.has(fieldname); n++) fieldname = `${to}_${n}`;
				if (fieldname === from) return;
				editor.history.group(() => {
					const column = editor.columnOf(from);
					if (column) column.fields = column.fields.map((entry) => (nameOf(entry) === from ? fieldname : entry));
					editor.acts.setField(from, "fieldname", fieldname);
				});
				if (ui.focus?.fieldname === from) ui.focus = { ...ui.focus, fieldname };
				else editor.state.selection = { kind: "field", fieldname };
			},
			labelFocus,
			focusLabel(fieldname: string) {
				editor.state.selection = { kind: "field", fieldname };
				labelFocus.value = fieldname;
			},
			focusTabLabel(key: string) {
				editor.state.selection = { kind: "tab", key };
				labelFocus.value = key;
			},
			async beforeRemove(fieldname: string) {
				const customize = child.customize;
				if (editor.state.mode === "customize" && customize?.isStandard(fieldname)) {
					editor.acts.setField(fieldname, "hidden", editor.field(fieldname)?.hidden ? 0 : 1);
					return false;
				}
				return true;
			},
		} as DraftUi);
		return child;
	}
	return ui;
}

/** A child's meta, through the same shared read the record page uses. */
function metaOf(name: string): Promise<any> {
	const { meta } = useDoctypeMeta(name);
	return new Promise((resolve) => {
		const stop = watch(
			meta,
			(one) => {
				if (!one?.fields) return;
				resolve(one);
				queueMicrotask(() => stop());
			},
			{ immediate: true }
		);
	});
}

/** The DocTypes with a Table field (standard or custom) that holds this child. */
async function parentsOf(child: string) {
	const filters = { fieldtype: ["in", ["Table", "Table MultiSelect"]], options: child };
	const [standard, custom] = await Promise.all([
		runMethod<{ parent: string }[]>(
			"frappe.client.get_list",
			{ doctype: "DocField", parent: "DocType", filters: JSON.stringify(filters), fields: JSON.stringify(["parent"]), limit_page_length: 0 },
			{ http: "GET" }
		),
		runMethod<{ dt: string }[]>(
			"frappe.client.get_list",
			{ doctype: "Custom Field", filters: JSON.stringify(filters), fields: JSON.stringify(["dt"]), limit_page_length: 0 },
			{ http: "GET" }
		),
	]);
	return [...new Set([...(standard.data ?? []).map((one) => one.parent), ...(custom.data ?? []).map((one) => one.dt)])];
}

/** The grid's width against the form's: how much of it fits before it scrolls sideways. */
export function gridFit(columns: EditorField[]) {
	const room = FORM_PX - GRID_FIXED_PX;
	const used = columns.reduce((sum, one) => sum + columnPx(one), 0);
	return { room, used, over: Math.max(0, used - room) };
}

export const modeOf = (customizing: boolean): Mode => (customizing ? "customize" : "design");
