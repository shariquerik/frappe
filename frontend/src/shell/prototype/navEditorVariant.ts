// PROTOTYPE (map #47369, ticket #47378): the editor variant under test, switched by
// `?variant=`. Throwaway: lives on `prototype/nav-editor` only, never merged.

import { computed, ref, watch } from "vue";

export type EditorVariant = "inplace" | "dialog" | "panel";

export const VARIANTS: { key: EditorVariant; label: string }[] = [
	{ key: "inplace", label: "A · In place on the rail and sidebar" },
	{ key: "dialog", label: "B · Customize dialog, two panes" },
	{ key: "panel", label: "C · Side panel beside the navigation" },
];

const STORE = "proto-nav-editor-variant";

function parse(key: string | null | undefined) {
	return VARIANTS.find((variant) => variant.key === key);
}

// The address wins on load; the store keeps it across navigations, which drop the query.
const initial =
	parse(new URLSearchParams(location.search).get("variant")) ??
	parse(localStorage.getItem(STORE)) ??
	VARIANTS[0];

export const variantKey = ref<EditorVariant>(initial.key);
export const variant = computed(() => parse(variantKey.value) ?? VARIANTS[0]);

watch(variantKey, (key) => localStorage.setItem(STORE, key));

export function setVariant(key: string) {
	const found = parse(key);
	if (found) variantKey.value = found.key;
}

export function step(by: number) {
	const at = VARIANTS.findIndex((v) => v.key === variantKey.value);
	variantKey.value = VARIANTS[(at + by + VARIANTS.length) % VARIANTS.length].key;
}
