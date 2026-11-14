<!--
  PROTOTYPE (#47378), variant B: the dialog's left pane. One list at a time, the rail or one
  sidebar; a row opens in the right pane.
-->
<template>
	<div class="flex min-h-0 flex-col" data-dialog-outline>
		<div class="flex flex-col gap-2 px-6 pt-5">
			<div class="flex items-center justify-between">
				<TabButtons v-model="tab" :options="TABS" />
				<DialogAddMenu class="-mr-2" />
			</div>
			<Select
				v-if="tab === 'sidebar'"
				v-model="sidebar"
				:options="sidebarOptions"
				placeholder="Choose a sidebar"
			/>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-2">
			<ul v-if="list.length" class="flex flex-col gap-0.5" data-dialog-list>
				<li
					v-for="{ row, depth } in list"
					:key="row.key"
					:data-key="row.key"
					draggable="true"
					:class="[
						'group/row flex h-7 cursor-pointer items-center rounded-4 px-2 text-sm transition',
						isSelected(row.key)
							? 'bg-surface-elevation-3 text-ink-gray-8 shadow-sm'
							: 'text-ink-gray-7 hover:bg-surface-gray-2',
						row.hidden_by ? 'opacity-50' : '',
					]"
					@click="choose(container(), row.key)"
					@dragstart="dragged = row.key"
					@dragover.prevent
					@drop="drop(row.key)"
				>
					<span
						v-for="guide in depth"
						:key="guide"
						class="flex h-full w-4 shrink-0 justify-center"
					>
						<span class="h-full border-l border-outline-gray-2" />
					</span>
					<Icon :name="iconFor(row)" class="shrink-0 text-ink-gray-6" />
					<span
						:class="[
							'ml-2 min-w-0 flex-1 truncate',
							row.item_type === 'Section' ? 'font-medium text-ink-gray-8' : '',
						]"
					>
						{{ nameOf(row) }}
					</span>
					<Badge
						v-if="badge(row)"
						:label="badge(row)!.label"
						:theme="badge(row)!.theme"
						size="sm"
						class="ml-2 shrink-0"
					/>
					<span
						class="lucide-grip-vertical ml-1 size-3.5 shrink-0 cursor-grab text-ink-gray-4 opacity-0 group-hover/row:opacity-100"
					/>
				</li>
			</ul>
			<p v-else class="px-2 py-1 text-sm text-ink-gray-5">Nothing here yet.</p>
		</div>

		<div class="border-t border-outline-gray-1 px-6 py-3">
			<Checkbox v-model="showHidden" label="Show hidden" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Badge, Checkbox, Select, TabButtons } from "frappe-ui";
import Icon from "@/icons/Icon.vue";
import {
	containerLabel,
	containers,
	type DraftRow,
	editing,
	flatten,
	focus,
	iconFor,
	level,
	nameOf,
	own,
	RAIL,
	showHidden,
} from "./navDraft";
import { placeBefore } from "./navEdits";
import { choose, clear, container, pane, sidebar, tab } from "./dialogPane";
import DialogAddMenu from "./DialogAddMenu.vue";

const TABS = [
	{ label: "Rail", value: "rail" },
	{ label: "Sidebar", value: "sidebar" },
];

const dragged = ref<string | null>(null);

const list = computed(() => (container() ? flatten(container()) : []));
const sidebarOptions = computed(() =>
	containers()
		.filter((c) => c !== RAIL)
		.map((c) => ({ label: containerLabel(c), value: c }))
);

// The editor opens on the list it was opened from; "Give it a sidebar" moves to the new sidebar.
watch(editing, (open) => open && follow(focus.value), { immediate: true });
watch(focus, (value) => editing.value && follow(value));
watch(tab, clear);
watch(sidebar, () => tab.value === "sidebar" && clear());
watch(level, () => {
	if (!containers().includes(sidebar.value)) sidebar.value = containers()[1] ?? "";
	clear();
});

function follow(where: string) {
	if (where === RAIL) {
		tab.value = "rail";
		sidebar.value ||= containers()[1] ?? "";
		return;
	}
	sidebar.value = where;
	tab.value = "sidebar";
}

function isSelected(key: string) {
	return pane.value.mode === "row" && pane.value.key === key;
}

function drop(beforeKey: string) {
	if (dragged.value && dragged.value !== beforeKey)
		placeBefore(container(), dragged.value, container(), beforeKey);
	dragged.value = null;
}

/** One state worth saying, in order of weight; nothing for a plain row. */
function badge(row: DraftRow): { label: string; theme: "gray" | "red" } | null {
	if (row.marker === "no-access") return { label: "No access", theme: "red" };
	if (row.marker === "view-deleted") return { label: "View deleted", theme: "red" };
	if (row.hidden_by) return { label: "Hidden", theme: "gray" };
	if (own(row)) return { label: "Added", theme: "gray" };
	return null;
}
</script>
