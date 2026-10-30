// PROTOTYPE (#45867): the review's toggles, kept across pages in localStorage so a walk from
// the DocType page to a record keeps them. Not part of the design.
import { reactive, watch } from "vue";

const KEY = "proto-45867-tweaks";

export const tweaks = reactive({
	/** The DocType page: properties as a fixed right pane, or a card shown on selection. */
	properties: "pane" as "pane" | "selection",
	/** In-place edit: the Done/Cancel bar floats at the bottom, or replaces the page header. */
	bar: "floating" as "floating" | "header",
	/** Simulates a site with developer mode off: every standard DocType opens in Customize. */
	dev: true,
	/** Developer mode only: edit as Customize instead of Design. */
	customize: false,
	acts: false,
	...JSON.parse(localStorage.getItem(KEY) ?? "{}"),
});

watch(tweaks, (value) => localStorage.setItem(KEY, JSON.stringify(value)), { deep: true });

/** The mode the server would pick (#45862 ruling 1): a custom DocType is always Design. */
export function modeFor(custom: boolean) {
	if (custom) return "design" as const;
	return !tweaks.dev || tweaks.customize ? ("customize" as const) : ("design" as const);
}
