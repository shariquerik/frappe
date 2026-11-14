// PROTOTYPE (map #47369, ticket #47374): the layout and side under test, switched by
// `?variant=`. Throwaway: lives on `prototype/nav-layouts` only, never merged.

import { computed, ref, watch } from "vue";

export type Layout = "rail" | "sidebar" | "dock" | "peek";
export type Side = "left" | "right";

export const LAYOUTS: { key: Layout; letter: string; name: string }[] = [
	{ key: "rail", letter: "A", name: "Rail + sidebar" },
	{ key: "sidebar", letter: "B", name: "Sidebar only" },
	{ key: "dock", letter: "C", name: "Dock: floating rail (v1)" },
	{ key: "peek", letter: "D", name: "Dock: whole navigation peeks" },
];

/** Layout-major, so the right arrow flips the side before it moves to the next layout. */
export const VARIANTS = LAYOUTS.flatMap((layout) =>
	(["left", "right"] as Side[]).map((side) => ({
		key: side === "left" ? layout.key : `${layout.key}-right`,
		layout: layout.key,
		side,
		label: `${layout.letter} · ${layout.name} · ${side}`,
	}))
);

const STORE = "proto-nav-variant";

function parse(key: string | null | undefined) {
	return VARIANTS.find((variant) => variant.key === key);
}

// The address wins on load; the store keeps it across navigations, which drop the query.
const initial =
	parse(new URLSearchParams(location.search).get("variant")) ??
	parse(localStorage.getItem(STORE)) ??
	VARIANTS[0];

export const variantKey = ref(initial.key);
export const variant = computed(() => parse(variantKey.value) ?? VARIANTS[0]);
export const layout = computed(() => variant.value.layout);
export const side = computed(() => variant.value.side);
/** The tooltip and menu side that points away from the navigation. */
export const awaySide = computed(() => (side.value === "left" ? "right" : "left"));

/** A dock or peek locked open by its pin; dropped on every switch. */
export const pinned = ref(false);

watch(variantKey, (key) => {
	localStorage.setItem(STORE, key);
	pinned.value = false;
});

export function setVariant(key: string) {
	if (parse(key)) variantKey.value = key;
}

export function step(by: number) {
	const at = VARIANTS.findIndex((v) => v.key === variantKey.value);
	variantKey.value = VARIANTS[(at + by + VARIANTS.length) % VARIANTS.length].key;
}
