<!--
  PROTOTYPE (#47378), variant B: today's customize dialog, grown into two panes. The left lists the
  rail and one sidebar; the right is the chosen row's form, or the form for a new row.
-->
<template>
	<Dialog :modelValue="editing" size="4xl" title="Customize navigation" @update:modelValue="(open) => !open && discard()">
		<div class="-mt-2 mb-3 flex items-center justify-between">
			<LevelSwitch />
			<p v-if="refusal" class="rounded-4 bg-surface-amber-2 px-2 py-1 text-xs text-ink-gray-8" data-refusal>{{ refusal }}</p>
		</div>

		<div class="grid h-[30rem] grid-cols-[19rem_1fr] gap-4" data-dialog-editor>
			<div class="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
				<section v-for="container in shownContainers" :key="container">
					<div class="mb-1 flex items-center gap-2">
						<Select
							v-if="container !== RAIL"
							v-model="sidebar"
							:options="sidebarOptions"
							size="sm"
							class="min-w-0 flex-1"
						/>
						<p v-else class="flex-1 text-xs font-medium uppercase text-ink-gray-5">Rail</p>
						<Dropdown :options="addMenu(container)" align="end">
							<Button size="sm" icon-left="lucide-plus" label="Add" :data-add="container" />
						</Dropdown>
					</div>
					<ul class="flex flex-col gap-px">
						<li
							v-for="{ row, depth } in flatten(container)"
							:key="row.key"
							:data-key="row.key"
							:class="[
								'group/row flex h-7 cursor-pointer items-center gap-2 rounded-4 pr-1 text-sm',
								isSelected(container, row.key) ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2',
								row.hidden_by || row.marker ? 'opacity-60' : '',
							]"
							:style="{ paddingLeft: `${depth * 14 + 6}px` }"
							@click="choose(container, row.key)"
						>
							<Icon :name="iconFor(row)" class="shrink-0 text-ink-gray-6" />
							<span :class="['min-w-0 flex-1 truncate', row.item_type === 'Section' ? 'font-medium text-ink-gray-8' : 'text-ink-gray-7']">
								{{ nameOf(row) }}
							</span>
							<Badge v-if="row.marker" :label="row.marker === 'no-access' ? 'No access' : 'View deleted'" theme="red" size="sm" />
							<span v-else-if="row.hidden_by" class="lucide-eye-off size-3.5 text-ink-gray-5" />
							<Badge v-else-if="row.origin !== 'app'" :label="ORIGIN_LABEL[row.origin]" size="sm" :theme="row.origin === 'site' ? 'blue' : 'orange'" />
							<span class="hidden gap-0.5 group-hover/row:flex">
								<button type="button" class="lucide-chevron-up size-4 text-ink-gray-5" aria-label="Up" @click.stop="shift(container, row.key, -1)" />
								<button type="button" class="lucide-chevron-down size-4 text-ink-gray-5" aria-label="Down" @click.stop="shift(container, row.key, 1)" />
							</span>
						</li>
					</ul>
				</section>
			</div>

			<div class="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-8 bg-surface-gray-1 p-4" data-dialog-pane>
				<template v-if="pane.mode === 'add'">
					<Select
						v-if="pane.container !== RAIL"
						v-model="pane.parent"
						:options="parentOptions(pane.container)"
						label="Place under"
					/>
					<RowForm
						:key="`add:${pane.container}:${pane.type}`"
						:container="pane.container"
						:initial-type="pane.type"
						:parent-key="pane.parent || null"
						@done="pane = { mode: 'none' }"
					/>
				</template>

				<template v-else-if="pane.mode === 'row' && current">
					<div class="flex flex-wrap items-center gap-2" data-row-actions>
						<Button
							size="sm"
							:icon-left="current.hidden_by ? 'lucide-eye' : 'lucide-eye-off'"
							:label="current.hidden_by ? 'Show' : 'Hide'"
							@click="toggleHidden(pane.container, current.key)"
						/>
						<Button v-if="own(current)" size="sm" icon-left="lucide-trash-2" label="Delete" theme="red" @click="remove(pane.container, current.key)" />
						<Button
							v-if="pane.container === RAIL"
							size="sm"
							icon-left="lucide-panel-left"
							:label="sidebarOf(current) ? 'Edit its sidebar' : 'Give it a sidebar'"
							data-give-sidebar
							@click="linkSidebar(current.key)"
						/>
						<Select
							v-if="pane.container !== RAIL && current.item_type !== 'Section'"
							:modelValue="current.parent_key ?? ''"
							:options="parentOptions(pane.container, current.key)"
							size="sm"
							class="w-44"
							data-nest
							@update:modelValue="(v: string) => nest(pane.container, current!.key, v || null)"
						/>
						<Select
							:modelValue="''"
							:options="[{ label: 'Move to…', value: '' }, ...moveOptions(pane.container)]"
							size="sm"
							class="w-44"
							@update:modelValue="(v: string) => v && moveTo(pane.container, current!.key, v)"
						/>
					</div>
					<RowForm :key="`edit:${current.key}:${current.item_type}`" :container="pane.container" :row="current" @done="pane = { mode: 'none' }" />
				</template>

				<p v-else class="m-auto max-w-xs text-center text-sm text-ink-gray-5">
					Choose a row to edit it, or add one to the rail or a sidebar.
				</p>
			</div>
		</div>

		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Discard" @click="discard" />
				<Button variant="solid" label="Save" @click="save" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Badge, Button, Dialog, Dropdown, Select } from "frappe-ui";
import Icon from "@/icons/Icon.vue";
import {
	type Container, containerLabel, containers, discard, editing, find, flatten, focus, iconFor, level, nameOf,
	ORIGIN_LABEL, own, RAIL, refusal, rows, save, selected, sidebarOf,
} from "./navDraft";
import { giveSidebar, moveTo, nest, remove, shift, toggleHidden } from "./navEdits";
import LevelSwitch from "./LevelSwitch.vue";
import RowForm from "./RowForm.vue";

type Pane =
	| { mode: "none" }
	| { mode: "add"; container: Container; type: string; parent: string }
	| { mode: "row"; container: Container; key: string };

const TYPES = ["DocType", "View", "Record", "Page", "Link", "Act", "Section"];

const pane = ref<Pane>({ mode: "none" });
const sidebar = ref<string>("");

watch(editing, (open) => {
	if (!open) return;
	pane.value = { mode: "none" };
	sidebar.value = focus.value !== RAIL ? focus.value : containers()[1] ?? "";
});
// Another level lists other rows: what was chosen may not be on it.
watch(level, () => {
	pane.value = { mode: "none" };
	if (!containers().includes(sidebar.value)) sidebar.value = containers()[1] ?? "";
});
// "Give it a sidebar" moves the focus; the left pane follows it.
watch(focus, (value) => value !== RAIL && (sidebar.value = value));

const shownContainers = computed(() => (sidebar.value ? [RAIL, sidebar.value] : [RAIL]));
const sidebarOptions = computed(() =>
	containers()
		.filter((c) => c !== RAIL)
		.map((c) => ({ label: containerLabel(c), value: c }))
);
const current = computed(() => (pane.value.mode === "row" ? find(pane.value.container, pane.value.key) : undefined));

function addMenu(container: Container) {
	return TYPES.filter((type) => container !== RAIL || type !== "Section").map((type) => ({
		label: type,
		onClick: () => (pane.value = { mode: "add", container, type, parent: "" }),
	}));
}

function choose(container: Container, key: string) {
	pane.value = { mode: "row", container, key };
	selected.value = { container, key };
}

function isSelected(container: Container, key: string) {
	return pane.value.mode === "row" && pane.value.container === container && pane.value.key === key;
}

function parentOptions(container: Container, self?: string) {
	return [
		{ label: "Top level", value: "" },
		...rows(container)
			.filter((row) => row.key !== self && !row.marker)
			.map((row) => ({ label: `Under ${nameOf(row)}`, value: row.key })),
	];
}

function moveOptions(container: Container) {
	return containers()
		.filter((c) => c !== container)
		.map((c) => ({ label: `Move to ${containerLabel(c)}`, value: c }));
}

function linkSidebar(key: string) {
	giveSidebar(key);
	sidebar.value = focus.value;
}
</script>
