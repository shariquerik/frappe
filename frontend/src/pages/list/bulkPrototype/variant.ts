// PROTOTYPE (#47260), throwaway: never merge. Which bulk bar placement the list and cards draw.
import { computed, ref } from "vue";

export const VARIANTS = [
	{ key: "A", name: "Header row, spacing fixed" },
	{ key: "B", name: "Floating island" },
	{ key: "C", name: "Island, dark" },
	{ key: "D", name: "Island, lifted, rows fade" },
	{ key: "E", name: "Island, soft gray, rows fade" },
	{ key: "F", name: "Island, glass" },
	{ key: "G", name: "Docked in the footer row" },
	{ key: "H", name: "D as a pill, deeper shadow" },
	{ key: "I", name: "D with a count chip" },
	{ key: "J", name: "D with a dark count badge" },
	{ key: "K", name: "H, rounded, tight, checkbox" },
] as const;

type Key = (typeof VARIANTS)[number]["key"];

const fromUrl = new URLSearchParams(location.search).get("variant");
export const bulkVariant = ref<Key>(VARIANTS.find((variant) => variant.key === fromUrl)?.key ?? "A");

export function setBulkVariant(key: Key) {
	bulkVariant.value = key;
	const url = new URL(location.href);
	url.searchParams.set("variant", key);
	history.replaceState(history.state, "", url);
}

export const isIsland = computed(() => ["B", "C", "D", "E", "F", "H", "I", "J", "K"].includes(bulkVariant.value));
export const fades = computed(() => ["D", "E", "H", "I", "J", "K"].includes(bulkVariant.value));
export const docked = computed(() => bulkVariant.value === "G");
