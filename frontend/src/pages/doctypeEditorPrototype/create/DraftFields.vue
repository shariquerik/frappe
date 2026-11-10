<!-- PROTOTYPE (#45867): a column's fields on the new-DocType canvas. Each is the record page's
     own control, made inert. Click a field to edit it; drag to move it; "Add field" at the
     column's end asks for a label first. -->
<template>
	<Draggable
		:model-value="column.fields"
		item-key="fieldname"
		:group="{ name: 'dte-fields' }"
		ghost-class="dte-ghost"
		class="flex min-h-9 flex-col gap-4"
		:filter="'.dte-no-drag'"
		:prevent-on-filter="false"
		:data-column-key="column.name"
		@start="editor.state.dragging = 'field'"
		@end="onDrop(editor, $event)"
	>
		<template #item="{ element: field }">
			<div :data-fieldname="field.fieldname" class="cursor-grab">
				<Chrome kind="field" :selected="isOpen(field.fieldname)" @select="edit(field.fieldname, $event)">
					<div inert :class="ui.titleField.value === field.fieldname && 'dte-title-field'">
						<slot name="field" :field="field" />
					</div>
				</Chrome>
			</div>
		</template>
		<template #footer>
			<div class="dte-no-drag flex" :class="column.fields.length && '-mt-1'">
				<Button
					variant="ghost"
					icon-left="lucide-plus"
					label="Add field"
					class="-ml-2 text-ink-gray-6"
					@click.stop="(event: MouseEvent) => ui.open({ kind: 'add', column: column.name! }, event.currentTarget as Element)"
				/>
			</div>
		</template>
	</Draggable>
</template>

<script setup lang="ts">
import { inject } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button } from "frappe-ui";
import type { Column } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import Chrome from "../canvas/Chrome.vue";
import { DraftUiKey } from "./draftUi";

defineProps<{ column: Column }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;

function isOpen(fieldname: string) {
	const editing = ui.editing.value;
	return editing?.kind === "field" && editing.fieldname === fieldname;
}

function edit(fieldname: string, element: Element) {
	ui.open({ kind: "field", fieldname }, element);
}
</script>

<style>
/* The title field's mark sits after its label, inside the record page's own control. */
.dte-title-field label[data-slot="label"]::after {
	content: "· Title field";
	margin-left: 6px;
	color: var(--ink-gray-5);
}
</style>
