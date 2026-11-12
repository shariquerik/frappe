<!-- PROTOTYPE (#47096), throwaway: the two dialogs behind Customize mode's ⋯ menu. "Reset all
     customizations" lists what it removes and what it keeps, with real counts. "Export to an app"
     (developer mode only) asks what v1's export asks. Neither writes anything. -->
<template>
	<Dialog v-model:open="resetOpen" :title="`Reset ${doctype}?`" size="md">
		<div class="flex flex-col gap-4 text-p-base text-ink-gray-7">
			<template v-if="removes.length">
				<div class="flex flex-col gap-2">
					<p>Removes what this site changed:</p>
					<ul class="flex flex-col gap-1.5">
						<li v-for="line in removes" :key="line" class="flex items-center gap-2">
							<span class="lucide-minus size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />{{ line }}
						</li>
					</ul>
				</div>
				<p>The values in the custom fields' columns stay in the database. {{ doctype }} looks as {{ ui.app || "its app" }} ships it.</p>
			</template>
			<p v-else>This site has not changed {{ doctype }}. Nothing to reset.</p>
			<p v-if="keeps" class="text-ink-gray-5">Keeps {{ keeps }}: {{ ui.app || "the app" }} made them, and they come back on every migrate.</p>
		</div>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="resetOpen = false" />
				<Button variant="solid" theme="red" label="Reset all" :disabled="!removes.length" @click="reset" />
			</div>
		</template>
	</Dialog>

	<Dialog v-model:open="exportOpen" title="Export customizations" size="md">
		<div class="flex flex-col gap-5">
			<p class="text-p-base text-ink-gray-7">
				Writes this site's changes to {{ doctype }} into an app, so every site with the app gets them.
			</p>
			<div class="flex flex-col gap-1.5">
				<Combobox v-model="module" label="Module" :options="modules" placeholder="Choose a module" />
				<p class="text-sm text-ink-gray-5">
					<template v-if="file">Writes <span class="font-mono text-ink-gray-7">{{ file }}</span></template>
					<template v-else>The app and the folder the file goes in.</template>
				</p>
			</div>
			<div class="flex items-start justify-between gap-4">
				<div class="flex flex-col gap-0.5">
					<span class="text-base text-ink-gray-8">Apply on migrate</span>
					<span class="text-sm text-ink-gray-5">Each migrate writes them to the site again.</span>
				</div>
				<Switch v-model="sync" />
			</div>
			<div class="flex items-start justify-between gap-4">
				<div class="flex flex-col gap-0.5">
					<span class="text-base text-ink-gray-8">Include permissions</span>
					<span class="text-sm text-ink-gray-5">The roles this site added to {{ doctype }}.</span>
				</div>
				<Switch v-model="permissions" />
			</div>
		</div>
		<template #actions>
			<div class="flex items-center justify-between gap-3">
				<span class="text-sm text-ink-gray-5">{{ counted }}</span>
				<Button variant="solid" label="Export" :disabled="!module" @click="exportNow" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { runMethod } from "@framework/ui/api";
import { Button, Combobox, Dialog, Switch, toast } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { summary, type CustomizeUi } from "./customize";

const props = defineProps<{ doctype: string; ui: CustomizeUi }>();
const resetOpen = defineModel<boolean>("reset", { default: false });
const exportOpen = defineModel<boolean>("export", { default: false });
const modules = inject<Addresses>("addresses")!.moduleNames();

const removes = computed(() => {
	const { customFields, propertyChanges, layouts } = props.ui.counts;
	const out = [];
	if (customFields) out.push(`${customFields} custom field${customFields === 1 ? "" : "s"}`);
	if (propertyChanges) out.push(`${propertyChanges} property change${propertyChanges === 1 ? "" : "s"} (hidden, required, labels, order…)`);
	if (layouts) out.push(`${layouts} site layout${layouts === 1 ? "" : "s"} (the form's tabs and sections)`);
	return out;
});
const keeps = computed(() => {
	const fields = Object.values(props.ui.customFields).filter((one) => one.is_system_generated).length;
	return summary({ customFields: fields, propertyChanges: props.ui.appSetters });
});
function reset() {
	resetOpen.value = false;
	toast.success(`${props.doctype} reset (prototype: nothing was removed)`);
}

const module = ref<string | null>(null);
const sync = ref(true);
const permissions = ref(false);
const scrub = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "_");
// The file goes in the chosen module's app: <app>/<app>/<module>/custom/<doctype>.json.
const app = ref("");
watch(module, async (name) => {
	app.value = "";
	if (!name) return;
	const { data } = await runMethod<any>("frappe.client.get_value", { doctype: "Module Def", filters: name, fieldname: "app_name" }, { http: "GET" });
	app.value = String(data?.app_name ?? "");
});
const file = computed(() => (module.value && app.value ? `${app.value}/${scrub(module.value)}/custom/${scrub(props.doctype)}.json` : ""));
const counted = computed(() => summary(props.ui.counts) || "No site changes yet");
function exportNow() {
	exportOpen.value = false;
	toast.success(`Exported to ${file.value} (prototype: nothing was written)`);
}
</script>
