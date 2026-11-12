<!-- PROTOTYPE (#47095), throwaway, variant B: a 240px outline left of the canvas. Tabs, then their
     sections, then their fields; only the canvas's tab is expanded, a search expands every match. A
     click on a field opens its tab, selects it and scrolls it into view; a click on a tab opens it. -->
<template>
	<nav class="flex h-full w-[240px] shrink-0 flex-col border-r border-outline-gray-1" aria-label="Fields" data-field-outline>
		<div class="px-3 pb-2 pt-3">
			<TextInput v-model="query" placeholder="Find a field">
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</TextInput>
		</div>
		<div ref="list" class="min-h-0 flex-1 overflow-y-auto px-3 pb-24">
			<template v-for="tab in outline" :key="tab.key">
				<ItemListRow
					as="button"
					type="button"
					class="-mx-1.5 mt-1 text-left"
					:selected="!query && tab.key === editor.state.activeTab"
					@click="openTab(tab.key)"
				>
					<template #prefix>
						<span class="size-4 text-ink-gray-5" :class="isOpen(tab.key) ? 'lucide-chevron-down' : 'lucide-chevron-right'" aria-hidden="true" />
					</template>
					<span class="block truncate font-medium text-ink-gray-8">{{ tab.label }}</span>
					<template #suffix><span class="text-sm text-ink-gray-4">{{ tab.count }}</span></template>
				</ItemListRow>
				<template v-if="isOpen(tab.key)">
					<template v-for="section in tab.sections" :key="section.key">
						<p v-if="section.label" class="truncate pb-0.5 pl-6 pt-2 text-sm text-ink-gray-5">{{ section.label }}</p>
						<ItemListRow
							v-for="row in section.rows"
							:key="row.fieldname"
							as="button"
							type="button"
							size="sm"
							class="-mx-1.5 pl-6 text-left"
							:data-outline-field="row.fieldname"
							:selected="row.fieldname === selected"
							@click="saved?.jumpTo(row.fieldname)"
						>
							<template #prefix><span class="size-4 text-ink-gray-5" :class="iconOf(row.fieldtype)" aria-hidden="true" /></template>
							<span class="block truncate text-ink-gray-8">{{ row.label }}</span>
						</ItemListRow>
					</template>
				</template>
			</template>
			<p v-if="!outline.length" class="px-1.5 pt-2 text-p-sm text-ink-gray-5">No field matches.</p>
		</div>
	</nav>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { ItemListRow, TextInput } from "frappe-ui";
import { EditorKey } from "../context";
import { iconOf } from "../fieldtypes";
import { fieldIndex, matches, SavedUiKey } from "./savedDoctype";

const editor = inject(EditorKey)!;
const saved = inject(SavedUiKey)!;
const query = ref("");

const selected = computed(() => (editor.state.selection?.kind === "field" ? editor.state.selection.fieldname : null));

const outline = computed(() => {
	const tabs: { key: string; label: string; count: number; sections: { key: string; label: string; rows: ReturnType<typeof fieldIndex> }[] }[] = [];
	for (const row of fieldIndex(editor)) {
		let tab = tabs.find((one) => one.key === row.tabKey);
		if (!tab) tabs.push((tab = { key: row.tabKey, label: row.tab, count: 0, sections: [] }));
		tab.count++;
		if (!matches(row, query.value)) continue;
		let section = tab.sections.at(-1);
		if (!section || section.label !== row.section) tab.sections.push((section = { key: `${row.tabKey}/${tab.sections.length}`, label: row.section, rows: [] }));
		section.rows.push(row);
	}
	return query.value ? tabs.filter((tab) => tab.sections.length) : tabs;
});

// One tab open at a time, the canvas's; a search opens every tab with a match.
const isOpen = (key: string) => Boolean(query.value) || key === editor.state.activeTab;
const openTab = (key: string) => (editor.state.activeTab = key);

// A field selected on the canvas shows in the outline too.
const list = ref<HTMLElement | null>(null);
watch(selected, async (fieldname) => {
	if (!fieldname) return;
	await nextTick();
	list.value?.querySelector(`[data-outline-field="${fieldname}"]`)?.scrollIntoView({ block: "nearest" });
});
</script>
