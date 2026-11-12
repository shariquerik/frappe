<!-- PROTOTYPE (#47099), throwaway: a child's field in the parent's panel (?child=A from a grid
     column, B from the panel's list): a crumb back to the Table field, then the field's settings,
     the same panel a field of the parent gets, working on the child. -->
<template>
	<nav class="flex h-10 shrink-0 items-center gap-1 border-b border-outline-gray-1 px-3 text-base" aria-label="Breadcrumbs" data-child-crumbs>
		<button
			type="button"
			class="flex h-7 items-center gap-1 rounded-4 px-1 text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8"
			@click="back"
		>
			<span class="lucide-chevron-left size-4" aria-hidden="true" />
			{{ tableLabel }}
		</button>
		<span class="text-ink-gray-4" aria-hidden="true">›</span>
		<Tooltip :text="`Open ${child.name}'s editor`">
			<button
				type="button"
				class="flex h-7 min-w-0 items-center rounded-4 px-1 text-ink-gray-8 hover:bg-surface-gray-2"
				@click="ui.jumped = table"
			>
				<span class="truncate">{{ child.name }}</span>
			</button>
		</Tooltip>
	</nav>
	<ChildScope :child="child">
		<PanelFieldSettings v-if="field" :key="field.fieldname" :field="field" @remove="remove" @close="back" />
	</ChildScope>
</template>

<script setup lang="ts">
import { computed, inject, onMounted } from "vue";
import { Tooltip } from "frappe-ui";
import { EditorKey } from "../context";
import ChildScope from "./ChildScope.vue";
import PanelFieldSettings from "./PanelFieldSettings.vue";
import { ChildUiKey, type ChildTable } from "./childTables";

const props = defineProps<{ child: ChildTable; table: string; fieldname: string }>();
const ui = inject(ChildUiKey)!;
const parent = inject(EditorKey)!;
const field = computed(() => props.child.editor.field(props.fieldname));
const tableLabel = computed(() => parent.field(props.table)?.label || props.table);

const back = () => (ui.focus = null);
// Opened from B's list (far down the panel), the field starts at the panel's top, crumb in view.
onMounted(() => document.querySelector("[data-editor-panel]")?.scrollTo({ top: 0 }));

async function remove() {
	const draftUi = props.child.draftUi;
	if (draftUi.beforeRemove && !(await draftUi.beforeRemove(props.fieldname))) return;
	props.child.editor.acts.deleteField(props.fieldname);
	ui.focus = null;
}
</script>
