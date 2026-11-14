<!--
  PROTOTYPE (#47378), variant B: the dialog's right pane. The chosen row's fields, or a new row's;
  every refusal shows under the field it is about.
-->
<template>
	<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5" data-dialog-pane>
		<template v-if="pane.mode === 'add'">
			<PaneHeading
				:icon="kindOf(pane.type).icon"
				:title="`New ${pane.type}`"
				:origin="addedBy"
			/>
			<RowForm
				:key="`add:${pane.container}:${pane.type}:${JSON.stringify(pane.prefill ?? {})}`"
				quiet
				:container="pane.container"
				:initial-type="pane.type"
				:prefill="pane.prefill"
				:parent-key="pane.parent || null"
				@done="clear"
			>
				<template #placement>
					<Select
						v-if="pane.container !== RAIL && pane.type !== 'Section'"
						v-model="pane.parent"
						:options="parentOptions(pane.container)"
						label="Place under"
					/>
					<p v-if="refusal" class="text-xs text-ink-red-4" data-refusal>{{ refusal }}</p>
				</template>
			</RowForm>
		</template>

		<template v-else-if="pane.mode === 'row' && current">
			<PaneHeading
				:icon="iconFor(current)"
				:title="nameOf(current)"
				:origin="originOf(current)"
			/>
			<p v-if="!own(current)" class="-mt-3 mb-5 text-sm text-ink-gray-5">
				You can rename it, change its icon, hide it or move it. Its type and target stay.
			</p>
			<RowForm
				:key="`edit:${current.key}:${current.item_type}`"
				quiet
				:container="pane.container"
				:row="current"
			>
				<template #placement>
					<Select
						v-if="pane.container !== RAIL && current.item_type !== 'Section'"
						:modelValue="current.parent_key ?? ''"
						:options="parentOptions(pane.container, current.key)"
						label="Place under"
						data-nest
						@update:modelValue="(value: string) => nest(pane.container, current!.key, value || null)"
					/>
					<p v-if="refusal" class="text-xs text-ink-red-4" data-refusal>{{ refusal }}</p>
				</template>
			</RowForm>

			<div class="mt-auto border-t border-outline-gray-1 pt-4">
				<div class="-mx-2 flex items-center gap-1" data-row-actions>
					<Dropdown :options="moveOptions(pane.container)" align="start" side="bottom">
						<Button
							variant="ghost"
							icon-left="lucide-arrow-right-left"
							label="Move to…"
						/>
					</Dropdown>
					<Button
						v-if="pane.container === RAIL"
						variant="ghost"
						icon-left="lucide-panel-left"
						:label="sidebarOf(current) ? 'Open its sidebar' : 'Give it a sidebar'"
						data-give-sidebar
						@click="giveSidebar(current.key)"
					/>
					<Button
						variant="ghost"
						:icon-left="current.hidden_by ? 'lucide-eye' : 'lucide-eye-off'"
						:label="current.hidden_by ? 'Show' : 'Hide'"
						@click="toggleHidden(pane.container, current.key)"
					/>
					<Button
						v-if="own(current)"
						variant="ghost"
						theme="red"
						icon-left="lucide-trash-2"
						label="Delete"
						class="ml-auto"
						@click="remove(pane.container, current.key) && clear()"
					/>
				</div>
			</div>
		</template>

		<p v-else class="m-auto text-sm text-ink-gray-5">
			Pick a row to change it, or add one with + Add.
		</p>
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Button, Dropdown, Select } from "frappe-ui";
import type { Boot } from "@/boot";
import {
	containerLabel,
	containers,
	type Container,
	type DraftRow,
	find,
	iconFor,
	level,
	nameOf,
	own,
	RAIL,
	refusal,
	rows,
	sidebarOf,
} from "./navDraft";
import { giveSidebar, moveTo, nest, remove, toggleHidden } from "./navEdits";
import { kindOf } from "./navRowKinds";
import { clear, pane } from "./dialogPane";
import PaneHeading from "./DialogPaneHeading.vue";
import RowForm from "./RowForm.vue";

const boot = inject<Boot>("boot")!;

const current = computed(() =>
	pane.value.mode === "row" ? find(pane.value.container, pane.value.key) : undefined
);
const addedBy = computed(() => (level.value === "user" ? "Added by you" : "Added for everyone"));

function originOf(row: DraftRow) {
	if (row.origin === "site") return "Added for everyone";
	if (row.origin === "user") return "Added by you";
	return `From ${boot.app_title ?? "the app"}`;
}

function parentOptions(container: Container, self?: string) {
	return [
		{ label: "Top level", value: "" },
		...rows(container)
			.filter((row) => row.key !== self && !row.marker)
			.map((row) => ({ label: nameOf(row), value: row.key })),
	];
}

function moveOptions(from: Container) {
	return containers()
		.filter((c) => c !== from)
		.map((c) => ({
			label: containerLabel(c),
			onClick: () => current.value && moveTo(from, current.value.key, c),
		}));
}
</script>
