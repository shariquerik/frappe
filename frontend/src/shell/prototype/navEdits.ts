// PROTOTYPE (#47378): every edit the editor makes, with the refusals the map's rulings ask for:
// the depth cap (charter 5), the 50-row cap and own-versus-inherited rows (#47377), and no
// section in the rail (#47376). Each returns false and says why when it refuses.

import { toast } from "frappe-ui";
import {
	CAP,
	draft,
	type Container,
	type DraftRow,
	find,
	focus,
	level,
	newKey,
	own,
	RAIL,
	refusal,
	rows,
	selected,
	sidebarOf,
} from "./navDraft";

export const TOO_DEEP = "Too deep: a section, its items, and one level under an item. Nothing deeper.";

export function refuse(message: string): false {
	refusal.value = message;
	toast.warning(message);
	return false;
}

/** Adds a row at the level being edited, at the top level or under `parentKey`. */
export function add(container: Container, fields: Partial<DraftRow>, parentKey?: string | null) {
	if (ownCount(container) >= CAP)
		return refuse(`Limit reached: ${CAP} added rows per rail or sidebar, per level.`);
	const row = { ...fields, key: newKey(), origin: level.value } as DraftRow;
	if (!canPlace(container, row, parentKey ?? null)) return false;
	row.parent_key = parentKey ?? undefined;
	rows(container).push(row);
	selected.value = { container, key: row.key };
	refusal.value = null;
	return true;
}

/** Changes a row; an inherited row keeps its type and target. */
export function update(container: Container, key: string, fields: Partial<DraftRow>) {
	const row = find(container, key);
	if (!row) return false;
	const allowed = own(row) ? fields : { label: fields.label, icon: fields.icon };
	Object.assign(row, allowed);
	return true;
}

export function remove(container: Container, key: string) {
	const row = find(container, key);
	if (!row || !own(row)) return refuse("Only rows added at this level can be deleted. Hide it instead.");
	const list = rows(container);
	list.splice(list.indexOf(row), 1);
	// Orphans move up to the top level, as the server already does.
	for (const child of list) if (child.parent_key === key) child.parent_key = undefined;
	if (selected.value?.key === key) selected.value = null;
	return true;
}

export function toggleHidden(container: Container, key: string) {
	const row = find(container, key);
	if (!row) return false;
	if (row.hidden_by && row.hidden_by !== level.value)
		return refuse("Hidden for everyone. Switch to Everyone to show it again.");
	row.hidden_by = row.hidden_by ? undefined : level.value;
	return true;
}

/** Nests `key` under `parentKey`, or lifts it to the top level with `null`. */
export function nest(container: Container, key: string, parentKey: string | null) {
	const row = find(container, key);
	if (!row || !canPlace(container, row, parentKey)) return false;
	row.parent_key = parentKey ?? undefined;
	refusal.value = null;
	return true;
}

/** One step up or down among its siblings. */
export function shift(container: Container, key: string, by: -1 | 1) {
	const list = rows(container);
	const row = find(container, key);
	if (!row) return;
	const siblings = list.filter((other) => other.parent_key === row.parent_key);
	const other = siblings[siblings.indexOf(row) + by];
	if (!other) return;
	const a = list.indexOf(row);
	const b = list.indexOf(other);
	[list[a], list[b]] = [list[b], list[a]];
}

/** Drag and drop: `key` lands just before `beforeKey`, under the same parent. */
export function placeBefore(from: Container, key: string, to: Container, beforeKey: string | null) {
	if (from !== to && !moveTo(from, key, to)) return false;
	const list = rows(to);
	const row = find(to, key)!;
	const before = beforeKey ? find(to, beforeKey) : undefined;
	if (before === row) return true;
	const parent = before?.parent_key ?? null;
	if (!canPlace(to, row, parent)) return false;
	row.parent_key = parent ?? undefined;
	list.splice(list.indexOf(row), 1);
	list.splice(before ? list.indexOf(before) : list.length, 0, row);
	return true;
}

/** Moves a row, with any children, from the rail into a sidebar or back. */
export function moveTo(from: Container, key: string, to: Container) {
	const row = find(from, key);
	if (!row) return false;
	if (to === RAIL && row.item_type === "Section") return refuse("A section can't go into the rail.");
	if (own(row) && ownCount(to) >= CAP)
		return refuse(`Limit reached: ${CAP} added rows per rail or sidebar, per level.`);
	const moving = [row, ...rows(from).filter((other) => other.parent_key === key)];
	const list = rows(from);
	for (const each of moving) list.splice(list.indexOf(each), 1);
	row.parent_key = undefined;
	// The rail is flat: children come along as rows of their own.
	if (to === RAIL) for (const each of moving) each.parent_key = undefined;
	rows(to).push(...moving);
	selected.value = { container: to, key };
	return true;
}

/** Gives a rail row a new sidebar of its own; its own page is the sidebar's first row. */
export function giveSidebar(key: string) {
	const row = find(RAIL, key);
	if (!row || !draft.value) return false;
	const existing = sidebarOf(row);
	if (existing) {
		focus.value = existing;
		return true;
	}
	const address = `${level.value}-sidebar-${Math.random().toString(36).slice(2, 6)}`;
	const { key: _key, origin: _origin, parent_key: _parent, ...target } = row;
	draft.value.sidebars[address] = [
		{ ...target, key: newKey(), origin: level.value } as DraftRow,
	];
	Object.assign(row, { item_type: "Sidebar", link_to: address, link_doctype: undefined, url: undefined });
	focus.value = address;
	return true;
}

/** Whether `row` may sit under `parentKey` in `container`; refuses with the reason. */
export function canPlace(container: Container, row: DraftRow, parentKey: string | null): boolean {
	if (container === RAIL && row.item_type === "Section") return refuse("A section can't go into the rail.");
	if (!parentKey) return true;
	if (container === RAIL) return refuse("The rail is flat: its rows can't nest.");
	if (row.item_type === "Section") return refuse("A section sits at the top level only.");
	const parent = find(container, parentKey);
	if (!parent || parent.key === row.key) return false;
	if (parent.item_type === "Section") return true;
	const grand = parent.parent_key ? find(container, parent.parent_key) : undefined;
	const hasChildren = rows(container).some((other) => other.parent_key === row.key);
	if ((grand && grand.item_type !== "Section") || hasChildren) return refuse(TOO_DEEP);
	return true;
}

function ownCount(container: Container) {
	return rows(container).filter((row) => row.origin === level.value).length;
}
