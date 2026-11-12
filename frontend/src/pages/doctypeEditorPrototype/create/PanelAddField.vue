<!-- PROTOTYPE (#45867): nothing selected. On a saved DocType's variant C (#47095), a switch above
     shows the form's fields instead, grouped by tab, to search and jump to. As frappe/crm#3419's PanelAddField, but a new DocType has
     no fields to pick, so the list is of field types, A to Z with their icons. Click one to add a
     field of that type at the form's end (its label takes the caret), or drag it onto the form. -->
<template>
	<div v-if="listing" class="px-4 pb-1 pt-3">
		<TabButtons v-model="pane" :options="PANES" class="[&>*]:w-full [&_button]:flex-1" />
	</div>
	<div v-if="!listing || pane === 'add'" class="flex min-h-[42px] items-center px-4 py-2">
		<p class="text-p-sm text-ink-gray-5">Select a field or a section heading to edit it here.</p>
	</div>
	<template v-if="listing && pane === 'fields'">
		<div class="px-4 pb-1 pt-2">
			<TextInput v-model="fieldQuery" placeholder="Find a field">
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</TextInput>
		</div>
		<PanelSection v-for="group in fieldGroups" :key="`${group.key}/${Boolean(fieldQuery)}`" :label="group.label" :count="group.rows.length" :start-open="Boolean(fieldQuery) || group.key === editor.state.activeTab">
			<div class="-mt-1 flex flex-col">
				<ItemListRow
					v-for="row in group.rows"
					:key="row.fieldname"
					as="button"
					type="button"
					class="-mx-2 !min-h-8 text-left"
					@click="saved?.jumpTo(row.fieldname)"
				>
					<template #prefix><span class="size-4 text-ink-gray-5" :class="iconOf(row.fieldtype)" aria-hidden="true" /></template>
					<span class="block truncate text-ink-gray-8">{{ row.label }}</span>
					<template #suffix><span class="max-w-32 truncate text-sm text-ink-gray-4">{{ row.section }}</span></template>
				</ItemListRow>
			</div>
		</PanelSection>
		<p v-if="!fieldGroups.length" class="px-4 py-2 text-p-sm text-ink-gray-5">No field matches.</p>
	</template>
	<PanelSection v-else label="Add a field">
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
import { computed, inject, ref } from "vue";
import { useRoute } from "vue-router";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { ItemListRow, TabButtons, TextInput } from "frappe-ui";
import { EditorKey } from "../context";
import { FIELDTYPES, iconOf } from "../fieldtypes";
import PanelSection from "./PanelSection.vue";
import { fieldIndex, matches, SavedUiKey } from "./savedDoctype";
import { typeIcon, type FieldType } from "./typeMenu";

defineEmits<{ add: [type: FieldType]; "drag-start": [event: any]; "drag-end": [event: any] }>();

// Email is Data with the Email option, listed as its own type, as the type menu does.
const ALL = [...FIELDTYPES.flatMap((group) => group.types).map((one) => ({ fieldtype: one } as FieldType)), { fieldtype: "Data", options: "Email" }]
	.map((type) => ({ type, value: type.options ?? type.fieldtype, label: type.options ?? type.fieldtype, icon: typeIcon(type) }))
	.sort((a, b) => a.label.localeCompare(b.label));

const query = ref("");

const PANES = [
	{ value: "fields", label: "Fields" },
	{ value: "add", label: "Add a field" },
];
const editor = inject(EditorKey)!;
const saved = inject(SavedUiKey, null);
const route = useRoute();
const listing = computed(() => Boolean(saved?.value) && route.query.variant === "C");
const pane = ref("fields");
const fieldQuery = ref("");
const fieldGroups = computed(() => {
	const groups: { key: string; label: string; rows: ReturnType<typeof fieldIndex> }[] = [];
	for (const row of fieldIndex(editor)) {
		if (!matches(row, fieldQuery.value)) continue;
		let group = groups.find((one) => one.key === row.tabKey);
		if (!group) groups.push((group = { key: row.tabKey, label: row.tab, rows: [] }));
		group.rows.push(row);
	}
	return groups;
});
const rows = computed(() => {
	const typed = query.value.trim().toLowerCase();
	return typed ? ALL.filter((row) => row.label.toLowerCase().includes(typed)) : ALL;
});
</script>
