<!-- PROTOTYPE (#45867): a field on the canvas as the record page draws it, one size up, inert. A
     click selects it (its settings open in the panel); the whole field drags. Copies
     frappe/crm#3419's EditorField: ring on hover and select, no fill, grip in the label row. -->
<template>
	<div
		data-editor-select
		class="editor-field group/field relative -m-2 cursor-grab rounded-6 p-2 transition-shadow active:cursor-grabbing"
		:class="selected ? 'ring-1 ring-outline-gray-4' : 'hover:ring-1 hover:ring-outline-gray-2'"
	>
		<div v-if="field.fieldtype !== 'Check'" class="mb-1.5 flex items-center gap-1 text-sm text-ink-gray-6">
			<span class="truncate">{{ field.label || field.fieldname }}</span>
			<span v-if="field.reqd" class="-ml-0.5 text-ink-red-4">*</span>
			<span v-if="isTitle" class="shrink-0 text-ink-gray-4">· Title field</span>
			<ConditionMark :rules="rules" />
			<CustomizeMarks :field="field" />
			<!-- Variant B (#47096): a standard field's lock sits in the grip's lane, so it takes no label width. -->
			<span v-if="locked && !selected" class="-my-1 ml-auto grid size-4 shrink-0 place-items-center group-hover/field:hidden" aria-label="Standard field">
				<span class="lucide-lock size-3.5 text-ink-gray-4" />
			</span>
			<span
				class="lucide-grip-vertical -my-1 ml-auto size-4 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover/field:opacity-100"
				:class="{ '!opacity-100': selected, 'hidden group-hover/field:block': locked && !selected }"
				aria-hidden="true"
			/>
		</div>
		<!-- #47099: a Table field draws as its grid; ?child=A makes its columns clickable, so it is not inert. -->
		<CanvasGrid v-if="TABLE.has(field.fieldtype) && childUi" :field="field" :class="{ 'opacity-50': customizing && field.hidden }" />
		<div v-else class="pointer-events-none" :class="{ 'opacity-50': customizing && field.hidden }" tabindex="-1" inert>
			<div v-if="field.fieldtype === 'Check'" class="flex min-h-7 items-center gap-2">
				<FormControl type="checkbox" :model-value="false" />
				<span class="text-sm text-ink-gray-6">{{ field.label }}<span v-if="field.reqd" class="text-ink-red-4">*</span></span>
				<ConditionMark :rules="rules" />
				<CustomizeMarks :field="field" />
				<!-- Variant B (#47096): a standard field's lock sits in the grip's lane, so it takes no label width. -->
				<span v-if="locked && !selected" class="ml-auto grid size-4 shrink-0 place-items-center group-hover/field:hidden" aria-label="Standard field">
					<span class="lucide-lock size-3.5 text-ink-gray-4" />
				</span>
				<span
					class="lucide-grip-vertical ml-auto size-4 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover/field:opacity-100"
					:class="{ '!opacity-100': selected, 'hidden group-hover/field:block': locked && !selected }"
					aria-hidden="true"
				/>
			</div>
			<FormControl v-else-if="TEXTAREA.has(field.fieldtype)" type="textarea" size="md" :rows="3" model-value="" :placeholder="field.placeholder" />
			<FormControl v-else-if="CHOICE.has(field.fieldtype)" type="select" size="md" model-value="" :options="[{ label: choiceText, value: '' }]" />
			<div
				v-else-if="TABLE.has(field.fieldtype)"
				class="flex h-20 items-center justify-center rounded-4 border border-dashed border-outline-gray-2 text-base text-ink-gray-5"
			>
				{{ field.options ? `Rows of ${field.options}` : "Choose its child table in the panel" }}
			</div>
			<TextInput v-else size="md" model-value="" :placeholder="placeholder">
				<template v-if="SUFFIX[field.fieldtype]" #suffix>
					<span :class="[SUFFIX[field.fieldtype], 'size-4 text-ink-gray-5']" aria-hidden="true" />
				</template>
			</TextInput>
		</div>
		<p v-if="field.description" class="mt-1.5 text-p-sm text-ink-gray-5">{{ field.description }}</p>
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { useRoute } from "vue-router";
import { FormControl, TextInput } from "frappe-ui";
import type { EditorField } from "../editor";
import CanvasGrid from "./CanvasGrid.vue";
import CustomizeMarks from "./CustomizeMarks.vue";
import ConditionMark from "./ConditionMark.vue";
import { ChildScopeKey, ChildUiKey } from "./childTables";
import { CustomizeKey } from "./customize";
import { DraftUiKey } from "./draftUi";

const TEXTAREA = new Set(["Small Text", "Text", "Long Text", "Text Editor", "Markdown Editor", "Code", "JSON", "HTML"]);
const CHOICE = new Set(["Select", "Link", "Dynamic Link", "Autocomplete"]);
const TABLE = new Set(["Table", "Table MultiSelect"]);
const SUFFIX: Record<string, string> = {
	Date: "lucide-calendar",
	Datetime: "lucide-calendar",
	Time: "lucide-clock",
	Attach: "lucide-paperclip",
	"Attach Image": "lucide-image",
	Color: "lucide-palette",
};
const SAMPLE: Record<string, string> = { Int: "0", Float: "0.00", Currency: "0.00", Percent: "0%", Phone: "+1 555 0100" };

const props = defineProps<{ field: EditorField; selected?: boolean }>();
const ui = inject(DraftUiKey)!;
// A child's own editor (C) never holds a Table field; the parent's canvas draws one as its grid.
const childUi = inject(ChildScopeKey, null) ? null : inject(ChildUiKey, null);

const customizeKey = inject(CustomizeKey, null);
const customizing = computed(() => Boolean(customizeKey?.value));
const route = useRoute();
const locked = computed(() => route.query.variant === "B" && Boolean(customizeKey?.value?.isStandard(props.field.fieldname)));
// #47100: the canvas says a field has conditions; the tooltip says them.
const rules = computed(() => [
	{ label: "Visible if", value: props.field.depends_on },
	{ label: "Mandatory if", value: props.field.mandatory_depends_on },
	{ label: "Read-only if", value: props.field.read_only_depends_on },
]);
const isTitle = computed(() => ui.titleField.value === props.field.fieldname);
const placeholder = computed(() => props.field.placeholder || SAMPLE[props.field.fieldtype] || (props.field.options === "Email" ? "name@example.com" : ""));
const choiceText = computed(() => {
	if (props.field.placeholder) return props.field.placeholder;
	if (props.field.fieldtype === "Link" && props.field.options) return `Choose a ${props.field.options}`;
	return "Select an option";
});
</script>
