<!-- PROTOTYPE (#45867): the Preview tab. The record page's own FormLayout draws the draft as a
     record will look; no layout-edit parts, so it is the plain page. A saved DocType (#47095)
     fills it with a real record, the latest by default, or an empty form. The record is a copy:
     its tabs open and its fields take typing, but nothing is written.
     #47097 round 2: drawn as the record page's Details column (its FORM_CLASSES: no frame, its
     tab strip, 728px of content), with the Record row on the same left and right edges.
     #47098 owner note: the row is a quiet "Previewing …" button, not a labelled select. -->
<template>
	<div class="mx-auto w-full max-w-3xl">
		<!-- #47098 note: one quiet line, not a labelled field: "Previewing <name> <title> ▾" as a
		     crumb-style button (bleeds 4px so its text sits on the form's left edge), the note on
		     the right edge. Both 13px gray. -->
		<div v-if="saved" class="mb-1 flex items-center gap-2 px-[--page-gutter]">
			<Combobox
				:model-value="record"
				:options="records"
				align="start"
				placeholder="Search records"
				@update:model-value="pick(String($event ?? EMPTY))"
			>
				<template #trigger="{ open }">
					<button
						type="button"
						class="-ml-1 flex min-w-0 max-w-[320px] items-center gap-1 rounded-4 px-1 py-1 text-p-sm text-ink-gray-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
						:class="open ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
						data-preview-record
					>
						<span class="shrink-0">Previewing</span>
						<span class="shrink-0 text-ink-gray-8">{{ current.name }}</span>
						<span v-if="current.title" class="min-w-0 truncate">{{ current.title }}</span>
						<span class="lucide-chevron-down size-4 shrink-0" aria-hidden="true" />
					</button>
				</template>
				<template #item-label="{ item }">
					<span class="flex min-w-0 gap-1.5 leading-tighter">
						<span class="shrink-0">{{ item.name ?? item.label }}</span>
						<span v-if="item.title" class="min-w-0 truncate text-ink-gray-5">{{ item.title }}</span>
					</span>
				</template>
			</Combobox>
			<span v-if="loading" class="text-p-sm text-ink-gray-5">Loading…</span>
			<span class="ml-auto shrink-0 text-p-sm text-ink-gray-5">Changes here are not saved.</span>
		</div>
		<div :inert="!saved">
			<FormLayout :key="record" v-model:doc="doc" v-model:tab="tab" :layout="filtered" :class="FORM_CLASSES" />
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
import { EditorKey } from "../context";
import { linkFiltersForPreview } from "./conditions";

const props = defineProps<{ schema: any }>();

// The draft page provides nothing to FormLayout; this keeps the preview plain on its own.
provide(LayoutEditKey, null as any);
provide(CommitKey, NO_COMMIT);
const doc = ref<Record<string, any>>({});
const tab = ref("");
// #47100: desk v2 reads no `link_filters`; the Preview turns a Link's into its search filters
// (equality as a value, the rest as [op, value]; `eval:doc.company` read from this record).
const editor = inject(EditorKey, null);
const filtered = computed(() => {
	if (!editor) return props.schema;
	return props.schema.map((one: any) => ({
		...one,
		sections: one.sections.map((section: any) => ({
			...section,
			columns: section.columns.map((column: any) => ({
				...column,
				fields: column.fields.map((node: any) => {
					const raw = (editor.field(node.fieldname) as any)?.link_filters;
					return raw ? { ...node, filters: linkFiltersForPreview(raw, doc.value) ?? node.filters } : node;
				}),
			})),
		})),
	}));
});

const EMPTY = "__empty__";
const savedKey = inject(SavedUiKey, null);
const saved = computed(() => savedKey?.value ?? null);
const ui = inject(DraftUiKey)!;
const latest = ref<{ name: string; title?: string }[]>([]);
const record = ref(EMPTY);
const loading = ref(false);

const current = computed(() => {
	if (record.value === EMPTY) return { name: "an empty form", title: "" };
	const one = latest.value.find((row) => row.name === record.value);
	return { name: record.value, title: one?.title && one.title !== one.name ? one.title : "" };
});

const records = computed(() => [
	{ label: "Empty form", value: EMPTY },
	...latest.value.map((one) => {
		const title = one.title && one.title !== one.name ? one.title : "";
		return { label: `${one.name} ${title}`.trim(), value: one.name, name: one.name, title };
	}),
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
