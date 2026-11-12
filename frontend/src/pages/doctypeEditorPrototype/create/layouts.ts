// PROTOTYPE (#47097), throwaway: the layouts a saved DocType has, as the `Details ▾` menu lists
// them, and the acts on the one that is open. Nothing is written; Save stays a toast.
// ?switcher= picks where those acts live: A a card in the panel, B a strip over the canvas,
// C a ⋯ on each menu row.
import { computed, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import type { Editor, LayoutKey, Source, Variant } from "../editor";
import { LAYOUTS } from "../editor";
import type { Kind } from "./newDoctype";

export const WHERE: Record<LayoutKey, string> = {
	details: "The record page's main column",
	"side-panel": "The record page's right side",
	"quick-entry": "The Create dialog",
	"new-record": "A new record's page, until its first save",
};

export const ICON: Record<LayoutKey, string> = {
	details: "lucide-file-text",
	"side-panel": "lucide-panel-right",
	"quick-entry": "lucide-app-window",
	"new-record": "lucide-file-plus",
};

export const BADGE: Record<Source, string> = {
	app: "App layout",
	site: "Site layout",
	fallback: "From DocType fields",
	none: "Not set up",
	details: "Same as Details",
};

/** PROTOTYPE: no conditional row exists on this site, so these DocTypes get a made-up one. */
export const FAKE_VARIANTS: Record<string, { key: LayoutKey; condition: string }> = {
	Contact: { key: "details", condition: 'doc.status == "Passive"' },
	"CRM Lead": { key: "details", condition: 'doc.status == "Junk"' },
};

/** A child table's rows use Details only; a single has no Create dialog and no new record. */
export function layoutsFor(kind: Kind): LayoutKey[] {
	if (kind === "child") return ["details"];
	if (kind === "single") return ["details", "side-panel"];
	return ["details", "side-panel", "quick-entry", "new-record"];
}

export interface LayoutEntry {
	id: string;
	key: LayoutKey;
	/** "Side panel", or "When doc.status == …" for a variant. */
	label: string;
	/** The button's label: "Details · when doc.status == …" for a variant. */
	title: string;
	where: string;
	badge: string;
	icon: string;
	variant?: Variant;
}

export interface LayoutUi {
	kind: ComputedRef<Kind>;
	entries: ComputedRef<LayoutEntry[]>;
	current: ComputedRef<LayoutEntry>;
	open: (entry: LayoutEntry) => void;
	/** The "Add a variant" dialog; the "Edit condition" one is the same dialog for one variant. */
	adding: Ref<boolean>;
	editing: Ref<Variant | null>;
	canReset: (id: string) => boolean;
	reset: (id: string) => void;
	remove: (id: string) => void;
}

export const LayoutUiKey: InjectionKey<LayoutUi> = Symbol("LayoutUi");

export function createLayoutUi(editor: Editor, kind: ComputedRef<Kind>): LayoutUi {
	const entryOf = (key: LayoutKey, variant?: Variant): LayoutEntry => {
		const type = LAYOUTS.find((one) => one.key === key)!.label;
		const id = variant?.id ?? key;
		return {
			id,
			key,
			label: variant ? `When ${variant.condition}` : type,
			title: variant ? `${type} · when ${variant.condition}` : type,
			where: WHERE[key],
			badge: BADGE[editor.state.source[id] ?? "none"],
			icon: ICON[key],
			variant,
		};
	};
	const entries = computed(() =>
		layoutsFor(kind.value).flatMap((key) => [
			entryOf(key),
			...editor.state.variants.filter((one) => one.key === key).map((one) => entryOf(key, one)),
		])
	);
	return {
		kind,
		entries,
		current: computed(() => entries.value.find((one) => one.id === editor.state.open) ?? entries.value[0]),
		open: (entry) => editor.openLayout(entry.key, entry.variant?.row),
		adding: ref(false),
		editing: ref(null),
		canReset: (id) => editor.canReset(id),
		reset: (id) => editor.acts.resetLayout(id),
		remove: (id) => editor.acts.deleteVariant(id),
	};
}

/** The acts a layout has, in the order every variant lists them. */
export function actsOf(ui: LayoutUi, entry: LayoutEntry) {
	const acts: { label: string; icon: string; onClick: () => void; theme?: "red" }[] = [];
	if (entry.variant) acts.push({ label: "Edit condition", icon: "lucide-pencil", onClick: () => (ui.editing.value = entry.variant!) });
	if (ui.canReset(entry.id)) acts.push({ label: "Reset to app layout", icon: "lucide-rotate-ccw", onClick: () => ui.reset(entry.id) });
	if (entry.variant) acts.push({ label: "Delete variant", icon: "lucide-trash-2", onClick: () => ui.remove(entry.id) });
	return acts;
}
