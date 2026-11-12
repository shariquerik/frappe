<!-- PROTOTYPE (#45867): the Editor tab, as frappe/crm#3419's EditorTab: the canvas (one 640px column
     centred in the space left of the panel) and the 380px panel, side by side under the tab strip.
     The panel shows the selected field's settings, the selected section's, or "Add a field".
     No × on the canvas: remove from the panel, with Delete/Backspace, or on the drag bin. Escape
     cancels a drag, else clears the selection. -->
<template>
	<div class="flex min-h-0 flex-1">
		<slot name="rail" />
		<div
			class="relative min-w-0 flex-1 overflow-y-auto"
			:class="{ 'select-none': editor.state.dragging }"
			data-editor-canvas
			:data-drop-tab="editor.state.dropTab ?? undefined"
			@click="onCanvasClick"
		>
			<div class="mx-auto w-full max-w-[640px] px-10 pb-[80vh] pt-10">
				<slot name="banner" />
				<div class="mb-10">
					<h1 class="text-2xl font-semibold text-ink-gray-9">{{ name }}</h1>
					<textarea
						ref="description"
						v-model="ui.description.value"
						placeholder="Add a description of what one record holds"
						rows="1"
						class="mt-2 w-full resize-none border-0 bg-transparent p-0 text-base text-ink-gray-6 placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
						@input="grow"
					/>
					<p class="mt-1 text-p-sm text-ink-gray-5">{{ meta }}</p>
				</div>
				<EditorCanvas @drag-start="startField" @drag-end="endField" />
			</div>
			<DragLayer ref="layer" />
		</div>

		<aside class="flex h-full w-[380px] shrink-0 flex-col overflow-y-auto border-l border-outline-gray-1" data-editor-panel>
			<PanelFieldSettings v-if="selectedField" :key="selectedField.fieldname" :field="selectedField" @remove="removeField(selectedField.fieldname)" @close="clear" />
			<PanelSectionSettings
				v-else-if="selectedSection"
				:key="selectedSection.name"
				:section="selectedSection"
				@columns="setColumns(selectedSection, $event)"
				@remove="removeSection(selectedSection)"
				@close="clear"
			/>
			<PanelTabSettings v-else-if="selectedTab" :key="selectedTab.name" :tab="selectedTab" @close="clear" />
			<PanelAddField v-else @add="addTyped" @drag-start="startPalette" @drag-end="endPalette" />
		</aside>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { LayoutTreeSection, LayoutTreeTab } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import DragLayer from "./DragLayer.vue";
import EditorCanvas from "./EditorCanvas.vue";
import PanelAddField from "./PanelAddField.vue";
import PanelFieldSettings from "./PanelFieldSettings.vue";
import PanelSectionSettings from "./PanelSectionSettings.vue";
import PanelTabSettings from "./PanelTabSettings.vue";
import { DraftUiKey } from "./draftUi";
import { typeLabel } from "./newDoctype";
import { typeIcon, type FieldType } from "./typeMenu";

defineProps<{ name: string; meta: string }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;

const selectedField = computed(() => (editor.state.selection?.kind === "field" ? editor.field(editor.state.selection.fieldname) : undefined));
const selectedSection = computed(() => {
	const selected = editor.state.selection;
	return selected?.kind === "section" ? (editor.find(selected.key)?.node as LayoutTreeSection | undefined) : undefined;
});
const selectedTab = computed(() => {
	const selected = editor.state.selection;
	return selected?.kind === "tab" ? (editor.find(selected.key)?.node as LayoutTreeTab | undefined) : undefined;
});
const clear = () => (editor.state.selection = null);
const sections = () => editor.tree.value.flatMap((tab) => tab.sections);

async function removeField(fieldname: string) {
	if (ui.beforeRemove && !(await ui.beforeRemove(fieldname))) return;
	if (ui.titleField.value === fieldname) ui.titleField.value = "";
	editor.acts.deleteField(fieldname);
}

const activeTab = computed(() => editor.tree.value.find((tab) => tab.name === editor.state.activeTab) ?? editor.tree.value[0]);
const tabSections = () => activeTab.value?.sections ?? [];

/** A removed section hands its fields to the section before it (after, for the first). */
function removeSection(section: LayoutTreeSection) {
	const all = tabSections();
	if (all.length < 2) return;
	const index = all.indexOf(section);
	const into = all[index - 1] ?? all[index + 1];
	editor.history.group(() => {
		into.columns[into.columns.length - 1].fields.push(...section.columns.flatMap((column) => column.fields));
		editor.acts.removeContainer(section.name!);
	});
}

/** Fewer columns fold the removed ones' fields into the last one kept. */
function setColumns(section: LayoutTreeSection, count: number) {
	const key = section.name!;
	editor.history.group(() => {
		while (section.columns.length < count) editor.acts.addColumn(key);
		while (section.columns.length > count) {
			const last = section.columns[section.columns.length - 1];
			section.columns[section.columns.length - 2].fields.push(...last.fields);
			editor.acts.removeContainer(last.name!);
		}
	});
	editor.state.selection = { kind: "section", key };
}

/** A click on a type in the panel adds a field of that type at the end of the tab in view, label first. */
function addTyped(type: FieldType, column?: string, index?: number) {
	const all = tabSections();
	const last = all[all.length - 1];
	const target = column ?? last.columns[last.columns.length - 1].name!;
	const label = typeLabel(type.fieldtype, type.options);
	const fieldname = editor.acts.addLabelled({ label, fieldtype: type.fieldtype, options: type.options }, target, index);
	ui.focusLabel(fieldname);
	requestAnimationFrame(() => document.querySelector(`[data-editor-canvas] [data-fieldname="${fieldname}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
}

// One drag at a time: a canvas field (with the bin) or a panel type (without).
const layer = ref<InstanceType<typeof DragLayer>>();
let dragged: { kind: "field" | "palette"; cancelled: boolean; type?: FieldType } | null = null;

function startField(event: any) {
	window.getSelection()?.removeAllRanges();
	const field = editor.field(event.item.dataset.fieldname);
	editor.state.dragging = "field";
	dragged = { kind: "field", cancelled: false };
	if (field) layer.value?.start({ label: field.label || field.fieldname, icon: typeIcon(field) }, true);
}

function endField(event: any) {
	const tab = editor.state.dropTab;
	const overBin = layer.value?.end();
	const cancelled = dragged?.cancelled;
	dragged = null;
	editor.state.dragging = null;
	if (cancelled) return;
	if (overBin) return removeField(event.item.dataset.fieldname);
	if (tab) return dropOnTab(event.item.dataset.fieldname, tab);
	onDrop(editor, event);
}

const PALETTE = (value: string): FieldType => (value === "Email" ? { fieldtype: "Data", options: "Email" } : { fieldtype: value });

function startPalette(event: any) {
	window.getSelection()?.removeAllRanges();
	const type = PALETTE(event.item.dataset.fieldtype);
	editor.state.dragging = "field";
	dragged = { kind: "palette", cancelled: false, type };
	layer.value?.start({ label: typeLabel(type.fieldtype, type.options), icon: typeIcon(type) }, false);
}

function endPalette(event: any) {
	const tab = editor.state.dropTab;
	layer.value?.end();
	const one = dragged;
	dragged = null;
	editor.state.dragging = null;
	if (one && !one.cancelled && tab) return void addTyped(one.type!, firstColumnOf(tab));
	const column = event.to?.dataset?.columnKey;
	if (!one || one.cancelled || !column || event.to === event.from) return;
	addTyped(one.type!, column, event.newIndex);
}

/** A field dropped on a tab's header moves to the end of that tab's first section, and the tab opens. */
function dropOnTab(fieldname: string, tab: string) {
	editor.acts.moveFieldToTab(fieldname, tab);
	editor.state.activeTab = tab;
	editor.state.selection = { kind: "field", fieldname };
}

function firstColumnOf(tabKey: string) {
	editor.state.activeTab = tabKey;
	const section = tabSections()[0];
	return section.columns[section.columns.length - 1].name!;
}

// Sortable ends its drag on the document's pointer/mouse up.
function cancelDrag(event: KeyboardEvent) {
	event.preventDefault();
	if (dragged) dragged.cancelled = true;
	const { x, y } = layer.value?.pos ?? { x: 0, y: 0 };
	document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x, clientY: y }));
	document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
}

function onCanvasClick(event: MouseEvent) {
	if ((event.target as HTMLElement).closest("[data-editor-select], input, textarea, button")) return;
	clear();
}

const OPEN_OVERLAY = "[role='listbox'], [role='menu'], [role='dialog']";
const TYPING = "input, textarea, select, [contenteditable='true']";
function onKeydown(event: KeyboardEvent) {
	if (event.key === "Escape" && dragged) return cancelDrag(event);
	if (document.querySelector(OPEN_OVERLAY)) return;
	if (event.key === "Escape") return clear();
	const typing = (event.target as HTMLElement).closest?.(TYPING);
	// Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) undo and redo the editor's acts; in a text box they stay the box's.
	const mod = event.ctrlKey || event.metaKey;
	if (mod && !typing && event.key.toLowerCase() === "z") {
		event.preventDefault();
		return event.shiftKey ? editor.history.redo() : editor.history.undo();
	}
	if (mod && !typing && event.key.toLowerCase() === "y") {
		event.preventDefault();
		return editor.history.redo();
	}
	// A or / opens "Add field" in the selected section (the selected field's), else the tab's last.
	if (!mod && !event.altKey && !typing && (event.key === "a" || event.key === "/")) {
		event.preventDefault();
		return openAddField();
	}
	if (!["Delete", "Backspace"].includes(event.key) || !selectedField.value) return;
	if ((event.target as HTMLElement).closest?.(TYPING)) return;
	event.preventDefault();
	removeField(selectedField.value.fieldname);
}
onMounted(() => window.addEventListener("keydown", onKeydown));
// Another tab is another page of the form: it opens at the top, with the DocType's name in view.
watch(
	() => editor.state.activeTab,
	() => document.querySelector("[data-editor-canvas]")?.scrollTo({ top: 0 })
);
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

function openAddField() {
	const selected = editor.state.selection;
	const all = tabSections();
	let section = all[all.length - 1];
	if (selected?.kind === "section") section = (editor.find(selected.key)?.node as LayoutTreeSection) ?? section;
	if (selected?.kind === "field") {
		const column = editor.columnOf(selected.fieldname);
		section = all.find((one) => one.columns.includes(column!)) ?? section;
	}
	document.querySelector<HTMLElement>(`[data-editor-add-field="${section?.name}"] button`)?.click();
}

const description = ref<HTMLTextAreaElement>();
function grow() {
	const el = description.value;
	if (!el) return;
	el.style.height = "auto";
	el.style.height = `${el.scrollHeight}px`;
}
onMounted(() => requestAnimationFrame(grow));

</script>
