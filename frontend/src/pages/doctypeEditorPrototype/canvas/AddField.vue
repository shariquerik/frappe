<!-- PROTOTYPE (#45867): "+" inside a column. It adds a field of the chosen type at this
     place in the column; it replaces the field list and the header's "Add field". -->
<template>
	<Dropdown :options="options" side="bottom" align="start">
		<slot>
			<Button variant="ghost" size="sm" icon="lucide-plus" :label="label" />
		</slot>
	</Dropdown>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Button, Dropdown } from "frappe-ui";
import { EditorKey } from "../context";
import { FIELDTYPES, iconOf } from "../fieldtypes";

const props = defineProps<{ column: string; index?: number }>();
const editor = inject(EditorKey)!;

const label = computed(() => (editor.state.mode === "customize" ? "Add custom field" : "Add field"));

const COMMON = ["Data", "Select", "Link", "Date", "Check", "Int", "Currency", "Small Text", "Table"];
const add = (fieldtype: string) => () => editor.acts.addField(fieldtype, props.column, props.index);
const options = computed(() => [
	{
		group: label.value,
		options: COMMON.map((type) => ({ label: type, icon: iconOf(type), onClick: add(type) })),
	},
	{
		group: "",
		options: [
			{
				label: "More types",
				icon: "lucide-shapes",
				submenu: FIELDTYPES.map((group) => ({
					group: group.label,
					options: group.types
						.filter((type) => !COMMON.includes(type))
						.map((type) => ({ label: type, icon: iconOf(type), onClick: add(type) })),
				})),
			},
		],
	},
]);
</script>
