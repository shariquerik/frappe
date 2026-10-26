// PROTOTYPE: search over every pane, block and field. The field labels come from each bound
// doctype's meta, read once when the search box is first focused.

import { computed, effectScope, ref, shallowRef, type ComputedRef } from "vue";
import { useDoctypeMeta } from "@framework/ui/composables/useDoctypeMeta";
import type { RawMetaField } from "@framework/ui/components/FormLayout/types";
import { GROUPS, type BlockSpec, type PaneGroup, type PaneSpec } from "./panes";
import { dataFields } from "./rows";

export interface SearchHit {
	prefix: string;
	appLabel: string;
	pane: PaneSpec;
	block?: BlockSpec;
	fieldname?: string;
	title: string;
	path: string;
}

/** The field a search result asked for; the pane scrolls to it and flashes it. */
export const searchTarget = ref<{
	prefix: string;
	pane: string;
	block?: string;
	fieldname?: string;
} | null>(null);

const metas = shallowRef<Record<string, ComputedRef<RawMetaField[]>>>({});
let started = false;

/** Reads every bound doctype's meta; a no-op after the first call. */
export function warmIndex() {
	if (started) return;
	started = true;
	const doctypes = new Set(
		GROUPS.flatMap((group) =>
			group.panes.flatMap((pane) =>
				pane.blocks.flatMap((block) => [
					...(block.binding ? [block.binding.doctype] : []),
					...Object.values(block.bindings ?? {}).map((spec) => spec.doctype),
				])
			)
		)
	);
	effectScope(true).run(() => {
		const entries: Record<string, ComputedRef<RawMetaField[]>> = {};
		for (const doctype of doctypes) {
			const { meta } = useDoctypeMeta(doctype);
			entries[doctype] = computed(() => (meta.value?.fields ?? []) as RawMetaField[]);
		}
		metas.value = entries;
	});
}

export function search(query: string, groups: PaneGroup[]): SearchHit[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const matches = (...texts: (string | undefined)[]) =>
		texts.some((text) => text?.toLowerCase().includes(needle));

	return groups.flatMap((group) =>
		group.panes.flatMap((pane) => {
			const appLabel = GROUPS.find((other) => other.prefix === group.prefix)!.label;
			const base = { prefix: group.prefix, appLabel, pane };
			const hits: SearchHit[] = [];
			const paneMatched = matches(pane.label, pane.description);
			if (paneMatched) hits.push({ ...base, title: pane.label, path: appLabel });
			for (const block of pane.blocks) {
				const where = block.label ? `${pane.label} › ${block.label}` : pane.label;
				if (block.label && matches(block.label, block.description, ...(block.keywords ?? [])))
					hits.push({ ...base, block, title: block.label, path: pane.label });
				// A block with no heading reads as its pane, so it only stands in when the pane did not match.
				else if (!block.label && !paneMatched && matches(...(block.keywords ?? [])))
					hits.push({ ...base, block, title: pane.label, path: appLabel });
				for (const field of fieldsOf(block)) {
					if (matches(field.label, field.description))
						hits.push({
							...base,
							block,
							fieldname: field.fieldname,
							title: field.label ?? field.fieldname,
							path: where,
						});
				}
			}
			return hits;
		})
	);
}

function fieldsOf(block: BlockSpec): RawMetaField[] {
	if (!block.binding) return [];
	const meta = metas.value[block.binding.doctype]?.value ?? [];
	const names = block.fields?.length ? block.fields : dataFields(meta);
	const byName = new Map(meta.map((field) => [field.fieldname, field]));
	return names.map((name) => byName.get(name)).filter((field): field is RawMetaField => !!field);
}

/** The rounded layer a search pick flashes, a little wider than its row and behind its content. */
export const FLASH =
	"pointer-events-none absolute -inset-x-3 inset-y-1 -z-10 rounded-4 bg-surface-gray-3 opacity-0";

/** The same layer around a pane's title, which has no divider to keep clear of. */
export const TITLE_FLASH =
	"pointer-events-none absolute -inset-x-3 -inset-y-2 -z-10 rounded-4 bg-surface-gray-3 opacity-0";

/** Fades an element's own flash layer in and out. */
export function flash(element: Element | null | undefined) {
	element
		?.querySelector(":scope > [data-flash]")
		?.animate(
			[{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
			{ duration: 2000, easing: "ease-out" }
		);
}
