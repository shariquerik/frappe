<!-- PROTOTYPE (#47098), throwaway: the Form pane and the List and search pane (`part`), each in small
     groups (SettingsGroup). Form: Record, Creating, Tracking, Attachments, Rows (a child table's).
     List and search: List, Search, Links, Import. A child table and a Single show only the groups
     that apply. `only` draws one setting (variant C's panel). -->
<template>
	<!-- The 1px cover hides the divider over whichever group shows first. -->
	<div class="relative flex flex-col before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-surface-base">
		<template v-if="part === 'form'">
			<SettingsGroup v-if="listed && (show('title') || show('image'))" label="Record">
				<SettingsRow v-if="show('title')" label="Title field" help="Lists, links and headings show it instead of the ID." prop="title_field" :reset-label="labelOf(ui.shipped('title_field')) || 'none'">
					<Combobox class="w-[200px]" :model-value="ui.value('title_field') || NONE" :options="[{ label: 'None, the ID', value: NONE }, ...pick(TITLE_TYPES)]" @update:model-value="setField('title_field', $event)" />
				</SettingsRow>
				<SettingsRow v-if="show('image')" label="Image field" help="The picture lists, links and the heading show." prop="image_field" :reset-label="labelOf(ui.shipped('image_field')) || 'none'">
					<Combobox class="w-[200px]" :model-value="ui.value('image_field') || NONE" :options="[{ label: 'None', value: NONE }, ...pick(new Set(['Attach Image']))]" @update:model-value="setField('image_field', $event)" />
				</SettingsRow>
			</SettingsGroup>
			<template v-if="show('flags')">
				<SettingsGroup v-for="group in formGroups" :key="group.label" :label="group.label">
					<FlagRow v-for="flag in group.flags" :key="flag.key" :flag="flag" />
				</SettingsGroup>
			</template>
		</template>
		<template v-else>
			<SettingsGroup v-if="listed && (show('sort') || show('flags'))" label="List">
				<SettingsRow v-if="show('flags')" label="Default view" help="The view the DocType opens in." prop="default_view">
					<Select class="w-[140px]" :model-value="ui.value('default_view') || 'List'" :options="VIEWS" @update:model-value="ui.set('default_view', $event === 'List' ? '' : $event)" />
				</SettingsRow>
				<SettingsRow v-if="show('sort')" label="Default sort" help="The order a list opens in." prop="sort_field" keywords="order">
					<div class="flex items-center gap-2">
						<Select class="w-[140px]" :model-value="ui.value('sort_field') || 'creation'" :options="sortOptions" @update:model-value="ui.set('sort_field', $event)" />
						<TabButtons :options="ORDERS" :model-value="ui.value('sort_order') || 'DESC'" @update:model-value="ui.set('sort_order', $event)" />
					</div>
				</SettingsRow>
				<FlagRow v-if="show('flags')" :flag="CALENDAR" />
			</SettingsGroup>
			<SettingsGroup v-if="listed && (show('search') || show('flags'))" label="Search">
				<SettingsRow v-if="show('search')" label="Search by" help="A Link field's search matches these fields as well as the ID." prop="search_fields" wide :reset-label="shippedSearch">
					<div class="flex flex-wrap items-center gap-1.5" data-search-chips>
						<span v-for="one in search" :key="one" class="inline-flex h-7 items-center gap-1 rounded-4 bg-surface-gray-2 pl-2.5 pr-1 text-base text-ink-gray-8">
							{{ labelOf(one) }}
							<button type="button" class="grid size-5 place-items-center rounded-3 text-ink-gray-5 hover:bg-surface-gray-4 hover:text-ink-gray-8" :aria-label="`Remove ${labelOf(one)}`" @click="setSearch(search.filter((other) => other !== one))">
								<span class="lucide-x size-3.5" aria-hidden="true" />
							</button>
						</span>
						<Combobox
							:key="search.join()"
							class="w-[160px]"
							variant="subtle"
							:model-value="''"
							:options="pick(SEARCHABLE).filter((one) => !search.includes(String(one.value)))"
							placeholder="Add a field"
							@update:model-value="$event && setSearch([...search, String($event)])"
						>
							<template #prefix><span class="lucide-plus size-4 text-ink-gray-5" aria-hidden="true" /></template>
						</Combobox>
					</div>
				</SettingsRow>
				<FlagRow v-if="show('flags')" :flag="GLOBAL_SEARCH" />
			</SettingsGroup>
			<template v-if="show('flags')">
				<SettingsGroup v-for="group in listGroups" :key="group.label" :label="group.label">
					<FlagRow v-for="flag in group.flags" :key="flag.key" :flag="flag" />
				</SettingsGroup>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, inject } from "vue";
import { Combobox, Select, Switch, TabButtons, TextInput } from "frappe-ui";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import { TITLE_TYPES } from "./draftUi";
import { SettingsKey, type SettingsKind } from "./settings";

type Flag = { key: string; label: string; help: string; only?: (kind: SettingsKind) => boolean; int?: boolean };

const props = defineProps<{ part: "form" | "list"; only?: string }>();
const ui = inject(SettingsKey)!;
const NONE = "__none";
const ORDERS = [
	{ label: "Ascending", value: "ASC" },
	{ label: "Descending", value: "DESC" },
];
const VIEWS = ["List", "Report", "Image", "Kanban", "Calendar", "Gantt"];
const SEARCHABLE = new Set(["Data", "Link", "Select", "Small Text", "Int", "Float", "Currency", "Date", "Dynamic Link", "Read Only", "Phone"]);
const notChild = (kind: SettingsKind) => kind !== "child";
const many = (kind: SettingsKind) => kind !== "child" && kind !== "single";
const CALENDAR: Flag = { key: "is_calendar_and_gantt", label: "Calendar and Gantt", help: "Offers the calendar and Gantt views." };
const GLOBAL_SEARCH: Flag = { key: "show_name_in_global_search", label: "In global search", help: "The search bar finds records by their ID." };
const FORM_GROUPS: { label: string; flags: Flag[] }[] = [
	{
		label: "Creating",
		flags: [
			{ key: "quick_entry", label: "Quick entry", help: "A new record opens in a dialog of the required fields.", only: many },
			{ key: "allow_copy", label: "Hide copy", help: "A record's menu has no Duplicate.", only: many },
			{ key: "allow_auto_repeat", label: "Auto repeat", help: "A record can repeat on a schedule.", only: many },
		],
	},
	{
		label: "Tracking",
		flags: [
			{ key: "track_changes", label: "Track changes", help: "Keeps each save's changes in the record's activity." },
			{ key: "track_views", label: "Track views", help: "Notes who opened each record.", only: notChild },
			{ key: "track_seen", label: "Track seen", help: "Marks a record seen once each person opens it.", only: notChild },
		],
	},
	{
		label: "Attachments",
		flags: [
			{ key: "max_attachments", label: "Max attachments", help: "Files one record can hold; 0 is no limit.", int: true, only: notChild },
			{ key: "make_attachments_public", label: "Make attachments public", help: "New attachments are public files by default.", only: notChild },
		],
	},
	{ label: "Rows", flags: [{ key: "editable_grid", label: "Editable grid", help: "Rows are edited in the parent's table, not a dialog.", only: (kind) => kind === "child" }] },
];
const LIST_GROUPS: { label: string; flags: Flag[] }[] = [
	{
		label: "Links",
		flags: [
			{ key: "show_title_field_in_link", label: "Show the title in links", help: "A Link field shows the title next to the ID.", only: many },
			{ key: "show_image_in_link", label: "Show the image in links", help: "A Link field's search shows each record's image.", only: many },
		],
	},
	{
		label: "Import",
		flags: [
			{ key: "allow_import", label: "Allow import", help: "Records can come in from a spreadsheet.", only: many },
			{ key: "allow_bulk_edit", label: "Allow bulk edit", help: "Many rows can be edited at once.", only: (kind) => kind !== "single" },
		],
	},
];

const show = (key: string) => !props.only || props.only === key;
const listed = computed(() => ui.kind !== "child" && ui.kind !== "single");
const fits = (groups: { label: string; flags: Flag[] }[]) =>
	groups.map((group) => ({ ...group, flags: group.flags.filter((one) => !one.only || one.only(ui.kind)) })).filter((group) => group.flags.length);
const formGroups = computed(() => fits(FORM_GROUPS));
const listGroups = computed(() => fits(LIST_GROUPS));
const labelOf = (fieldname: string) => ui.fields.find((one) => one.fieldname === fieldname)?.label || fieldname;
const pick = (types: Set<string>) => ui.fields.filter((one) => types.has(one.fieldtype)).map((one) => ({ label: one.label || one.fieldname, value: one.fieldname }));
const setField = (prop: string, value: unknown) => ui.set(prop, value === NONE || !value ? "" : String(value));

const split = (raw: string) => String(raw || "").split(",").map((one) => one.trim()).filter(Boolean);
const search = computed(() => split(ui.value("search_fields")));
const setSearch = (fields: string[]) => ui.set("search_fields", fields.join(","));
const shippedSearch = computed(() => split(ui.shipped("search_fields")).map(labelOf).join(", ") || "none");

const sortOptions = computed(() => [
	{ label: "Created on", value: "creation" },
	{ label: "Last updated", value: "modified" },
	...pick(new Set(["Date", "Datetime", "Data", "Link", "Select", "Int", "Float", "Currency"])),
]);

/** One flag: a switch, or a number box for a count. */
const FlagRow = defineComponent({
	props: { flag: { type: Object as () => Flag, required: true } },
	setup: (rowProps) => () => {
		const flag = rowProps.flag;
		const control = flag.int
			? h(TextInput, { class: "w-[80px]", type: "number", modelValue: ui.value(flag.key), "onUpdate:modelValue": (next: unknown) => ui.set(flag.key, Number(next) || 0) })
			: h(Switch, { modelValue: Boolean(ui.value(flag.key)), "onUpdate:modelValue": (next: boolean) => ui.set(flag.key, next ? 1 : 0) });
		return h(SettingsRow, { label: flag.label, help: flag.help, prop: flag.key }, () => control);
	},
});
</script>
