// PROTOTYPE (#47260), throwaway: never merge. Which bulk bar placement the list and cards draw.
import { ref } from "vue";

export const VARIANTS = [
	{ key: "A", name: "Header row, spacing fixed" },
	{ key: "B", name: "Floating island" },
	{ key: "C", name: "Island, dark" },
	{ key: "D", name: "Island, lifted, rows fade" },
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
