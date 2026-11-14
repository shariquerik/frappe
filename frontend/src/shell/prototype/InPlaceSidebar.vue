<!--
  PROTOTYPE (#47378), variant A: the sidebar itself turns editable, at its own width. Rows drag,
  rename on double-click, carry a ⋯ menu, and a "+" on each row adds under it.
-->
<template>
	<div class="flex h-full w-[14rem] shrink-0 flex-col border-l border-outline-gray-1 bg-surface-menu-bar" data-inplace-sidebar>
		<div class="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2">
			<p class="truncate text-base font-medium text-ink-gray-8">{{ title }}</p>
			<Badge class="ml-auto" :label="level === 'user' ? 'Just me' : 'Everyone'" size="sm" theme="orange" />
		</div>

		<p v-if="focus === RAIL" class="px-4 text-sm text-ink-gray-5">
			Choose a rail item with a sidebar, or give one a sidebar from its menu.
		</p>

		<div v-else class="min-h-0 flex-1 overflow-y-auto px-2 pb-2" @dragover.prevent @drop.prevent="dropAt(null)">
			<div
				v-for="{ row, depth } in flat"
				:key="row.key"
				:data-key="row.key"
				draggable="true"
				:class="[
					'group/row flex h-7 items-center gap-1 rounded-4 pr-1 hover:bg-surface-gray-2',
					row.hidden_by || row.marker ? 'opacity-60' : '',
					row.item_type === 'Section' ? 'mt-2' : '',
				]"
				:style="{ paddingLeft: `${depth * 12 + 2}px` }"
				@dragstart="dragging = { container: focus, key: row.key }"
				@dragover.prevent.stop
				@drop.prevent.stop="dropAt(row.key)"
			>
				<span class="lucide-grip-vertical size-3.5 shrink-0 cursor-grab text-ink-gray-4 opacity-0 group-hover/row:opacity-100" />
				<span
					v-if="row.item_type === 'Section'"
					class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-5"
					:class="{ '-rotate-90': row.keep_closed }"
				/>
				<Icon v-else :name="iconFor(row)" class="shrink-0 text-ink-gray-6" />
				<input
					v-if="renaming === row.key"
					v-focus
					class="h-6 min-w-0 flex-1 rounded-4 bg-surface-white px-1 text-sm"
					:value="nameOf(row)"
					@keydown.enter="finishRename(row.key, ($event.target as HTMLInputElement).value)"
					@blur="finishRename(row.key, ($event.target as HTMLInputElement).value)"
				/>
				<span
					v-else
					:class="['min-w-0 flex-1 truncate', row.item_type === 'Section' ? 'text-xs font-medium text-ink-gray-5' : 'text-sm text-ink-gray-7']"
					@dblclick="renaming = row.key"
				>{{ nameOf(row) }}</span>
				<span v-if="row.url && !row.url.startsWith('/')" class="lucide-arrow-up-right size-3 text-ink-gray-5" />
				<Badge v-if="row.marker" :label="row.marker === 'no-access' ? 'No access' : 'View deleted'" theme="red" size="sm" />
				<span v-else-if="row.hidden_by" class="lucide-eye-off size-3.5 text-ink-gray-5" />
				<span v-else-if="row.origin !== 'app'" :title="ORIGIN_LABEL[row.origin]" :class="ORIGIN_DOT[row.origin]" />
				<button
					type="button"
					class="lucide-plus hidden size-5 shrink-0 place-items-center rounded-4 text-ink-gray-5 hover:bg-surface-gray-3 group-hover/row:grid"
					:aria-label="`Add under ${nameOf(row)}`"
					@click="openAdd($event, row.key)"
				/>
				<Dropdown :options="rowMenu(focus, row, hooks(row, $el))">
					<button type="button" class="lucide-ellipsis hidden size-5 shrink-0 rounded-4 text-ink-gray-5 hover:bg-surface-gray-3 group-hover/row:block" aria-label="Row menu" />
				</Dropdown>
			</div>

			<div class="mt-2 flex flex-col gap-0.5 border-t border-outline-gray-1 pt-2">
				<button type="button" :class="ADD" data-add-row @click="openAdd($event, null)">
					<span class="lucide-plus size-4" /> Add row
				</button>
				<button type="button" :class="ADD" data-add-section @click="openAdd($event, null, 'Section')">
					<span class="lucide-heading size-4" /> Add section
				</button>
			</div>
		</div>

		<Popover v-model:open="adding" trigger="manual" :reference="anchor" side="bottom" align="start" :dismissible="false">
			<template #trigger><span /></template>
			<div class="w-80 p-3">
				<RowForm
					v-if="adding"
					:key="formKey"
					:container="focus"
					:row="editingRow"
					:parent-key="parentKey"
					:initial-type="initialType"
					@done="adding = false"
				/>
			</div>
		</Popover>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { Badge, Dropdown, Popover } from "frappe-ui";
import Icon from "@/icons/Icon.vue";
import {
	containerLabel, dragging, type DraftRow, find, flatten, focus, iconFor, level, nameOf, ORIGIN_LABEL, RAIL,
} from "./navDraft";
import { placeBefore, update } from "./navEdits";
import { rowMenu } from "./navMenu";
import RowForm from "./RowForm.vue";

const ADD = "flex h-7 items-center gap-2 rounded-4 px-2 text-sm text-ink-gray-6 hover:bg-surface-gray-2";
const ORIGIN_DOT = {
	app: "",
	site: "size-1.5 shrink-0 rounded-full bg-surface-blue-3",
	user: "size-1.5 shrink-0 rounded-full bg-surface-amber-3",
};

const vFocus = { mounted: (el: HTMLInputElement) => el.select() };

const title = computed(() => (focus.value === RAIL ? "Sidebar" : containerLabel(focus.value).replace(/ sidebar$/, "")));
const flat = computed(() => flatten(focus.value));

const renaming = ref<string | null>(null);
const adding = ref(false);
const anchor = shallowRef<Element>();
const parentKey = ref<string | null>(null);
const initialType = ref<string>();
const editingRow = ref<DraftRow>();
const formKey = ref(0);

function openAdd(event: MouseEvent, parent: string | null, type?: string) {
	const el = event.currentTarget as Element;
	show(el.closest("[data-key]") ?? el, { parent, type });
}

function hooks(row: DraftRow, el: Element) {
	return {
		rename: () => (renaming.value = row.key),
		edit: () => show(document.querySelector(`[data-inplace-sidebar] [data-key="${row.key}"]`) ?? el, { row }),
	};
}

function show(el: Element, { parent = null, type, row }: { parent?: string | null; type?: string; row?: DraftRow }) {
	anchor.value = el;
	parentKey.value = parent;
	initialType.value = type;
	editingRow.value = row;
	formKey.value++;
	adding.value = true;
}

function finishRename(key: string, label: string) {
	if (renaming.value !== key) return;
	renaming.value = null;
	const row = find(focus.value, key);
	if (row && label && label !== nameOf(row)) update(focus.value, key, { label, icon: row.icon });
}

function dropAt(before: string | null) {
	const from = dragging.value;
	dragging.value = null;
	if (from) placeBefore(from.container, from.key, focus.value, before);
}
</script>
