// PROTOTYPE (#47378): one row's ⋯ menu, for the variants that put actions on the row itself.

import type { DropdownOptions } from "frappe-ui";
import { type Container, containerLabel, containers, type DraftRow, own, RAIL, rows } from "./navDraft";
import { giveSidebar, moveTo, nest, remove, shift, toggleHidden } from "./navEdits";

export type MenuHooks = { rename: () => void; edit: () => void };

export function rowMenu(container: Container, row: DraftRow, hooks: MenuHooks): DropdownOptions {
	const items = [
		{ label: "Rename", icon: "lucide-pencil", onClick: hooks.rename },
		{ label: own(row) ? "Edit…" : "Icon and label…", icon: "lucide-sliders-horizontal", onClick: hooks.edit },
		{ label: "Move up", icon: "lucide-arrow-up", onClick: () => shift(container, row.key, -1) },
		{ label: "Move down", icon: "lucide-arrow-down", onClick: () => shift(container, row.key, 1) },
	];
	if (container !== RAIL && row.item_type !== "Section")
		items.push({ label: "Nest under…", icon: "lucide-indent", submenu: nestTargets(container, row) } as never);
	items.push({ label: "Move to…", icon: "lucide-move-right", submenu: moveTargets(container, row) } as never);
	if (container === RAIL)
		items.push({
			label: row.item_type === "Sidebar" ? "Edit its sidebar" : "Give it a sidebar",
			icon: "lucide-panel-left",
			onClick: () => giveSidebar(row.key),
		});
	const last = [
		{
			label: row.hidden_by ? "Show" : "Hide",
			icon: row.hidden_by ? "lucide-eye" : "lucide-eye-off",
			onClick: () => toggleHidden(container, row.key),
		},
	];
	if (own(row)) last.push({ label: "Delete", icon: "lucide-trash-2", onClick: () => remove(container, row.key) });
	return [
		{ group: "", hideLabel: true, options: items },
		{ group: "", hideLabel: true, options: last },
	];
}

/** Every row it could sit under, refusals included: the editor says why when it refuses. */
function nestTargets(container: Container, row: DraftRow) {
	const parents = rows(container).filter((other) => other.key !== row.key && !other.marker);
	return [
		{ label: "Top level", onClick: () => nest(container, row.key, null) },
		...parents.map((parent) => ({
			label: `${parent.item_type === "Section" ? "§ " : ""}${parent.label ?? parent.link_to ?? parent.key}`,
			onClick: () => nest(container, row.key, parent.key),
		})),
	];
}

function moveTargets(container: Container, row: DraftRow) {
	return containers()
		.filter((other) => other !== container)
		.map((other) => ({ label: containerLabel(other), onClick: () => moveTo(container, row.key, other) }));
}
