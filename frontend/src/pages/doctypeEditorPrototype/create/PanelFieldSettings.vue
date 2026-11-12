<!-- PROTOTYPE (#45867): the selected field's settings in the 380px panel, in the look of
     frappe/crm#3419's PanelFieldSettings. "Field" and "Conditions" start open; the rarer groups
     start closed. Each change applies at once; nothing saves. -->
<template>
	<PanelHeader
		:icon="typeIcon(field)"
		:title="field.label || field.fieldname"
		:subtitle="`${typeLabel(field.fieldtype, field.options)} · ${field.fieldname}`"
		remove-label="Remove field"
		@remove="$emit('remove')"
		@close="$emit('close')"
	/>
	<PanelSection label="Field">
		<PanelRow label="Label">
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
		<PanelRow label="Type">
			<Dropdown :options="menu" side="bottom" align="start">
				<button type="button" class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8">
					<span :class="[typeIcon(field), 'size-4 shrink-0 text-ink-gray-5']" aria-hidden="true" />
					<span class="min-w-0 flex-1 truncate">{{ typeLabel(field.fieldtype, field.options) }}</span>
					<span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				</button>
			</Dropdown>
		</PanelRow>
		<PanelRow v-if="LINKS_TO.has(field.fieldtype)" :label="field.fieldtype === 'Link' ? 'Links to' : 'Child table'">
			<Combobox
				variant="ghost"
				:model-value="field.options"
				:options="doctypes"
				placeholder="Choose a DocType"
				@update:model-value="set('options', String($event ?? ''))"
			/>
		</PanelRow>
		<PanelRow v-if="field.fieldtype === 'Select'" label="Options">
			<Textarea
				variant="ghost"
				:rows="3"
				class="!resize-none"
				placeholder="One per line"
				:model-value="field.options"
				@update:model-value="set('options', $event)"
			/>
		</PanelRow>
		<PanelRow label="Required" :box="false">
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
		<PanelRow label="Default">
			<TextInput variant="ghost" :model-value="field.default" placeholder="None" @update:model-value="set('default', $event)" />
		</PanelRow>
		<PanelRow v-if="field.fieldtype !== 'Check'" label="Placeholder">
			<TextInput variant="ghost" :model-value="field.placeholder" placeholder="Add placeholder…" @update:model-value="set('placeholder', $event)" />
		</PanelRow>
		<PanelRow label="Help text">
			<Textarea
				variant="ghost"
				:rows="1"
				class="!min-h-7 !resize-none !py-1"
				:model-value="field.description"
				placeholder="Add help text…"
				@update:model-value="set('description', $event)"
			/>
		</PanelRow>
		<PanelRow label="Fieldname" :box="false">
			<div class="flex min-h-7 flex-col justify-center px-2">
				<span class="truncate font-mono text-sm leading-7 text-ink-gray-7">{{ field.fieldname }}</span>
				<p v-if="ui.draft.value && field.added" class="pb-1 text-p-sm text-ink-gray-5">Follows the label until the first save.</p>
			</div>
		</PanelRow>
	</PanelSection>

	<PanelSection label="Conditions">
		<template #actions>
			<Tooltip text="A field name, or eval: with doc.<fieldname>, like eval:doc.status == 'Open'. Leave blank for no condition.">
				<span class="lucide-info size-4 text-ink-gray-4" aria-hidden="true" />
			</Tooltip>
		</template>
		<PanelRow v-for="rule in RULES" :key="rule.key" :label="rule.label">
			<TextInput variant="ghost" :model-value="value(rule.key)" :placeholder="rule.empty" @update:model-value="set(rule.key, $event)" />
		</PanelRow>
	</PanelSection>

	<PanelSection v-for="group in groups" :key="group.label" :label="group.label" :start-open="false" :count="group.on">
		<PanelRow v-for="prop in group.props" :key="prop.key" :label="prop.label" :box="prop.type !== 'check'" :title="prop.label">
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
import { computed, inject, nextTick, ref, watch } from "vue";
import { Combobox, Dropdown, Switch, Textarea, TextInput, Tooltip } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { EditorKey } from "../context";
import type { EditorField } from "../editor";
import PanelHeader from "./PanelHeader.vue";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";
import { DraftUiKey, TITLE_TYPES } from "./draftUi";
import { fieldnameOf, typeLabel } from "./newDoctype";
import { typeIcon, typeMenu, type FieldType } from "./typeMenu";

type Prop = { key: string; label: string; type: "check" | "text" | "int"; placeholder?: string; only?: (field: EditorField) => boolean };

const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);
const LINKS_TO = new Set(["Link", "Table", "Table MultiSelect"]);

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
const menu = computed(() => typeMenu((type: FieldType) => (set("fieldtype", type.fieldtype), set("options", type.options))));

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
