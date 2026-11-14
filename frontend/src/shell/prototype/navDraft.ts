// PROTOTYPE (#47378): the editor's draft of the rail and every sidebar, in memory only.
// The live navigation draws from it, so an edit shows at once; nothing reaches the server.

import { computed, ref, watch } from "vue";
import type { Navigation, NavigationItem } from "@/boot";

/** Who a row belongs to: the app that ships it, the site (Everyone), or one person (Just me). */
export type Origin = "app" | "site" | "user";
export type Level = "user" | "site";

export type DraftRow = NavigationItem & {
	origin: Origin;
	/** The level that hid it; a hidden row is not drawn in the live navigation. */
	hidden_by?: Level;
	/** Shown in the editor only; the live navigation drops the row. */
	marker?: "no-access" | "view-deleted";
};

/** `rail`, or a sidebar's address. */
export type Container = string;
export const RAIL: Container = "rail";

export type Draft = { rail: DraftRow[]; sidebars: Record<string, DraftRow[]> };

export const CAP = 50;

export const draft = ref<Draft | null>(null);
export const editing = ref(false);
export const level = ref<Level>("user");
export const showHidden = ref(false);
/** The container the editor is looking at: the rail, or one sidebar. */
export const focus = ref<Container>(RAIL);
export const selected = ref<{ container: Container; key: string } | null>(null);
/** The last refusal, drawn inline by each variant. */
export const refusal = ref<string | null>(null);

let snapshot: Draft | null = null;

/** Seeds the draft from the server's navigation once, with the rows the editor must show off. */
export function seed(navigation: Navigation) {
	if (draft.value) return;
	const rail = navigation.rail.map((item) => ({ ...item, origin: "app" as Origin }));
	const sidebars = Object.fromEntries(
		Object.entries(navigation.sidebars).map(([address, rows]) => [
			address,
			rows.map((item) => ({ ...item, origin: "app" as Origin })),
		])
	);
	draft.value = { rail, sidebars };
	seedExamples();
}

/** One site row, one row the person lost access to, one whose view was deleted. */
function seedExamples() {
	const address = Object.keys(draft.value!.sidebars)[0];
	const rows = address ? draft.value!.sidebars[address] : draft.value!.rail;
	rows.push(
		{
			key: "site:hb81c0",
			item_type: "Link",
			url: "https://frappe.io/handbook",
			label: "Team handbook",
			icon: "book-open",
			origin: "site",
		},
		{
			key: "user:na3f9a",
			item_type: "DocType",
			link_to: "Salary Slip",
			link_doctype: "DocType",
			label: "My salary slips",
			origin: "user",
			marker: "no-access",
		},
		{
			key: "user:vd72e1",
			item_type: "View",
			link_doctype: "ToDo",
			link_to: "my-open-todos",
			label: "My open to-dos",
			icon: "list",
			origin: "user",
			marker: "view-deleted",
		}
	);
}

export const live = computed<Navigation | null>(() => {
	if (!draft.value) return null;
	const shown = (rows: DraftRow[]) => rows.filter(drawn).map(toItem);
	return {
		rail: shown(draft.value.rail),
		sidebars: Object.fromEntries(
			Object.entries(draft.value.sidebars).map(([address, rows]) => [address, shown(rows)])
		),
	};
});

function drawn(row: DraftRow) {
	return !row.hidden_by && !row.marker;
}

function toItem(row: DraftRow): NavigationItem {
	const { origin: _o, hidden_by: _h, marker: _m, ...item } = row;
	return item;
}

export function open(container?: Container) {
	snapshot = JSON.parse(JSON.stringify(draft.value));
	focus.value = container ?? RAIL;
	selected.value = null;
	refusal.value = null;
	editing.value = true;
}

export function save() {
	snapshot = null;
	editing.value = false;
}

export function discard() {
	if (snapshot) draft.value = snapshot;
	snapshot = null;
	editing.value = false;
}

export function rows(container: Container): DraftRow[] {
	if (!draft.value) return [];
	return container === RAIL ? draft.value.rail : draft.value.sidebars[container] ?? [];
}

/** The rows this level lists: on Everyone, a person's own rows are not the site's business. */
export function listed(container: Container): DraftRow[] {
	return rows(container).filter(
		(row) =>
			(level.value === "user" || row.origin !== "user") &&
			(showHidden.value || !row.hidden_by)
	);
}

export function find(container: Container, key: string) {
	return rows(container).find((row) => row.key === key);
}

/** Rows added at the level being edited: deleted outright, and every field is theirs to change. */
export function own(row: DraftRow) {
	return row.origin === level.value;
}

export function newKey() {
	return `${level.value}:${Math.random().toString(36).slice(2, 8)}`;
}

/** The sidebar a rail row opens, if it is linked. */
export function sidebarOf(row: DraftRow): string | undefined {
	return row.item_type === "Sidebar" ? row.link_to : undefined;
}

export function containerLabel(container: Container) {
	if (container === RAIL) return "Rail";
	const owner = draft.value?.rail.find((row) => sidebarOf(row) === container);
	return `${owner?.label ?? container} sidebar`;
}

/** Every container: the rail, then each sidebar a rail row opens. */
export function containers(): Container[] {
	const linked = listed(RAIL).map(sidebarOf).filter((a): a is string => !!a);
	return [RAIL, ...new Set(linked)];
}

export const ORIGIN_LABEL: Record<Origin, string> = {
	app: "App",
	site: "Everyone",
	user: "Just me",
};

/** The row being dragged, and where it came from: a drag can cross from the rail to a sidebar. */
export const dragging = ref<{ container: Container; key: string } | null>(null);

/** A row and how deep it sits, depth-first: the order a reader sees. */
export function flatten(container: Container): { row: DraftRow; depth: number }[] {
	const list = listed(container);
	const keys = new Set(list.map((row) => row.key));
	const out: { row: DraftRow; depth: number }[] = [];
	const walk = (parent: string | undefined, depth: number) => {
		for (const row of list)
			if ((row.parent_key && keys.has(row.parent_key) ? row.parent_key : undefined) === parent) {
				out.push({ row, depth });
				walk(row.key, depth + 1);
			}
	};
	walk(undefined, 0);
	return out;
}

export function nameOf(row: DraftRow) {
	return row.label || row.link_to || row.url || row.key;
}

export function iconFor(row: DraftRow) {
	const fallback: Record<string, string> = {
		DocType: "list", View: "layout-grid", Record: "file-text", Page: "layout-dashboard",
		Link: "link", Act: "zap", Section: "heading", Sidebar: "panel-left", Module: "box",
	};
	return row.icon || fallback[row.item_type] || "circle-dot";
}

// On Everyone a person's own sidebars are not listed, so the editor steps back to one that is.
watch(level, () => {
	if (!containers().includes(focus.value)) focus.value = containers()[1] ?? RAIL;
	selected.value = null;
});
