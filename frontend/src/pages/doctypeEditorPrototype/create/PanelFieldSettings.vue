<!-- PROTOTYPE (#45867): the selected field's settings in the 380px panel, in the look of
     frappe/crm#3419's PanelFieldSettings. "Field" and "Conditions" start open; the rarer groups
     start closed. Each change applies at once; nothing saves. On a saved DocType (#47095) a field
     whose column holds values says how many, keeps its type within the changes that keep them, and
     renames (custom DocType) or locks (standard) its fieldname. In Customize mode (#47096) a
     standard field hides instead of going, locks what a site may not change, and marks (and
     resets) what the site changed; a custom field names the field it is placed after. -->
<template>
	<PanelHeader
		:icon="typeIcon(field)"
		:title="field.label || field.fieldname"
		:subtitle="subtitle"
		:remove-label="removeLabel"
		:remove-icon="removeIcon"
		@remove="$emit('remove')"
		@close="$emit('close')"
	/>
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
		<PanelRow v-if="LINKS_TO.has(field.fieldtype)" :label="field.fieldtype === 'Link' ? 'Links to' : 'Child table'" v-bind="mark('options')">
			<Combobox
				variant="ghost"
				:model-value="field.options"
				:options="doctypes"
				placeholder="Choose a DocType"
				@update:model-value="set('options', String($event ?? ''))"
			/>
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
		<PanelRow v-if="TITLE_TYPES.has(field.fieldtype)" label="Title field" :box="false">
			<div class="flex min-h-7 flex-col justify-center px-2">
				<div class="flex h-7 items-center">
					<Switch size="sm" :model-value="isTitle" @update:model-value="ui.titleField.value = $event ? field.fieldname : ''" />
				</div>
				<p v-if="isTitle" class="pb-1 text-p-sm text-ink-gray-5">Lists and links show this instead of the ID.</p>
			</div>
		</PanelRow>
		<PanelRow label="Default" v-bind="mark('default')">
			<TextInput variant="ghost" :model-value="field.default" placeholder="None" @update:model-value="set('default', $event)" />
		</PanelRow>
		<PanelRow v-if="field.fieldtype !== 'Check'" label="Placeholder" v-bind="mark('placeholder')">
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

	<PanelSection label="Conditions">
		<template #actions>
			<Tooltip text="A field name, or eval: with doc.<fieldname>, like eval:doc.status == 'Open'. Leave blank for no condition.">
				<span class="lucide-info size-4 text-ink-gray-4" aria-hidden="true" />
			</Tooltip>
		</template>
		<PanelRow v-for="rule in RULES" :key="rule.key" :label="rule.label" v-bind="mark(rule.key)">
			<TextInput variant="ghost" :model-value="value(rule.key)" :placeholder="rule.empty" @update:model-value="set(rule.key, $event)" />
		</PanelRow>
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
import { Combobox, Dropdown, Switch, Textarea, TextInput, Tooltip } from "frappe-ui";
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

type Prop = { key: string; label: string; type: "check" | "text" | "int"; placeholder?: string; only?: (field: EditorField) => boolean };

const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);
const LINKS_TO = new Set(["Link", "Table", "Table MultiSelect"]);

const CHECKS = new Set(["reqd", "hidden", "read_only", "bold", "print_hide", "report_hide", "allow_on_submit", "translatable", "in_list_view", "in_standard_filter", "in_global_search", "in_preview", "fetch_if_empty", "unique", "no_copy", "set_only_once", "non_negative", "ignore_user_permissions"]);

const RULES = [
	{ key: "depends_on", label: "Visible if", empty: "Always" },
	{ key: "mandatory_depends_on", label: "Mandatory if", empty: "Never" },
	{ key: "read_only_depends_on", label: "Read-only if", empty: "Never" },
];

const props = defineProps<{ field: EditorField }>();
defineEmits<{ remove: []; close: [] }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;
const doctypes = inject<Addresses>("addresses")!.doctypeNames();

const value = (key: string) => (props.field as Record<string, any>)[key];
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
const removeLabel = computed(() => (!standard.value ? "Remove field" : props.field.hidden ? "Show field" : "Hide field"));
const removeIcon = computed(() => (!standard.value ? "lucide-trash-2" : props.field.hidden ? "lucide-eye" : "lucide-eye-off"));
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
			{ key: "in_list_view", label: "In list view", type: "check" },
			{ key: "in_standard_filter", label: "List filter", type: "check" },
			{ key: "in_global_search", label: "Global search", type: "check" },
			{ key: "in_preview", label: "Link preview", type: "check" },
			{ key: "search_index", label: "Search index", type: "check" },
			{ key: "fetch_from", label: "Fetch from", type: "text", placeholder: "customer.customer_name" },
			{ key: "fetch_if_empty", label: "Fetch if empty", type: "check" },
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
