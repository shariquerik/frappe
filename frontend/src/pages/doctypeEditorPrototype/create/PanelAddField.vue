<!-- PROTOTYPE (#45867): nothing selected. On a saved DocType's variant C (#47095), a switch above
     shows the form's fields instead, grouped by tab, to search and jump to. As frappe/crm#3419's PanelAddField, but a new DocType has
     no fields to pick, so the list is of field types, A to Z with their icons. Click one to add a
     field of that type at the form's end (its label takes the caret), or drag it onto the form.
     #47097: outside Details, "Fields not on this layout" comes first (click one to place it at the
     end of the section in view), and the type list is retitled "New field". -->
<template>
	<div v-if="listing" class="px-4 pb-1 pt-3">
		<TabButtons v-model="pane" :options="PANES" class="[&>*]:w-full [&_button]:flex-1" />
	</div>
	<div v-if="!listing || pane === 'add'" class="flex min-h-[42px] items-center px-4 py-2">
		<p class="text-p-sm text-ink-gray-5">Select a field or a section heading to edit it here.</p>
	</div>
	<!-- #47099: a child's own editor puts its grid columns here, under the hint. -->
	<slot name="first" />
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
	<!-- #47097: outside Details, the DocType's fields this layout does not place come first. -->
	<PanelSection v-if="offDetails && !(listing && pane === 'fields')" label="Fields not on this layout" data-unplaced>
		<template #actions><span class="text-sm text-ink-gray-4">{{ notPlaced.length }}</span></template>
		<div data-unplaced-search>
			<TextInput v-model="unplacedQuery" placeholder="Find a field">
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</TextInput>
		</div>
		<div v-if="unplacedRows.length" class="-mx-2 flex max-h-[272px] flex-col overflow-y-auto">
			<ItemListRow
				v-for="row in unplacedRows"
				:key="row.fieldname"
				as="button"
				type="button"
				class="!min-h-8 shrink-0 text-left hover:bg-surface-gray-2"
				:data-unplaced-field="row.fieldname"
				title="Click to place it at the end of the section in view"
				@click="$emit('place', row.fieldname)"
			>
				<template #prefix><span class="size-4 text-ink-gray-5" :class="typeIcon(row)" aria-hidden="true" /></template>
				<span class="block truncate text-ink-gray-8">{{ row.label || row.fieldname }}</span>
				<template #suffix><span class="max-w-32 truncate text-sm text-ink-gray-4">{{ typeLabel(row.fieldtype, row.options) }}</span></template>
			</ItemListRow>
		</div>
		<p v-else class="text-p-sm text-ink-gray-5">{{ notPlaced.length ? "No field matches." : "Every field of the DocType is on this layout." }}</p>
	</PanelSection>
	<PanelSection v-if="!(listing && pane === 'fields')" :label="offDetails ? 'New field' : 'Add a field'">
		<TextInput v-model="query" placeholder="Search field types">
			<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
		</TextInput>
		<Draggable
			:model-value="rows"
			:group="{ name: 'dte-fields', pull: 'clone', put: false }"
			:sort="false"
			item-key="value"
			class="-mx-2 flex flex-col"
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
import { typeLabel } from "./newDoctype";
import { typeIcon, type FieldType } from "./typeMenu";
import { use47434 } from "./proto47434";

defineEmits<{ add: [type: FieldType]; place: [fieldname: string]; "drag-start": [event: any]; "drag-end": [event: any] }>();

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
// #47097: Quick Entry already draws the unplaced mandatory fields, so they are not listed.
// #47434 ?tray=A: on Details too, while a field is off the layout; with none the group is not drawn.
const { tray } = use47434();
const offDetails = computed(() => editor.state.layout !== "details" || (tray.value === "A" && notPlaced.value.length > 0));
const notPlaced = computed(() => {
	const drawn = new Set(editor.state.layout === "quick-entry" ? editor.autoFields.value.map((one) => one.fieldname) : []);
	return editor.unplaced.value.filter((one) => !one.hidden && !drawn.has(one.fieldname));
});
const unplacedQuery = ref("");
const unplacedRows = computed(() => notPlaced.value.filter((one) => matches({ label: one.label || one.fieldname, fieldname: one.fieldname }, unplacedQuery.value)));
const rows = computed(() => {
	const typed = query.value.trim().toLowerCase();
	return typed ? ALL.filter((row) => row.label.toLowerCase().includes(typed)) : ALL;
});
</script>
