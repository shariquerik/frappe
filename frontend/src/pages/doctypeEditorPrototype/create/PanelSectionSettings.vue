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
		:searchable="!unified"
		@search="searchOpen = true"
	/>
	<PanelSearchRow v-if="searchOpen" v-model="search.query" @close="closeSearch" />
	<p v-if="searching && !anyMatch" class="border-t border-outline-gray-1 px-4 py-3 text-base text-ink-gray-5">No properties match “{{ search.query.trim() }}”</p>
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
		<!-- #47100: a collapsible section, and when it starts open (`collapsible_depends_on`). -->
		<PanelRow label="Collapsible" :box="false">
			<div class="flex h-7 items-center px-2">
				<Switch size="sm" :model-value="Boolean(section.collapsible)" @update:model-value="setSection('collapsible', $event)" />
			</div>
		</PanelRow>
	</PanelSection>
	<PanelSection label="Conditions">
		<ConditionPanelRow
			label="Visible if"
			kind="condition"
			:value="section.dependsOn || ''"
			empty-text="Always"
			empty-note="Always visible. Add a condition to show the section only sometimes."
			:subject="section.label || 'Untitled section'"
			:row-key="`${section.name}.depends_on`"
			:scope="scope"
			:record="scope.fields"
			:mark="mark('dependsOn')"
			@update="setSection('dependsOn', $event)"
		/>
		<ConditionPanelRow
			v-if="section.collapsible"
			label="Starts open if"
			kind="condition"
			:value="(section as any).collapsibleDependsOn || ''"
			empty-text="Never"
			empty-note="Starts closed. Add a condition to open it when it matters."
			:subject="section.label || 'Untitled section'"
			:row-key="`${section.name}.collapsible_depends_on`"
			:scope="scope"
			:record="scope.fields"
			:mark="mark('collapsibleDependsOn')"
			@update="setSection('collapsibleDependsOn', $event)"
		/>
	</PanelSection>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Switch, TabButtons, TextInput } from "frappe-ui";
import type { LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import PanelHeader from "./PanelHeader.vue";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";
import { useRoute } from "vue-router";
import PanelSearchRow from "./PanelSearchRow.vue";
import { providePanelSearch } from "./panelSearch";
import ConditionPanelRow from "./ConditionPanelRow.vue";
import { conditionScope } from "./conditions";
import { DraftUiKey } from "./draftUi";
import { CustomizeKey } from "./customize";

const props = defineProps<{ section: LayoutTreeSection }>();
defineEmits<{ columns: [count: number]; remove: []; close: [] }>();
// #47098: filters the properties below; "/" is the Editor's add-a-field key, so it is not bound here.
const { search, searching, anyMatch } = providePanelSearch();
const searchOpen = ref(false);
// ?search=one: the header's finder searches properties; the panel has no search of its own.
const unified = useRoute().query.search === "one";
function closeSearch() {
	search.query = "";
	searchOpen.value = false;
}
const editor = inject(EditorKey)!;

const ui = inject(DraftUiKey)!;
const scope = computed(() => conditionScope(editor.state.fields, { submittable: ui.kind === "submittable" }));
/** The tree holds a section's rules; its Section Break field (if the DocType has one) holds them too. */
const FIELD_PROP: Record<string, string> = { dependsOn: "depends_on", collapsible: "collapsible", collapsibleDependsOn: "collapsible_depends_on" };
function setSection(prop: "dependsOn" | "collapsible" | "collapsibleDependsOn", value: unknown) {
	const own = prop === "collapsible" ? Boolean(value) : value;
	editor.history.group(() => {
		editor.acts.setContainer(props.section.name!, prop, own);
		if (editor.field(props.section.name!)) editor.acts.setField(props.section.name!, FIELD_PROP[prop], prop === "collapsible" ? (value ? 1 : 0) : value);
	});
}

// Customize: a standard section's changed rule gets the dot and a reset, as a field's does.
const customizeKey = inject(CustomizeKey, null);
function mark(prop: "dependsOn" | "collapsibleDependsOn") {
	const site = customizeKey?.value;
	const field = editor.field(props.section.name!);
	if (!site || !field || !site.isChanged(field.fieldname, FIELD_PROP[prop])) return {};
	return { changed: true, resetText: `Reset to ${site.app}'s value`, onReset: () => setSection(prop, site.shipped(field.fieldname, FIELD_PROP[prop])) };
}

const COLUMNS = [1, 2, 3].map((n) => ({ label: String(n), value: n }));
const count = computed(() => props.section.columns.reduce((total, column) => total + column.fields.length, 0));
</script>
