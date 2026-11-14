// PROTOTYPE (map #47369, ticket #47385): the navigation on phones and narrow windows, switched by
// `?phone=` and `?narrow=` beside `?variant=`. Throwaway: lives on `prototype/nav-narrow` only.

import { computed, ref, watch } from "vue";
import { breakpointsTailwind, useBreakpoints } from "@vueuse/core";
import type { RouteLocationRaw } from "vue-router";
import type { NavigationItem } from "@/boot";
import { labelOf, renderingOf } from "@/navigation/registry";
import type { ItemNode } from "@/navigation/tree";
import type { ItemContext } from "@/navigation/types";

export type PhoneStyle = "drawer" | "sheet" | "page";
export type NarrowMode = "same" | "overlay" | "phone";

export const PHONE_STYLES: { key: PhoneStyle; name: string }[] = [
	{ key: "drawer", name: "P1 · Drawer from the side" },
	{ key: "sheet", name: "P2 · Tab bar + sheet (v1)" },
	{ key: "page", name: "P3 · Full-screen menu" },
];

export const NARROW_MODES: { key: NarrowMode; name: string }[] = [
	{ key: "same", name: "N1 · As on desktop" },
	{ key: "overlay", name: "N2 · Sidebar over the page" },
	{ key: "phone", name: "N3 · Phone navigation" },
];

function fromAddress<T extends string>(name: string, keys: T[], fallback: T): T {
	const asked = new URLSearchParams(location.search).get(name) ?? localStorage.getItem(`proto-nav-${name}`);
	return keys.includes(asked as T) ? (asked as T) : fallback;
}

export const phoneStyle = ref<PhoneStyle>(
	fromAddress("phone", PHONE_STYLES.map((s) => s.key), "drawer")
);
export const narrowMode = ref<NarrowMode>(
	fromAddress("narrow", NARROW_MODES.map((m) => m.key), "overlay")
);
watch(phoneStyle, (key) => localStorage.setItem("proto-nav-phone", key));
watch(narrowMode, (key) => localStorage.setItem("proto-nav-narrow", key));

// v1's split: phones below `md` (768), a narrow window below `lg` (1024).
const breakpoints = useBreakpoints(breakpointsTailwind);
const belowMd = breakpoints.smaller("md");
const belowLg = breakpoints.smaller("lg");

/** The width band the window is in. */
export const band = computed(() => (belowMd.value ? "phone" : belowLg.value ? "narrow" : "wide"));

/** What the shell draws: the desktop layouts, the narrow overlay, or a phone navigation. */
export const navMode = computed(() => {
	if (band.value === "phone") return "phone";
	if (band.value === "narrow" && narrowMode.value === "phone") return "phone";
	if (band.value === "narrow" && narrowMode.value === "overlay") return "overlay";
	return "desktop";
});

/** The phone navigation's open state: the drawer, the sheet or the full-screen menu. */
export const navOpen = ref(false);
watch([navMode, phoneStyle], () => (navOpen.value = false));

export type Cell = {
	key: string;
	label: string;
	icon?: string;
	sidebar?: string;
} & ({ to: RouteLocationRaw } | { href: string });

/** The rail's cells, flat, as `RailColumn` draws them. */
export function railCells(tree: ItemNode[], context: ItemContext): Cell[] {
	const out: Cell[] = [];
	const walk = (nodes: ItemNode[]) => {
		for (const node of nodes) {
			const cell = cellOf(node.item, context);
			if (cell) out.push(cell);
			walk(node.children);
		}
	};
	walk(tree);
	return out;
}

function cellOf(item: NavigationItem, context: ItemContext): Cell | null {
	const rendering = renderingOf(item, context);
	if (!rendering || !("to" in rendering || "href" in rendering)) return null;
	const cell = { key: item.key, label: labelOf(item, context), icon: item.icon };
	return "to" in rendering
		? { ...cell, to: rendering.to, sidebar: rendering.sidebar }
		: { ...cell, href: rendering.href, sidebar: rendering.sidebar };
}

let keepOpen = 0;
/** Navigations in the next moment leave the phone navigation open: a tap that browses, not one
 * that arrives. A moment, not one navigation: a rail tap can replace its address a second time. */
export function keepOpenOnce() {
	keepOpen = Date.now() + 1000;
}
/** Called on each navigation: closes the phone navigation unless a browse asked to keep it. */
export function closeOnNavigate() {
	if (Date.now() > keepOpen) navOpen.value = false;
}
