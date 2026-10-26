// PROTOTYPE (#45263): the palette's in-page state, and the review switches read off the address.
//   ?palette=empty | deal | searching | scoped | assign | nomatch   opens the palette in that state
//   ?trigger=sidebar | rail | none                                  which visible trigger the shell draws

import { ref } from "vue";

export type Trigger = "sidebar" | "rail" | "none";
export type Step = { kind: "scope"; doctype: string } | { kind: "argument"; act: string; icon: string };

const params = new URLSearchParams(window.location.search);

export const trigger = ref<Trigger>(readTrigger());
export const open = ref(false);
export const query = ref("");
export const step = ref<Step | null>(null);
/** Records are still on their way from the server. */
export const searching = ref(false);
/** The review state the address asked for, held so Records keep "Searching…" for the screenshot. */
export const pinned = params.get("palette");

function readTrigger(): Trigger {
	const asked = params.get("trigger");
	return asked === "rail" || asked === "none" ? asked : "sidebar";
}

export function openPalette() {
	open.value = true;
}

/** Puts the palette in the state the address names, as if the user had typed and picked. */
export function openPinned() {
	if (!pinned) return;
	const states: Record<string, () => void> = {
		empty: () => {},
		deal: () => (query.value = "deal"),
		searching: () => {
			query.value = "deal";
			searching.value = true;
		},
		scoped: () => {
			step.value = { kind: "scope", doctype: "CRM Deal" };
			query.value = "tech";
		},
		assign: () => (step.value = { kind: "argument", act: "Assign to", icon: "lucide-user-plus" }),
		nomatch: () => (query.value = "xyz"),
	};
	states[pinned]?.();
	open.value = true;
}
