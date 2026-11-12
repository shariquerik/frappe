<!-- PROTOTYPE (#45867): the selected tab's settings: its label and its place among the tabs.
     Remove hands the tab's sections to the tab before it, so no field is lost. -->
<template>
	<PanelHeader
		icon="lucide-panel-top"
		:title="tab.label || 'Untitled tab'"
		:subtitle="`Tab · ${tab.sections.length} ${tab.sections.length === 1 ? 'section' : 'sections'} · ${count} ${count === 1 ? 'field' : 'fields'}`"
		remove-label="Remove tab, keep its fields"
		@remove="editor.acts.removeTab(tab.name!)"
		@close="$emit('close')"
	/>
	<PanelSection label="Tab">
		<PanelRow label="Label">
			<TextInput
				ref="labelInput"
				variant="ghost"
				:model-value="tab.label"
				placeholder="Add label…"
				@update:model-value="editor.acts.setContainer(tab.name!, 'label', $event)"
			/>
		</PanelRow>
		<PanelRow label="Order" :box="false">
			<div class="flex gap-1.5">
				<Tooltip text="Move left">
					<Button size="sm" variant="subtle" icon="lucide-arrow-left" label="Move left" :disabled="index === 0" @click="editor.acts.moveTab(tab.name!, -1)" />
				</Tooltip>
				<Tooltip text="Move right">
					<Button size="sm" variant="subtle" icon="lucide-arrow-right" label="Move right" :disabled="index === last" @click="editor.acts.moveTab(tab.name!, 1)" />
				</Tooltip>
			</div>
		</PanelRow>
	</PanelSection>
	<p class="px-4 pt-2 text-p-sm text-ink-gray-5">To move a field to this tab, drag it onto the tab's name, or pick the tab in the field's settings.</p>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { Button, TextInput, Tooltip } from "frappe-ui";
import type { LayoutTreeTab } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import { DraftUiKey } from "./draftUi";
import PanelHeader from "./PanelHeader.vue";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";

const props = defineProps<{ tab: LayoutTreeTab }>();
defineEmits<{ close: [] }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;

const index = computed(() => editor.tree.value.indexOf(props.tab));
const last = computed(() => editor.tree.value.length - 1);
const count = computed(() =>
	props.tab.sections.reduce((total, section) => total + section.columns.reduce((sum, column) => sum + column.fields.length, 0), 0)
);

// A new tab's label takes the caret, so typing names it at once.
const labelInput = ref<{ inputElement: HTMLInputElement | null } | null>(null);
watch(
	() => ui.labelFocus.value,
	async (key) => {
		if (key !== props.tab.name) return;
		await nextTick();
		labelInput.value?.inputElement?.focus();
		labelInput.value?.inputElement?.select();
		ui.labelFocus.value = null;
	},
	{ immediate: true }
);
</script>
