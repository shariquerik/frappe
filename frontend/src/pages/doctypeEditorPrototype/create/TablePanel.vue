<!-- PROTOTYPE (#47099), throwaway: what a Table field's panel adds under its "Field" group, by
     ?child=: A and B the grid's columns (B also lists every field of the child, to open one here);
     C nothing, since the child's own editor holds its columns. -->
<template>
	<template v-if="child && ui.variant !== 'C'">
		<GridColumns :child="child" :table="field.fieldname" @open="open" />
		<PanelSection v-if="ui.variant === 'B'" :label="`Fields of ${child.name}`">
			<template #actions
				><span class="text-sm text-ink-gray-4">{{ rows.length }}</span></template
			>
			<div class="-mt-1 flex flex-col" data-child-field-list>
				<ItemListRow
					v-for="row in shown"
					:key="row.fieldname"
					as="button"
					type="button"
					class="-mx-2 !min-h-8 text-left"
					:data-child-field="row.fieldname"
					@click="open(row.fieldname)"
				>
					<template #prefix><span class="size-4 text-ink-gray-5" :class="iconOf(row.fieldtype)" aria-hidden="true" /></template>
					<span class="block truncate text-ink-gray-8">{{ row.label || row.fieldname }}</span>
					<template #suffix>
						<span v-if="row.in_list_view" class="text-sm text-ink-gray-5">Column</span>
						<span v-else-if="row.hidden" class="lucide-eye-off size-3.5 text-ink-gray-4" aria-label="Hidden" />
					</template>
				</ItemListRow>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add field" @click="ui.newColumn(child, field.fieldname, false)" />
				<Button
					v-if="rows.length > LIMIT"
					variant="ghost"
					size="sm"
					:label="all ? 'Show fewer' : `Show all ${rows.length}`"
					@click="all = !all"
				/>
			</div>
		</PanelSection>
	</template>
</template>

<script setup lang="ts">
import { computed, inject, ref, watchEffect } from "vue";
import { Button, ItemListRow } from "frappe-ui";
import { DROPPED_FIELDTYPES } from "@framework/ui/FormLayout";
import type { EditorField } from "../editor";
import { iconOf } from "../fieldtypes";
import GridColumns from "./GridColumns.vue";
import PanelSection from "./PanelSection.vue";
import { ChildUiKey } from "./childTables";

const LIMIT = 10;
const props = defineProps<{ field: EditorField }>();
const ui = inject(ChildUiKey)!;
const child = computed(() => ui.get(props.field.options));
watchEffect(() => props.field.options && void ui.ensure(props.field.options));
const all = ref(false);

// The child's data fields in its field order; its grid columns come first.
const rows = computed(() => {
	const fields =
		child.value?.editor.state.fields.filter((one) => !DROPPED_FIELDTYPES.has(one.fieldtype) || ["Button", "HTML"].includes(one.fieldtype)) ?? [];
	return [...fields.filter((one) => one.in_list_view), ...fields.filter((one) => !one.in_list_view)];
});
const shown = computed(() => (all.value ? rows.value : rows.value.slice(0, LIMIT)));

const open = (fieldname: string) => (ui.focus = { table: props.field.fieldname, fieldname });
</script>
