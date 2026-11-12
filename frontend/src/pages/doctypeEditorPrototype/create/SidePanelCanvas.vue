<!-- PROTOTYPE (#47097), throwaway: the Side Panel layout on the canvas, a 380px column in the
     record panel's look (record/panel/PanelSection + PanelField): the built-ins as one gray block
     nobody edits, then the layout's sections as one flat list (tabs run together), each a 42px
     header (label typed in place, chevron) over label-left rows with an inert value. Fields and
     sections select; fields drag between sections; "Add field" under each section, "Add section"
     at the end. With no sections yet ("Not set up"): an empty state pointing at the panel. -->
<template>
	<div class="mx-auto w-[380px] overflow-hidden rounded-7 border border-outline-gray-2 bg-surface-base" data-side-panel>
		<div class="px-4 py-3">
			<div class="flex items-center gap-2 rounded-6 bg-surface-gray-2 px-3 py-2.5 text-p-sm text-ink-gray-6">
				<span class="lucide-lock size-3.5 shrink-0 text-ink-gray-5" aria-hidden="true" />
				Name, quick actions and people are built in
			</div>
		</div>

		<div v-if="!sections.length" class="flex flex-col items-center gap-3 border-t border-outline-gray-1 px-6 py-10 text-center">
			<p class="text-base font-medium text-ink-gray-8">No fields on the side panel yet</p>
			<p class="text-p-sm text-ink-gray-5">Pick fields from the panel on the right. Each one shows on every record's right side.</p>
			<Button variant="subtle" size="sm" icon-right="lucide-arrow-right" label="Add a field" @click.stop="pointAtPanel" />
		</div>

		<div v-for="section in sections" :key="section.name" :data-container-key="section.name" class="border-t border-outline-gray-1" :class="{ 'ring-1 ring-inset ring-outline-gray-4': isSection(section.name!) }">
			<div class="group/section flex h-[42px] items-center gap-1.5 px-4" data-editor-select @click.stop="select(section.name!)">
				<input
					:value="section.label"
					:data-heading="section.name"
					placeholder="Untitled section"
					class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold text-ink-gray-8 placeholder:font-normal placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
					@focus="select(section.name!)"
					@input="editor.acts.setContainer(section.name!, 'label', ($event.target as HTMLInputElement).value)"
				/>
				<button type="button" class="grid size-6 shrink-0 place-items-center rounded-4 text-ink-gray-5 hover:bg-surface-gray-2" :aria-expanded="!shut.has(section.name!)" aria-label="Show or hide its fields" @click.stop="toggle(section.name!)">
					<span class="size-4" :class="shut.has(section.name!) ? 'lucide-chevron-down' : 'lucide-chevron-up'" aria-hidden="true" />
				</button>
			</div>
			<div v-show="!shut.has(section.name!)" class="flex flex-col px-4 pb-3 pt-1">
				<Draggable
					v-for="column in section.columns"
					:key="column.name"
					:model-value="column.fields"
					:item-key="(entry: any) => nameOf(entry)"
					:group="{ name: 'dte-fields' }"
					handle=".editor-field"
					class="flex flex-col gap-2.5"
					:class="{ 'min-h-8': !column.fields.length }"
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
							<div
								v-if="editor.field(nameOf(element))"
								data-editor-select
								class="editor-field -mx-1.5 grid cursor-grab grid-cols-[130px_1fr] items-center gap-2 rounded-4 px-1.5 active:cursor-grabbing"
								:class="isField(nameOf(element)) ? 'ring-1 ring-outline-gray-4' : 'hover:ring-1 hover:ring-outline-gray-2'"
								@click.stop="editor.state.selection = { kind: 'field', fieldname: nameOf(element) }"
							>
								<span class="truncate text-base text-ink-gray-5">{{ editor.field(nameOf(element))!.label || nameOf(element) }}</span>
								<span class="truncate px-1.5 py-1 text-base text-ink-gray-4">{{ sample(nameOf(element)) }}</span>
							</div>
						</div>
					</template>
				</Draggable>
				<p v-if="!section.columns.some((column) => column.fields.length)" class="pointer-events-none -mt-8 flex h-8 items-center text-p-sm text-ink-gray-4">Drop a field here</p>
				<div class="mt-2.5">
					<AddFieldPopover :section-key="section.name" @add="addTo(section, $event)" />
				</div>
			</div>
		</div>

		<div v-if="sections.length" class="border-t border-outline-gray-1 px-4 py-3">
			<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add section" @click.stop="addSection" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, reactive } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button } from "frappe-ui";
import type { LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import { nameOf } from "../editor";
import AddFieldPopover from "./AddFieldPopover.vue";

defineEmits<{ "drag-start": [event: any]; "drag-end": [event: any] }>();
const editor = inject(EditorKey)!;

// The panel is one list: every tab's sections in order.
const sections = computed(() => editor.tree.value.flatMap((tab) => tab.sections ?? []));
const shut = reactive(new Set<string>());
const toggle = (key: string) => (shut.has(key) ? shut.delete(key) : shut.add(key));

const isField = (fieldname: string) => editor.state.selection?.kind === "field" && editor.state.selection.fieldname === fieldname;
const isSection = (key: string) => editor.state.selection?.kind === "section" && editor.state.selection.key === key;
const select = (key: string) => (editor.state.selection = { kind: "section", key });

/** The empty value a reader sees before the record has one, as the panel words it. */
function sample(fieldname: string) {
	const field = editor.field(fieldname);
	return field ? `Add ${field.label || fieldname}...` : "";
}

function addTo(section: LayoutTreeSection, field: { label: string; fieldtype: string; options?: string }) {
	const column = section.columns[section.columns.length - 1];
	const fieldname = editor.acts.addLabelled(field, column.name!);
	editor.state.selection = { kind: "field", fieldname };
}

async function addSection() {
	editor.acts.addSection(editor.tree.value[editor.tree.value.length - 1]?.name);
	const all = sections.value;
	await nextTick();
	(document.querySelector(`[data-heading="${all[all.length - 1].name}"]`) as HTMLInputElement | null)?.focus();
}

function pointAtPanel() {
	document.querySelector<HTMLInputElement>("[data-unplaced-search] input")?.focus();
}
</script>

<style>
/* Panel rows sit 10px apart: the drop line centres in that gap. */
[data-side-panel] .dte-drop-line {
	margin: -6px 0 !important;
}
[data-side-panel] [data-editor-empty] > .dte-drop-line {
	margin: 15px 0 0 !important;
}
</style>
