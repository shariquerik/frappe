<!-- PROTOTYPE (#47095 A, #47097 round 2), throwaway: the header's "Find a field". The trigger copies
     frappe-ui's search trigger (KeyboardShortcut's SearchTrigger story): subtle, search icon, label,
     the shortcut on the right. A click or Cmd/Ctrl+J (from anywhere, a text box too) opens a popover
     below it, aligned to its right edge: a search box and the open layout's fields grouped by tab,
     the section muted on the right. Up/Down move, Enter or a click jumps to the field, Esc closes.
     #47098 ?search=one (`settings` given): it searches everything, in groups of at most 6: the
     selected field's properties, the fields, the Settings rows. A pick opens the tab, scrolls to the
     row and flashes it. -->
<template>
	<Popover v-model:open="open" side="bottom" align="end">
		<template #trigger>
			<button
				type="button"
				class="flex h-7 shrink-0 items-center gap-2 rounded-4 bg-surface-gray-2 px-2 text-base text-ink-gray-5 hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				:class="settings ? 'w-80' : 'w-56'"
				aria-keyshortcuts="Control+J Meta+J"
				data-field-finder
			>
				<span class="lucide-search size-4 shrink-0" aria-hidden="true" />
				<span class="flex-1 truncate text-left">{{ placeholder }}</span>
				<KeyboardShortcut combo="Mod+J" />
			</button>
		</template>
		<div class="flex flex-col" :class="settings ? 'w-[400px]' : 'w-[360px]'" data-field-finder-content>
			<div class="p-1.5 pb-0">
				<TextInput
					v-model="query"
					:placeholder="placeholder"
					:aria-label="placeholder"
					@keydown.down.prevent="move(1)"
					@keydown.up.prevent="move(-1)"
					@keydown.enter.prevent="enter"
				>
					<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
				</TextInput>
			</div>
			<div v-if="settings" ref="list" class="flex max-h-[420px] flex-col overflow-y-auto p-1.5">
				<div v-for="group in unifiedGroups" :key="group.label" class="flex flex-col gap-px">
					<p class="flex h-7 shrink-0 items-center px-2 text-sm font-medium leading-tighter text-ink-gray-4">{{ group.label }}</p>
					<ItemListRow
						v-for="item in group.items"
						:key="item.key"
						as="button"
						type="button"
						class="shrink-0 text-left"
						:active="items[active]?.key === item.key"
						:data-finder-row="item.key"
						@mousemove="active = items.indexOf(item)"
						@click="pick(item)"
					>
						<span class="block truncate text-ink-gray-8">{{ item.label }}</span>
						<template v-if="item.suffix" #suffix><span class="max-w-32 truncate text-sm text-ink-gray-5">{{ item.suffix }}</span></template>
					</ItemListRow>
				</div>
				<p v-if="!items.length" class="px-2 py-1.5 text-base text-ink-gray-5">Nothing matches “{{ query.trim() }}”.</p>
			</div>
			<div v-else ref="list" class="flex max-h-[360px] flex-col overflow-y-auto p-1.5">
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
import { useRoute, useRouter } from "vue-router";
import { ItemListRow, KeyboardShortcut, Popover, TextInput } from "frappe-ui";
import { EditorKey } from "../context";
import { activePanel, flash, revealProperty } from "./panelSearch";
import { fieldIndex, matches, SavedUiKey } from "./savedDoctype";
import { matches as matchesText, SECTION_LABELS, type SettingsUi } from "./settings";

type Item = { key: string; label: string; suffix: string; pick: () => void };

const props = defineProps<{ settings?: SettingsUi | null }>();
const emit = defineEmits<{ tab: [tab: string] }>();
const route = useRoute();
const router = useRouter();
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

const placeholder = computed(() => (props.settings ? "Search fields, settings, properties" : "Find a field"));
const LIMIT = 6;

// ?search=one: the open panel's properties (a field selected), the fields, the Settings rows.
const unifiedGroups = computed(() => {
	const out: { label: string; items: Item[] }[] = [];
	const q = query.value;
	const selected = editor.state.selection?.kind === "field" ? editor.field(editor.state.selection.fieldname) : null;
	const panel = activePanel.value;
	if (selected && panel) {
		const rows = [...panel.rows.entries()].filter(([, row]) => matchesText(row.text, q)).slice(0, LIMIT);
		const items = rows.map(([id, row]) => ({
			key: `property-${id}`,
			label: row.label,
			suffix: panel.groups.get(row.group)?.label ?? "",
			pick: () => {
				emit("tab", "editor");
				void revealProperty(panel, row);
			},
		}));
		if (items.length) out.push({ label: `Properties of ${selected.label || selected.fieldname}`, items });
	}
	const fields = hits.value.slice(0, LIMIT).map((row) => ({ key: `field-${row.fieldname}`, label: row.label, suffix: row.section, pick: () => jump(row.fieldname) }));
	if (fields.length) out.push({ label: "Fields", items: fields });
	const settingRows = [...(props.settings?.search.rows.entries() ?? [])].filter(([, row]) => matchesText(row.text, q)).slice(0, LIMIT);
	const settings = settingRows.map(([id, row]) => ({
		key: `setting-${id}`,
		label: row.label,
		suffix: SECTION_LABELS[row.section] ?? "",
		pick: () => void revealSetting(row.section, row.el),
	}));
	if (settings.length) out.push({ label: "Settings", items: settings });
	return out;
});
const items = computed(() => unifiedGroups.value.flatMap((group) => group.items));

function pick(item: Item) {
	open.value = false;
	item.pick();
}
function enter() {
	if (!props.settings) return hits.value[active.value] && jump(hits.value[active.value].fieldname);
	if (items.value[active.value]) pick(items.value[active.value]);
}
async function revealSetting(section: string, el: () => HTMLElement | null) {
	emit("tab", "settings");
	await router.replace({ query: { ...route.query, tab: "settings", section } });
	await nextTick();
	requestAnimationFrame(() => flash(el(), { bleed: true }));
}

watch(query, () => (active.value = 0));
watch(open, (now) => {
	if (now) return;
	query.value = "";
	active.value = 0;
});

function move(by: number) {
	const count = props.settings ? items.value.length : hits.value.length;
	if (!count) return;
	active.value = (active.value + by + count) % count;
	const key = props.settings ? items.value[active.value].key : hits.value[active.value].fieldname;
	void nextTick(() => list.value?.querySelector(`[data-finder-row="${key}"]`)?.scrollIntoView({ block: "nearest" }));
}

function jump(fieldname: string) {
	open.value = false;
	emit("tab", "editor");
	void nextTick(() => saved.value?.jumpTo(fieldname));
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
