<!-- PROTOTYPE (#47099), throwaway: a Table field on the canvas, drawn as the record page's grid
     (Grid.vue: checkbox, row number, the child's in_list_view columns, row menu) with one empty
     row. Each column is as wide as its `columns` asks (v1's pixel map), growing with the form; past
     the form's width the grid scrolls, as on the record page. ?child=A makes it the place to edit
     the child: a click on a column opens that field in the panel, and the last header cell adds one. -->
<template>
	<div v-if="!child" class="flex h-20 items-center justify-center rounded-4 border border-dashed border-outline-gray-2 text-base text-ink-gray-5">
		{{ field.options ? `Loading ${field.options}…` : "Choose its child table in the panel" }}
	</div>
	<div v-else class="flex flex-col gap-2" :data-canvas-grid="field.fieldname">
		<div class="relative overflow-hidden rounded-4 border border-outline-gray-2">
			<div class="overflow-x-auto [scrollbar-width:none]">
				<div class="grid text-sm" :style="{ gridTemplateColumns: tracks, minWidth: `${minWidth}px` }">
					<!-- Header -->
					<div class="sticky left-0 z-10 flex h-9 items-center justify-center border-r border-outline-gray-2 bg-surface-gray-2">
						<span class="size-3.5 rounded-2 border border-outline-gray-3 bg-surface-white" aria-hidden="true" />
					</div>
					<div
						class="sticky left-10 z-10 flex h-9 items-center justify-center border-r border-outline-gray-2 bg-surface-gray-2 text-ink-gray-5"
					>
						#
					</div>
					<component
						:is="editable ? 'button' : 'div'"
						v-for="(one, i) in columns"
						:key="one.fieldname"
						v-bind="editable ? { type: 'button' } : {}"
						class="flex h-9 min-w-0 items-center gap-0.5 bg-surface-gray-2 px-2 text-ink-gray-5"
						:class="[
							i < columns.length - 1 && 'border-r border-outline-gray-2',
							RIGHT.has(one.fieldtype) && 'justify-end',
							editable && 'hover:bg-surface-gray-3 hover:text-ink-gray-8',
							isOpen(one.fieldname) && '!bg-surface-gray-3 !text-ink-gray-9',
						]"
						:data-grid-header="one.fieldname"
						@click.stop="editable && openColumn(one.fieldname)"
					>
						<span class="truncate">{{ one.label || one.fieldname }}</span>
						<span v-if="one.reqd" class="text-ink-red-5">*</span>
					</component>
					<div v-if="!columns.length" class="h-9 bg-surface-gray-2" />
					<div class="sticky right-0 z-10 flex h-9 items-center justify-center border-l border-outline-gray-2 bg-surface-gray-2">
						<AddColumnMenu v-if="editable" :child="child" :table="field.fieldname" align="end">
							<Tooltip text="Add column">
								<button
									type="button"
									class="grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:bg-surface-gray-4 hover:text-ink-gray-9"
									aria-label="Add column"
								>
									<span class="lucide-plus size-4" aria-hidden="true" />
								</button>
							</Tooltip>
						</AddColumnMenu>
					</div>
					<!-- One empty row -->
					<div class="sticky left-0 z-10 flex h-9 items-center justify-center border-r border-t border-outline-gray-2 bg-surface-base">
						<span class="size-3.5 rounded-2 border border-outline-gray-3" aria-hidden="true" />
					</div>
					<div
						class="sticky left-10 z-10 flex h-9 items-center justify-center border-r border-t border-outline-gray-2 bg-surface-base text-ink-gray-7"
					>
						1
					</div>
					<div
						v-for="(one, i) in columns"
						:key="one.fieldname"
						class="h-9 border-t border-outline-gray-2"
						:class="[i < columns.length - 1 && 'border-r', isOpen(one.fieldname) && 'bg-surface-gray-2']"
					/>
					<div v-if="!columns.length" class="flex h-9 items-center border-t border-outline-gray-2 px-2 text-ink-gray-5">
						{{ editable ? "No columns yet. Add one with +." : "No columns yet" }}
					</div>
					<div
						class="sticky right-0 z-10 flex h-9 items-center justify-center border-l border-t border-outline-gray-2 bg-surface-base text-ink-gray-5"
					>
						<span class="lucide-ellipsis size-4" aria-hidden="true" />
					</div>
				</div>
			</div>
			<!-- Past the form's width the grid scrolls: a fade at the right edge says so. -->
			<div
				v-if="fit.over"
				class="pointer-events-none absolute inset-y-0 right-10 z-10 w-10 bg-gradient-to-l from-surface-base to-transparent"
			/>
		</div>
		<div class="flex">
			<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add Row" inert tabindex="-1" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, watchEffect } from "vue";
import { Button, Tooltip } from "frappe-ui";
import { EditorKey } from "../context";
import type { EditorField } from "../editor";
import AddColumnMenu from "./AddColumnMenu.vue";
import { ChildUiKey, columnPx, gridFit } from "./childTables";

const RIGHT = new Set(["Int", "Float", "Currency", "Percent"]);
// `own`: drawn in the child's own editor, where a column click selects that field there.
const props = defineProps<{ field: EditorField; own?: boolean }>();
const ui = inject(ChildUiKey)!;
const editor = inject(EditorKey)!;
watchEffect(() => props.field.options && void ui.ensure(props.field.options));
const child = computed(() => ui.get(props.field.options));
const editable = computed(() => props.own || ui.variant === "A");
const columns = computed(() => (child.value ? ui.columns(child.value) : []));
const fit = computed(() => gridFit(columns.value));

// Checkbox, # and the row menu are 40px; a column is its pixel width at least, and grows in proportion.
const tracks = computed(() =>
	[
		"40px",
		"40px",
		...columns.value.map((one) => `minmax(${columnPx(one)}px, ${columnPx(one)}fr)`),
		columns.value.length ? "40px" : "1fr 40px",
	].join(" ")
);
const minWidth = computed(() => 120 + fit.value.used);

const isOpen = (fieldname: string) =>
	props.own
		? editor.state.selection?.kind === "field" && editor.state.selection.fieldname === fieldname
		: ui.focus?.table === props.field.fieldname && ui.focus.fieldname === fieldname;
function openColumn(fieldname: string) {
	if (props.own) return void (editor.state.selection = { kind: "field", fieldname });
	editor.state.selection = { kind: "field", fieldname: props.field.fieldname };
	ui.focus = { table: props.field.fieldname, fieldname };
}
</script>
