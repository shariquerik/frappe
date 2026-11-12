// PROTOTYPE (#47097), throwaway: the layouts a saved DocType has, as the layout crumb's menu
// lists them, and the acts on the one that is open. Nothing is written; Save stays a toast.
// Round 2: the acts live in that menu, under the rows, for the open layout only.
// #47098: a conditional layout has its own title; "Add layout…" and "Delete layout" replace the
// variant words; the new menu shows the source as short gray text (SOURCE), ?menu=old keeps the pills.
import { computed, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import type { Editor, LayoutKey, Source, Variant } from "../editor";
import { LAYOUTS } from "../editor";
import type { Kind } from "./newDoctype";

export const WHERE: Record<LayoutKey, string> = {
	details: "Shows in the record page's main column",
	"side-panel": "Shows on the record page's right side",
	"quick-entry": "Shows in the Create dialog",
	"new-record": "Shows on a new record's page until its first save",
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

/** #47098: the new menu's source column: plain gray text, no pill. */
export const SOURCE: Record<Source, string> = {
	app: "App",
	site: "Site",
	fallback: "From fields",
	none: "Not set up",
	details: "From Details",
};

/** PROTOTYPE: no conditional row exists on this site, so these DocTypes get a made-up one. */
export const FAKE_VARIANTS: Record<string, { key: LayoutKey; condition: string; title: string }> = {
	Contact: { key: "details", condition: 'doc.status == "Passive"', title: "Passive contacts" },
	"CRM Lead": { key: "details", condition: 'doc.status == "Junk"', title: "Junk leads" },
	// The owner's #47098 shot: a Passive layout added on Sales Invoice.
	"Sales Invoice": { key: "details", condition: 'doc.status == "Passive"', title: "Passive invoices" },
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
	/** #47098: the crumb and the menu's row: the type ("Side panel"), or a variant's own title. */
	name: string;
	where: string;
	badge: string;
	/** #47098: the source as the new menu shows it: "App", "Site", "From fields", "Not set up". */
	source: string;
	icon: string;
	variant?: Variant;
}

export interface LayoutUi {
	kind: ComputedRef<Kind>;
	entries: ComputedRef<LayoutEntry[]>;
	current: ComputedRef<LayoutEntry>;
	open: (entry: LayoutEntry) => void;
	/** The "Add a layout" dialog; "Edit condition" and "Rename" are the same dialog for one variant. */
	adding: Ref<boolean>;
	editing: Ref<Variant | null>;
	renaming: Ref<Variant | null>;
	canReset: (id: string) => boolean;
	reset: (id: string) => void;
	remove: (id: string) => void;
}

export const LayoutUiKey: InjectionKey<LayoutUi> = Symbol("LayoutUi");

export function createLayoutUi(editor: Editor, kind: ComputedRef<Kind>): LayoutUi {
	const entryOf = (key: LayoutKey, variant?: Variant): LayoutEntry => {
		const type = LAYOUTS.find((one) => one.key === key)!.label;
		const id = variant?.id ?? key;
		const source = editor.state.source[id] ?? "none";
		return {
			id,
			key,
			// A site's own conditional row has no title yet: its condition names it.
			name: variant ? variant.title || `When ${variant.condition}` : type,
			where: WHERE[key],
			badge: BADGE[source],
			source: SOURCE[source],
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
		renaming: ref(null),
		canReset: (id) => editor.canReset(id),
		reset: (id) => editor.acts.resetLayout(id),
		remove: (id) => editor.acts.deleteVariant(id),
	};
}

export interface LayoutAct {
	label: string;
	icon: string;
	danger?: boolean;
	onClick: () => void;
}

/** The acts a layout has, in the order every layout lists them. */
export function actsOf(ui: LayoutUi, entry: LayoutEntry) {
	const acts: LayoutAct[] = [];
	if (entry.variant) acts.push({ label: "Rename…", icon: "lucide-type", onClick: () => (ui.renaming.value = entry.variant!) });
	if (entry.variant) acts.push({ label: "Edit condition…", icon: "lucide-pencil", onClick: () => (ui.editing.value = entry.variant!) });
	if (ui.canReset(entry.id)) acts.push({ label: "Reset to app layout", icon: "lucide-rotate-ccw", onClick: () => ui.reset(entry.id) });
	if (entry.variant) acts.push({ label: "Delete layout", icon: "lucide-trash-2", danger: true, onClick: () => ui.remove(entry.id) });
	return acts;
}
