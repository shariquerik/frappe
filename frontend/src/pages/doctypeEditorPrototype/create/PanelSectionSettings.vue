<!-- PROTOTYPE (#45867): the selected section's settings, as frappe/crm#3419's PanelSectionSettings:
     heading and columns. Remove keeps the section's fields. -->
<template>
	<PanelHeader
		icon="lucide-rows-3"
		:title="section.label || 'Untitled section'"
		:subtitle="`Section · ${count} ${count === 1 ? 'field' : 'fields'}`"
		remove-label="Remove section, keep its fields"
		@remove="$emit('remove')"
		@close="$emit('close')"
	/>
	<PanelSection label="Section">
		<PanelRow label="Heading">
			<TextInput
				variant="ghost"
				:model-value="section.label"
				placeholder="Add heading…"
				@update:model-value="editor.acts.setContainer(section.name!, 'label', $event)"
			/>
		</PanelRow>
		<PanelRow label="Columns" :box="false">
			<TabButtons :options="COLUMNS" :model-value="section.columns.length" @update:model-value="$emit('columns', Number($event))" />
		</PanelRow>
	</PanelSection>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { TabButtons, TextInput } from "frappe-ui";
import type { LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import PanelHeader from "./PanelHeader.vue";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";

const props = defineProps<{ section: LayoutTreeSection }>();
defineEmits<{ columns: [count: number]; remove: []; close: [] }>();
const editor = inject(EditorKey)!;

const COLUMNS = [1, 2, 3].map((n) => ({ label: String(n), value: n }));
const count = computed(() => props.section.columns.reduce((total, column) => total + column.fields.length, 0));
</script>
