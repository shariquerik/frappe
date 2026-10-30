<!-- PROTOTYPE (#45867), variant C: the layout as a tree. Click selects; the canvas and the
     tree share one selection. Moves still drag on the canvas or run from a menu. -->
<template>
	<div class="min-h-0 overflow-y-auto px-3 py-3 text-base">
		<div class="flex h-7 items-center px-1.5 text-sm-medium text-ink-gray-5">Structure</div>
		<template v-for="tab in tabs" :key="tab.name">
			<Row :depth="0" icon="lucide-panel-top" :label="tab.label || 'Tab'" :selected="is('tab', tab.name)" @click="select('tab', tab.name)" />
			<template v-for="section in tab.sections" :key="section.name">
				<Row :depth="1" icon="lucide-rows-3" :label="section.label || 'Section'" :muted="!section.label" :selected="is('section', section.name)" @click="select('section', section.name)" />
				<template v-for="(column, c) in section.columns" :key="column.name">
					<Row v-if="section.columns.length > 1" :depth="2" icon="lucide-columns-2" :label="column.label || `Column ${c + 1}`" :muted="!column.label" :selected="is('column', column.name)" @click="select('column', column.name)" />
					<Row
						v-for="entry in column.fields"
						:key="nameOf(entry)"
						:depth="section.columns.length > 1 ? 3 : 2"
						:icon="iconOf(editor.field(nameOf(entry))?.fieldtype ?? '')"
						:label="editor.field(nameOf(entry))?.label || nameOf(entry)"
						:selected="isField(nameOf(entry))"
						@click="editor.state.selection = { kind: 'field', fieldname: nameOf(entry) }"
					/>
				</template>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, inject } from "vue";
import { EditorKey } from "./context";
import { nameOf } from "./editor";
import { iconOf } from "./fieldtypes";

const editor = inject(EditorKey)!;
const tabs = computed(() => editor.tree.value);

const is = (kind: string, key?: string) => {
	const selected = editor.state.selection as any;
	return selected?.kind === kind && selected.key === key;
};
const isField = (fieldname: string) => {
	const selected = editor.state.selection;
	return selected?.kind === "field" && selected.fieldname === fieldname;
};
const select = (kind: "tab" | "section" | "column", key?: string) => {
	if (key) editor.state.selection = { kind, key };
};

const Row = defineComponent({
	props: { depth: Number, icon: String, label: String, selected: Boolean, muted: Boolean },
	emits: ["click"],
	setup(props, { emit }) {
		return () =>
			h(
				"button",
				{
					type: "button",
					class: [
						"flex h-7 w-full items-center gap-2 rounded-3 pr-1.5 text-left",
						props.selected ? "bg-surface-gray-3 text-ink-gray-9" : "text-ink-gray-7 hover:bg-surface-gray-2",
					],
					style: { paddingLeft: `${6 + (props.depth ?? 0) * 16}px` },
					onClick: () => emit("click"),
				},
				[
					h("span", { class: [props.icon, "size-4 shrink-0 text-ink-gray-5"], "aria-hidden": "true" }),
					h("span", { class: ["truncate", props.muted && "text-ink-gray-5"] }, props.label),
				]
			);
	},
});
</script>
