<!-- PROTOTYPE (#47097), throwaway: the layout crumb, last in `DocType / Contact / Details ▾`, and
     its menu. The crumb names the open layout in the crumbs' own type; a click opens the menu
     below it, aligned to its left edge. The menu lists Details, Side panel, Quick entry and New
     record (those the DocType's kind allows), each conditional variant indented under its type, a
     source badge on every row and a check on the open one. Round 2: the open layout's own acts
     follow (Edit condition…, Reset to app layout, Delete variant) under a muted header naming it
     and where it shows; a layout with no acts drops the header too. "Add a variant…" ends it.
     #47098: kept as ?menu=old to compare with the new LayoutMenu. It takes #47098's words and
     titles ("Add layout…", "Delete layout", Rename…, a variant row and the crumb read its title,
     the crumb stops at 240px); the look is #47097's. -->
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
		<div class="flex w-[380px] flex-col divide-y divide-outline-elevation-2" data-layout-menu-content>
			<div class="flex flex-col gap-px p-1.5">
				<ItemListRow
					v-for="entry in ui.entries.value"
					:key="entry.id"
					as="div"
					role="menuitem"
					tabindex="0"
					class="cursor-pointer !pr-1 hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2 focus-visible:outline-none"
					:class="{ '!pl-8': entry.variant }"
					:data-layout-row="entry.id"
					@click="pick(entry)"
					@keydown.enter.prevent="pick(entry)"
				>
					<template v-if="!entry.variant" #prefix>
						<span class="size-4 text-ink-gray-6" :class="entry.icon" aria-hidden="true" />
					</template>
					<span class="block truncate" :class="entry.variant ? 'text-ink-gray-7' : 'text-ink-gray-8'" :title="entry.name">{{ entry.name }}</span>
					<template #suffix>
						<Badge :label="entry.badge" theme="gray" class="shrink-0" />
						<span class="grid size-4 shrink-0 place-items-center" aria-hidden="true">
							<span v-if="entry.id === ui.current.value.id" class="lucide-check size-4 text-ink-gray-7" />
						</span>
					</template>
				</ItemListRow>
				<p v-if="ui.kind.value === 'child'" class="px-2 pb-1 pt-1.5 text-p-sm text-ink-gray-5">A child table's rows use Details only.</p>
			</div>
			<div v-if="acts.length" class="flex flex-col gap-px p-1.5" data-layout-acts>
				<div class="px-2 pb-1.5 pt-1">
					<p class="truncate text-sm font-medium leading-tighter text-ink-gray-5" :title="ui.current.value.name">{{ ui.current.value.name }}</p>
					<p class="mt-1 text-sm leading-tighter text-ink-gray-4">{{ ui.current.value.where }}</p>
				</div>
				<ItemListRow v-for="act in acts" :key="act.label" as="button" type="button" class="text-left hover:bg-surface-gray-2" :data-layout-act="act.label" @click="run(act)">
					<template #prefix><span class="size-4 text-ink-gray-6" :class="act.icon" aria-hidden="true" /></template>
					<span class="block truncate text-ink-gray-8">{{ act.label }}</span>
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
import { Badge, ItemListRow, Popover } from "frappe-ui";
import { actsOf, LayoutUiKey, type LayoutEntry } from "./layouts";

// Disabled until the layouts load: the menu's badges need them.
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
function run(act: { onClick: () => void }) {
	open.value = false;
	act.onClick();
}

function addLayout() {
	open.value = false;
	ui.adding.value = true;
}
</script>
