// PROTOTYPE (#47378), variant B: what the dialog's right pane shows, and which list the left shows.

import { ref } from "vue";
import { type Container, type DraftRow, RAIL, refusal, selected } from "./navDraft";

export type Pane =
	| { mode: "none" }
	| { mode: "add"; container: Container; type: string; parent: string; prefill?: Partial<DraftRow> }
	| { mode: "row"; container: Container; key: string };

export const pane = ref<Pane>({ mode: "none" });
export const tab = ref<"rail" | "sidebar">("sidebar");
/** The sidebar the Sidebar tab lists. */
export const sidebar = ref<string>("");

export function container(): Container {
	return tab.value === "rail" ? RAIL : sidebar.value;
}

export function choose(where: Container, key: string) {
	pane.value = { mode: "row", container: where, key };
	selected.value = { container: where, key };
	refusal.value = null;
}

export function startAdd(type: string, prefill?: Partial<DraftRow>) {
	pane.value = { mode: "add", container: container(), type, parent: "", prefill };
	selected.value = null;
	refusal.value = null;
}

export function clear() {
	pane.value = { mode: "none" };
	selected.value = null;
}
