<!-- PROTOTYPE (#47098), throwaway: the Danger zone's dialogs, opened by its rows or by the header's
     ⋯ menu (ui.act). Rename asks the new name and says what moves; Move and Make it standard ask the
     module and say where the files go; Delete asks for the name typed, its box focused on open. Each ends in a toast: nothing
     is renamed, moved, written or deleted. -->
<template>
	<Dialog :open="ui.act === 'rename'" :title="`Rename ${ui.doctype}`" size="md" @update:open="close">
		<div class="flex flex-col gap-4">
			<TextInput v-model="name" label="New name" />
			<ul class="flex flex-col gap-1.5 text-p-base text-ink-gray-7">
				<li class="flex items-start gap-2"><span class="lucide-arrow-right mt-0.5 size-4 shrink-0 text-ink-gray-5" aria-hidden="true" /><span>The table <code class="font-mono text-sm">tab{{ ui.doctype }}</code> becomes <code class="font-mono text-sm">tab{{ target }}</code>, with its {{ records }}.</span></li>
				<li class="flex items-start gap-2"><span class="lucide-arrow-right mt-0.5 size-4 shrink-0 text-ink-gray-5" aria-hidden="true" /><span>{{ ui.loaded.linkFields }} Link and Table field{{ ui.loaded.linkFields === 1 ? "" : "s" }} in other DocTypes point to {{ target }}.</span></li>
				<li v-if="!ui.custom" class="flex items-start gap-2"><span class="lucide-arrow-right mt-0.5 size-4 shrink-0 text-ink-gray-5" aria-hidden="true" /><span>The folder <code class="font-mono text-sm">{{ folderOf(ui, ui.module) }}</code> becomes <code class="font-mono text-sm">{{ folderOf(ui, ui.module, target) }}</code>, and its controller class is renamed.</span></li>
			</ul>
		</div>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button variant="solid" label="Rename" :disabled="!name.trim() || target === ui.doctype" @click="done('renamed')" />
			</div>
		</template>
	</Dialog>

	<Dialog :open="ui.act === 'move' || ui.act === 'standard'" :title="ui.act === 'standard' ? `Make ${ui.doctype} standard` : `Move ${ui.doctype}`" size="md" @update:open="close">
		<div class="flex flex-col gap-1.5">
			<Combobox v-model="module" label="Module" :options="modules" placeholder="Choose a module" />
			<p class="text-p-sm text-ink-gray-5">
				<template v-if="!module">The module, and with it the app {{ ui.act === "standard" ? "its files go in" : "it belongs to" }}.</template>
				<template v-else-if="ui.act === 'standard'">Writes its files into <code class="font-mono text-ink-gray-7">{{ folderOf(ui, module) }}</code>. It stops being custom; that cannot be undone here.</template>
				<template v-else-if="ui.custom">Only the module changes: a custom DocType has no files.</template>
				<template v-else>Its folder moves from <code class="font-mono text-ink-gray-7">{{ folderOf(ui, ui.module) }}</code> to <code class="font-mono text-ink-gray-7">{{ folderOf(ui, module) }}</code>.</template>
			</p>
		</div>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button variant="solid" :label="ui.act === 'standard' ? 'Make standard' : 'Move'" :disabled="!module" @click="done(ui.act === 'standard' ? 'written' : 'moved')" />
			</div>
		</template>
	</Dialog>

	<Dialog :open="ui.act === 'delete'" :title="`Delete ${ui.doctype}?`" size="md" @update:open="close">
		<div class="flex flex-col gap-4">
			<p class="text-p-base text-ink-gray-7">
				Deletes {{ ui.doctype }}, its {{ records }} and its table <code class="font-mono text-sm">tab{{ ui.doctype }}</code>. Custom fields that use it as a child table go too.
				<template v-if="!ui.custom"> Its folder <code class="font-mono text-sm">{{ folderOf(ui, ui.module) }}</code> is removed.</template>
			</p>
			<TextInput v-model="typed" :label="`Type ${ui.doctype} to confirm`" :placeholder="ui.doctype" autofocus />
		</div>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button variant="solid" theme="red" :label="`Delete ${ui.doctype}`" :disabled="typed !== ui.doctype" @click="done('deleted')" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, Combobox, Dialog, TextInput, toast } from "frappe-ui";
import { folderOf, type SettingsUi } from "./settings";

// A prop, not an injection: the page mounts these next to its header, outside the tab.
const props = defineProps<{ ui: SettingsUi }>();
const ui = props.ui;
const name = ref(ui.doctype);
const module = ref("");
const typed = ref("");
const target = computed(() => name.value.trim() || ui.doctype);
const records = computed(() => `${(ui.records ?? 0).toLocaleString()} record${ui.records === 1 ? "" : "s"}`);
const modules = computed(() => ui.loaded.modules.filter((one) => one.name !== ui.module).map((one) => ({ label: one.name, value: one.name, description: one.app })));

// Each opening starts clean.
watch(
	() => ui.act,
	() => {
		name.value = ui.doctype;
		module.value = "";
		typed.value = "";
	}
);

const close = () => (ui.act = "");
function done(what: string) {
	close();
	toast.success(`Prototype: nothing was ${what}`);
}
</script>
