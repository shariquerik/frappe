<!-- PROTOTYPE (#45867): a field's every property, in a panel at the page's right. A field row
     holds the common ones; this panel holds the rest, grouped, with a search. Each change applies
     at once, as in the row. -->
<template>
	<aside class="flex w-[340px] shrink-0 flex-col border-l border-outline-gray-1 bg-surface-base">
		<div class="flex items-start gap-2 border-b border-outline-gray-1 py-3 pl-4 pr-2">
			<span :class="[typeIcon(field), 'mt-0.5 size-4 shrink-0 text-ink-gray-5']" aria-hidden="true" />
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="truncate text-base-medium text-ink-gray-9">{{ field.label || field.fieldname }}</span>
				<span class="truncate text-sm text-ink-gray-5">{{ typeLabel(field.fieldtype, field.options) }} · <span class="font-mono">{{ field.fieldname }}</span></span>
			</div>
			<Button variant="ghost" icon="lucide-x" label="Close" @click="ui.panel.value = null" />
		</div>
		<div class="px-4 pb-1 pt-3">
			<TextInput v-model="query" size="sm" placeholder="Search properties" autocomplete="off">
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</TextInput>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
			<section v-for="group in groups" :key="group.label" class="flex flex-col gap-3 border-b border-outline-gray-1 py-4 last:border-b-0">
				<h3 class="text-sm-medium text-ink-gray-5">{{ group.label }}</h3>
				<template v-for="prop in group.props" :key="prop.key">
					<div v-if="prop.type === 'check'" class="flex items-center justify-between gap-3">
						<span class="text-base text-ink-gray-7">{{ prop.label }}</span>
						<Switch size="sm" :model-value="Boolean(value(prop.key))" @update:model-value="set(prop.key, $event ? 1 : 0)" />
					</div>
					<FormControl
						v-else
						size="sm"
						:type="prop.type === 'int' ? 'number' : multiline(prop) ? 'textarea' : 'text'"
						:rows="multiline(prop) ? 3 : undefined"
						:label="prop.label"
						:placeholder="prop.placeholder"
						:model-value="value(prop.key)"
						@update:model-value="set(prop.key, prop.type === 'int' ? Number($event) || 0 : $event)"
					/>
				</template>
			</section>
			<p v-if="!groups.length" class="py-6 text-center text-base text-ink-gray-5">No property matches “{{ query }}”.</p>
		</div>
	</aside>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Button, FormControl, Switch, TextInput } from "frappe-ui";
import { EditorKey } from "../context";
import type { EditorField } from "../editor";
import { DraftUiKey } from "./draftUi";
import { typeLabel } from "./newDoctype";
import { typeIcon } from "./typeMenu";

type Prop = { key: string; label: string; type: "check" | "text" | "int"; placeholder?: string; only?: (field: EditorField) => boolean };

const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);

const props = defineProps<{ field: EditorField }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;

const value = (key: string) => (props.field as Record<string, any>)[key];
const set = (key: string, next: unknown) => editor.acts.setField(props.field.fieldname, key, next);

const GROUPS: { label: string; props: Prop[] }[] = [
	{
		label: "Basics",
		props: [
			{ key: "label", label: "Label", type: "text" },
			{ key: "options", label: "Options", type: "text", placeholder: "Link target, or Select options" },
			{ key: "default", label: "Default", type: "text", placeholder: "None" },
			{ key: "description", label: "Description", type: "text", placeholder: "Help text under the field" },
			{ key: "placeholder", label: "Placeholder", type: "text", placeholder: "None" },
		],
	},
	{
		label: "Display",
		props: [
			{ key: "hidden", label: "Hidden", type: "check" },
			{ key: "read_only", label: "Read only", type: "check" },
			{ key: "bold", label: "Bold", type: "check" },
			{ key: "print_hide", label: "Hide in print", type: "check" },
			{ key: "report_hide", label: "Hide in reports", type: "check" },
			{ key: "allow_on_submit", label: "Editable after submit", type: "check", only: () => ui.kind === "submittable" },
			{ key: "translatable", label: "Translatable", type: "check" },
		],
	},
	{
		label: "Conditions",
		props: [
			{ key: "depends_on", label: "Visible if", type: "text", placeholder: 'eval:doc.status == "Open"' },
			{ key: "mandatory_depends_on", label: "Mandatory if", type: "text", placeholder: "eval:…" },
			{ key: "read_only_depends_on", label: "Read only if", type: "text", placeholder: "eval:…" },
		],
	},
	{
		label: "List and search",
		props: [
			{ key: "in_list_view", label: "Show in list", type: "check" },
			{ key: "in_standard_filter", label: "Show as a list filter", type: "check" },
			{ key: "in_global_search", label: "Find in global search", type: "check" },
			{ key: "in_preview", label: "Show in link preview", type: "check" },
			{ key: "search_index", label: "Index for search", type: "check" },
			{ key: "fetch_from", label: "Fetch from", type: "text", placeholder: "customer.customer_name" },
			{ key: "fetch_if_empty", label: "Fetch only if empty", type: "check" },
		],
	},
	{
		label: "Data and permissions",
		props: [
			{ key: "unique", label: "Unique", type: "check" },
			{ key: "no_copy", label: "Skip when duplicating", type: "check" },
			{ key: "set_only_once", label: "Set only once", type: "check" },
			{ key: "non_negative", label: "No negative values", type: "check", only: (field) => NUMERIC.has(field.fieldtype) },
			{ key: "precision", label: "Decimal places", type: "int", only: (field) => NUMERIC.has(field.fieldtype) && field.fieldtype !== "Int" },
			{ key: "length", label: "Maximum length", type: "int", only: (field) => field.fieldtype === "Data" },
			{ key: "permlevel", label: "Permission level", type: "int" },
			{ key: "ignore_user_permissions", label: "Ignore user permissions", type: "check", only: (field) => field.fieldtype === "Link" },
		],
	},
];

// A Select's options are one per line, so they need a box that shows lines.
const multiline = (prop: Prop) => prop.key === "options" && props.field.fieldtype === "Select";

const query = ref("");
const groups = computed(() => {
	const typed = query.value.trim().toLowerCase();
	return GROUPS.map((group) => ({
		label: group.label,
		props: group.props.filter((prop) => (!prop.only || prop.only(props.field)) && (!typed || prop.label.toLowerCase().includes(typed))),
	})).filter((group) => group.props.length);
});
</script>
