<!-- PROTOTYPE (#45867): a column's fields on the canvas. Each is the record page's own
     control, made inert, so the canvas is the form; hidden fields show, dimmed. -->
<template>
	<Draggable
		:model-value="column.fields"
		item-key="fieldname"
		:group="{ name: 'dte-fields' }"
		ghost-class="dte-ghost"
		class="flex min-h-12 flex-col gap-4 rounded-4"
		:class="[
			!column.fields.length && 'border border-dashed border-outline-gray-2',
			editor.state.dragging === 'field' && !column.fields.length && 'bg-surface-gray-1',
		]"
		:data-column-key="column.name"
		@start="editor.state.dragging = 'field'"
		@end="onDrop(editor, $event)"
	>
		<template #item="{ element: field }">
			<div :data-fieldname="field.fieldname" class="cursor-grab">
				<Chrome kind="field"
					:selected="isSelected(field.fieldname)"
					@select="editor.state.selection = { kind: 'field', fieldname: field.fieldname }"
				>
					<div inert :class="{ 'opacity-50': field.hidden }">
						<slot name="field" :field="field" />
					</div>
					<div class="pointer-events-none absolute right-0 top-0 flex items-center gap-1 text-ink-gray-5">
						<span v-if="warns(field)" class="lucide-triangle-alert size-3.5 text-ink-amber-3" title="Mandatory in a conditional container" />
						<span v-if="field.dependsOn || meta(field)?.depends_on" class="lucide-git-branch size-3.5" title="Shown when a condition holds" />
						<span v-if="field.hidden" class="lucide-eye-off size-3.5" title="Hidden" />
						<span v-if="meta(field)?.added" class="text-xs">{{ editor.state.mode === 'customize' ? 'Custom · new' : 'New' }}</span>
					</div>
				</Chrome>
			</div>
		</template>
		<template #footer>
			<div
				v-if="!column.fields.length"
				class="pointer-events-none flex h-12 items-center justify-center text-sm text-ink-gray-4"
			>
				Drag fields here
			</div>
		</template>
	</Draggable>
</template>

<script setup lang="ts">
import { inject } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import type { Column, FieldNode } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import Chrome from "./Chrome.vue";
import { conditionalHome } from "../warnings";

defineProps<{ column: Column }>();
const editor = inject(EditorKey)!;

const meta = (field: FieldNode) => editor.field(field.fieldname);
const warns = (field: FieldNode) => Boolean(meta(field)?.reqd) && Boolean(conditionalHome(editor, field.fieldname));

function isSelected(fieldname: string) {
	const selected = editor.state.selection;
	return selected?.kind === "field" && selected.fieldname === fieldname;
}
</script>

<style>
.dte-ghost {
	opacity: 0.4;
}
</style>
