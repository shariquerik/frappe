<!-- PROTOTYPE (#45867): a section's "Add field" (subtle sm, as frappe/crm#3419). CRM picks an
     existing field there; a new DocType has none, so the popover asks for a label and guesses the
     type, which the chip can change. Enter adds the field and keeps the popover open for the next. -->
<template>
	<Popover v-model:open="open" side="bottom" align="start" :auto-focus="false">
		<template #trigger="{ open: isOpen }">
			<div ref="triggerEl" class="flex w-fit scroll-mt-[20vh]" data-editor-add-field @click.stop>
				<Button variant="subtle" size="sm" icon-left="lucide-plus" label="Add field" :class="{ '!bg-surface-gray-3': isOpen }" />
			</div>
		</template>
		<form ref="formEl" class="flex w-[320px] flex-col gap-2 p-2" @submit.prevent="add" @click.stop>
			<TextInput v-model="label" placeholder="Field label, like Due date" autocomplete="off" @keydown.esc="open = false" />
			<div class="flex items-center gap-2">
				<Dropdown :options="menu" side="bottom" align="start">
					<Button size="sm" variant="subtle" :icon-left="typeIcon(type)" icon-right="lucide-chevron-down" :label="typeLabel(type.fieldtype, type.options)" />
				</Dropdown>
				<span class="min-w-0 flex-1 truncate text-sm text-ink-gray-5">{{ hint }}</span>
			</div>
			<Textarea v-if="type.fieldtype === 'Select'" v-model="optionsTyped" :rows="3" placeholder="Options, one per line" />
			<div class="flex justify-end gap-1.5 border-t border-outline-gray-1 pt-2">
				<Button size="sm" variant="ghost" label="Done" @click="open = false" />
				<Button size="sm" variant="solid" type="submit" label="Add" :disabled="!label.trim()" />
			</div>
		</form>
	</Popover>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { Button, Dropdown, Popover, Textarea, TextInput } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { guessType, typeLabel } from "./newDoctype";
import { typeIcon, typeMenu, type FieldType } from "./typeMenu";

const emit = defineEmits<{ add: [field: { label: string; fieldtype: string; options?: string }] }>();
const doctypes = inject<Addresses>("addresses")!.doctypeNames();

const open = ref(false);
// The label drives the guess until a type is picked on the chip.
const label = ref("");
const picked = ref<FieldType | null>(null);
const optionsTyped = ref("");
const guess = computed(() => guessType(label.value, doctypes));
const type = computed<FieldType>(() => picked.value ?? { fieldtype: guess.value.fieldtype, options: guess.value.options });
const menu = computed(() => typeMenu(pick, guess.value.options));

const hint = computed(() => {
	if (!label.value.trim()) return "Guessed from the label";
	if (picked.value) return "";
	return guess.value.because ? `Guessed from ${guess.value.because}` : "No guess, so Data";
});

// The menu hands focus back to the chip as it closes; the label takes it back after.
function pick(next: FieldType) {
	picked.value = next;
	setTimeout(focusLabel, 50);
}

function add() {
	if (!label.value.trim()) return;
	const options = type.value.fieldtype === "Select" ? optionsTyped.value : type.value.options;
	emit("add", { label: label.value.trim(), fieldtype: type.value.fieldtype, options });
	label.value = "";
	picked.value = null;
	optionsTyped.value = "";
	focusLabel();
	nextTick(keepRoomBelow);
}

const formEl = ref<HTMLFormElement>();
const focusLabel = () => formEl.value?.querySelector("input")?.focus({ preventScroll: true });
watch(open, async (now) => {
	if (!now) return;
	keepRoomBelow();
	await nextTick();
	setTimeout(focusLabel, 30);
});

// Near the window's bottom the popover and its type menu would flip above the button.
const triggerEl = ref<HTMLElement>();
function keepRoomBelow() {
	const top = triggerEl.value?.getBoundingClientRect().top ?? 0;
	if (top > window.innerHeight / 2) triggerEl.value?.scrollIntoView({ block: "start" });
}
</script>
