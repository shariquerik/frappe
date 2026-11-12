<!-- PROTOTYPE (#45867): the Preview tab. The record page's own FormLayout draws the draft as a
     record will look; no layout-edit parts, so it is the plain page. A saved DocType (#47095)
     fills it with a real record, the latest by default, or an empty form. The record is a copy:
     its tabs open and its fields take typing, but nothing is written.
     #47097 round 2: drawn as the record page's Details column (its FORM_CLASSES: no frame, its
     tab strip, 728px of content), with the Record row on the same left and right edges. -->
<template>
	<div class="mx-auto w-full max-w-3xl">
		<div v-if="saved" class="mb-2 flex items-center gap-2 px-[--page-gutter]">
			<span class="text-base text-ink-gray-5">Record</span>
			<Combobox class="w-72" :model-value="record" :options="records" placeholder="Choose a record" @update:model-value="pick(String($event ?? EMPTY))" />
			<span v-if="loading" class="text-p-sm text-ink-gray-5">Loading…</span>
			<span class="ml-auto text-p-sm text-ink-gray-5">Changes here are not saved.</span>
		</div>
		<div :inert="!saved">
			<FormLayout :key="record" v-model:doc="doc" v-model:tab="tab" :layout="schema" :class="FORM_CLASSES" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch } from "vue";
import { Combobox } from "frappe-ui";
import { runMethod } from "@framework/ui/api";
import { FormLayout } from "@framework/ui/FormLayout";
import { CommitKey, LayoutEditKey, NO_COMMIT } from "@framework/ui/FormLayout/types";
import { FORM_CLASSES } from "@/pages/record/formClasses";
import { DraftUiKey } from "./draftUi";
import { SavedUiKey } from "./savedDoctype";

defineProps<{ schema: any }>();

// The draft page provides nothing to FormLayout; this keeps the preview plain on its own.
provide(LayoutEditKey, null as any);
provide(CommitKey, NO_COMMIT);
const doc = ref<Record<string, any>>({});
const tab = ref("");

const EMPTY = "__empty__";
const savedKey = inject(SavedUiKey, null);
const saved = computed(() => savedKey?.value ?? null);
const ui = inject(DraftUiKey)!;
const latest = ref<{ name: string; title?: string }[]>([]);
const record = ref(EMPTY);
const loading = ref(false);

const records = computed(() => [
	{ label: "Empty form", value: EMPTY },
	...latest.value.map((one) => ({ label: one.title && one.title !== one.name ? `${one.title} · ${one.name}` : one.name, value: one.name })),
]);

watch(
	saved,
	async (one) => {
		if (!one || latest.value.length) return;
		const titleField = ui.titleField.value;
		const { data } = await runMethod<{ name: string; title?: string }[]>(
			"frappe.client.get_list",
			{
				doctype: one.doctype,
				fields: JSON.stringify(titleField ? ["name", `${titleField} as title`] : ["name"]),
				order_by: "modified desc",
				limit_page_length: 20,
			},
			{ http: "GET" }
		);
		latest.value = data;
		if (data.length) pick(data[0].name);
	},
	{ immediate: true }
);

async function pick(name: string) {
	record.value = name;
	if (name === EMPTY) return void (doc.value = {});
	loading.value = true;
	const { data } = await runMethod<Record<string, any>>("frappe.client.get", { doctype: saved.value!.doctype, name }, { http: "GET" }).finally(
		() => (loading.value = false)
	);
	if (record.value === name) doc.value = data;
}
</script>
