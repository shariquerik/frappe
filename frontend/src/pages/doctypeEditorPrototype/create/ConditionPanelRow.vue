<!-- PROTOTYPE (#47100), throwaway: one rule in the panel as one line ("Always", "Is POS is on and
     Customer is set", or the code in mono), which opens the builder. ?cond= picks where it opens:
     A a 600px popover under the row, its right edge on the row's, over the canvas; B a dialog;
     C inline, under the row, inside the 380px panel. -->
<template>
	<PanelRow :label="label" :box="false" v-bind="mark">
		<!-- Every rule has its full sentence here, so two rows cut at the same word still differ. -->
		<Tooltip>
			<template v-if="sentence && !open" #content>
				<p class="max-w-[320px] whitespace-normal break-words">{{ sentence }}</p>
			</template>
			<button
				ref="button"
				type="button"
				class="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-4 px-2 text-left"
				:class="open ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
				:data-condition-row="rowKey"
				:aria-expanded="open"
				@click="toggle"
			>
				<span v-if="summary.kind === 'code'" class="lucide-code size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				<span
					class="min-w-0 flex-1 truncate"
					:class="summary.kind === 'empty' ? 'text-base text-ink-gray-5' : summary.kind === 'code' ? 'font-mono text-sm text-ink-gray-7' : 'text-base text-ink-gray-8'"
				>
					{{ summary.text }}
				</span>
				<span class="size-4 shrink-0 text-ink-gray-5" :class="variant === 'C' && open ? 'lucide-chevron-up' : 'lucide-chevron-down'" aria-hidden="true" />
			</button>
		</Tooltip>
		<Popover v-if="variant === 'A' && button" :open="open" trigger="manual" :reference="button" side="bottom" align="end" @update:open="onPopover">
			<!-- Capped at the room under the row, so a growing builder scrolls instead of flipping above it. -->
			<div class="w-[600px] overflow-y-auto" style="max-height: var(--reka-popover-content-available-height)" @keydown.esc.stop="close">
				<ConditionEditor v-bind="editorProps" surface="popover" @update:model-value="$emit('update', $event)" @done="close" />
			</div>
		</Popover>
	</PanelRow>
	<div v-if="variant === 'C' && open" class="-mx-4 border-y border-outline-gray-1 bg-surface-gray-1 px-4 py-3" data-condition-inline>
		<ConditionEditor v-bind="editorProps" surface="inline" @update:model-value="$emit('update', $event)" @done="close" />
	</div>
	<Dialog v-if="variant === 'B'" :open="open" :title="`${label} · ${subject}`" size="2xl" @update:open="open = $event">
		<ConditionEditor v-bind="editorProps" surface="dialog" @update:model-value="$emit('update', $event)" @done="close" />
	</Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Dialog, Popover, Tooltip } from "frappe-ui";
import type { ConditionField } from "@framework/ui/ConditionBuilder";
import ConditionEditor from "./ConditionEditor.vue";
import PanelRow from "./PanelRow.vue";
import { summarize, summarizeLinkFilters, type ConditionScope } from "./conditions";
import { makeRoomBelow } from "./roomBelow";

const props = defineProps<{
	label: string;
	value: string;
	kind: "condition" | "filters";
	/** "Always", "Never": what no condition means here. */
	emptyText: string;
	emptyNote: string;
	/** What the rule is on: the field's or section's label. */
	subject: string;
	rowKey: string;
	scope?: ConditionScope;
	doctype?: string;
	targetFields?: ConditionField[];
	record: ConditionField[];
	onRow?: boolean;
	/** PanelRow's Customize mark (lock, or changed with a reset). */
	mark?: Record<string, unknown>;
}>();
defineEmits<{ update: [value: string] }>();

const route = useRoute();
const variant = computed(() => (["A", "B", "C"].includes(String(route.query.cond)) ? String(route.query.cond) : "A"));
const button = ref<HTMLElement | null>(null);
const open = ref(false);

const summary = computed(() =>
	props.kind === "filters"
		? summarizeLinkFilters(props.value, props.doctype!, props.targetFields ?? [], props.record)
		: summarize(props.value, props.scope!, props.emptyText)
);
const sentence = computed(() => {
	const { kind, text } = summary.value;
	if (kind === "empty") return "";
	if (props.kind === "filters") return `${props.label}: ${text}`;
	return kind === "code" ? `${props.label} (code) ${text}` : `${props.label} ${text}`;
});

const editorProps = computed(() => ({
	key: variant.value,
	kind: props.kind,
	modelValue: props.value,
	title: props.label,
	subject: props.subject,
	emptyNote: props.emptyNote,
	scope: props.scope,
	doctype: props.doctype,
	targetFields: props.targetFields,
	record: props.record,
	onRow: props.onRow,
}));

// The popover closes on a click outside, which the row's own button is; that click must not reopen it.
let closedAt = 0;
function onPopover(next: boolean) {
	if (next) return;
	open.value = false;
	closedAt = Date.now();
}
let release = () => {};
async function toggle() {
	if (Date.now() - closedAt < 300) return;
	if (open.value) return close();
	if (variant.value === "A") release = makeRoomBelow(button.value, 560);
	open.value = true;
	// Inline (C) grows under the row; it scrolls into view.
	if (variant.value === "C") {
		await nextTick();
		(document.querySelector("[data-condition-inline]") as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
	}
}
function close() {
	open.value = false;
	button.value?.focus();
}
watch(open, (next) => !next && (release(), (release = () => {})));
// Another field selected: the builder belongs to the old one.
watch(
	() => props.rowKey,
	() => (open.value = false)
);
</script>
