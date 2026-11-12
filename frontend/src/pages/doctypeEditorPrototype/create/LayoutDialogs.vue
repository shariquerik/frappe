<!-- PROTOTYPE (#47097), throwaway: "Add a variant" (the layout menu's last row) and "Edit
     condition" (a variant's act), one dialog. A variant is a conditional row of one layout type:
     the first whose condition matches a record wins, else the default layout shows. Create adds
     it in memory and opens it; nothing is written. -->
<template>
	<Dialog v-model:open="shown" :title="editing ? 'Edit condition' : 'Add a variant'" size="md">
		<form class="flex flex-col gap-5" @submit.prevent="submit">
			<FormControl v-if="!editing" v-model="key" type="select" label="Layout" :options="types" />
			<FormControl
				v-model="condition"
				type="text"
				label="Show it when"
				placeholder='doc.status == "Passive"'
				description="A JavaScript expression on doc. The first variant that matches wins; otherwise the default layout shows."
				autocomplete="off"
				class="[&_input]:font-mono"
			/>
			<div v-if="!editing" class="flex flex-col gap-1.5">
				<span class="text-xs text-ink-gray-5">Start from</span>
				<TabButtons v-model="start" :options="starts" class="[&>*]:w-full [&_button]:flex-1" />
			</div>
			<button type="submit" class="hidden" />
		</form>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="shown = false" />
				<Button variant="solid" :label="editing ? 'Save' : 'Create'" :disabled="!condition.trim()" @click="submit" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { Button, Dialog, FormControl, TabButtons } from "frappe-ui";
import { EditorKey } from "../context";
import { LAYOUTS, type LayoutKey } from "../editor";
import { layoutsFor, LayoutUiKey } from "./layouts";

const editor = inject(EditorKey)!;
const ui = inject(LayoutUiKey)!;

const editing = computed(() => ui.editing.value);
const shown = computed({
	get: () => ui.adding.value || Boolean(ui.editing.value),
	set: (open) => {
		if (open) return;
		ui.adding.value = false;
		ui.editing.value = null;
	},
});

const key = ref<LayoutKey>("details");
const condition = ref("");
const start = ref<"copy" | "empty">("copy");
const types = computed(() => layoutsFor(ui.kind.value).map((one) => ({ label: LAYOUTS.find((row) => row.key === one)!.label, value: one })));
const typeLabel = computed(() => LAYOUTS.find((row) => row.key === key.value)!.label);
const starts = computed(() => [
	{ label: `A copy of ${typeLabel.value}`, value: "copy" },
	{ label: "Empty", value: "empty" },
]);

// The dialog opens on the type in view, or on the variant's own condition.
watch(shown, (open) => {
	if (!open) return;
	key.value = editing.value?.key ?? editor.state.layout;
	condition.value = editing.value?.condition ?? "";
	start.value = "copy";
});

function submit() {
	const typed = condition.value.trim();
	if (!typed) return;
	if (editing.value) editor.acts.setCondition(editing.value.id, typed);
	else editor.acts.addVariant(key.value, typed, start.value);
	shown.value = false;
}
</script>
