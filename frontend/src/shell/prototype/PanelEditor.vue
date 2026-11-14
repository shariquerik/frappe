<!--
  PROTOTYPE (#47378), variant C: a panel docked beside the live navigation, pushing the page. One
  tree holds the rail with each linked item's sidebar folded under it; forms open inline, and the
  chosen row is outlined in the live rail or sidebar.
-->
<template>
	<aside class="flex h-full w-[21rem] shrink-0 flex-col border-l border-outline-gray-1 bg-surface-white" data-panel-editor>
		<div class="flex h-12 shrink-0 items-center gap-2 border-b border-outline-gray-1 pl-4 pr-2">
			<span class="lucide-sliders-horizontal size-4 text-ink-gray-6" />
			<p class="text-base font-medium text-ink-gray-8">Navigation</p>
			<div class="ml-auto flex gap-1">
				<Button size="sm" label="Discard" @click="discard" />
				<Button size="sm" variant="solid" label="Done" @click="save" />
			</div>
		</div>
		<div class="border-b border-outline-gray-1 px-4 py-2">
			<LevelSwitch />
			<p v-if="refusal" class="mt-2 rounded-4 bg-surface-amber-2 px-2 py-1 text-xs text-ink-gray-8" data-refusal>{{ refusal }}</p>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-2">
			<template v-for="{ row } in flatten(RAIL)" :key="row.key">
				<PanelRow :container="RAIL" :row="row" :depth="0" :open="isOpen(row)" @toggle="toggleOpen(row)" />
				<!-- The sidebar this rail item opens, folded under it. -->
				<div v-if="sidebarOf(row) && isOpen(row)" class="ml-3 border-l border-outline-gray-2 pl-1" :data-sidebar="sidebarOf(row)">
					<PanelRow
						v-for="child in flatten(sidebarOf(row)!)"
						:key="child.row.key"
						:container="sidebarOf(row)!"
						:row="child.row"
						:depth="child.depth"
					/>
					<PanelAdd :container="sidebarOf(row)!" />
				</div>
			</template>
			<PanelAdd :container="RAIL" label="Add to the rail" />
		</div>

		<SelectedOutline />
	</aside>
</template>

<script setup lang="ts">
import { h, reactive } from "vue";
import { Button } from "frappe-ui";
import { discard, type DraftRow, flatten, focus, RAIL, refusal, save, selected, sidebarOf } from "./navDraft";
import LevelSwitch from "./LevelSwitch.vue";
import PanelAdd from "./PanelAdd.vue";
import PanelRow from "./PanelRow.vue";

const opened = reactive(new Set<string>());

function isOpen(row: DraftRow) {
	const address = sidebarOf(row);
	return !!address && (opened.has(row.key) || focus.value === address);
}

function toggleOpen(row: DraftRow) {
	if (opened.has(row.key)) opened.delete(row.key);
	else opened.add(row.key);
	if (focus.value === sidebarOf(row)) focus.value = RAIL;
}

// The chosen row, outlined wherever the live navigation draws it.
const SelectedOutline = () => {
	const key = selected.value?.key;
	if (!key) return null;
	const at = `[data-key="${key}"]`;
	return h("style", `${at} { outline: 2px solid var(--outline-gray-4, #999); outline-offset: 1px; border-radius: 8px; }`);
};
</script>
