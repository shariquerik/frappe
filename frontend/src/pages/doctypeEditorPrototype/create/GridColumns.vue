<!-- PROTOTYPE (#47099), throwaway: which of the child's fields the grid shows (`in_list_view`) and
     how wide (`columns`, 1 to 10; Auto is the type's width). A bar sets the columns' widths against
     the form's: past its edge the grid scrolls sideways (no column limit since d0f94ba3c6). Columns
     keep the child's field order, so a drag moves the field. In Customize, a change on a standard
     child is a site change on it, marked like the others. -->
<template>
	<PanelSection :label="label" :divided="divided">
		<template #actions
			><span class="text-sm text-ink-gray-4">{{ columns.length }}</span></template
		>
		<div class="flex flex-col gap-1.5" data-grid-fit>
			<div class="relative h-2">
				<div class="flex h-full gap-0.5 overflow-hidden rounded-full bg-surface-gray-2">
					<div
						v-for="one in columns"
						:key="one.fieldname"
						class="h-full min-w-0"
						:class="isFocused(one.fieldname) ? 'bg-surface-gray-7' : 'bg-surface-gray-5'"
						:style="{ flex: `${columnPx(one)} 1 0` }"
					/>
					<!-- The form's room the columns leave free. -->
					<div v-if="!fit.over && columns.length" :style="{ flex: `${fit.room - fit.used} 1 0` }" />
				</div>
				<!-- Wider than the form: the columns fill the bar, the part past the form's edge (the grid
				     scrolls it into view) is a lighter shade, and a thin mark taller than the bar is the edge. -->
				<template v-if="fit.over">
					<div class="absolute inset-y-0 right-0 rounded-r-full bg-surface-base opacity-60" :style="{ left: edge }" />
					<div class="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-surface-gray-9" :style="{ left: edge }" aria-label="The form's edge" data-form-edge />
				</template>
			</div>
			<p class="text-p-sm text-ink-gray-5">
				<template v-if="!columns.length">No columns. On save, its first 4 required fields become columns.</template>
				<template v-else-if="fit.over">Wider than the form: the grid scrolls sideways to show {{ lastLabel }}.</template>
				<template v-else>Fits the form's width.</template>
			</p>
			<!-- A shared child's grid is the same in every parent: a change here shows there too. -->
			<p v-if="note" class="text-p-sm text-ink-gray-5" data-shared-child>{{ note }}</p>
		</div>
		<Draggable
			:model-value="columns"
			item-key="fieldname"
			handle=".grid-col-handle"
			:animation="120"
			class="-mx-2 flex flex-col"
			ghost-class="opacity-40"
			@end="onMove"
		>
			<template #item="{ element: one }">
				<div
					class="group/col flex h-8 items-center gap-1 rounded-4 pl-1 pr-0.5 hover:bg-surface-gray-2"
					:class="{ 'bg-surface-gray-2': isFocused(one.fieldname) }"
					:data-grid-column="one.fieldname"
				>
					<span class="grid-col-handle lucide-grip-vertical size-4 shrink-0 cursor-grab text-ink-gray-4" aria-hidden="true" />
					<button type="button" class="flex h-8 min-w-0 flex-1 items-center gap-1.5 text-left" @click="$emit('open', one.fieldname)">
						<span class="min-w-0 truncate text-base text-ink-gray-8">{{ one.label || one.fieldname }}</span>
						<Badge v-if="isCustom(one.fieldname)" label="Custom" theme="gray" size="sm" class="shrink-0" />
						<span
							v-if="changed(one.fieldname)"
							class="size-1.5 shrink-0 rounded-full bg-surface-gray-7"
							aria-label="Changed on this site"
						/>
					</button>
					<div class="flex shrink-0 items-center rounded-4 bg-surface-gray-2 group-hover/col:bg-surface-gray-3" :data-width="one.fieldname">
						<button
							type="button"
							class="grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:text-ink-gray-9 disabled:text-ink-gray-3"
							:disabled="!width(one)"
							aria-label="Narrower"
							@click="step(one, -1)"
						>
							<span class="lucide-minus size-3.5" aria-hidden="true" />
						</button>
						<Tooltip :text="`${columnPx(one)}px in the grid`">
							<span class="w-9 text-center text-sm tabular-nums text-ink-gray-8">{{ width(one) || "Auto" }}</span>
						</Tooltip>
						<button
							type="button"
							class="grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:text-ink-gray-9 disabled:text-ink-gray-3"
							:disabled="width(one) >= 10"
							aria-label="Wider"
							@click="step(one, 1)"
						>
							<span class="lucide-plus size-3.5" aria-hidden="true" />
						</button>
					</div>
					<Tooltip text="Take off the grid">
						<button
							type="button"
							class="grid size-6 shrink-0 place-items-center rounded-4 text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-8"
							aria-label="Take off the grid"
							@click="remove(one)"
						>
							<span class="lucide-x size-3.5" aria-hidden="true" />
						</button>
					</Tooltip>
				</div>
			</template>
		</Draggable>
		<div class="flex items-center gap-2">
			<AddColumnMenu :child="child" :table="table">
				<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add column" />
			</AddColumnMenu>
		</div>
	</PanelSection>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Badge, Button, Tooltip } from "frappe-ui";
import type { EditorField } from "../editor";
import AddColumnMenu from "./AddColumnMenu.vue";
import PanelSection from "./PanelSection.vue";
import { ChildUiKey, columnPx, FORM_PX, GRID_FIXED_PX, gridFit, type ChildTable } from "./childTables";

const props = withDefaults(defineProps<{ child: ChildTable; table: string; label?: string; divided?: boolean }>(), {
	label: "Grid columns",
	divided: true,
});
defineEmits<{ open: [fieldname: string] }>();
const ui = inject(ChildUiKey)!;

const columns = computed(() => ui.columns(props.child));
const fit = computed(() => gridFit(columns.value));
// The bar's full width is the larger of the form's room and the grid's columns.
const scale = computed(() => Math.max(FORM_PX - GRID_FIXED_PX, fit.value.used));
const edge = computed(() => `${(fit.value.room / scale.value) * 100}%`);
const lastLabel = computed(() => {
	const last = columns.value[columns.value.length - 1];
	return last?.label || last?.fieldname || "";
});
const mode = computed(() => props.child.editor.state.mode);
const width = (one: EditorField) => Number((one as any).columns) || 0;
const isFocused = (fieldname: string) => ui.focus?.fieldname === fieldname && ui.focus.table === props.table;
const isCustom = (fieldname: string) => mode.value === "customize" && Boolean(props.child.customize?.isCustom(fieldname));
const changed = (fieldname: string) =>
	mode.value === "customize" && Boolean(props.child.customize?.changed(fieldname).some((prop) => prop === "in_list_view" || prop === "columns"));

// A shared child's grid is the same in every parent; a site change on it says so.
const note = computed(() => {
	const others = props.child.alsoIn;
	if (others.length)
		return `Shared: the same grid shows in ${others.slice(0, 2).join(", ")}${others.length > 2 ? ` and ${others.length - 2} more` : ""}.`;
	return "";
});

function step(one: EditorField, by: number) {
	props.child.editor.acts.setField(one.fieldname, "columns", Math.max(0, Math.min(10, width(one) + by)));
}
function remove(one: EditorField) {
	props.child.editor.acts.setField(one.fieldname, "in_list_view", 0);
}
function onMove(event: { oldIndex: number; newIndex: number }) {
	if (event.oldIndex === event.newIndex) return;
	const one = columns.value[event.oldIndex];
	ui.moveColumn(props.child, one.fieldname, event.newIndex);
}
</script>
