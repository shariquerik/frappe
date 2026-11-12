// PROTOTYPE (#47098), throwaway: the Editor panels' property search. The panel provides it; each
// PanelRow registers its label (and keywords) under its PanelSection, which opens while it holds a
// match and hides while it holds none. Without a provider (Add a field) nothing filters.
// ?search=one: the header's finder reads the open panel's rows (activePanel) and reveals one.
import { computed, inject, nextTick, onBeforeUnmount, provide, reactive, shallowRef, watchEffect, type InjectionKey, type Ref } from "vue";
import { matches } from "./settings";

export interface PanelSearch {
	query: string;
	groups: Map<number, { label: string; open: Ref<boolean> }>;
	rows: Map<number, { group: number; text: string; label: string; el: () => HTMLElement | null }>;
}

const PanelSearchKey: InjectionKey<PanelSearch> = Symbol("PanelSearch");
const PanelGroupKey: InjectionKey<number> = Symbol("PanelGroup");
/** The panel on screen, for the unified finder. */
export const activePanel = shallowRef<PanelSearch | null>(null);

/** Words that find a property its label does not name. */
const KEYWORDS: Record<string, string> = {
	Label: "name title",
	Type: "fieldtype",
	Required: "mandatory reqd",
	"Mandatory if": "required condition depends",
	"Visible if": "hidden show condition depends_on",
	"Read-only if": "condition depends",
	Filters: "link_filters filter query set_query",
	"Fetch from": "fetch_from copy",
	"Only when empty": "fetch_if_empty",
	"Fetched fields": "fetch_from copy",
	"Starts open if": "collapsible_depends_on collapsed condition",
	Collapsible: "collapse",
	Fieldname: "fieldname name column",
	"Help text": "description",
	"Links to": "options doctype link",
	Options: "select choices",
	Hidden: "hide hidden",
	"In list view": "column",
	"List filter": "filter standard",
	"Global search": "search",
	"Search index": "index",
	"Perm level": "permission level permlevel",
	"Edit after submit": "allow on submit",
	"Hide in print": "print",
	"Hide in reports": "report",
	Heading: "label title",
};

export function providePanelSearch() {
	const search = reactive({ query: "", groups: new Map(), rows: new Map() }) as PanelSearch;
	provide(PanelSearchKey, search);
	activePanel.value = search;
	onBeforeUnmount(() => activePanel.value === search && (activePanel.value = null));
	const searching = computed(() => Boolean(search.query.trim()));
	const anyMatch = computed(() => [...search.rows.values()].some((one) => matches(one.text, search.query)));
	return { search, searching, anyMatch };
}

let nextGroup = 1;
/** For a PanelSection: whether a search runs, and whether it holds a match. */
export function usePanelGroup(label: string, open: Ref<boolean>) {
	const search = inject(PanelSearchKey, null);
	const group = nextGroup++;
	provide(PanelGroupKey, group);
	search?.groups.set(group, { label, open });
	onBeforeUnmount(() => search?.groups.delete(group));
	const searching = computed(() => Boolean(search?.query.trim()));
	const hasMatch = computed(() => !search || !searching.value || [...search.rows.values()].some((one) => one.group === group && matches(one.text, search.query)));
	return { searching, hasMatch };
}

let nextRow = 1;
/** For a PanelRow: registers its text; true while the search keeps it. */
export function usePanelRow(label: () => string, el: () => HTMLElement | null) {
	const search = inject(PanelSearchKey, null);
	const group = inject(PanelGroupKey, 0);
	if (!search) return computed(() => true);
	const id = nextRow++;
	const full = () => `${label()} ${KEYWORDS[label()] ?? ""}`;
	watchEffect(() => search.rows.set(id, { group, text: full(), label: label(), el }));
	onBeforeUnmount(() => search.rows.delete(id));
	return computed(() => !search.query.trim() || matches(full(), search.query));
}

/** Opens a property's group, scrolls to its row and flashes it. */
export async function revealProperty(search: PanelSearch, row: { group: number; el: () => HTMLElement | null }) {
	const group = search.groups.get(row.group);
	if (group) group.open.value = true;
	await nextTick();
	flash(row.el());
}

// The bleed fill: a pseudo-element 8px past the row's sides, so the text stays on the column edge.
const BLEED = ["relative", "isolate", "before:pointer-events-none", "before:absolute", "before:-inset-x-2", "before:inset-y-0", "before:-z-10", "before:rounded-4", "before:bg-surface-gray-3", "before:transition-opacity", "before:duration-300"];

/** A brief gray background on a row the finder took you to; `bleed` pads it out past the row's sides. */
export function flash(el: HTMLElement | null, { bleed = false } = {}) {
	if (!el) return;
	el.scrollIntoView({ block: "center", behavior: "smooth" });
	if (!bleed) {
		el.classList.add("rounded-4", "bg-surface-gray-3", "transition-colors", "duration-300");
		setTimeout(() => el.classList.remove("bg-surface-gray-3"), 1200);
		return;
	}
	const added = BLEED.filter((one) => !el.classList.contains(one));
	el.classList.add(...added);
	setTimeout(() => el.classList.add("before:opacity-0"), 1200);
	setTimeout(() => el.classList.remove(...added, "before:opacity-0"), 1500);
}
