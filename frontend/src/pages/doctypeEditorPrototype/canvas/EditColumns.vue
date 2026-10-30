<!-- PROTOTYPE (#45867): a section's columns on the canvas, sortable side by side. -->
<template>
	<Draggable
		v-if="!automatic"
		:model-value="section.columns"
		item-key="name"
		:group="{ name: 'dte-columns' }"
		handle=".dte-handle"
		ghost-class="opacity-40"
		class="flex w-full flex-col gap-4 sm:flex-row"
		:data-parent-key="section.name"
		@start="editor.state.dragging = 'column'"
		@end="onDrop(editor, $event)"
	>
		<template #item="{ element: column }">
			<div class="flex min-w-0 flex-1" :data-container-key="column.name">
				<Chrome kind="column"
					class="flex min-w-0 flex-1 flex-col"
					:selected="isSelected(column.name)"
					@select="editor.state.selection = { kind: 'column', key: column.name }"
				>
					<slot name="column" :column="column" />
					<template v-if="section.columns.length > 1" #tools>
						<Button variant="ghost" size="sm" icon="lucide-grip-horizontal" class="dte-handle cursor-grab" label="Drag column" />
						<Button variant="ghost" size="sm" icon="lucide-trash-2" label="Delete column" @click="editor.acts.removeContainer(column.name)" />
					</template>
				</Chrome>
			</div>
		</template>
	</Draggable>
	<div v-else class="flex w-full">
		<slot name="column" :column="section.columns[0]" />
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button } from "frappe-ui";
import type { Section } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import { MORE_FIELDS } from "../editor";
import Chrome from "./Chrome.vue";

const props = defineProps<{ section: Section }>();
const editor = inject(EditorKey)!;
const automatic = computed(() => props.section.name === MORE_FIELDS);

function isSelected(key?: string) {
	const selected = editor.state.selection;
	return selected?.kind === "column" && selected.key === key;
}
</script>
