<!-- PROTOTYPE (#47434), throwaway: the selected column's settings, as the section's are drawn: its
     label, Hide label, its place among the section's columns, and Visible if. ?col=B opens it from
     the section's column list, so a "‹ <section>" crumb goes back; ?col=C from a field, so the crumb
     goes up to the section. Remove hands the column's fields to the column before it. -->
<template>
	<!-- ?col=C: the field panel's crumbs stay, with the column as the current one, so nothing moves. -->
	<nav v-if="col === 'C'" class="mx-2 mt-2 flex h-7 min-w-0 items-center text-base text-ink-gray-5" data-field-crumbs>
		<button type="button" class="h-7 min-w-0 truncate rounded-4 px-2 hover:bg-surface-gray-2 hover:text-ink-gray-8" @click="editor.state.selection = { kind: 'section', key: section.name! }">
			{{ section.label || "Untitled section" }}
		</button>
		<span class="shrink-0 text-ink-gray-4">/</span>
		<span class="shrink-0 px-2 text-ink-gray-8" aria-current="true">{{ column.label || `Column ${index + 1}` }}</span>
	</nav>
	<button
		v-else-if="col === 'B'"
		type="button"
		class="mx-2 mt-2 flex h-7 w-fit max-w-[calc(100%-1rem)] items-center gap-1 rounded-4 px-2 text-base text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8"
		data-column-back
		@click="editor.state.selection = { kind: 'section', key: section.name! }"
	>
		<span class="lucide-chevron-left -ml-1 size-4 shrink-0" aria-hidden="true" />
		<span class="truncate">{{ section.label || "Untitled section" }}</span>
	</button>
	<PanelHeader
		icon="lucide-columns-2"
		:title="column.label || `Column ${index + 1}`"
		:subtitle="`Column · ${column.fields.length} ${column.fields.length === 1 ? 'field' : 'fields'}`"
		remove-label="Remove column, keep its fields"
		:class="{ '!pt-2': col !== 'A' }"
		@remove="remove"
		@close="editor.state.selection = null"
	/>
	<PanelSection label="Column">
		<PanelRow label="Label">
			<TextInput variant="ghost" :model-value="column.label" placeholder="Add label…" @update:model-value="editor.acts.setContainer(column.name!, 'label', $event)" />
		</PanelRow>
		<PanelRow label="Hide label" :box="false">
			<div class="flex h-7 items-center px-2">
				<Switch size="sm" :disabled="!column.label" :model-value="Boolean(column.hideLabel)" @update:model-value="editor.acts.setContainer(column.name!, 'hideLabel', $event)" />
			</div>
		</PanelRow>
		<PanelRow label="Order" :box="false">
			<div class="flex gap-1.5">
				<Tooltip text="Move left (Alt+←)">
					<Button size="sm" variant="subtle" icon="lucide-arrow-left" label="Move left" :disabled="index === 0" @click="move(-1)" />
				</Tooltip>
				<Tooltip text="Move right (Alt+→)">
					<Button size="sm" variant="subtle" icon="lucide-arrow-right" label="Move right" :disabled="index === section.columns.length - 1" @click="move(1)" />
				</Tooltip>
			</div>
		</PanelRow>
	</PanelSection>
	<PanelSection label="Conditions">
		<ConditionPanelRow
			label="Visible if"
			kind="condition"
			:value="(column as any).dependsOn || ''"
			empty-text="Always"
			empty-note="Always visible. Add a condition to show the column only sometimes."
			:subject="column.label || `Column ${index + 1}`"
			:row-key="`${column.name}.depends_on`"
			:scope="scope"
			:record="scope.fields"
			@update="editor.acts.setContainer(column.name!, 'dependsOn', $event)"
		/>
	</PanelSection>
	<p v-if="col === 'A'" class="px-4 pt-2 text-p-sm text-ink-gray-5">To select a column, click its free space on the form. Drag its grip to move it.</p>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Button, Switch, TextInput, Tooltip } from "frappe-ui";
import type { LayoutTreeColumn, LayoutTreeSection } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import ConditionPanelRow from "./ConditionPanelRow.vue";
import { conditionScope } from "./conditions";
import { DraftUiKey } from "./draftUi";
import PanelHeader from "./PanelHeader.vue";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";
import { use47434 } from "./proto47434";

const props = defineProps<{ column: LayoutTreeColumn; section: LayoutTreeSection }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;
const { col } = use47434();
const scope = computed(() => conditionScope(editor.state.fields, { submittable: ui.kind === "submittable" }));
const index = computed(() => props.section.columns.indexOf(props.column));

function move(by: number) {
	editor.acts.moveContainer(props.column.name!, props.section.name!, index.value + by);
	editor.state.selection = { kind: "column", key: props.column.name! };
}

function remove() {
	const columns = props.section.columns;
	if (columns.length < 2) return;
	const into = columns[index.value - 1] ?? columns[index.value + 1];
	editor.history.group(() => {
		into.fields.push(...props.column.fields);
		editor.acts.removeContainer(props.column.name!);
	});
	editor.state.selection = { kind: "section", key: props.section.name! };
}
</script>
