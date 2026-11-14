<!--
  PROTOTYPE (#47378), variant A: the rail itself turns editable, like desk v1's dock editor. A tile
  opens its menu; tiles drag; a linked tile opens its sidebar beside it for editing.
-->
<template>
	<SidebarRail data-inplace-rail>
		<div class="mb-3 flex shrink-0 justify-center">
			<span class="grid size-7 place-items-center rounded-[7px] bg-surface-gray-3 text-ink-gray-6">
				<span class="lucide-pencil size-4" />
			</span>
		</div>
		<div class="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto" @dragover.prevent @drop.prevent="dropAt(null)">
			<div
				v-for="{ row } in flat"
				:key="row.key"
				:data-key="row.key"
				draggable="true"
				class="relative"
				@dragstart="dragging = { container: RAIL, key: row.key }"
				@dragover.prevent.stop
				@drop.prevent.stop="dropAt(row.key)"
			>
				<Dropdown :options="rowMenu(RAIL, row, hooks(row))" side="right" align="start">
					<button
						type="button"
						:aria-label="nameOf(row)"
						:title="nameOf(row)"
						:class="[
							'grid size-7 place-items-center rounded-[7px] ring-1 ring-outline-gray-3 cursor-grab',
							focus === sidebarOf(row) ? 'bg-surface-gray-4' : 'bg-surface-gray-3',
							row.hidden_by ? 'opacity-40' : '',
						]"
					>
						<Icon :name="iconFor(row)" />
					</button>
				</Dropdown>
				<!-- A linked tile carries a corner mark; its sidebar shows beside the rail when chosen. -->
				<span
					v-if="sidebarOf(row)"
					class="absolute -right-1 -top-1 size-2 rounded-full border border-surface-white bg-surface-gray-7"
				/>
				<span v-if="row.origin !== 'app'" :class="['absolute -bottom-1 -right-1 size-2 rounded-full border border-surface-white', row.origin === 'site' ? 'bg-surface-blue-3' : 'bg-surface-amber-3']" />
			</div>
			<button
				type="button"
				class="grid size-7 shrink-0 place-items-center rounded-[7px] border border-dashed border-outline-gray-3 text-ink-gray-5 hover:bg-surface-gray-2"
				aria-label="Add to the rail"
				data-add-rail
				@click="show($event.currentTarget as Element, {})"
			>
				<span class="lucide-plus size-4" />
			</button>
		</div>

		<Popover v-model:open="adding" trigger="manual" :reference="anchor" side="bottom" align="start" :dismissible="false">
			<template #trigger><span /></template>
			<div class="w-80 p-3">
				<RowForm v-if="adding" :key="formKey" :container="RAIL" :row="editingRow" @done="adding = false" />
			</div>
		</Popover>
	</SidebarRail>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { Dropdown, Popover, SidebarRail } from "frappe-ui";
import Icon from "@/icons/Icon.vue";
import { dragging, type DraftRow, flatten, focus, iconFor, nameOf, RAIL, sidebarOf } from "./navDraft";
import { placeBefore } from "./navEdits";
import { rowMenu } from "./navMenu";
import RowForm from "./RowForm.vue";

const flat = computed(() => flatten(RAIL));

const adding = ref(false);
const anchor = shallowRef<Element>();
const editingRow = ref<DraftRow>();
const formKey = ref(0);

function hooks(row: DraftRow) {
	const open = () => show(document.querySelector(`[data-inplace-rail] [data-key="${row.key}"]`)!, { row });
	return { rename: open, edit: open };
}

function show(el: Element, { row }: { row?: DraftRow }) {
	anchor.value = el;
	editingRow.value = row;
	formKey.value++;
	adding.value = true;
}

function dropAt(before: string | null) {
	const from = dragging.value;
	dragging.value = null;
	if (from) placeBefore(from.container, from.key, RAIL, before);
}
</script>
