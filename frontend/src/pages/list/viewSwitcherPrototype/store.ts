// PROTOTYPE (frappe/frappe#45851), throwaway: never merge. Branch `proto/view-switcher`.
//
// Four placements of the view switcher on the real list page, switched by `?variant=A|B|C|D`.
// The list of views comes from the real `list_views` read. Every write (save, save as new, rename,
// delete, publish, defaults) is a stub in this module's memory: a reload forgets it.
// A view's filters are applied as the URL query when it opens, because no read sends a saved
// view's settings to the page yet (map #45846, "Not yet specified").
import { runMethod } from "@framework/ui/api";
import { toast } from "frappe-ui";
import { computed, reactive } from "vue";
import type { LocationQuery, RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { Boot } from "@/boot";
import { routeFor } from "@/router/routeFor";

export type Layer = "own" | "site" | "app" | null;
export type Scope = "user" | "site";
export type Variant = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export const VARIANTS: { key: Variant; name: string }[] = [
	{ key: "A", name: "Title dropdown" },
	{ key: "B", name: "View tabs" },
	{ key: "C", name: "Sidebar rows" },
	{ key: "D", name: "Controls row" },
	{ key: "E", name: "Floating views" },
	{ key: "F", name: "Floating pill" },
	{ key: "G", name: "Footer tabs" },
	{ key: "H", name: "Views panel" },
	{ key: "I", name: "Header button" },
	{ key: "J", name: "Header views" },
	{ key: "K", name: "DocType sidebar" },
	{ key: "L", name: "Crumb + save bar" },
];

export interface ProtoView {
	key: string;
	label: string;
	type: string;
	layer: Layer;
	/** The view's filters and sort as the list's URL query. */
	base: Record<string, string>;
	/** A site row at an app view's key: Delete restores the app's view. */
	overridesApp?: boolean;
	/** Made in this prototype: no row exists, so its address names it with `?pv=`. */
	stub?: boolean;
}

// The query keys that are not the list's own filters and sort.
const FOREIGN = new Set(["variant", "pv", "sidebar", "view", "layout", "from"]);

/** What the seeded views hold, since no read returns a saved view's settings yet. */
function seededBase(key: string, user: string): Record<string, string> {
	if (key === "open") return { status: "Open" };
	if (key.startsWith("high-priority-45851")) return { priority: "High" };
	if (key.startsWith("cancelled-45851")) return { status: "Cancelled" };
	if (key.startsWith("mine-45851")) return { allocated_to: user };
	if (key.startsWith("cards-45851")) return { status: "Open" };
	return {};
}

const state = reactive({
	doctype: "",
	loaded: false,
	views: [] as ProtoView[],
	/** The pointer at each layer; null = none. A type's plain view is named by its lower-case type. */
	defaults: { user: null as string | null, site: null as string | null, app: null as string | null },
	/** Whether the reader is a site administrator; the bar can switch it to see the other side. */
	admin: true,
	last: "",
	dialog: null as null | { kind: "rename" | "save_as_new" | "delete" | "publish"; key: string },
	types: [] as { name: string; label: string; icon: string | null }[],
	/** K: the shell's sidebar lists the views, so the crumb's menu keeps only this view's acts. */
	inSidebar: false,
});

export function protoState() {
	return state;
}

export function variantOf(route: RouteLocationNormalizedLoaded): Variant | null {
	const value = String(route.query.variant ?? "").toUpperCase();
	return (VARIANTS.find((each) => each.key === value)?.key as Variant) ?? null;
}

export async function loadViews(boot: Boot, doctype: string) {
	if (state.loaded && state.doctype === doctype) return;
	const user = boot.session.user.name;
	state.doctype = doctype;
	state.types = boot.view_types ?? [];
	state.admin = user === "Administrator" || (boot.session.roles ?? []).includes("System Manager");
	const { data } = await runMethod<Record<string, any[]>>(
		"frappe.desk.doctype.doctype_view.api.list_views",
		{ doctype, app: boot.app },
		{ http: "GET" }
	);
	const listed = data[doctype] ?? [];
	state.views = listed.map((view) => ({
		key: view.key,
		label: view.label,
		type: view.type,
		layer: view.layer,
		base: seededBase(view.key, user),
	}));
	// The seed put the site's pointer at the app view `open`; the read names only the winner.
	const winner = listed.find((view) => view.default);
	if (winner) state.defaults.site = winner.key;
	state.loaded = true;
}

// The seeded types' icons, named whole so Tailwind emits them: lucide-list lucide-layout-grid
export function iconOf(type: string): string {
	const icon = state.types.find((each) => each.name === type)?.icon || "list";
	return icon.startsWith("lucide-") ? icon : `lucide-${icon}`;
}

export function viewOf(key: string): ProtoView | undefined {
	return state.views.find((view) => view.key === key);
}

/** The key the address names: `?pv=` for a stub, else the segment after `/view/`, else plain List. */
export function currentKey(route: RouteLocationNormalizedLoaded): string {
	if (route.query.pv) return String(route.query.pv);
	const segment = route.path.split("/view/")[1]?.split("/")[0];
	return segment ? decodeURIComponent(segment) : "list";
}

export function ownedQuery(query: LocationQuery): Record<string, string> {
	return Object.fromEntries(
		Object.entries(query)
			.filter(([key]) => !FOREIGN.has(key))
			.map(([key, value]) => [key, String(value)])
	);
}

function same(a: Record<string, string>, b: Record<string, string>) {
	const spell = (value: Record<string, string>) => JSON.stringify(Object.entries(value).sort());
	return spell(a) === spell(b);
}

export function isModified(route: RouteLocationNormalizedLoaded): boolean {
	const view = viewOf(currentKey(route));
	return !!view && !same(ownedQuery(route.query), view.base);
}

/** The default this person gets: person over site over app, else the plain List view; a dead pointer is skipped. */
export function liveDefault(): string {
	const { user, site, app } = state.defaults;
	return [user, site, app].find((key) => key && viewOf(key)) ?? "list";
}

export const resolvedDefault = computed(liveDefault);

/** Which layers point at `key`, for the "Default" mark and "Remove default". */
export function defaultScopes(key: string): Scope[] {
	const scopes: Scope[] = [];
	if (state.defaults.user === key) scopes.push("user");
	if (state.defaults.site === key) scopes.push("site");
	return scopes;
}

export const can = {
	/** Ruling 10: a shared view has no per-person layer; the plain view keeps one. */
	save: (view: ProtoView) => view.layer === null || view.layer === "own" || state.admin,
	rename: (view: ProtoView) => view.layer === "own" || (view.layer === "site" && state.admin),
	delete: (view: ProtoView) => view.layer === "own" || (view.layer === "site" && state.admin),
	/** Ruling 5: only a site administrator publishes. */
	publish: (view: ProtoView) => view.layer === "own" && state.admin,
	siteDefault: (view: ProtoView) => state.admin && view.layer !== "own",
};

export const GROUPS: { layer: Layer; label: string }[] = [
	{ layer: null, label: "Types" },
	{ layer: "own", label: "My views" },
	{ layer: "site", label: "Site views" },
	{ layer: "app", label: "App views" },
];

export function viewsIn(layer: Layer): ProtoView[] {
	return state.views.filter((view) => view.layer === layer);
}

function say(message: string) {
	state.last = message;
	toast.success(message);
}

export function useViewActs(router: Router, route: RouteLocationNormalizedLoaded) {
	function addressOf(view: ProtoView, query: Record<string, string>) {
		const path = router.resolve(routeFor(state.doctype)).path;
		const segment = view.stub ? view.type.toLowerCase() : view.key;
		const kept: Record<string, string> = {};
		for (const key of ["variant", "sidebar"]) if (route.query[key]) kept[key] = String(route.query[key]);
		if (view.stub) kept.pv = view.key;
		return { path: `${path}/view/${segment}`, query: { ...query, ...kept } };
	}

	function open(key: string) {
		const view = viewOf(key);
		if (view) void router.push(addressOf(view, view.base));
	}

	const current = () => viewOf(currentKey(route));

	function save() {
		const view = current();
		if (!view) return;
		view.base = ownedQuery(route.query);
		if (view.layer === "app") {
			view.layer = "site";
			view.overridesApp = true;
			say(`Saved "${view.label}" for the site. It now overrides the app's view.`);
		} else say(`Saved "${view.label}".`);
	}

	function discard() {
		const view = current();
		if (view) void router.replace(addressOf(view, view.base));
	}

	function saveAsNew(label: string) {
		const view = current();
		if (!view) return;
		let key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "view";
		while (viewOf(key)) key = `${key}-2`;
		const made: ProtoView = {
			key,
			label,
			type: view.type,
			layer: "own",
			base: ownedQuery(route.query),
			stub: true,
		};
		state.views.push(made);
		say(`Saved "${label}" to My views.`);
		void router.push(addressOf(made, made.base));
	}

	function rename(key: string, label: string) {
		const view = viewOf(key);
		if (!view || !label.trim()) return;
		const was = view.label;
		view.label = label.trim();
		say(`Renamed "${was}" to "${view.label}". Its address stays /view/${view.key}.`);
	}

	function remove(key: string) {
		const view = viewOf(key);
		if (!view) return;
		const restored = !!view.overridesApp;
		if (restored) {
			view.layer = "app";
			view.overridesApp = false;
			view.base = seededBase(view.key, "");
			say(`Deleted the site's copy. "${view.label}" is the app's view again.`);
		} else {
			state.views = state.views.filter((each) => each !== view);
			// Ruling 6 of #45852: deleting own view deletes the person's pointer; a site pointer is skipped at read.
			if (state.defaults.user === key) state.defaults.user = null;
			say(`Deleted "${view.label}".`);
		}
		if (currentKey(route) === key) open(restored ? key : liveDefault());
	}

	function publish(key: string) {
		const view = viewOf(key);
		if (!view) return;
		view.layer = "site";
		say(`Published "${view.label}". Everyone on the site sees it under Site views.`);
	}

	function setDefault(key: string, scope: Scope) {
		state.defaults[scope] = key;
		const label = viewOf(key)?.label ?? key;
		say(scope === "user" ? `"${label}" is your default.` : `"${label}" is the default for everyone.`);
	}

	function clearDefault(scope: Scope) {
		state.defaults[scope] = null;
		say(scope === "user" ? "Removed your default." : "Removed the default for everyone.");
	}

	return { open, save, discard, saveAsNew, rename, remove, publish, setDefault, clearDefault, current };
}
