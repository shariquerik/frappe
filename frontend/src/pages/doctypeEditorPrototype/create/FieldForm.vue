<!-- PROTOTYPE (#45867): the draft page's one popover. Adding, it asks for the label and shows
     the type it guesses as a chip the person can change before "Add". Editing, it holds the
     placed field's few properties; each change applies at once. -->
<template>
	<form class="flex w-[320px] flex-col gap-4 p-3" @submit.prevent="confirm">
		<div class="flex flex-col gap-1.5">
			<FormControl
				ref="labelInput"
				:model-value="label"
				label="Label"
				placeholder="Due date"
				autocomplete="off"
				@update:model-value="setLabel"
			/>
			<span class="text-sm text-ink-gray-5">Fieldname <span class="font-mono text-ink-gray-6">{{ fieldname || "…" }}</span></span>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs text-ink-gray-5">Type</span>
			<div class="flex">
				<Dropdown :options="typeMenu" side="bottom" align="start">
					<Button :icon-left="type.options === 'Email' ? 'lucide-mail' : iconOf(type.fieldtype)" icon-right="lucide-chevron-down" :label="typeLabel(type.fieldtype, type.options)" />
				</Dropdown>
			</div>
			<span v-if="hint" class="text-sm text-ink-gray-5">{{ hint }}</span>
		</div>

		<Combobox
			v-if="type.fieldtype === 'Link' || type.fieldtype === 'Table'"
			:model-value="type.options"
			:label="type.fieldtype === 'Link' ? 'Links to' : 'Child table'"
			:options="doctypes"
			placeholder="Choose a DocType"
			@update:model-value="setType({ fieldtype: type.fieldtype, options: String($event ?? '') })"
		/>
		<FormControl
			v-if="type.fieldtype === 'Select'"
			type="textarea"
			:rows="3"
			label="Options, one per line"
			:model-value="type.options"
			@update:model-value="setType({ fieldtype: 'Select', options: $event })"
		/>

		<template v-if="field">
			<div class="flex flex-col items-start gap-2.5">
				<FormControl type="checkbox" label="Mandatory" :model-value="Boolean(field.reqd)" @update:model-value="editor.acts.setField(field.fieldname, 'reqd', $event ? 1 : 0)" />
				<FormControl
					v-if="TITLE_TYPES.has(field.fieldtype)"
					type="checkbox"
					label="Title field"
					:model-value="ui.titleField.value === field.fieldname"
					@update:model-value="ui.titleField.value = $event ? field.fieldname : ''"
				/>
			</div>
			<FormControl type="textarea" :rows="2" label="Description" :model-value="field.description" @update:model-value="editor.acts.setField(field.fieldname, 'description', $event)" />
		</template>

		<div class="flex items-center gap-2">
			<template v-if="field">
				<Button variant="ghost" theme="red" icon-left="lucide-trash-2" label="Delete" class="-ml-1" @click="remove" />
				<Button variant="solid" label="Done" class="ml-auto" @click="emit('close')" />
			</template>
			<template v-else>
				<Button label="Cancel" class="ml-auto" @click="emit('close')" />
				<Button variant="solid" type="submit" label="Add" :disabled="!label.trim()" />
			</template>
		</div>
	</form>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref } from "vue";
import { Button, Combobox, Dropdown, FormControl } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { EditorKey } from "../context";
import { FIELDTYPES, iconOf } from "../fieldtypes";
import { DraftUiKey } from "./draftUi";
import { fieldnameOf, guessType, typeLabel } from "./newDoctype";

const props = defineProps<{ draft: boolean }>();
const emit = defineEmits<{ close: []; rename: [from: string, to: string] }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;
const doctypes = inject<Addresses>("addresses")!.doctypeNames();

const TITLE_TYPES = new Set(["Data", "Link", "Select", "Small Text"]);

const editing = ui.editing.value!;
const field = computed(() => (editing.kind === "field" ? editor.field(editing.fieldname) : undefined));

// Adding: the label drives the guess until the person picks a type on the chip.
const typed = ref("");
const picked = ref<{ fieldtype: string; options?: string } | null>(null);
const guess = computed(() => guessType(typed.value, doctypes));

const label = computed(() => (field.value ? field.value.label ?? "" : typed.value));
const fieldname = computed(() => {
	if (field.value) return field.value.fieldname;
	return typed.value.trim() ? fieldnameOf(typed.value) : "";
});
const type = computed(() =>
	field.value
		? { fieldtype: field.value.fieldtype, options: field.value.options }
		: picked.value ?? guess.value
);
const hint = computed(() => {
	if (field.value) return props.draft ? "" : "Safe to change until records exist";
	if (picked.value) return "";
	return guess.value.because ? `Guessed from ${guess.value.because}. Change it before adding.` : "";
});

function setLabel(value: string) {
	if (!field.value) {
		typed.value = value;
		return;
	}
	editor.acts.setField(field.value.fieldname, "label", value);
	// Before the first save a fieldname is free to follow its label.
	if (props.draft && field.value.added) emit("rename", field.value.fieldname, fieldnameOf(value));
}

function setType(next: { fieldtype: string; options?: string }) {
	if (!field.value) {
		picked.value = next;
		return;
	}
	editor.acts.setField(field.value.fieldname, "fieldtype", next.fieldtype);
	editor.acts.setField(field.value.fieldname, "options", next.options);
}

const COMMON = ["Data", "Email", "Phone", "Int", "Currency", "Date", "Datetime", "Check", "Select", "Link", "Small Text", "Text Editor", "Attach", "Table"];
const asType = (choice: string) =>
	choice === "Email" ? { fieldtype: "Data", options: "Email" } : { fieldtype: choice, options: choice === "Link" ? guess.value.options : undefined };
const typeMenu = computed(() => [
	{
		group: "Type",
		hideLabel: true,
		options: COMMON.map((choice) => ({ label: choice, icon: choice === "Email" ? "lucide-mail" : iconOf(choice), onClick: () => setType(asType(choice)) })),
	},
	{
		group: "",
		hideLabel: true,
		options: [
			{
				label: "More types",
				icon: "lucide-shapes",
				submenu: FIELDTYPES.map((group) => ({
					group: group.label,
					options: group.types.filter((one) => !COMMON.includes(one)).map((one) => ({ label: one, icon: iconOf(one), onClick: () => setType({ fieldtype: one }) })),
				})),
			},
		],
	},
]);

function confirm() {
	if (field.value) return emit("close");
	if (!typed.value.trim() || editing.kind !== "add") return;
	editor.acts.addLabelled({ label: typed.value.trim(), ...type.value }, editing.column, editing.index);
	emit("close");
}

function remove() {
	if (!field.value) return;
	if (ui.titleField.value === field.value.fieldname) ui.titleField.value = "";
	editor.acts.deleteField(field.value.fieldname);
	emit("close");
}

const labelInput = ref();
onMounted(() => nextTick(() => labelInput.value?.$el?.querySelector("input")?.focus()));
</script>
