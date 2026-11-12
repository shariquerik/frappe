<!-- PROTOTYPE (#45867): nothing selected. As frappe/crm#3419's PanelAddField, but a new DocType has
     no fields to pick, so the list is of field types, A to Z with their icons. Click one to add a
     field of that type at the form's end (its label takes the caret), or drag it onto the form. -->
<template>
	<div class="flex min-h-[42px] items-center px-4 py-2">
		<p class="text-p-sm text-ink-gray-5">Select a field or a section heading to edit it here.</p>
	</div>
	<PanelSection label="Add a field">
		<TextInput v-model="query" placeholder="Search field types">
			<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
		</TextInput>
		<Draggable
			:model-value="rows"
			:group="{ name: 'dte-fields', pull: 'clone', put: false }"
			:sort="false"
			item-key="value"
			class="flex flex-col"
			:force-fallback="true"
			:fallback-on-body="false"
			fallback-class="dte-drag-fallback"
			ghost-class="dte-drop-line"
			@start="$emit('drag-start', $event)"
			@end="$emit('drag-end', $event)"
		>
			<template #item="{ element: row }">
				<ItemListRow
					as="button"
					type="button"
					class="!min-h-8 cursor-grab text-left hover:bg-surface-gray-2 active:cursor-grabbing"
					:data-fieldtype="row.value"
					title="Click to add, or drag onto the form"
					@click="$emit('add', row.type)"
				>
					<template #prefix><span class="size-4 text-ink-gray-5" :class="row.icon" aria-hidden="true" /></template>
					<span class="block truncate text-ink-gray-8">{{ row.label }}</span>
				</ItemListRow>
			</template>
		</Draggable>
		<p v-if="!rows.length" class="text-p-sm text-ink-gray-5">No field type matches.</p>
	</PanelSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { ItemListRow, TextInput } from "frappe-ui";
import { FIELDTYPES } from "../fieldtypes";
import PanelSection from "./PanelSection.vue";
import { typeIcon, type FieldType } from "./typeMenu";

defineEmits<{ add: [type: FieldType]; "drag-start": [event: any]; "drag-end": [event: any] }>();

// Email is Data with the Email option, listed as its own type, as the type menu does.
const ALL = [...FIELDTYPES.flatMap((group) => group.types).map((one) => ({ fieldtype: one } as FieldType)), { fieldtype: "Data", options: "Email" }]
	.map((type) => ({ type, value: type.options ?? type.fieldtype, label: type.options ?? type.fieldtype, icon: typeIcon(type) }))
	.sort((a, b) => a.label.localeCompare(b.label));

const query = ref("");
const rows = computed(() => {
	const typed = query.value.trim().toLowerCase();
	return typed ? ALL.filter((row) => row.label.toLowerCase().includes(typed)) : ALL;
});
</script>
