<!-- PROTOTYPE (#45867): the Editor tab, in the look of CRM's Forms builder (EditorCanvas).
     Sections are gray boxes with a title, a field count and a ⋯ menu; columns are dashed boxes
     of field rows, each ending in "Add field". Drag a row by its grip, a section by its own. -->
<template>
	<div class="flex flex-col gap-3" :class="editor.state.dragging && 'select-none'">
		<template v-for="tab in editor.tree.value" :key="tab.name">
			<Draggable
				:model-value="tab.sections"
				item-key="name"
				handle=".section-handle"
				:group="{ name: 'dte-sections' }"
				class="flex flex-col gap-3"
				ghost-class="opacity-40"
				:data-parent-key="tab.name"
				:animation="120"
				@start="editor.state.dragging = 'section'"
				@end="onDrop(editor, $event)"
			>
				<template #item="{ element: section }">
					<div :data-container-key="section.name" class="flex flex-col gap-1.5 rounded-4 bg-surface-gray-2 p-2.5">
						<div class="flex h-7 items-center justify-between gap-2">
							<div class="flex min-w-0 flex-1 items-center gap-2 text-base-medium text-ink-gray-9">
								<span class="lucide-grip-vertical section-handle h-3.5 shrink-0 cursor-grab text-ink-gray-3" aria-hidden="true" />
								<input
									v-if="renaming === section.name"
									:ref="(el) => el && (el as HTMLInputElement).focus()"
									:value="section.label"
									placeholder="Section title"
									class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base-medium text-ink-gray-9 placeholder:font-normal placeholder:italic placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
									@input="editor.acts.setContainer(section.name, 'label', ($event.target as HTMLInputElement).value)"
									@blur="renaming = null"
									@keydown.enter="renaming = null"
								/>
								<span v-else class="cursor-text truncate" :class="!section.label && 'italic text-ink-gray-4'" @click="renaming = section.name">
									{{ section.label || "Section title" }}
								</span>
							</div>
							<div class="flex shrink-0 items-center gap-1.5">
								<span v-if="count(section)" class="rounded-4 bg-surface-gray-3 px-1.5 py-0.5 text-xs leading-none text-ink-gray-4">
									{{ count(section) }} {{ count(section) === 1 ? "field" : "fields" }}
								</span>
								<Dropdown :options="sectionMenu(section)" side="bottom" align="end">
									<Button variant="ghost" icon="lucide-ellipsis" label="Section menu" />
								</Dropdown>
							</div>
						</div>
						<div class="flex gap-2">
							<div
								v-for="column in section.columns"
								:key="column.name"
								class="flex min-w-0 flex-1 flex-col gap-1.5 rounded-4 border border-dashed border-outline-gray-2 bg-surface-elevation-2 p-2"
							>
								<Draggable
									:model-value="column.fields"
									:item-key="(entry: string) => entry"
									handle=".drag-handle"
									:group="{ name: 'dte-fields' }"
									class="flex min-h-[34px] min-w-0 flex-col gap-1.5"
									ghost-class="opacity-40"
									:data-column-key="column.name"
									:animation="120"
									@start="editor.state.dragging = 'field'"
									@end="onDrop(editor, $event)"
								>
									<template #item="{ element }">
										<div :data-fieldname="nameOf(element)">
											<FieldRow v-if="editor.field(nameOf(element))" :field="editor.field(nameOf(element))!" />
										</div>
									</template>
								</Draggable>
								<NewFieldRow v-if="ui.adding.value === column.name" :column="column.name" />
								<Button
									v-else
									class="!h-8 w-full !bg-surface-elevation-2"
									variant="outline"
									label="Add field"
									icon-left="lucide-plus"
									@click="startAdding(column.name)"
								/>
							</div>
						</div>
					</div>
				</template>
			</Draggable>
		</template>

		<Button class="!h-8 w-full" variant="subtle" label="Add section" icon-left="lucide-plus" @click="addSection" />
	</div>
</template>

<script setup lang="ts">
import { inject, ref } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button, Dropdown } from "frappe-ui";
import type { LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import { nameOf } from "../editor";
import FieldRow from "./FieldRow.vue";
import NewFieldRow from "./NewFieldRow.vue";
import { DraftUiKey } from "./draftUi";

const MAX_COLUMNS = 3;

const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;

const renaming = ref<string | null>(null);

const count = (section: LayoutTreeSection) => section.columns.reduce((total, column) => total + column.fields.length, 0);

function startAdding(column: string) {
	ui.expanded.value = null;
	ui.adding.value = column;
}

function addSection() {
	editor.acts.addSection();
	const sections = editor.tree.value[0].sections;
	renaming.value = sections[sections.length - 1].name!;
	editor.state.selection = null;
}

function sectionMenu(section: LayoutTreeSection) {
	const key = section.name!;
	return [
		{
			group: "Section",
			hideLabel: true,
			options: [
				{ label: "Rename", icon: "lucide-pencil", onClick: () => (renaming.value = key) },
				{ label: "Add column", icon: "lucide-columns-2", onClick: () => editor.acts.addColumn(key), condition: () => section.columns.length < MAX_COLUMNS },
				{
					label: "Remove last column",
					icon: "lucide-panel-right-close",
					onClick: () => removeLastColumn(section),
					condition: () => section.columns.length > 1,
				},
			],
		},
		{
			group: "Remove",
			hideLabel: true,
			options: [
				{
					label: "Remove section",
					icon: "lucide-trash-2",
					theme: "red",
					onClick: () => removeSection(section),
					condition: () => editor.tree.value.flatMap((tab) => tab.sections).length > 1,
				},
			],
		},
	];
}

/** A removed column's fields move to the column before it, so nothing is lost. */
function removeLastColumn(section: LayoutTreeSection) {
	const last = section.columns[section.columns.length - 1];
	section.columns[section.columns.length - 2].fields.push(...last.fields);
	editor.acts.removeContainer(last.name!);
}

/** A removed section's fields move to the section before it (or after, for the first). */
function removeSection(section: LayoutTreeSection) {
	const sections = editor.tree.value.flatMap((tab) => tab.sections);
	const index = sections.indexOf(section);
	const into = sections[index - 1] ?? sections[index + 1];
	if (into) into.columns[into.columns.length - 1].fields.push(...section.columns.flatMap((column) => column.fields));
	editor.acts.removeContainer(section.name!);
}
</script>
