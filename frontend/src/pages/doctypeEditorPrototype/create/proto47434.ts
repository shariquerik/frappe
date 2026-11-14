// PROTOTYPE (#47434), throwaway: the three build-only features redesigned, each with its own
// address key. ?col= how a column is selected and moved; ?series= how Naming Series is edited;
// ?tray= where Details' "Fields not on this layout" sits. ?bar=col|series|tray points the variant
// bar at one of them. Any of ?col= or ?tray= draws the canvas with the record page's real controls
// and the marks inline after the label (map rulings 2 and 9). &off=a,b takes fields off Details.
import { computed, reactive } from "vue";
import { useRoute } from "vue-router";

export const COL = [
	{ key: "A", label: "Column: click its free space" },
	{ key: "B", label: "Column: listed in the section" },
	{ key: "C", label: "Column: a step up from the field" },
];
export const SERIES = [
	{ key: "A", label: "Series: edit in the rows" },
	{ key: "B", label: "Series: edit in a dialog" },
	{ key: "C", label: "Series: one per line" },
];
export const TRAY = [
	{ key: "A", label: "Tray: first group of the panel" },
	{ key: "B", label: "Tray: under the form" },
	{ key: "C", label: "Tray: in the meta line" },
];
export const BARS: Record<string, { variants: { key: string; label: string }[] }> = { col: { variants: COL }, series: { variants: SERIES }, tray: { variants: TRAY } };

const pick = (value: unknown, keys: { key: string }[]) => (keys.some((one) => one.key === value) ? String(value) : "");

export function use47434() {
	const route = useRoute();
	const col = computed(() => pick(route.query.col, COL));
	const series = computed(() => pick(route.query.series, SERIES));
	const tray = computed(() => pick(route.query.tray, TRAY));
	const real = computed(() => Boolean(col.value || tray.value));
	return { col, series, tray, real };
}

/** The column the pointer is over (on the canvas, or on its row in the section's panel). */
export const colUi = reactive({ hover: null as string | null });
