// PROTOTYPE (#47056), throwaway: the design choices the owner flips between, kept in the address
// (`?bulk=A&barAt=bottom&...`) and in localStorage so a reload keeps them.
import { reactive, watch } from "vue";

export const tweaks = reactive({
	/** A: a few buttons and a More menu. B: one grouped Actions menu. */
	bulk: "A" as "A" | "B",
	/** Where the bar sits: floating at the bottom, or in place of the controls row. */
	barAt: "bottom" as "bottom" | "top",
	/** Where "Select all N matching" is offered: a strip over the rows, or inside the bar. */
	selectAll: "strip" as "strip" | "bar",
	/** Where a background run shows: in the bar's place, or in a corner tray. */
	runs: "bar" as "bar" | "tray",
	/** Fake doctype facts. */
	workflow: true,
	submittable: true,
	queued: false,
	/** Pretends the filter matches 1,240 records, over the 500 cap. */
	big: false,
});

const KEY = "bulk-prototype-47056";
const FLAGS = ["workflow", "submittable", "queued", "big"] as const;

function load() {
	Object.assign(tweaks, JSON.parse(localStorage.getItem(KEY) || "{}"));
	const query = new URLSearchParams(location.search);
	for (const key of ["bulk", "barAt", "selectAll", "runs"] as const) {
		const value = query.get(key);
		if (value) (tweaks as Record<string, unknown>)[key] = value;
	}
	for (const key of FLAGS) {
		const value = query.get(key);
		if (value) tweaks[key] = value === "1";
	}
}

load();

watch(
	tweaks,
	(value) => {
		localStorage.setItem(KEY, JSON.stringify(value));
		const url = new URL(location.href);
		for (const [key, v] of Object.entries(value))
			url.searchParams.set(key, typeof v === "boolean" ? (v ? "1" : "0") : v);
		history.replaceState(history.state, "", url);
	},
	{ deep: true }
);
