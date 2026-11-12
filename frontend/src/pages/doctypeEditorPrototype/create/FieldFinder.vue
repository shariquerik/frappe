<!-- PROTOTYPE (#47095 A, #47097 round 2), throwaway: the header's "Find a field". The trigger copies
     frappe-ui's search trigger (KeyboardShortcut's SearchTrigger story): subtle, search icon, label,
     the shortcut on the right. A click or Cmd/Ctrl+J (from anywhere, a text box too) opens a popover
     below it, aligned to its right edge: a search box and the open layout's fields grouped by tab,
     the section muted on the right. Up/Down move, Enter or a click jumps to the field, Esc closes. -->
<template>
	<Popover v-model:open="open" side="bottom" align="end">
		<template #trigger>
			<button
				type="button"
				class="flex h-7 w-56 shrink-0 items-center gap-2 rounded-4 bg-surface-gray-2 px-2 text-base text-ink-gray-5 hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				aria-keyshortcuts="Control+J Meta+J"
				data-field-finder
			>
				<span class="lucide-search size-4 shrink-0" aria-hidden="true" />
				<span class="flex-1 truncate text-left">Find a field</span>
				<KeyboardShortcut combo="Mod+J" />
			</button>
		</template>
		<div class="flex w-[360px] flex-col" data-field-finder-content>
			<div class="p-1.5 pb-0">
				<TextInput
					v-model="query"
					placeholder="Find a field"
					aria-label="Find a field"
					@keydown.down.prevent="move(1)"
					@keydown.up.prevent="move(-1)"
					@keydown.enter.prevent="hits[active] && jump(hits[active].fieldname)"
				>
					<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
				</TextInput>
			</div>
			<div ref="list" class="flex max-h-[360px] flex-col overflow-y-auto p-1.5">
				<div v-for="group in groups" :key="group.tab" class="flex flex-col gap-px">
					<!-- A DocType with no tabs has one group: its "Untitled tab" header says nothing. -->
					<p v-if="tabbed" class="flex h-7 shrink-0 items-center px-2 text-sm font-medium leading-tighter text-ink-gray-4">{{ group.tab }}</p>
					<ItemListRow
						v-for="row in group.rows"
						:key="row.fieldname"
						as="button"
						type="button"
						class="shrink-0 text-left"
						:active="hits[active]?.fieldname === row.fieldname"
						:data-finder-row="row.fieldname"
						@mousemove="active = hits.indexOf(row)"
						@click="jump(row.fieldname)"
					>
						<span class="block truncate text-ink-gray-8">{{ row.label }}</span>
						<template v-if="row.section" #suffix><span class="max-w-32 truncate text-sm text-ink-gray-5">{{ row.section }}</span></template>
					</ItemListRow>
				</div>
				<p v-if="!hits.length" class="px-2 py-1.5 text-base text-ink-gray-5">No field matches “{{ query.trim() }}”.</p>
			</div>
		</div>
	</Popover>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ItemListRow, KeyboardShortcut, Popover, TextInput } from "frappe-ui";
import { EditorKey } from "../context";
import { fieldIndex, matches, SavedUiKey } from "./savedDoctype";

const editor = inject(EditorKey)!;
const saved = inject(SavedUiKey)!;
const open = ref(false);
const query = ref("");
const active = ref(0);
const list = ref<HTMLElement>();

const tabbed = computed(() => editor.tree.value.length > 1);
const hits = computed(() => fieldIndex(editor).filter((row) => matches(row, query.value) || row.section.toLowerCase().includes(query.value.trim().toLowerCase())));
const groups = computed(() => {
	const out: { tab: string; rows: typeof hits.value }[] = [];
	for (const row of hits.value) {
		let group = out.find((one) => one.tab === row.tab);
		if (!group) out.push((group = { tab: row.tab, rows: [] }));
		group.rows.push(row);
	}
	return out;
});

watch(query, () => (active.value = 0));
watch(open, (now) => {
	if (now) return;
	query.value = "";
	active.value = 0;
});

function move(by: number) {
	if (!hits.value.length) return;
	active.value = (active.value + by + hits.value.length) % hits.value.length;
	void nextTick(() => list.value?.querySelector(`[data-finder-row="${hits.value[active.value].fieldname}"]`)?.scrollIntoView({ block: "nearest" }));
}

function jump(fieldname: string) {
	open.value = false;
	saved.value?.jumpTo(fieldname);
}

// Capture, so a text box or a menu under the caret cannot keep Cmd/Ctrl+J (Chrome's Downloads) to itself.
function onKeydown(event: KeyboardEvent) {
	if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "j") return;
	event.preventDefault();
	event.stopPropagation();
	open.value = !open.value;
}
onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>
