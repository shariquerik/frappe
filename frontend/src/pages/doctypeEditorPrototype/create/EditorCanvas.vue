<!-- PROTOTYPE (#45867): the new DocType's form as a record page draws it, one size up, in the look
     of frappe/crm#3419's EditorCanvas: sections 40px apart with the heading typed in place, columns
     as full-height drop zones, "Add field" under each section, "Add section" under a rule. -->
<template>
	<Draggable
		v-for="tab in editor.tree.value"
		:key="tab.name"
		:model-value="tab.sections"
		item-key="name"
		handle=".section-handle"
		:group="{ name: 'dte-sections' }"
		class="flex flex-col gap-10"
		ghost-class="opacity-40"
		:data-parent-key="tab.name"
		:animation="120"
		@start="editor.state.dragging = 'section'"
		@end="onDrop(editor, $event)"
	>
		<template #item="{ element: section }">
			<div :data-container-key="section.name" class="relative">
				<div class="relative -m-4 rounded-7 p-4" :class="{ 'ring-1 ring-outline-gray-4': isSection(section.name) }">
					<div class="group/section relative mb-5 flex h-6 items-center">
						<input
							:value="section.label"
							data-editor-select
							:data-heading="section.name"
							placeholder="Untitled section"
							class="min-w-0 flex-1 border-0 bg-transparent p-0 text-lg font-semibold text-ink-gray-9 placeholder:font-normal placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
							@focus="selectSection(section.name)"
							@click.stop="selectSection(section.name)"
							@input="editor.acts.setContainer(section.name, 'label', ($event.target as HTMLInputElement).value)"
						/>
						<span
							class="section-handle flex size-6 shrink-0 cursor-grab items-center justify-center text-ink-gray-4 opacity-0 transition-opacity hover:text-ink-gray-7 group-hover/section:opacity-100"
							:class="{ '!opacity-100': isSection(section.name) }"
							title="Drag to move the section"
						>
							<span class="lucide-grip-vertical size-4" aria-hidden="true" />
						</span>
					</div>
					<div class="grid gap-x-8" :style="{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(0,1fr))` }">
						<div v-for="column in section.columns" :key="column.name" class="relative flex min-w-0 flex-col">
							<Draggable
								:model-value="column.fields"
								:item-key="(entry: any) => nameOf(entry)"
								:group="{ name: 'dte-fields' }"
								handle=".editor-field"
								class="flex min-w-0 flex-1 flex-col gap-6 pb-4"
								:class="{ 'min-h-[60px]': !column.fields.length }"
								:data-column-key="column.name"
								:data-editor-empty="!column.fields.length || null"
								ghost-class="dte-drop-line"
								:force-fallback="true"
								:fallback-on-body="false"
								fallback-class="dte-drag-fallback"
								:animation="120"
								@start="$emit('drag-start', $event)"
								@end="$emit('drag-end', $event)"
							>
								<template #item="{ element }">
									<div :data-fieldname="nameOf(element)">
										<EditorField
											v-if="editor.field(nameOf(element))"
											:field="editor.field(nameOf(element))!"
											:selected="isField(nameOf(element))"
											@click.stop="editor.state.selection = { kind: 'field', fieldname: nameOf(element) }"
										/>
									</div>
								</template>
							</Draggable>
							<div
								v-if="!column.fields.length"
								class="pointer-events-none absolute inset-x-0 top-0 flex h-[60px] items-center justify-center rounded-4 border border-dashed border-outline-gray-2 text-base text-ink-gray-4"
							>
								Drop a field here
							</div>
						</div>
					</div>
					<AddFieldPopover @add="addToSection(section, $event)" />
				</div>
			</div>
		</template>
	</Draggable>

	<div class="mt-10 flex border-t border-outline-gray-1 pt-4">
		<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add section" @click.stop="addSection" />
	</div>
</template>

<script setup lang="ts">
import { inject, nextTick } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button } from "frappe-ui";
import type { LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import { nameOf } from "../editor";
import AddFieldPopover from "./AddFieldPopover.vue";
import EditorField from "./EditorField.vue";

defineEmits<{ "drag-start": [event: any]; "drag-end": [event: any] }>();
const editor = inject(EditorKey)!;

const isField = (fieldname: string) => editor.state.selection?.kind === "field" && editor.state.selection.fieldname === fieldname;
const isSection = (key: string) => editor.state.selection?.kind === "section" && editor.state.selection.key === key;
const selectSection = (key: string) => (editor.state.selection = { kind: "section", key });

/** A field enters after the selected one in this section, else at the end of its shortest column. */
function addToSection(section: LayoutTreeSection, field: { label: string; fieldtype: string; options?: string }) {
	const selected = editor.state.selection?.kind === "field" ? editor.state.selection.fieldname : null;
	const holder = selected ? section.columns.find((column) => column.fields.some((entry) => nameOf(entry) === selected)) : undefined;
	const column = holder ?? [...section.columns].sort((a, b) => a.fields.length - b.fields.length)[0];
	const index = holder ? holder.fields.findIndex((entry) => nameOf(entry) === selected) + 1 : undefined;
	const fieldname = editor.acts.addLabelled(field, column.name!, index);
	editor.state.selection = { kind: "field", fieldname };
}

async function addSection() {
	editor.acts.addSection();
	const sections = editor.tree.value[0].sections;
	const key = sections[sections.length - 1].name!;
	await nextTick();
	(document.querySelector(`[data-heading="${key}"]`) as HTMLInputElement | null)?.focus();
}
</script>

<style>
/* Sortable's floating clone stays hidden: DragLayer draws the preview card instead. */
.dte-drag-fallback {
	opacity: 0 !important;
}
/* Sortable's ghost is drawn as a 2px line centred in the 24px field gap. */
.dte-drop-line {
	height: 2px !important;
	min-height: 0 !important;
	margin: -13px 0 !important;
	padding: 0 !important;
	border: 0 !important;
	border-radius: 1px;
	overflow: hidden;
	box-shadow: none !important;
	background-color: var(--outline-gray-4) !important;
	opacity: 1 !important;
}
[data-editor-empty] > .dte-drop-line {
	margin: 29px 0 0 !important;
}
/* The line crosses the empty box's middle, so its text steps aside. */
[data-editor-empty]:has(> .dte-drop-line) + div {
	color: transparent;
}
.dte-drop-line > * {
	display: none !important;
}
</style>
