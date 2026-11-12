<!-- PROTOTYPE (#45867): one field in the structure view, in the look of CRM's Forms builder
     (FieldCard). The row shows grip, type, label (click to rename), mandatory and title marks.
     Expanded, it holds the common properties; "All properties" opens the side panel. -->
<template>
	<div
		class="rounded-4 border bg-surface-elevation-2 text-ink-gray-8"
		:class="expanded || inPanel ? 'border-outline-gray-3' : 'border-outline-gray-2'"
	>
		<div class="flex items-center gap-2 px-2.5 py-2">
			<span class="lucide-grip-vertical drag-handle h-3.5 shrink-0 cursor-grab text-ink-gray-4" aria-hidden="true" />
			<span :class="[typeIcon(field), 'size-4 shrink-0 text-ink-gray-5']" :title="typeLabel(field.fieldtype, field.options)" aria-hidden="true" />
			<input
				v-if="renaming"
				ref="labelInput"
				:value="field.label"
				:placeholder="field.fieldname"
				class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink-gray-8 placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
				@input="setLabel(($event.target as HTMLInputElement).value)"
				@blur="endRename"
				@keydown.enter="endRename"
			/>
			<div v-else class="group/label flex min-w-0 flex-1 cursor-text items-center" title="Click to rename" @click="beginRename">
				<span class="-ml-1 inline-flex min-w-0 max-w-full items-center gap-1 rounded-4 px-1 py-0.5 transition-colors group-hover/label:bg-surface-gray-3">
					<span class="min-w-0 truncate text-base" :class="field.label ? 'text-ink-gray-8' : 'text-ink-gray-4'">{{ field.label || field.fieldname }}</span>
					<span v-if="field.reqd" class="shrink-0 text-ink-red-4">*</span>
					<span class="lucide-pencil size-3 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover/label:opacity-100" aria-hidden="true" />
				</span>
			</div>
			<Badge v-if="isTitle" label="Title" theme="gray" size="sm" class="shrink-0" />
			<Button variant="ghost" :tooltip="expanded ? 'Collapse' : 'Edit field'" @click="toggle">
				<template #icon>
					<span class="lucide-chevron-down size-4 text-ink-gray-5 transition-transform" :class="expanded && 'rotate-180'" aria-hidden="true" />
				</template>
			</Button>
			<Button variant="ghost" tooltip="Remove" @click="remove">
				<template #icon><span class="lucide-x size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</Button>
		</div>

		<div v-if="expanded" class="flex flex-col gap-3 border-t border-outline-gray-2 p-2.5">
			<div class="flex items-center justify-between gap-3">
				<span class="text-base text-ink-gray-5">Type</span>
				<Dropdown :options="menu" side="bottom" align="end">
					<Button size="sm" :icon-left="typeIcon(field)" icon-right="lucide-chevron-down" :label="typeLabel(field.fieldtype, field.options)" />
				</Dropdown>
			</div>
			<Combobox
				v-if="field.fieldtype === 'Link' || field.fieldtype === 'Table'"
				:model-value="field.options"
				:label="field.fieldtype === 'Link' ? 'Links to' : 'Child table'"
				:options="doctypes"
				placeholder="Choose a DocType"
				@update:model-value="set('options', String($event ?? ''))"
			/>
			<FormControl
				v-if="field.fieldtype === 'Select'"
				type="textarea"
				size="sm"
				:rows="3"
				label="Options, one per line"
				:model-value="field.options"
				@update:model-value="set('options', $event)"
			/>
			<div class="flex items-center justify-between">
				<span class="text-base text-ink-gray-5">Mandatory</span>
				<Switch size="sm" :model-value="Boolean(field.reqd)" @update:model-value="set('reqd', $event ? 1 : 0)" />
			</div>
			<div v-if="TITLE_TYPES.has(field.fieldtype)" class="flex items-center justify-between">
				<span class="text-base text-ink-gray-5">Title field</span>
				<Switch size="sm" :model-value="isTitle" @update:model-value="ui.titleField.value = $event ? field.fieldname : ''" />
			</div>
			<FormControl size="sm" label="Default" placeholder="None" :model-value="field.default" @update:model-value="set('default', $event)" />
			<FormControl size="sm" label="Description" placeholder="Help text under the field" :model-value="field.description" @update:model-value="set('description', $event)" />
			<div class="flex items-center justify-between gap-3 border-t border-outline-gray-2 pt-2.5">
				<span class="min-w-0 truncate text-sm text-ink-gray-5">Fieldname <span class="font-mono text-ink-gray-6">{{ field.fieldname }}</span></span>
				<Button size="sm" variant="ghost" icon-left="lucide-sliders-horizontal" label="All properties" class="shrink-0" @click="ui.panel.value = field.fieldname" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref } from "vue";
import { Badge, Button, Combobox, Dropdown, FormControl, Switch } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { EditorKey } from "../context";
import type { EditorField } from "../editor";
import { DraftUiKey, TITLE_TYPES } from "./draftUi";
import { fieldnameOf, typeLabel } from "./newDoctype";
import { typeIcon, typeMenu, type FieldType } from "./typeMenu";

const props = defineProps<{ field: EditorField }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;
const doctypes = inject<Addresses>("addresses")!.doctypeNames();

const expanded = computed(() => ui.expanded.value === props.field.fieldname);
const inPanel = computed(() => ui.panel.value === props.field.fieldname);
const isTitle = computed(() => ui.titleField.value === props.field.fieldname);

const set = (prop: string, value: unknown) => editor.acts.setField(props.field.fieldname, prop, value);
const menu = computed(() => typeMenu((type: FieldType) => (set("fieldtype", type.fieldtype), set("options", type.options))));

function toggle() {
	ui.expanded.value = expanded.value ? null : props.field.fieldname;
	if (ui.panel.value && ui.expanded.value) ui.panel.value = ui.expanded.value;
}

const renaming = ref(false);
const labelInput = ref<HTMLInputElement>();
async function beginRename() {
	renaming.value = true;
	await nextTick();
	labelInput.value?.focus();
}

const setLabel = (value: string) => set("label", value);

function endRename() {
	if (!renaming.value) return;
	renaming.value = false;
	if (ui.draft.value && props.field.added && props.field.label) ui.rename(props.field.fieldname, fieldnameOf(props.field.label));
}

function remove() {
	const { fieldname } = props.field;
	if (ui.titleField.value === fieldname) ui.titleField.value = "";
	if (ui.expanded.value === fieldname) ui.expanded.value = null;
	if (ui.panel.value === fieldname) ui.panel.value = null;
	editor.acts.deleteField(fieldname);
}
</script>
