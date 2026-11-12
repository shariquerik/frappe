<!-- PROTOTYPE (#47098), throwaway: the DocType editor's Settings tab. Naming, Form, List and search,
     Permissions and the Danger zone (Design mode on a saved DocType only; Change kind is its first
     row). ?settings= picks the page: B (the default, the owner's pick) a 200px list of the
     sections with the search on top, the chosen one alone in a 728px pane (?section= keeps it); a
     search lists every matching row under its section, and greys the sections without one. A one
     scrolling page; C one summary row per setting, edited in the 380px panel. A section with no
     match hides. Every edit waits for the header's Save; `ui` is made by the page. -->
<template>
	<div v-if="!ui.loaded.done" class="flex flex-1 items-center justify-center border-t border-outline-gray-1 text-base text-ink-gray-5">Loading settings…</div>
	<div v-else-if="variant === 'B'" class="min-h-0 flex-1 overflow-y-auto border-t border-outline-gray-1" data-settings-page="B">
		<div class="mx-auto flex w-full max-w-[1048px] gap-10 px-10 pb-24 pt-8">
			<nav class="sticky top-8 flex w-[200px] shrink-0 flex-col gap-0.5 self-start" aria-label="Settings sections">
				<SearchInput v-if="!unified" v-model="ui.search.query" placeholder="Search settings" slash class="mb-2" />
				<ItemListRow
					v-for="one in sections"
					:key="one.key"
					as="button"
					type="button"
					class="text-left"
					:selected="!searching && one.key === current?.key"
					:data-section-link="one.key"
					@click="pickSection(one.key)"
				>
					<template #prefix><span class="size-4" :class="[one.icon, found.includes(one) ? 'text-ink-gray-5' : 'text-ink-gray-3']" aria-hidden="true" /></template>
					<span class="block truncate" :class="!found.includes(one) ? 'text-ink-gray-4' : one.key === 'danger' ? 'text-ink-red-7' : 'text-ink-gray-8'">{{ one.label }}</span>
				</ItemListRow>
			</nav>
			<div class="min-w-0 max-w-[728px] flex-1">
				<p v-if="!found.length" class="flex h-7 items-center text-base text-ink-gray-5">{{ noMatch }}</p>
				<!-- Every section stays mounted, so the search knows what each one holds. -->
				<section
					v-for="one in sections"
					v-show="searching ? found.includes(one) : one.key === current?.key"
					:key="one.key"
					:class="searching && one !== found[0] && 'mt-6 border-t border-outline-gray-1 pt-6'"
					:data-section="one.key"
				>
					<h2 class="mb-1 flex h-7 items-center text-lg font-semibold text-ink-gray-9">{{ one.label }}</h2>
					<SettingsSection :section="one.key" :can-customize="canCustomize" @customize="$emit('customize')" />
				</section>
			</div>
		</div>
	</div>
	<div v-else-if="variant === 'C'" class="flex min-h-0 flex-1 border-t border-outline-gray-1" data-settings-page="C">
		<div class="min-w-0 flex-1 overflow-y-auto">
			<div class="mx-auto w-full max-w-[808px] px-10 pb-24">
				<div class="sticky top-0 z-10 flex justify-end bg-surface-base pb-2 pt-8"><SearchInput v-model="ui.search.query" placeholder="Search settings" slash class="w-[240px]" /></div>
				<p v-if="!summary.length && !wide.some((one) => ui.sectionMatches(one.key))" class="text-base text-ink-gray-5">{{ noMatch }}</p>
				<section v-for="(group, at) in summary" :key="group.key" class="pb-6" :class="at && 'border-t border-outline-gray-1 pt-6'" :data-section="group.key">
					<h2 class="mb-2 text-lg font-semibold text-ink-gray-9">{{ group.label }}</h2>
					<div class="-mx-3 flex flex-col gap-0.5">
						<button
							v-for="row in group.rows"
							:key="row.key"
							type="button"
							class="grid h-9 grid-cols-[200px_minmax(0,1fr)_20px] items-center gap-3 rounded-4 px-3 text-left"
							:class="picked === row.key ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
							:data-summary-row="row.key"
							@click="picked = row.key"
						>
							<span class="truncate text-base text-ink-gray-8">{{ row.label }}</span>
							<span class="truncate text-base text-ink-gray-5">{{ row.value }}</span>
							<SettingsMark :lock="ui.lock(row.prop)" :changed="ui.changed(row.prop)" />
						</button>
					</div>
				</section>
				<section v-for="one in wide" v-show="ui.sectionMatches(one.key)" :key="one.key" class="border-t border-outline-gray-1 py-6" :data-section="one.key">
					<h2 class="mb-1 text-lg font-semibold text-ink-gray-9">{{ one.label }}</h2>
					<SettingsSection :section="one.key" :can-customize="canCustomize" @customize="$emit('customize')" />
				</section>
			</div>
		</div>
		<aside class="flex h-full w-[380px] shrink-0 flex-col overflow-y-auto border-l border-outline-gray-1" data-settings-panel>
			<SettingsPanel v-if="pickedRow" :key="pickedRow.key" v-bind="pickedRow.panel" @close="picked = ''" />
			<div v-else class="flex flex-1 items-center justify-center px-8 text-center text-base text-ink-gray-5">Pick a setting to change it.</div>
		</aside>
	</div>
	<div v-else class="min-h-0 flex-1 overflow-y-auto border-t border-outline-gray-1" data-settings-page="A">
		<div class="mx-auto w-full max-w-[808px] px-10 pb-24">
			<div class="sticky top-0 z-10 flex justify-end bg-surface-base pb-2 pt-8"><SearchInput v-model="ui.search.query" placeholder="Search settings" slash class="w-[240px]" /></div>
			<p v-if="!found.length" class="text-base text-ink-gray-5">{{ noMatch }}</p>
			<!-- Hidden, not unmounted: a section's rows tell the search what it holds. -->
			<section
				v-for="one in sections"
				v-show="found.includes(one)"
				:key="one.key"
				class="pb-6"
				:class="one !== found[0] && 'border-t border-outline-gray-1 pt-6'"
				:data-section="one.key"
			>
				<h2 class="mb-1 text-lg font-semibold text-ink-gray-9">{{ one.label }}</h2>
				<SettingsSection :section="one.key" :can-customize="canCustomize" @customize="$emit('customize')" />
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ItemListRow } from "frappe-ui";
import SettingsMark from "./SettingsMark.vue";
import SettingsPanel from "./SettingsPanel.vue";
import SearchInput from "./SearchInput.vue";
import SettingsSection from "./SettingsSection.vue";
import { matches, RULES, SettingsKey, type SettingsUi } from "./settings";

const props = defineProps<{ ui: SettingsUi; canCustomize?: boolean }>();
defineEmits<{ customize: [] }>();
provide(SettingsKey, props.ui);
const ui = props.ui;
const route = useRoute();
const router = useRouter();
const variant = computed(() => String(route.query.settings ?? "B"));
// ?search=one: the header's finder searches the settings; the list has no search of its own.
const unified = computed(() => route.query.search === "one");

const SECTIONS = [
	{ key: "naming", label: "Naming", icon: "lucide-hash" },
	{ key: "form", label: "Form", icon: "lucide-file-text" },
	{ key: "list", label: "List and search", icon: "lucide-list" },
	{ key: "permissions", label: "Permissions", icon: "lucide-shield" },
	{ key: "danger", label: "Danger zone", icon: "lucide-triangle-alert" },
];
// A child table takes naming and permissions from its parent; a Single has one record to name.
const sections = computed(() =>
	SECTIONS.filter((one) => {
		if (one.key === "naming") return ui.kind !== "child" && ui.kind !== "single";
		if (one.key === "permissions") return ui.kind !== "child";
		if (one.key === "list") return ui.kind !== "single";
		if (one.key === "danger") return !ui.draft && !ui.customizing;
		return true;
	})
);
const found = computed(() => sections.value.filter((one) => ui.sectionMatches(one.key)));
const noMatch = computed(() => `No settings match “${ui.search.query.trim()}”`);
const searching = computed(() => Boolean(ui.search.query.trim()));
const current = computed(() => sections.value.find((one) => one.key === route.query.section) ?? sections.value[0]);
// A pick during a search ends it, and shows that section alone.
function pickSection(key: string) {
	ui.search.query = "";
	void router.replace({ query: { ...route.query, section: key } });
}

// C: one row per setting; the wide sections stay on the page.
const picked = ref("");
const labelOf = (fieldname: string) => ui.fields.find((one) => one.fieldname === fieldname)?.label || fieldname;
const onOff = (prop: string) => (ui.value(prop) ? "On" : "Off");
function namingValue() {
	const rule = RULES.find((one) => one.value === ui.rule)!.label;
	const autoname = String(ui.value("autoname") ?? "");
	if (ui.rule === "field") return `${rule} · ${labelOf(autoname.slice(6))}`;
	if (ui.rule === "format") return `${rule} · ${autoname.replace(/^format:/, "")}`;
	return rule;
}
const FLAG_LABELS: Record<string, string> = { quick_entry: "Quick entry", track_changes: "Track changes", track_views: "Track views", track_seen: "Track seen", editable_grid: "Editable grid", allow_import: "Allow import", show_name_in_global_search: "In global search" };
const sortValue = () => {
	const field = ui.value("sort_field");
	const name = field === "modified" ? "Last updated" : field === "creation" || !field ? "Created on" : labelOf(field);
	return `${name}, ${ui.value("sort_order") === "ASC" ? "ascending" : "descending"}`;
};
const summary = computed(() => {
	const listed = ui.kind !== "child" && ui.kind !== "single";
	const row = (section: string, key: string, label: string, value: string, prop: string, icon: string, keywords = "") => ({
		key, label, value, prop, keywords, panel: { section, only: key, title: label, subtitle: SECTIONS.find((one) => one.key === section)!.label, icon },
	});
	const flags = Object.keys(FLAG_LABELS).filter((key) => ui.value(key)).map((key) => FLAG_LABELS[key]);
	const search = String(ui.value("search_fields") || "").split(",").map((one) => one.trim()).filter(Boolean);
	const groups = [
		...(listed
			? [
					{
						key: "naming",
						label: "Naming",
						rows: [
							row("naming", "naming", "Naming rule", namingValue(), "naming", "lucide-hash", "autoname naming series pattern format random autoincrement prompt"),
							row("naming", "rename", "Allow rename", onOff("allow_rename"), "allow_rename", "lucide-pencil"),
						],
					},
				]
			: []),
		{
			key: "form",
			label: "Form, list and search",
			rows: [
				...(listed
					? [
							row("form", "title", "Title field", ui.value("title_field") ? labelOf(ui.value("title_field")) : "None, the ID", "title_field", "lucide-heading", "title_field links"),
							row("list", "search", "Search by", search.map(labelOf).join(", ") || "The ID only", "search_fields", "lucide-search", "search_fields link"),
							row("list", "sort", "Default sort", sortValue(), "sort_field", "lucide-arrow-down-wide-narrow", "sort order list"),
							row("form", "image", "Image field", ui.value("image_field") ? labelOf(ui.value("image_field")) : "None", "image_field", "lucide-image"),
						]
					: []),
				row("form", "flags", "Options", flags.join(", ") || "All off", "", "lucide-toggle-right", "quick entry track changes views seen import global search grid attachments copy"),
			],
		},
	];
	const query = ui.search.query;
	return groups
		.map((group) => ({ ...group, rows: group.rows.filter((one) => matches([one.label, one.value, one.prop, one.keywords].join(" "), query)) }))
		.filter((group) => group.rows.length);
});
const pickedRow = computed(() => summary.value.flatMap((one) => one.rows).find((one) => one.key === picked.value));
const wide = computed(() => sections.value.filter((one) => one.key === "permissions" || one.key === "danger"));
</script>
