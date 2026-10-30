<!-- PROTOTYPE (#45867): every data field, grouped by where the open layout puts it
     (#45864 ruling 11). A row drags onto the canvas; the canvas drags back to unplace. -->
<template>
	<div class="flex min-h-0 flex-col">
		<div class="flex items-center gap-2 px-3 pb-2 pt-3">
			<TextInput v-model="query" variant="outline" placeholder="Search fields" class="flex-1">
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</TextInput>
			<Dropdown :options="addOptions" side="bottom" align="end">
				<Button variant="subtle" icon="lucide-plus" :label="addLabel" :tooltip="addLabel" />
			</Dropdown>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
			<section v-for="group in groups" :key="group.key" class="pt-3">
				<header class="flex h-7 items-center justify-between px-1.5">
					<span class="text-sm-medium text-ink-gray-5">{{ group.label }}</span>
					<span class="text-sm text-ink-gray-4">{{ group.fields.length }}</span>
				</header>
				<p v-if="group.hint" class="px-1.5 pb-1 text-sm text-ink-gray-5">{{ group.hint }}</p>
				<Draggable
					:model-value="group.fields"
					item-key="fieldname"
					:group="{ name: 'dte-fields', pull: group.key === 'omitted' ? false : true, put: group.key === 'unplaced' }"
					:sort="false"
					ghost-class="dte-ghost"
					class="flex min-h-1 flex-col"
					:data-column-key="MORE_FIELDS"
					@start="editor.state.dragging = 'field'"
					@end="onDrop(editor, $event)"
				>
					<template #item="{ element: field }">
						<div
							:data-fieldname="field.fieldname"
							class="group/row flex h-8 cursor-pointer items-center gap-2 rounded-3 px-1.5 text-base"
							:class="isSelected(field.fieldname) ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
							@click="editor.state.selection = { kind: 'field', fieldname: field.fieldname }"
						>
							<span class="size-4 shrink-0 text-ink-gray-5" :class="iconOf(field.fieldtype)" aria-hidden="true" />
							<span class="min-w-0 flex-1 truncate" :class="field.hidden ? 'text-ink-gray-5' : 'text-ink-gray-8'">
								{{ field.label || field.fieldname }}
								<span v-if="field.reqd" class="text-ink-red-4">*</span>
							</span>
							<span v-if="field.custom" class="shrink-0 text-xs text-ink-gray-5">Custom</span>
							<span v-if="field.hidden" class="lucide-eye-off size-3.5 shrink-0 text-ink-gray-4" title="Hidden on every layout" />
							<span class="flex w-6 shrink-0 justify-end" @click.stop>
								<Dropdown v-if="rowMenu(field).length" :options="rowMenu(field)" side="bottom" align="end">
									<Button variant="ghost" size="sm" icon="lucide-more-horizontal" label="Field actions" class="invisible group-hover/row:visible" />
								</Dropdown>
							</span>
						</div>
					</template>
				</Draggable>
				<p v-if="!group.fields.length" class="px-1.5 py-1 text-sm text-ink-gray-4">{{ group.empty }}</p>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button, Dropdown, TextInput } from "frappe-ui";
import { EditorKey, onDrop } from "./context";
import { isMandatory, MORE_FIELDS, type EditorField } from "./editor";
import { FIELDTYPES, iconOf } from "./fieldtypes";

const props = defineProps<{ hidePlaced?: boolean }>();
const editor = inject(EditorKey)!;
const query = ref("");

const matches = (field: EditorField) => {
	const q = query.value.trim().toLowerCase();
	return !q || `${field.label} ${field.fieldname}`.toLowerCase().includes(q);
};

const byIdx = (a: EditorField, b: EditorField) => (a.idx ?? 0) - (b.idx ?? 0);

const groups = computed(() => {
	const all = editor.dataFields.value.filter(matches);
	const omits = editor.hasMoreFields.value;
	const unplacedHint = {
		details: "Shown in “More fields” at the end of the first tab.",
		"new-record": "Shown in “More fields” at the end of the first tab.",
		"quick-entry": "Hidden, except mandatory fields, which the dialog adds.",
		"side-panel": "Not shown in the side panel.",
	}[editor.state.layout];
	const list = [
		{ key: "placed", label: "Placed", fields: all.filter((f) => editor.placed.value.has(f.fieldname)), empty: "Nothing placed yet." },
		{ key: "unplaced", label: "Unplaced", hint: unplacedHint, fields: all.filter((f) => !editor.placed.value.has(f.fieldname) && !editor.omitted.value.has(f.fieldname)).sort(byIdx), empty: "Every field is placed." },
	];
	if (props.hidePlaced) list.shift();
	if (omits) list.push({ key: "omitted", label: "Omitted", fields: all.filter((f) => editor.omitted.value.has(f.fieldname)), empty: "No field is kept off this layout." } as any);
	return list;
});

const addLabel = computed(() => (editor.state.mode === "customize" ? "Add custom field" : "Add field"));
const addOptions = computed(() =>
	FIELDTYPES.map((group) => ({
		group: group.label,
		items: group.types.map((fieldtype) => ({
			label: fieldtype,
			icon: iconOf(fieldtype),
			onClick: () => editor.acts.addField(fieldtype),
		})),
	}))
);

function rowMenu(field: EditorField) {
	const items = [];
	const placed = editor.placed.value.has(field.fieldname);
	const omitted = editor.omitted.value.has(field.fieldname);
	const locked = isMandatory(field);
	if (placed) items.push({ label: "Remove from layout", icon: "lucide-log-out", onClick: () => editor.acts.moveField(field.fieldname, MORE_FIELDS, 0) });
	if (editor.hasMoreFields.value && !omitted && !locked) items.push({ label: "Omit from this layout", icon: "lucide-eye-off", onClick: () => editor.acts.omit(field.fieldname) });
	if (omitted) items.push({ label: "Restore", icon: "lucide-undo-2", onClick: () => editor.acts.restore(field.fieldname) });
	return items;
}

function isSelected(fieldname: string) {
	const selected = editor.state.selection;
	return selected?.kind === "field" && selected.fieldname === fieldname;
}
</script>
