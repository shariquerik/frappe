<!-- PROTOTYPE (#45867): the selected field's settings in the 380px panel, in the look of
     frappe/crm#3419's PanelFieldSettings. "Field" and "Conditions" start open; the rarer groups
     start closed. Each change applies at once; nothing saves. On a saved DocType (#47095) a field
     whose column holds values says how many, keeps its type within the changes that keep them, and
     renames (custom DocType) or locks (standard) its fieldname. In Customize mode (#47096) a
     standard field hides instead of going, locks what a site may not change, and marks (and
     resets) what the site changed; a custom field names the field it is placed after. -->
<template>
	<!-- #47434 ?col=C: the field's place, a step up at a time; its column is one click away. -->
	<nav v-if="col === 'C' && place" class="mx-2 mt-2 flex h-7 min-w-0 items-center text-base text-ink-gray-5" data-field-crumbs>
		<button type="button" class="h-7 min-w-0 truncate rounded-4 px-2 hover:bg-surface-gray-2 hover:text-ink-gray-8" @click="editor.state.selection = { kind: 'section', key: place.section.name! }">
			{{ place.section.label || "Untitled section" }}
		</button>
		<span class="shrink-0 text-ink-gray-4">/</span>
		<button
			type="button"
			class="h-7 shrink-0 rounded-4 px-2 hover:bg-surface-gray-2 hover:text-ink-gray-8"
			data-crumb-column
			@mouseenter="colUi.hover = place.column.name!"
			@mouseleave="colUi.hover = null"
			@click="(colUi.hover = null), (editor.state.selection = { kind: 'column', key: place.column.name! })"
		>
			{{ place.column.label || `Column ${place.index + 1}` }}
		</button>
	</nav>
	<PanelHeader
		:class="{ '!pt-2': col === 'C' && place }"
		:icon="typeIcon(field)"
		:title="field.label || field.fieldname"
		:subtitle="subtitle"
		:remove-label="removeLabel"
		:remove-icon="removeIcon"
		@remove="$emit('remove')"
		@close="$emit('close')"
		:searchable="!unified"
		@search="searchOpen = true"
	/>
	<PanelSearchRow v-if="searchOpen" v-model="search.query" @close="closeSearch" />
	<p v-if="searching && !anyMatch" class="border-t border-outline-gray-1 px-4 py-3 text-base text-ink-gray-5">No properties match “{{ search.query.trim() }}”</p>
	<PanelSection label="Field">
		<PanelRow label="Label" v-bind="mark('label')">
			<TextInput
				ref="labelInput"
				variant="ghost"
				:model-value="field.label"
				:placeholder="field.fieldname"
				@update:model-value="set('label', $event)"
				@blur="followLabel"
				@keydown.enter="followLabel"
			/>
		</PanelRow>
		<PanelRow label="Type" :box="false" v-bind="mark('fieldtype')">
			<div class="rounded-4 hover:bg-surface-gray-2">
				<Dropdown :options="menu" side="bottom" align="start">
					<button type="button" class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8">
						<span :class="[typeIcon(field), 'size-4 shrink-0 text-ink-gray-5']" aria-hidden="true" />
						<span class="min-w-0 flex-1 truncate">{{ typeLabel(field.fieldtype, field.options) }}</span>
						<span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
					</button>
				</Dropdown>
			</div>
			<p v-if="typeNote" class="px-2 pb-1 pt-0.5 text-p-sm text-ink-gray-5">{{ typeNote }}</p>
		</PanelRow>
		<PanelRow v-if="anchor !== undefined" label="Placed after" :box="false">
			<div class="flex min-h-7 flex-col justify-center px-2">
				<div class="flex h-7 items-center text-base text-ink-gray-8">
					<span class="min-w-0 truncate">{{ anchor ? anchor.label : "The start of the form" }}</span>
				</div>
				<p class="pb-1 text-p-sm text-ink-gray-5">
					<template v-if="anchor"><code class="font-mono">{{ anchor.fieldname }}</code>. </template>Drag it to move it. It keeps this place when {{ customize!.app }} adds fields.
				</p>
			</div>
		</PanelRow>
		<PanelRow v-if="tabMenu.length > 1" label="Tab">
			<Dropdown :options="tabMenu" side="bottom" align="start">
				<button type="button" class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8">
					<span class="lucide-panel-top size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
					<span class="min-w-0 flex-1 truncate">{{ tabOfField?.label || "Untitled tab" }}</span>
					<span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				</button>
			</Dropdown>
		</PanelRow>
		<PanelRow v-if="TABLES.has(field.fieldtype) && childUi && !inChild" label="Child table" v-bind="mark('options')">
			<ChildTablePicker :field="field" />
		</PanelRow>
		<!-- #47099: the child's own editor: its fields (C), or its Details layout, the row's dialog (A, B). -->
		<PanelRow v-if="TABLES.has(field.fieldtype) && childUi && !inChild && field.options" :label="childUi.variant === 'C' ? 'Fields' : 'Row form'" :box="false">
			<div class="flex min-h-7 flex-col justify-center">
				<button
					type="button"
					class="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-4 px-2 text-left text-base text-ink-gray-8 hover:bg-surface-gray-2"
					data-open-child
					@click="childUi.jumped = field.fieldname"
				>
					<span class="min-w-0 truncate">{{ childUi.variant === "C" ? `Edit ${field.options}` : "Edit row form" }}</span>
					<span class="lucide-arrow-up-right size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				</button>
				<p v-if="childUi.variant === 'C'" class="px-2 pb-1 text-p-sm text-ink-gray-5">
					{{ gridSummary }}
				</p>
			</div>
		</PanelRow>
		<PanelRow v-else-if="LINKS_TO.has(field.fieldtype) && !(TABLES.has(field.fieldtype) && childUi && !inChild)" :label="field.fieldtype === 'Link' ? 'Links to' : 'Child table'" v-bind="mark('options')">
			<div class="w-full min-w-0 [&_[data-slot=trigger]]:!flex [&_[data-slot=trigger]]:w-full">
				<Combobox
					variant="ghost"
					:model-value="field.options"
					:options="doctypes"
					placeholder="Choose a DocType"
					@update:model-value="set('options', String($event ?? ''))"
				/>
			</div>
		</PanelRow>
		<!-- #47100: which records the Link offers (`link_filters`), in the conditions' builder. -->
		<LinkFiltersRow
			v-if="field.fieldtype === 'Link' && field.options"
			:key="`filters-${field.options}`"
			:doctype="field.options"
			:value="value('link_filters') || ''"
			:subject="field.label || field.fieldname"
			:row-key="field.fieldname"
			:record="scope.fields"
			:mark="mark('link_filters')"
			@update="set('link_filters', $event)"
		/>
		<!-- #47100 ?fetch=B: a Link field adds a read-only field that copies one of its target's. -->
		<PanelRow v-if="fetchOnLink && field.fieldtype === 'Link' && field.options" label="Fetched fields" :box="false">
			<div class="flex min-h-7 flex-col justify-center">
				<FetchAddButton :link="field" @pick="addFetched" />
				<p v-if="fetchedHere.length" class="px-2 pb-1 text-p-sm text-ink-gray-5">{{ fetchedLine }}</p>
			</div>
		</PanelRow>
		<PanelRow v-if="field.fieldtype === 'Select'" label="Options" v-bind="mark('options')">
			<Textarea
				variant="ghost"
				:rows="3"
				class="!resize-none"
				placeholder="One per line"
				:model-value="field.options"
				@update:model-value="set('options', $event)"
			/>
		</PanelRow>
		<PanelRow label="Required" :box="false" v-bind="mark('reqd')">
			<div class="flex h-7 items-center px-2">
				<Switch size="sm" :model-value="Boolean(field.reqd)" @update:model-value="set('reqd', $event ? 1 : 0)" />
			</div>
		</PanelRow>
		<PanelRow v-if="TITLE_TYPES.has(field.fieldtype) && ui.kind !== 'child'" label="Title field" :box="false">
			<div class="flex min-h-7 flex-col justify-center px-2">
				<div class="flex h-7 items-center">
					<Switch size="sm" :model-value="isTitle" @update:model-value="ui.titleField.value = $event ? field.fieldname : ''" />
				</div>
				<p v-if="isTitle" class="pb-1 text-p-sm text-ink-gray-5">Lists and links show this instead of the ID.</p>
			</div>
		</PanelRow>
		<!-- #47099: a child's field is a grid column (`in_list_view`) of a width (`columns`, 1 to 10, else the type's). -->
		<template v-if="ui.kind === 'child' && canBeColumn(field)">
			<PanelRow label="Grid column" :box="false" v-bind="mark('in_list_view')">
				<div class="flex h-7 items-center px-2">
					<Switch size="sm" :model-value="Boolean(field.in_list_view)" @update:model-value="set('in_list_view', $event ? 1 : 0)" />
				</div>
			</PanelRow>
			<PanelRow v-if="field.in_list_view" label="Column width" :box="false" v-bind="mark('columns')">
				<div class="flex min-h-7 flex-col justify-center px-2">
					<div class="flex h-7 items-center gap-2">
						<div class="flex items-center rounded-4 bg-surface-gray-2">
							<button type="button" class="grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:text-ink-gray-9 disabled:text-ink-gray-3" :disabled="!width" aria-label="Narrower" @click="set('columns', width - 1)">
								<span class="lucide-minus size-3.5" aria-hidden="true" />
							</button>
							<span class="w-9 text-center text-sm tabular-nums text-ink-gray-8">{{ width || "Auto" }}</span>
							<button type="button" class="grid size-6 place-items-center rounded-4 text-ink-gray-6 hover:text-ink-gray-9 disabled:text-ink-gray-3" :disabled="width >= 10" aria-label="Wider" @click="set('columns', width + 1)">
								<span class="lucide-plus size-3.5" aria-hidden="true" />
							</button>
						</div>
						<span class="text-sm text-ink-gray-5">{{ columnPx(field) }}px</span>
					</div>
				</div>
			</PanelRow>
		</template>
		<PanelRow v-if="!TABLES.has(field.fieldtype)" label="Default" v-bind="mark('default')">
			<TextInput variant="ghost" :model-value="field.default" placeholder="None" @update:model-value="set('default', $event)" />
		</PanelRow>
		<!-- #47100: Fetch from is a picker (a Link field, then its target's field), beside Default. -->
		<PanelRow v-if="!TABLES.has(field.fieldtype)" label="Fetch from" :box="false" v-bind="mark('fetch_from')">
			<FetchFromPicker :key="field.fieldname" :value="value('fetch_from') || ''" :links="linkFields" @update="set('fetch_from', $event)" />
		</PanelRow>
		<PanelRow v-if="value('fetch_from')" label="Only when empty" :box="false" v-bind="mark('fetch_if_empty')">
			<div class="flex min-h-7 flex-col justify-center px-2">
				<div class="flex h-7 items-center">
					<Switch size="sm" :model-value="Boolean(value('fetch_if_empty'))" @update:model-value="set('fetch_if_empty', $event ? 1 : 0)" />
				</div>
				<p class="pb-1 text-p-sm text-ink-gray-5">{{ fetchHelp }}</p>
			</div>
		</PanelRow>
		<PanelRow v-if="field.fieldtype !== 'Check' && !TABLES.has(field.fieldtype)" label="Placeholder" v-bind="mark('placeholder')">
			<TextInput variant="ghost" :model-value="field.placeholder" placeholder="Add placeholder…" @update:model-value="set('placeholder', $event)" />
		</PanelRow>
		<PanelRow label="Help text" v-bind="mark('description')">
			<Textarea
				variant="ghost"
				:rows="1"
				class="!min-h-7 !resize-none !py-1"
				:model-value="field.description"
				placeholder="Add help text…"
				@update:model-value="set('description', $event)"
			/>
		</PanelRow>
		<PanelRow label="Fieldname" :box="false" v-bind="mark('fieldname')">
			<template v-if="renamable">
				<div class="min-h-7 rounded-4 focus-within:bg-surface-gray-2 focus-within:ring-1 focus-within:ring-inset focus-within:ring-outline-gray-3 hover:bg-surface-gray-2">
					<TextInput
						variant="ghost"
						class="[&_input]:font-mono [&_input]:text-sm"
						:model-value="fieldnameDraft"
						@update:model-value="fieldnameDraft = $event"
						@blur="commitFieldname"
						@keydown.enter="commitFieldname"
						@keydown.esc.stop="fieldnameDraft = field.fieldname"
					/>
				</div>
				<p class="px-2 pb-1 pt-0.5 text-p-sm text-ink-gray-5">
					<template v-if="wasNamed">Was <code class="font-mono text-ink-gray-7">{{ wasNamed }}</code>. </template>
					Renames the column on save; {{ count ? `its ${plural(count, "value")} move with it` : "no record holds a value in it" }}. Reports, scripts and filters that name
					<code class="font-mono text-ink-gray-7">{{ wasNamed || field.fieldname }}</code> must change.
				</p>
			</template>
			<div v-else class="flex min-h-7 flex-col justify-center px-2">
				<div class="flex h-7 items-center gap-1.5">
					<span class="min-w-0 truncate font-mono text-sm text-ink-gray-7">{{ field.fieldname }}</span>
					<span v-if="locked && !customize" class="lucide-lock size-3.5 shrink-0 text-ink-gray-4" aria-hidden="true" />
				</div>
				<p v-if="ui.draft.value && field.added" class="pb-1 text-p-sm text-ink-gray-5">Follows the label until {{ saved ? "you save" : "the first save" }}.</p>
				<p v-else-if="locked && !customize" class="pb-1 text-p-sm text-ink-gray-5">A standard field keeps its fieldname. Renaming it needs a patch in the app.</p>
			</div>
		</PanelRow>
	</PanelSection>

	<TablePanel v-if="childUi && !inChild && TABLES.has(field.fieldtype) && field.options" :field="field" />

	<!-- #47100: each rule is one line in words; a click opens the builder (?cond= picks where). -->
	<PanelSection label="Conditions">
		<ConditionPanelRow
			v-for="rule in RULES"
			:key="rule.key"
			:label="rule.label"
			kind="condition"
			:value="value(rule.key) || ''"
			:empty-text="rule.empty"
			:empty-note="rule.note"
			:subject="field.label || field.fieldname"
			:row-key="`${field.fieldname}.${rule.key}`"
			:scope="scope"
			:record="scope.fields"
			:on-row="inChild"
			:mark="mark(rule.key)"
			@update="set(rule.key, $event)"
		/>
	</PanelSection>

	<PanelSection v-for="group in groups" :key="group.label" :label="group.label" :start-open="false" :count="group.on">
		<PanelRow v-for="prop in group.props" :key="prop.key" :label="prop.label" :box="prop.type !== 'check'" :title="prop.label" v-bind="mark(prop.key)">
			<div v-if="prop.type === 'check'" class="flex h-7 items-center px-2">
				<Switch size="sm" :model-value="Boolean(value(prop.key))" @update:model-value="set(prop.key, $event ? 1 : 0)" />
			</div>
			<TextInput
				v-else
				variant="ghost"
				:type="prop.type === 'int' ? 'number' : 'text'"
				:placeholder="prop.placeholder ?? 'None'"
				:model-value="value(prop.key)"
				@update:model-value="set(prop.key, prop.type === 'int' ? Number($event) || 0 : $event)"
			/>
		</PanelRow>
	</PanelSection>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch, watchEffect } from "vue";
import { Combobox, Dropdown, Switch, Textarea, TextInput } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { EditorKey } from "../context";
import type { EditorField } from "../editor";
import PanelHeader from "./PanelHeader.vue";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";
import { DraftUiKey, TITLE_TYPES } from "./draftUi";
import { CustomizeKey } from "./customize";
import { plural, SavedUiKey, typesKeepingValues } from "./savedDoctype";
import { fieldnameOf, typeLabel } from "./newDoctype";
import { COMMON, typeIcon, typeMenu, type FieldType } from "./typeMenu";
import { useRoute } from "vue-router";
import PanelSearchRow from "./PanelSearchRow.vue";
import ChildTablePicker from "./ChildTablePicker.vue";
import TablePanel from "./TablePanel.vue";
import { canBeColumn, ChildScopeKey, ChildUiKey, columnPx } from "./childTables";
import { providePanelSearch } from "./panelSearch";
import ConditionPanelRow from "./ConditionPanelRow.vue";
import FetchAddButton from "./FetchAddButton.vue";
import FetchFromPicker from "./FetchFromPicker.vue";
import LinkFiltersRow from "./LinkFiltersRow.vue";
import { conditionScope } from "./conditions";
import { colUi, use47434 } from "./proto47434";

type Prop = { key: string; label: string; type: "check" | "text" | "int"; placeholder?: string; only?: (field: EditorField) => boolean };

const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);
const LINKS_TO = new Set(["Link", "Table", "Table MultiSelect"]);
const TABLES = new Set(["Table", "Table MultiSelect"]);

const CHECKS = new Set(["reqd", "hidden", "read_only", "bold", "print_hide", "report_hide", "allow_on_submit", "translatable", "in_list_view", "in_standard_filter", "in_global_search", "in_preview", "fetch_if_empty", "unique", "no_copy", "set_only_once", "non_negative", "ignore_user_permissions"]);

const RULES = [
	{ key: "depends_on", label: "Visible if", empty: "Always", note: "Always visible. Add a condition to show it only sometimes." },
	{ key: "mandatory_depends_on", label: "Mandatory if", empty: "Never", note: "Never required by a condition. Add one to require it sometimes." },
	{ key: "read_only_depends_on", label: "Read-only if", empty: "Never", note: "Always editable. Add a condition to lock it sometimes." },
];

const props = defineProps<{ field: EditorField }>();
defineEmits<{ remove: []; close: [] }>();
// #47098: filters the properties below; "/" is the Editor's add-a-field key, so it is not bound here.
const { search, searching, anyMatch } = providePanelSearch();
const searchOpen = ref(false);
// ?search=one: the header's finder searches properties; the panel has no search of its own.
const unified = useRoute().query.search === "one";
function closeSearch() {
	search.query = "";
	searchOpen.value = false;
}
const editor = inject(EditorKey)!;
// #47434: where the field sits, for ?col=C's crumbs.
const { col } = use47434();
const place = computed(() => {
	const column = editor.columnOf(props.field.fieldname);
	const found = column ? editor.find(column.name!) : undefined;
	if (!column || found?.kind !== "column") return null;
	const section = found.parent as any;
	return { column, section, index: section.columns.indexOf(column) };
});
const ui = inject(DraftUiKey)!;
const doctypes = inject<Addresses>("addresses")!.doctypeNames();
// #47099: the page's child tables; inside a child's scope its own fields are edited, never a nested table.
const childUi = inject(ChildUiKey, null);
const inChild = Boolean(inject(ChildScopeKey, null));
const width = computed(() => Number((props.field as any).columns) || 0);
const gridSummary = computed(() => {
	const child = childUi?.get(props.field.options);
	if (!child) return "";
	const columns = childUi!.columns(child).map((one) => one.label || one.fieldname);
	return columns.length ? `Grid: ${columns.join(", ")}` : "No grid columns yet";
});

const value = (key: string) => (props.field as Record<string, any>)[key];

// #47100: what a condition may name: the other fields, the parent's on a child row, the record's own.
const scope = computed(() =>
	conditionScope(
		editor.state.fields,
		inChild ? { parent: childUi?.parentFields(), submittable: childUi?.parentSubmittable() } : { submittable: ui.kind === "submittable" }
	)
);
const linkFields = computed(() => editor.state.fields.filter((one) => one.fieldtype === "Link" && one.options && one.fieldname !== props.field.fieldname));
const fetchSource = computed(() => {
	const link = editor.field(String(value("fetch_from") ?? "").split(".")[0]);
	return link?.label || link?.options || "the linked record";
});
const fetchHelp = computed(() =>
	value("fetch_if_empty")
		? `Copies from ${fetchSource.value} only while this field is empty, so a typed value stays.`
		: `Copies from ${fetchSource.value} on every save; a typed value is replaced.`
);
// ?fetch=B: the Link field's own act, and the fields that already copy from it.
const fetchOnLink = useRoute().query.fetch === "B";
const fetchedHere = computed(() => editor.state.fields.filter((one) => String((one as any).fetch_from ?? "").split(".")[0] === props.field.fieldname));
const fetchedLine = computed(() => {
	const names = fetchedHere.value.map((one) => one.label || one.fieldname);
	return `Fetched now: ${names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ")}.`;
});
const FETCHED_TYPE: Record<string, string> = { "Text Editor": "Small Text", "Long Text": "Small Text", Text: "Small Text" };
/** A read-only field after the Link, copying the picked field; it opens in the panel. */
function addFetched(link: EditorField, source: EditorField) {
	const column = editor.columnOf(link.fieldname);
	if (!column) return;
	const at = column.fields.findIndex((entry) => (typeof entry === "string" ? entry : entry.fieldname) === link.fieldname) + 1;
	let fieldname = "";
	editor.history.group(() => {
		fieldname = editor.acts.addLabelled({ label: source.label || source.fieldname, fieldtype: FETCHED_TYPE[source.fieldtype] ?? source.fieldtype, options: source.options }, column.name!, at);
		editor.acts.setField(fieldname, "fetch_from", `${link.fieldname}.${source.fieldname}`);
		editor.acts.setField(fieldname, "read_only", 1);
	});
	editor.state.selection = { kind: "field", fieldname };
}
const set = (key: string, next: unknown) => editor.acts.setField(props.field.fieldname, key, next);
const isTitle = computed(() => ui.titleField.value === props.field.fieldname);
const pickType = (type: FieldType) => (set("fieldtype", type.fieldtype), set("options", type.options));

// A saved DocType's field: its column, how many records hold a value in it, its type at load.
const savedKey = inject(SavedUiKey, null);
const saved = computed(() => savedKey?.value ?? null);
const isSaved = computed(() => Boolean(saved.value?.isSaved(props.field.fieldname)));
watchEffect(() => isSaved.value && saved.value!.count(props.field.fieldname));
const count = computed(() => (isSaved.value ? saved.value!.counts[saved.value!.original(props.field.fieldname)] : undefined));
const loadedType = computed(() => (isSaved.value ? saved.value!.loadedType[saved.value!.original(props.field.fieldname)] : undefined));

const subtitle = computed(() => {
	// A saved field's subtitle trades the fieldname (in its own row below) for the value count.
	const type = typeLabel(props.field.fieldtype, props.field.options);
	if (!isSaved.value) return `${type} · ${props.field.fieldname}`;
	const origin = !customize.value ? "" : customize.value.fromApp(props.field.fieldname) ? ` · From ${customize.value.app}` : standard.value ? " · Standard" : " · Custom";
	return count.value === undefined ? `${type}${origin}` : `${type}${origin} · ${plural(count.value, "value")}`;
});

/** With values in its column, a field offers only the type changes that keep them; the rest show, disabled. */
const menu = computed(() => {
	if (standard.value && loadedType.value) return guardedMenu(typesKeepingValues(loadedType.value), `A standard ${loadedType.value} field can become`, "Not on a standard field");
	if (!count.value || !loadedType.value) return typeMenu(pickType);
	return guardedMenu(
		typesKeepingValues(loadedType.value),
		`Keeps its ${plural(count.value, "value")}`,
		`Not while ${plural(count.value, "record")} hold${count.value === 1 ? "s" : ""} a value`
	);
});

function guardedMenu(keeps: string[], allowed: string, refused: string) {
	if (keeps.includes("Data")) keeps.splice(keeps.indexOf("Data") + 1, 0, "Email");
	const asType = (one: string): FieldType => (one === "Email" ? { fieldtype: "Data", options: "Email" } : { fieldtype: one });
	const option = (one: string, disabled = false) => ({ label: one, icon: typeIcon(asType(one)), disabled, onClick: () => pickType(asType(one)) });
	return [
		{ group: allowed, options: keeps.map((one) => option(one)) },
		{ group: refused, options: COMMON.filter((one) => !keeps.includes(one)).map((one) => option(one, true)) },
	];
}

const typeNote = computed(() => {
	if (!loadedType.value || props.field.fieldtype === loadedType.value) return "";
	return count.value ? `The column changes type on save. Its ${plural(count.value, "value")} are kept.` : "The column changes type on save. No record holds a value in it.";
});

// Customize mode (#47096): null in Design mode and on a draft.
const customizeKey = inject(CustomizeKey, null);
const customize = computed(() => customizeKey?.value ?? null);
const standard = computed(() => Boolean(customize.value?.isStandard(props.field.fieldname)));
// #47097: outside Details a field leaves the layout only; it stays on the DocType.
const offLayout = computed(() => editor.state.layout !== "details");
const removeLabel = computed(() => (offLayout.value ? "Take off this layout" : !standard.value ? "Remove field" : props.field.hidden ? "Show field" : "Hide field"));
const removeIcon = computed(() => (offLayout.value ? "lucide-circle-minus" : !standard.value ? "lucide-trash-2" : props.field.hidden ? "lucide-eye" : "lucide-eye-off"));
const anchor = computed(() => (customize.value?.isCustom(props.field.fieldname) ? customize.value.anchor(props.field.fieldname) : undefined));
const shown = (prop: string, raw: string) => (CHECKS.has(prop) ? (raw ? "on" : "off") : raw || "empty");
/** A row's Customize mark: locked, or changed with a reset back to what the app ships. */
function mark(prop: string) {
	const ui = customize.value;
	if (!ui) return {};
	const lock = ui.lock(props.field, prop);
	if (lock) return { lock };
	if (!ui.isChanged(props.field.fieldname, prop)) return {};
	return { changed: true, resetText: `Reset to ${ui.app}'s value (${shown(prop, ui.shipped(props.field.fieldname, prop))})`, onReset: () => ui.reset(props.field.fieldname, prop) };
}

// A custom DocType renames a saved field's column on save; a standard one cannot without a patch.
const renamable = computed(() => isSaved.value && saved.value!.custom);
const locked = computed(() => isSaved.value && !saved.value!.custom);
const wasNamed = computed(() => (isSaved.value && saved.value!.renamed[props.field.fieldname]) || "");
const fieldnameDraft = ref(props.field.fieldname);
function commitFieldname() {
	const next = fieldnameOf(fieldnameDraft.value);
	fieldnameDraft.value = next;
	if (next !== props.field.fieldname) ui.rename(props.field.fieldname, next);
}

// With more than one tab, the field can move to another one here as well as by a drag.
const tabOfField = computed(() => {
	const column = editor.columnOf(props.field.fieldname);
	return editor.tree.value.find((tab) => tab.sections.some((section) => section.columns.includes(column!)));
});
const tabMenu = computed(() =>
	editor.tree.value.map((tab) => ({
		label: tab.label || "Untitled tab",
		onClick: () => {
			editor.acts.moveFieldToTab(props.field.fieldname, tab.name!);
			editor.state.activeTab = tab.name!;
		},
	}))
);

const GROUPS: { label: string; props: Prop[] }[] = [
	{
		label: "Display",
		props: [
			{ key: "hidden", label: "Hidden", type: "check" },
			{ key: "read_only", label: "Read only", type: "check" },
			{ key: "bold", label: "Bold", type: "check" },
			{ key: "print_hide", label: "Hide in print", type: "check" },
			{ key: "report_hide", label: "Hide in reports", type: "check" },
			{ key: "allow_on_submit", label: "Edit after submit", type: "check", only: () => ui.kind === "submittable" },
			{ key: "translatable", label: "Translatable", type: "check" },
		],
	},
	{
		label: "List and search",
		props: [
			{ key: "in_list_view", label: "In list view", type: "check", only: () => ui.kind !== "child" },
			{ key: "in_standard_filter", label: "List filter", type: "check" },
			{ key: "in_global_search", label: "Global search", type: "check" },
			{ key: "in_preview", label: "Link preview", type: "check" },
			{ key: "search_index", label: "Search index", type: "check" },
		],
	},
	{
		label: "Data and permissions",
		props: [
			{ key: "unique", label: "Unique", type: "check" },
			{ key: "no_copy", label: "No copy", type: "check" },
			{ key: "set_only_once", label: "Set only once", type: "check" },
			{ key: "non_negative", label: "No negatives", type: "check", only: (field) => NUMERIC.has(field.fieldtype) },
			{ key: "precision", label: "Decimal places", type: "int", only: (field) => NUMERIC.has(field.fieldtype) && field.fieldtype !== "Int" },
			{ key: "length", label: "Max length", type: "int", only: (field) => field.fieldtype === "Data" },
			{ key: "permlevel", label: "Perm level", type: "int", placeholder: "0" },
			{ key: "ignore_user_permissions", label: "Ignore user perms", type: "check", only: (field) => field.fieldtype === "Link" },
		],
	},
];

// A closed group shows how many of its properties are set, so nothing hides unseen.
const groups = computed(() =>
	GROUPS.map((group) => {
		const shown = group.props.filter((prop) => !prop.only || prop.only(props.field));
		return { label: group.label, props: shown, on: shown.filter((prop) => value(prop.key)).length };
	})
);

/** Before the first save, the fieldname follows the label as it settles. */
function followLabel() {
	if (ui.draft.value && props.field.added && props.field.label) ui.rename(props.field.fieldname, fieldnameOf(props.field.label));
}

// A new field's label takes the caret, so typing names it at once.
const labelInput = ref<{ inputElement: HTMLInputElement | null } | null>(null);
watch(
	() => ui.labelFocus.value,
	async (fieldname) => {
		if (fieldname !== props.field.fieldname) return;
		await nextTick();
		const input = labelInput.value?.inputElement;
		input?.focus();
		input?.select();
		ui.labelFocus.value = null;
	},
	{ immediate: true }
);
</script>
