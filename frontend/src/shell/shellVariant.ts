// PROTOTYPE (frappe/frappe#42571): three variants of the frame on frappe-ui's shell components,
// switchable with `?variant=A|B|C` on any address and a floating bar; `?variant=off` restores
// today's frame. The choice is kept in localStorage so a rail click does not drop it.

import { ref } from "vue";

const KEY = "frappe:desk:shell-variant";

export type Variant = "A" | "B" | "C";

export const VARIANTS: { key: Variant; name: string }[] = [
	{ key: "A", name: "Icon rail, drawer editor, panel collapses to nothing" },
	{ key: "B", name: "Labelled rail as today, frappe-ui panel only" },
	{ key: "C", name: "Icon rail, dialog editor, panel collapses to icons" },
];

function isVariant(value: string | null): value is Variant {
	return VARIANTS.some((variant) => variant.key === value);
}

function read(): Variant | null {
	try {
		const asked = new URLSearchParams(location.search).get("variant");
		if (asked === "off") localStorage.removeItem(KEY);
		else if (isVariant(asked)) localStorage.setItem(KEY, asked);
		const stored = localStorage.getItem(KEY);
		return isVariant(stored) ? stored : null;
	} catch {
		return null;
	}
}

/** The variant in force, or `null` for today's frame. Reactive: the bar swaps it in place. */
export const variant = ref<Variant | null>(read());

export function setVariant(next: Variant | null) {
	variant.value = next;
	try {
		if (next) localStorage.setItem(KEY, next);
		else localStorage.removeItem(KEY);
	} catch {
		// Full or forbidden. The switch still holds for this page.
	}
}
