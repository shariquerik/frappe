<!-- PROTOTYPE (#47097), throwaway: the `Details ▾` layout menu. Its button names the open layout;
     the menu lists Details, Side panel, Quick entry and New record (those the DocType's kind
     allows), each conditional variant indented under its type, a source badge on every row and a
     check on the open one, then "Add a variant…". It opens below its button, aligned to the
     button's edge. Rows by ?switcher=: A one line; B two (name, then where it shows); C one line
     with a trailing ⋯ holding the row's acts, its lane reserved on every row. -->
<template>
	<Popover v-model:open="open" side="bottom" :align="align" :auto-focus="false">
		<template #trigger="{ open: isOpen }">
			<Button
				variant="subtle"
				icon-right="lucide-chevron-down"
				:label="ui.current.value.title"
				class="max-w-[280px] shrink-0"
				:class="{ '!bg-surface-gray-3': isOpen }"
				data-layout-menu
			/>
		</template>
		<!-- B's second line needs the room: "A new record's page, until its first save" stays whole. -->
		<div class="flex flex-col divide-y divide-outline-elevation-2" :class="twoLine ? 'w-[440px]' : 'w-[380px]'" data-layout-menu-content>
			<div class="flex flex-col gap-px p-1.5">
				<ItemListRow
					v-for="entry in ui.entries.value"
					:key="entry.id"
					as="div"
					role="menuitem"
					tabindex="0"
					class="cursor-pointer !pr-1 hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2 focus-visible:outline-none"
					:class="[entry.variant ? '!pl-8' : '', twoLine ? '!min-h-12' : '']"
					:data-layout-row="entry.id"
					@click="pick(entry)"
					@keydown.enter.prevent="pick(entry)"
				>
					<template v-if="!entry.variant" #prefix>
						<span class="size-4 text-ink-gray-6" :class="entry.icon" aria-hidden="true" />
					</template>
					<span class="block truncate" :class="entry.variant ? 'text-ink-gray-7' : 'text-ink-gray-8'" :title="entry.label">{{ entry.label }}</span>
					<span v-if="twoLine" class="mt-0.5 block truncate text-sm text-ink-gray-5">{{ entry.where }}</span>
					<template #suffix>
						<Badge :label="entry.badge" theme="gray" class="shrink-0" />
						<span class="grid size-4 shrink-0 place-items-center" aria-hidden="true">
							<span v-if="entry.id === ui.current.value.id" class="lucide-check size-4 text-ink-gray-7" />
						</span>
						<!-- C: every row reserves the ⋯ lane (width and height), so badges line up and rows keep one height whether a row has acts or not. -->
						<span v-if="variant === 'C'" class="flex h-7 w-7 shrink-0 items-center justify-center" @click.stop @keydown.enter.stop>
							<Dropdown v-if="actsOf(ui, entry).length" :options="actsOf(ui, entry).map(withClose)" side="bottom" align="start">
								<Button variant="ghost" size="sm" icon="lucide-ellipsis" :label="`${entry.title}: more`" data-layout-acts />
							</Dropdown>
						</span>
					</template>
				</ItemListRow>
				<p v-if="ui.kind.value === 'child'" class="px-2 pb-1 pt-1.5 text-p-sm text-ink-gray-5">A child table's rows use Details only.</p>
			</div>
			<div class="flex flex-col gap-px p-1.5">
				<ItemListRow as="button" type="button" class="text-left hover:bg-surface-gray-2" data-add-variant @click="addVariant">
					<template #prefix><span class="lucide-plus size-4 text-ink-gray-6" aria-hidden="true" /></template>
					<span class="block truncate text-ink-gray-8">Add a variant…</span>
				</ItemListRow>
			</div>
		</div>
	</Popover>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Badge, Button, Dropdown, ItemListRow, Popover } from "frappe-ui";
import { actsOf, LayoutUiKey, type LayoutEntry } from "./layouts";

const props = withDefaults(defineProps<{ variant: string; align?: "start" | "end" }>(), { align: "start" });
const ui = inject(LayoutUiKey)!;
const open = ref(false);
const twoLine = computed(() => props.variant === "B");

function pick(entry: LayoutEntry) {
	ui.open(entry);
	open.value = false;
}

function addVariant() {
	open.value = false;
	ui.adding.value = true;
}

// An act closes the layout menu too: it may change the canvas under it.
const withClose = (act: { label: string; icon: string; onClick: () => void }) => ({
	...act,
	onClick: () => {
		open.value = false;
		act.onClick();
	},
});
</script>
