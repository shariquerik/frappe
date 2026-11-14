<!-- PROTOTYPE (#45867): the new DocType's form as a record page draws it, one size up, in the look
     of frappe/crm#3419's EditorCanvas: sections 40px apart with the heading typed in place, columns
     as full-height drop zones, "Add field" under each section, "Add section" under a rule. -->
<template>
	<!-- The rule spans the form's width; the tabs step 8px left so the first label sits on its edge.
	     Many tabs (a big DocType's) scroll sideways on one line, labels unbroken (#47095). -->
	<div v-if="editor.tree.value.length > 1" class="mb-10 border-b border-outline-gray-1">
		<div class="-mb-px -ml-2 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
		<button
			v-for="tab in editor.tree.value"
			:key="tab.name"
			type="button"
			data-editor-select
			:data-tab-key="tab.name"
			class="relative flex h-9 shrink-0 items-center whitespace-nowrap rounded-t-4 px-2 text-base transition-colors"
			:class="[
				tab.name === shown?.name ? 'font-medium text-ink-gray-9' : 'text-ink-gray-5 hover:text-ink-gray-7',
				editor.state.dropTab === tab.name && 'bg-surface-gray-2 text-ink-gray-9',
				isTab(tab.name!) && 'bg-surface-gray-2',
			]"
			@click.stop="openTab(tab.name!)"
		>
			<!-- #47433 ruling 3: an unlabelled first tab reads "Details", in gray like a placeholder. -->
			<span v-if="tab.label">{{ tab.label }}</span>
			<span v-else class="text-ink-gray-4">Details</span>
			<span v-if="tab.name === shown?.name" class="absolute inset-x-2 bottom-0 h-px bg-surface-gray-7" aria-hidden="true" />
		</button>
		<Tooltip text="Add tab">
			<Button variant="ghost" size="sm" icon="lucide-plus" label="Add tab" class="ml-1 shrink-0" @click.stop="addTab" />
		</Tooltip>
		</div>
	</div>
	<Draggable
		v-for="tab in shown ? [shown] : []"
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
				<!-- #47434: while one of its columns is ringed, the section's ring steps aside (the two would share an edge). -->
				<div class="relative -m-4 rounded-7 p-4" :class="{ 'ring-1 ring-outline-gray-4': isSection(section.name) && !ringsColumnOf(section) }">
					<div class="group/section relative flex h-6 items-center" :class="real ? 'mb-6' : 'mb-5'">
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
						<ConditionMark class="mr-1" :rules="[{ label: 'Visible if', value: section.dependsOn }, { label: 'Starts open if', value: section.collapsibleDependsOn }]" />
						<span
							class="section-handle flex size-6 shrink-0 cursor-grab items-center justify-center text-ink-gray-4 opacity-0 transition-opacity hover:text-ink-gray-7 group-hover/section:opacity-100"
							:class="{ '!opacity-100': isSection(section.name) }"
							title="Drag to move the section"
						>
							<span class="lucide-grip-vertical size-4" aria-hidden="true" />
						</span>
					</div>
					<!-- #47434: the columns drag by the grip a selected or hovered column shows (?col=A). -->
					<Draggable
						:model-value="section.columns"
						item-key="name"
						handle=".column-handle"
						:group="{ name: `dte-columns-${section.name}` }"
						class="grid gap-x-8"
						:style="{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(0,1fr))` }"
						:data-parent-key="section.name"
						ghost-class="opacity-40"
						:animation="120"
						@start="editor.state.dragging = 'column'"
						@end="onDrop(editor, $event)"
					>
						<template #item="{ element: column }">
						<div
							:key="column.name"
							class="relative flex min-w-0 flex-col"
							:data-container-key="column.name"
							:data-canvas-column="column.name"
							@mouseover="hoverOver(column.name, $event)"
							@mouseleave="colUi.hover = null"
							@click="clickColumn(column.name, $event)"
						>
							<!-- #47434: the column's ring sits 16px outside it concentric with a field's (8px out, rounded-6), drawn over, so nothing moves. -->
							<div
								v-if="ringOn(column.name)"
								class="pointer-events-none absolute -inset-4 z-[1] rounded-8 ring-1"
								:class="isColumn(column.name) ? 'ring-outline-gray-4' : 'ring-outline-gray-2'"
								data-column-ring
							/>
							<span
								v-if="col === 'A' && section.columns.length > 1 && ringOn(column.name)"
								class="column-handle absolute -top-4 left-1/2 z-[2] flex h-4 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center rounded-3 bg-surface-base px-1 text-ink-gray-4 hover:text-ink-gray-7"
								title="Drag to move the column"
								data-column-grip
							>
								<span class="lucide-grip-horizontal size-4" aria-hidden="true" />
							</span>
							<!-- The record page draws a column's label over its fields (FormLayoutColumn). -->
							<div v-if="real && column.label && !column.hideLabel" class="mb-4 max-w-fit text-base text-ink-gray-9" data-column-label>{{ column.label }}</div>
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
										<RealField
											v-if="real && editor.field(nameOf(element))"
											:field="editor.field(nameOf(element))!"
											:selected="isField(nameOf(element))"
											@click.stop="editor.state.selection = { kind: 'field', fieldname: nameOf(element) }"
										/>
										<EditorField
											v-else-if="editor.field(nameOf(element))"
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
						</template>
					</Draggable>
					<AddFieldPopover :section-key="section.name" @add="addToSection(section, $event)" />
				</div>
			</div>
		</template>
	</Draggable>

	<div class="mt-10 flex gap-2 border-t border-outline-gray-1 pt-4">
		<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add section" @click.stop="addSection" />
		<Button v-if="editor.tree.value.length < 2" variant="subtle" size="sm" icon-left="lucide-panel-top" label="Add tab" @click.stop="addTab" />
	</div>
	<!-- #47434 ?tray=B: Details' fields off the layout, under the form; nothing when there are none. -->
	<DetailsTray v-if="tray === 'B'" where="below" @place="$emit('place', $event)" @drag-start="$emit('drag-start', $event)" @drag-end="$emit('drag-end', $event)" />
</template>

<script setup lang="ts">
import { computed, inject, nextTick } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button, Tooltip } from "frappe-ui";
import type { LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import { nameOf } from "../editor";
import AddFieldPopover from "./AddFieldPopover.vue";
import EditorField from "./EditorField.vue";
import ConditionMark from "./ConditionMark.vue";
import { DraftUiKey } from "./draftUi";
import RealField from "./RealField.vue";
import DetailsTray from "./DetailsTray.vue";
import { colUi, use47434 } from "./proto47434";

defineEmits<{ "drag-start": [event: any]; "drag-end": [event: any]; place: [fieldname: string] }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;

const isField = (fieldname: string) => editor.state.selection?.kind === "field" && editor.state.selection.fieldname === fieldname;
const isSection = (key: string) => editor.state.selection?.kind === "section" && editor.state.selection.key === key;
const selectSection = (key: string) => (editor.state.selection = { kind: "section", key });
// #47434: ?col= picks how a column is selected. A: a click on its free space (not on a field)
// selects it, and its hover ring says so first. B: the section's panel lists its columns; a row's
// hover rings the column here. C: a field's panel steps up to its column.
const { col, real, tray } = use47434();
const isColumn = (key: string) => editor.state.selection?.kind === "column" && editor.state.selection.key === key;
const ringsColumnOf = (section: LayoutTreeSection) => Boolean(col.value) && section.columns.some((one) => ringOn(one.name!));
const ringOn = (key: string) => Boolean(col.value) && (isColumn(key) || colUi.hover === key);
function hoverOver(key: string, event: MouseEvent) {
	if (col.value !== "A" || editor.state.dragging) return;
	colUi.hover = (event.target as HTMLElement).closest(".editor-field") ? null : key;
}
function clickColumn(key: string, event: MouseEvent) {
	if (col.value !== "A" || (event.target as HTMLElement).closest(".editor-field")) return;
	event.stopPropagation();
	editor.state.selection = { kind: "column", key };
}
const isTab = (key: string) => editor.state.selection?.kind === "tab" && editor.state.selection.key === key;

// Only the tab in view is drawn. A click on another tab opens it; a click on the open one selects it.
const shown = computed(() => editor.tree.value.find((tab) => tab.name === editor.state.activeTab) ?? editor.tree.value[0]);
function openTab(key: string) {
	if (shown.value?.name === key) return void (editor.state.selection = { kind: "tab", key });
	editor.state.activeTab = key;
	editor.state.selection = null;
}

function addTab() {
	const key = editor.acts.addTab();
	ui.focusTabLabel(key);
}

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
	const sections = shown.value!.sections;
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
/* Over a tab header the field goes to that tab, so the line in the form hides. */
[data-drop-tab] .dte-drop-line {
	opacity: 0 !important;
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
