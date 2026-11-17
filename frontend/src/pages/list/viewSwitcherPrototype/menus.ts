// PROTOTYPE (#45851): the Dropdown options every variant shares, the grouped view list and one view's acts.
import { h } from "vue";
import {
	GROUPS,
	can,
	defaultScopes,
	iconOf,
	protoState,
	resolvedDefault,
	viewOf,
	viewsIn,
	type ProtoView,
	type useViewActs,
} from "./store";

type Acts = ReturnType<typeof useViewActs>;

const DEFAULT_MARK = () => h("span", { class: "ml-2 text-sm leading-none text-ink-gray-5" }, "Default");

/** One option per view, grouped by layer; the current view selected, the reader's default marked. */
export function viewGroups(acts: Acts, current: string) {
	return GROUPS.map(({ layer, label }) => ({
		group: label,
		hideLabel: layer === null,
		options: viewsIn(layer).map((view) => ({
			label: view.label,
			icon: iconOf(view.type),
			selected: view.key === current,
			onClick: () => acts.open(view.key),
			...(view.key === resolvedDefault.value ? { slots: { suffix: DEFAULT_MARK } } : {}),
		})),
	})).filter((group) => group.options.length);
}

/** Rename, Delete, Publish and the default entries for one view, as the reader may use them. */
export function viewActGroups(acts: Acts, key: string) {
	const view = viewOf(key);
	if (!view) return [];
	const state = protoState();
	const manage = [
		can.rename(view) && { label: "Rename", icon: "lucide-pencil", onClick: () => ask("rename", key) },
		can.publish(view) && {
			label: "Publish to site",
			icon: "lucide-globe",
			onClick: () => ask("publish", key),
		},
		can.delete(view) && {
			label: "Delete",
			icon: "lucide-trash-2",
			theme: "red",
			onClick: () => ask("delete", key),
		},
		view.overridesApp &&
			state.admin && {
				label: "Restore the app's view",
				icon: "lucide-rotate-ccw",
				onClick: () => ask("delete", key),
			},
	].filter(Boolean);
	return [
		{ group: "View", hideLabel: true, options: manage },
		{ group: "Default", hideLabel: true, options: defaultOptions(acts, view) },
	].filter((group) => group.options.length);
}

function defaultOptions(acts: Acts, view: ProtoView) {
	const state = protoState();
	const scopes = defaultScopes(view.key);
	const options = [];
	if (!scopes.includes("user"))
		options.push({
			label: "Set as my default",
			icon: "lucide-house",
			onClick: () => acts.setDefault(view.key, "user"),
		});
	else
		options.push({
			label: "Remove my default",
			icon: "lucide-house",
			onClick: () => acts.clearDefault("user"),
		});
	if (state.admin && !scopes.includes("site"))
		options.push({
			label: "Set as default for everyone",
			icon: "lucide-users",
			disabled: !can.siteDefault(view),
			description: can.siteDefault(view) ? undefined : "Publish this view first",
			onClick: () => acts.setDefault(view.key, "site"),
		});
	if (state.admin && scopes.includes("site"))
		options.push({
			label: "Remove default for everyone",
			icon: "lucide-users",
			onClick: () => acts.clearDefault("site"),
		});
	return options;
}

/** Modified (ruling 9): the menu opens on the changes, no buttons. Save only where the reader can save (ruling 10). */
export function changeGroup(acts: Acts, key: string) {
	const view = viewOf(key);
	const saveable = !view || can.save(view);
	const hint =
		view?.layer === "app"
			? "Saves a site copy over the app's view"
			: view?.layer === "site"
			? "Saves the view for everyone"
			: undefined;
	return {
		group: "Unsaved changes",
		options: [
			saveable && { label: "Save changes", icon: "lucide-check", description: hint, onClick: () => acts.save() },
			{ label: "Save as new view…", icon: "lucide-copy-plus", onClick: () => ask("save_as_new", key) },
			{ label: "Discard changes", icon: "lucide-undo-2", onClick: () => acts.discard() },
		].filter(Boolean),
	};
}

export function ask(kind: "rename" | "save_as_new" | "delete" | "publish", key: string) {
	protoState().dialog = { kind, key };
}
