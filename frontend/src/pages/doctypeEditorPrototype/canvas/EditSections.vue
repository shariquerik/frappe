<!-- PROTOTYPE (#45867): a tab's sections on the canvas, sortable; `FormLayout` draws each. -->
<template>
	<Draggable
		:model-value="sortable"
		item-key="name"
		:group="{ name: 'dte-sections' }"
		handle=".dte-handle"
		ghost-class="opacity-40"
		:data-parent-key="tab.name"
		@start="editor.state.dragging = 'section'"
		@end="onDrop(editor, $event)"
	>
		<template #item="{ element: section, index }">
			<div :data-container-key="section.name">
				<Chrome kind="section"
					:selected="isSelected(section.name)"
					@select="editor.state.selection = { kind: 'section', key: section.name }"
				>
					<slot name="section" :section="section" :index="index" />
					<div
						v-if="!section.label || section.hideLabel"
						class="pointer-events-none absolute -top-2.5 left-2 hidden bg-surface-base px-1 text-xs text-ink-gray-5 group-hover/section:block"
						:class="{ '!block': isSelected(section.name) }"
					>
						Section
					</div>
					<template #tools>
						<Button variant="ghost" size="sm" icon="lucide-grip-vertical" class="dte-handle cursor-grab" label="Drag section" />
						<Button variant="ghost" size="sm" icon="lucide-columns-2" label="Add column" @click="editor.acts.addColumn(section.name)" />
						<Dropdown :options="menu(section.name)" side="bottom" align="end">
							<Button variant="ghost" size="sm" icon="lucide-more-horizontal" label="Section actions" />
						</Dropdown>
					</template>
				</Chrome>
			</div>
		</template>
		<template #footer>
			<div v-for="section in automatic" :key="section.name" class="mt-5" data-automatic>
				<Chrome kind="section"
					automatic
					:selected="isSelected(section.name)"
					@select="editor.state.selection = { kind: 'section', key: section.name }"
				>
					<slot name="section" :section="section" :index="sortable.length" />
					<span class="pointer-events-none absolute -top-2.5 right-2 bg-surface-base px-1 text-xs text-ink-gray-5">
						Automatic
					</span>
				</Chrome>
			</div>
			<button
				type="button"
				class="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-4 border border-dashed border-outline-gray-2 text-base text-ink-gray-5 hover:border-outline-gray-3 hover:text-ink-gray-7"
				@click.stop="editor.acts.addSection(tab.name)"
			>
				<span class="lucide-plus size-4" aria-hidden="true" /> Add section
			</button>
		</template>
	</Draggable>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button, Dropdown } from "frappe-ui";
import type { Tab } from "@framework/ui/FormLayout/types";
import { EditorKey, onDrop } from "../context";
import { MORE_FIELDS } from "../editor";
import Chrome from "./Chrome.vue";

const props = defineProps<{ tab: Tab }>();
const editor = inject(EditorKey)!;

const sortable = computed(() => props.tab.sections.filter((s) => s.name !== MORE_FIELDS));
const automatic = computed(() => props.tab.sections.filter((s) => s.name === MORE_FIELDS));

function isSelected(key?: string) {
	const selected = editor.state.selection;
	return selected?.kind === "section" && selected.key === key;
}

function menu(key: string) {
	const found = editor.find(key);
	const list = found?.list ?? [];
	const index = list.indexOf(found?.node as any);
	return [
		{ label: "Move up", icon: "lucide-arrow-up", disabled: index <= 0, onClick: () => editor.acts.moveContainer(key, props.tab.name!, index - 1) },
		{ label: "Move down", icon: "lucide-arrow-down", disabled: index >= list.length - 1, onClick: () => editor.acts.moveContainer(key, props.tab.name!, index + 1) },
		{ label: "Delete section", icon: "lucide-trash-2", theme: "red", onClick: () => editor.acts.removeContainer(key) },
	];
}
</script>
