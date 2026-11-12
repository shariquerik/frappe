<!-- PROTOTYPE (#45867): "Add field" opens this row at the column's end. Type a label; the chip
     shows the type it guesses, and you can change it before Enter. Enter adds the field and keeps
     the row open for the next; Escape closes it. -->
<template>
	<form class="rounded-4 border border-outline-gray-3 bg-surface-elevation-2" @submit.prevent="add">
		<!-- pl-8 lines the type icon up with the placed rows' icons, which sit after a grip. -->
		<div class="flex items-center gap-2 py-1.5 pl-8 pr-1.5">
			<span :class="[typeIcon(type), 'size-4 shrink-0 text-ink-gray-5']" aria-hidden="true" />
			<input
				ref="labelInput"
				v-model="label"
				placeholder="Field label, like Due date"
				autocomplete="off"
				class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink-gray-8 placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
				@keydown.esc="close"
			/>
			<Dropdown :options="menu" side="bottom" align="end">
				<Button size="sm" variant="subtle" :label="typeLabel(type.fieldtype, type.options)" icon-right="lucide-chevron-down" />
			</Dropdown>
		</div>
		<div v-if="type.fieldtype === 'Select'" class="border-t border-outline-gray-2 py-2 pl-8 pr-1.5">
			<FormControl v-model="optionsTyped" type="textarea" size="sm" :rows="3" placeholder="Options, one per line" />
		</div>
		<div class="flex items-center justify-between gap-3 border-t border-outline-gray-2 py-1.5 pl-8 pr-1.5">
			<span class="min-w-0 truncate text-sm text-ink-gray-5">{{ hint }}</span>
			<div class="flex shrink-0 gap-1.5">
				<Button size="sm" variant="ghost" label="Cancel" @click="close" />
				<Button size="sm" variant="solid" type="submit" label="Add" :disabled="!label.trim()" />
			</div>
		</div>
	</form>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref } from "vue";
import { Button, Dropdown, FormControl } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { EditorKey } from "../context";
import { DraftUiKey } from "./draftUi";
import { guessType, typeLabel } from "./newDoctype";
import { typeIcon, typeMenu, type FieldType } from "./typeMenu";

const props = defineProps<{ column: string }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey)!;
const doctypes = inject<Addresses>("addresses")!.doctypeNames();

// The label drives the guess until a type is picked on the chip.
const label = ref("");
const picked = ref<FieldType | null>(null);
const guess = computed(() => guessType(label.value, doctypes));
const type = computed<FieldType>(() => picked.value ?? { fieldtype: guess.value.fieldtype, options: guess.value.options });
const optionsTyped = ref("");
const menu = computed(() => typeMenu(pick, guess.value.options));

// The menu hands focus back to the chip as it closes; the label takes it back after.
function pick(next: FieldType) {
	picked.value = next;
	setTimeout(() => labelInput.value?.focus(), 50);
}

const hint = computed(() => {
	if (!label.value.trim()) return "The type is guessed from the label.";
	if (picked.value) return "";
	if (guess.value.because) return `Guessed from ${guess.value.because}. Change it before adding.`;
	return "No guess, so Data. Change it before adding.";
});

function add() {
	if (!label.value.trim()) return;
	const options = type.value.fieldtype === "Select" ? optionsTyped.value : type.value.options;
	editor.acts.addLabelled({ label: label.value.trim(), fieldtype: type.value.fieldtype, options }, props.column);
	label.value = "";
	picked.value = null;
	optionsTyped.value = "";
	labelInput.value?.focus();
}

const close = () => (ui.adding.value = null);

const labelInput = ref<HTMLInputElement>();
onMounted(() => nextTick(() => labelInput.value?.focus()));
</script>
