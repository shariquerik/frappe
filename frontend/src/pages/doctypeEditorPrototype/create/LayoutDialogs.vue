<!-- PROTOTYPE (#47097), throwaway: "Add a layout" (the layout menu's last row), "Edit condition"
     and "Rename" (a conditional layout's acts), one dialog. A conditional layout is a row of one
     layout type with its own title: the first whose condition matches a record wins, else the
     type's default layout shows. Create adds it in memory and opens it; nothing is written.
     #47098: "Add a variant" became "Add a layout"; a required Title comes first, then Based on
     (the layout type), Show it when, Start from. Rename edits the title alone. -->
<template>
	<Dialog v-model:open="shown" :title="TITLES[mode]" size="md">
		<form class="flex flex-col gap-5" @submit.prevent="submit">
			<FormControl
				v-if="mode !== 'condition'"
				v-model="title"
				type="text"
				label="Title"
				placeholder="Passive contacts"
				:required="true"
				autocomplete="off"
				data-layout-title
			/>
			<FormControl v-if="mode === 'add'" v-model="key" type="select" label="Based on" :options="types" />
			<FormControl
				v-if="mode !== 'rename'"
				v-model="condition"
				type="text"
				label="Show it when"
				:required="true"
				placeholder='doc.status == "Passive"'
				description="A JavaScript expression on doc. The first layout whose condition matches wins; otherwise the default one shows."
				autocomplete="off"
				class="[&_input]:font-mono"
			/>
			<div v-if="mode === 'add'" class="flex flex-col gap-1.5">
				<FormLabel label="Start from" />
				<TabButtons v-model="start" :options="starts" class="[&>*]:w-full [&_button]:flex-1 [&_button]:justify-center" />
			</div>
			<button type="submit" class="hidden" />
		</form>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="shown = false" />
				<Button variant="solid" :label="mode === 'add' ? 'Create' : 'Save'" :disabled="!ready" @click="submit" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { Button, Dialog, FormControl, FormLabel, TabButtons } from "frappe-ui";
import { EditorKey } from "../context";
import { LAYOUTS, type LayoutKey } from "../editor";
import { layoutsFor, LayoutUiKey } from "./layouts";

const TITLES = { add: "Add a layout", condition: "Edit condition", rename: "Rename layout" } as const;

const editor = inject(EditorKey)!;
const ui = inject(LayoutUiKey)!;

const mode = computed(() => (ui.renaming.value ? "rename" : ui.editing.value ? "condition" : "add"));
const shown = computed({
	get: () => ui.adding.value || Boolean(ui.editing.value) || Boolean(ui.renaming.value),
	set: (open) => {
		if (open) return;
		ui.adding.value = false;
		ui.editing.value = null;
		ui.renaming.value = null;
	},
});

const title = ref("");
const key = ref<LayoutKey>("details");
const condition = ref("");
const start = ref<"copy" | "empty">("copy");
const types = computed(() => layoutsFor(ui.kind.value).map((one) => ({ label: LAYOUTS.find((row) => row.key === one)!.label, value: one })));
const typeLabel = computed(() => LAYOUTS.find((row) => row.key === key.value)!.label);
const starts = computed(() => [
	{ label: `A copy of ${typeLabel.value}`, value: "copy" },
	{ label: "Empty", value: "empty" },
]);
// Each mode needs what it shows: Add both title and condition, Rename a title, Edit a condition.
const ready = computed(() => {
	if (mode.value === "rename") return Boolean(title.value.trim());
	if (mode.value === "condition") return Boolean(condition.value.trim());
	return Boolean(title.value.trim() && condition.value.trim());
});

// The dialog opens on the type in view, or on the layout's own title and condition.
watch(shown, (open) => {
	if (!open) return;
	const variant = ui.renaming.value ?? ui.editing.value;
	title.value = variant?.title ?? "";
	key.value = variant?.key ?? editor.state.layout;
	condition.value = variant?.condition ?? "";
	start.value = "copy";
});

function submit() {
	if (!ready.value) return;
	if (ui.renaming.value) editor.acts.setTitle(ui.renaming.value.id, title.value.trim());
	else if (ui.editing.value) editor.acts.setCondition(ui.editing.value.id, condition.value.trim());
	else editor.acts.addVariant(key.value, condition.value.trim(), start.value, title.value.trim());
	shown.value = false;
}
</script>
