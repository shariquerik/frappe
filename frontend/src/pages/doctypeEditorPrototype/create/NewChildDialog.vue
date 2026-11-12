<!-- PROTOTYPE (#47099), throwaway: "+ New child table…" from a Table field's child-table picker. It
     asks the name (the parent's name and the field's label, singular) and the module (the
     parent's), and makes the child as a draft: it is written before its parent, in the same Save.
     In Customize it is a custom DocType, which a site may make without developer mode. -->
<template>
	<Dialog v-model:open="open" title="New child table" size="md">
		<form class="flex flex-col gap-5" @submit.prevent="create">
			<div class="flex flex-col gap-1.5">
				<FormControl v-model="name" label="Name" autocomplete="off" autofocus />
				<p class="text-sm text-ink-gray-5">
					<span v-if="error" class="text-ink-red-7">{{ error }}</span>
					<template v-else
						>Each row of {{ fieldLabel }} is one {{ name.trim() || "row" }}, with no list of its own. Saved before {{ parent }}, in one
						Save.</template
					>
				</p>
			</div>
			<div class="flex flex-col gap-1.5">
				<Combobox v-model="module" label="Module" :options="modules" placeholder="Choose a module" />
				<p class="text-sm text-ink-gray-5">
					{{
						customizing
							? `A custom DocType on this site, kept apart from ${parent}'s app.`
							: `The same module as ${parent}, so its files sit beside it.`
					}}
				</p>
			</div>
		</form>
		<template #actions>
			<div class="flex items-center justify-end gap-3">
				<Button variant="solid" label="Create child table" :disabled="!ready" @click="create" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { Button, Combobox, Dialog, FormControl } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { EditorKey } from "../context";
import { ChildUiKey } from "./childTables";
import { deriveName } from "./newDoctype";

defineProps<{ customizing?: boolean }>();
const child = inject(ChildUiKey)!;
const editor = inject(EditorKey)!;
const addresses = inject<Addresses>("addresses")!;
const modules = addresses.moduleNames();
const doctypes = addresses.doctypeNames();

const open = computed({
	get: () => Boolean(child.newFor),
	set: (value) => !value && (child.newFor = null),
});
const parent = computed(() => child.parent);
const field = computed(() => (child.newFor ? editor.field(child.newFor) : undefined));
const fieldLabel = computed(() => field.value?.label || "the table");
const name = ref("");
const module = ref("");

/** "Items" → "Item", "Payment Plans" → "Payment Plan": a row is one of them. */
const singular = (label: string) => label.replace(/ies$/i, "y").replace(/(?<!s)s$/i, "");

watch(open, (now) => {
	if (!now) return;
	const label = singular(field.value?.label || "Row");
	name.value = deriveName(`${parent.value} ${label}`);
	module.value = child.parentModule;
});

const error = computed(() => {
	const typed = deriveName(name.value);
	if (!typed) return "";
	const taken =
		doctypes.find((one) => one.toLowerCase() === typed.toLowerCase()) ??
		child.options.find((one) => one.name.toLowerCase() === typed.toLowerCase())?.name;
	return taken ? `${taken} exists. Pick it from the list instead.` : "";
});
const ready = computed(() => Boolean(deriveName(name.value)) && Boolean(module.value) && !error.value);

function create() {
	if (!ready.value || !child.newFor) return;
	child.makeChild(deriveName(name.value), module.value, child.newFor);
	child.newFor = null;
}
</script>
