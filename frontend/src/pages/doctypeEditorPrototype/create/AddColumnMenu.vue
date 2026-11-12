<!-- PROTOTYPE (#47099), throwaway: "Add column": the child's fields that are not in its grid, to
     search and pick, and at its foot a new field of the child, made as a column. The trigger is the
     default slot (the panel's button, or the canvas grid's + cell). -->
<template>
	<Combobox
		v-model:open="open"
		side="bottom"
		:align="align"
		:options="options"
		placeholder="Find a field"
		:model-value="null"
		@update:model-value="pick"
	>
		<template #trigger>
			<div class="flex" data-add-column @click.stop><slot /></div>
		</template>
		<template #footer>
			<div class="border-t border-outline-gray-1 p-1">
				<button
					type="button"
					class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8 hover:bg-surface-gray-3"
					data-new-column
					@click="add"
				>
					<span class="lucide-plus size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
					New field in {{ child.name }}
				</button>
			</div>
		</template>
	</Combobox>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Combobox } from "frappe-ui";
import { iconOf } from "../fieldtypes";
import { canBeColumn, ChildUiKey, type ChildTable } from "./childTables";

const props = withDefaults(defineProps<{ child: ChildTable; table: string; align?: "start" | "end" }>(), { align: "start" });
const ui = inject(ChildUiKey)!;
const open = ref(false);

const options = computed(() =>
	props.child.editor.state.fields
		.filter((one) => !one.in_list_view && !one.hidden && canBeColumn(one))
		.map((one) => ({ label: one.label || one.fieldname, value: one.fieldname, description: one.fieldtype, icon: iconOf(one.fieldtype) }))
);

function pick(value: unknown) {
	if (!value) return;
	ui.addColumn(props.child, String(value));
}

function add() {
	open.value = false;
	ui.newColumn(props.child, props.table);
}
</script>
