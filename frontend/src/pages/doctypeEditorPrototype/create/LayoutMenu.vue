<!-- PROTOTYPE (#47098), throwaway: the layout crumb, last in `DocType / Contact / Details ▾`, and
     its menu, redesigned (#47097's look stays as ?menu=old, LayoutMenuOld). The crumb names the
     open layout (its title, or its type) and stops at 240px. The 320px menu opens below it,
     aligned to its left edge: one row per layout, icon, name and its source as gray text in the
     same right slot on every row; the open one has a gray fill. A titled (conditional) layout is a
     child row under its type: a corner icon under the parent's name, its title, then its condition
     in gray (the full one in a tooltip). Then the open layout's acts, no header (Rename…, Edit
     condition…, Reset to app layout, Delete layout in red), then "Add layout…". -->
<template>
	<Popover v-model:open="open" side="bottom" align="start" :auto-focus="false">
		<template #trigger="{ open: isOpen }">
			<!-- px-1, not a plain crumb's px-0.5: the hover fill keeps 2px clear of the `/`. -->
			<button
				type="button"
				:disabled="disabled"
				class="flex min-w-0 max-w-[240px] items-center gap-0.5 rounded-4 px-1 py-1 text-lg-medium leading-tighter text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				:class="isOpen ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
				data-layout-menu
			>
				<span class="min-w-0 truncate" :title="ui.current.value.name">{{ ui.current.value.name }}</span>
				<span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
			</button>
		</template>
		<div class="flex w-[320px] flex-col divide-y divide-outline-elevation-2" data-layout-menu-content>
			<div class="flex flex-col gap-px p-1.5" role="menu">
				<ItemListRow
					v-for="entry in ui.entries.value"
					:key="entry.id"
					as="div"
					role="menuitem"
					tabindex="0"
					class="cursor-pointer focus-visible:outline-none"
					:class="[
						entry.id === ui.current.value.id ? 'bg-surface-gray-2 hover:bg-surface-gray-3 focus-visible:bg-surface-gray-3' : 'hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2',
						{ '!pl-8': entry.variant },
					]"
					:data-layout-row="entry.id"
					:data-open="entry.id === ui.current.value.id || undefined"
					@click="pick(entry)"
					@keydown.enter.prevent="pick(entry)"
				>
					<template #prefix>
						<span class="size-4 text-ink-gray-6" :class="entry.variant ? 'lucide-corner-down-right' : entry.icon" aria-hidden="true" />
					</template>
					<span v-if="!entry.variant" class="block truncate text-ink-gray-8">{{ entry.name }}</span>
					<span v-else class="flex min-w-0 items-baseline gap-1.5">
						<span class="max-w-[60%] shrink-0 truncate text-ink-gray-8" :title="entry.name">{{ entry.name }}</span>
						<Tooltip :text="entry.variant.condition">
							<span class="min-w-0 truncate text-ink-gray-5" data-layout-condition>{{ entry.variant.condition }}</span>
						</Tooltip>
					</span>
					<template #suffix>
						<span class="text-sm leading-tighter text-ink-gray-5" data-layout-source>{{ entry.source }}</span>
					</template>
				</ItemListRow>
				<p v-if="ui.kind.value === 'child'" class="px-2 pb-1 pt-1.5 text-p-sm text-ink-gray-5">A child table's rows use Details only.</p>
			</div>
			<div v-if="acts.length" class="flex flex-col gap-px p-1.5" data-layout-acts>
				<ItemListRow
					v-for="act in acts"
					:key="act.label"
					as="button"
					type="button"
					class="text-left"
					:class="act.danger ? 'hover:bg-surface-red-3' : 'hover:bg-surface-gray-2'"
					:data-layout-act="act.label"
					@click="run(act)"
				>
					<template #prefix><span class="size-4" :class="[act.icon, act.danger ? 'text-ink-red-7' : 'text-ink-gray-6']" aria-hidden="true" /></template>
					<span class="block truncate" :class="act.danger ? 'text-ink-red-7' : 'text-ink-gray-8'">{{ act.label }}</span>
				</ItemListRow>
			</div>
			<div class="flex flex-col gap-px p-1.5">
				<ItemListRow as="button" type="button" class="text-left hover:bg-surface-gray-2" data-add-layout @click="addLayout">
					<template #prefix><span class="lucide-plus size-4 text-ink-gray-6" aria-hidden="true" /></template>
					<span class="block truncate text-ink-gray-8">Add layout…</span>
				</ItemListRow>
			</div>
		</div>
	</Popover>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { ItemListRow, Popover, Tooltip } from "frappe-ui";
import { actsOf, LayoutUiKey, type LayoutAct, type LayoutEntry } from "./layouts";

// Disabled until the layouts load: the rows' sources need them.
defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ picked: [] }>();
const ui = inject(LayoutUiKey)!;
const open = ref(false);
const acts = computed(() => actsOf(ui, ui.current.value));

function pick(entry: LayoutEntry) {
	ui.open(entry);
	open.value = false;
	emit("picked");
}

// An act closes the menu first: it may change the canvas under it, or open a dialog.
function run(act: LayoutAct) {
	open.value = false;
	act.onClick();
}

function addLayout() {
	open.value = false;
	ui.adding.value = true;
}
</script>
