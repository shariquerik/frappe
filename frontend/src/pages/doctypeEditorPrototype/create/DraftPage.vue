<!--
  PROTOTYPE (#45867), throwaway: steps 2 to 5 of the new-DocType flow (comment 6767773108), in
  the look of CRM's Forms builder. The draft at /<prefix>/doctype/new starts with one "Title"
  field set as the title field. Editor shows the structure: sections, columns and field rows that
  expand to the common properties, with "All properties" in a side panel. "Add field" asks for a
  label and guesses the type. Settings shows the defaults; Preview draws the record page.
  Save pretends to create the DocType: a toast, the address becomes /doctype/<name>, and "Try it"
  offers the record and the list. Nothing reaches the server, and leaving an unsaved draft leaves
  nothing behind.
-->
<template>
	<PageFrame :scroll="false">
		<template #header>
			<div class="flex w-full flex-col">
				<div class="-mx-3 flex h-12 items-center justify-between gap-3 px-3 sm:-mx-5 sm:px-5" :class="current && 'border-b'">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<Breadcrumbs :items="crumbs" class="-ml-0.5 min-w-0" />
						<Badge v-if="current && unsavedNow" label="Not saved" theme="amber" />
					</div>
					<Tooltip v-if="current" text="No changes to save" :disabled="unsavedNow">
						<div class="flex shrink-0">
							<Button variant="solid" label="Save" :disabled="!unsavedNow" @click="save" />
						</div>
					</Tooltip>
				</div>
				<Tabs
					v-if="current"
					v-model="tab"
					class="-mx-3 -mb-px sm:-mx-5 [&_[role='tab']]:rounded-4 [&_[role='tablist']]:gap-5 [&_[role='tablist']]:px-3 [&_[role='tablist']]:py-2 sm:[&_[role='tablist']]:px-5"
				>
					<TabList variant="underline">
						<TabTrigger v-for="one in TABS" :key="one.value" :value="one.value" :label="one.label" :icon-left="one.icon" />
					</TabList>
				</Tabs>
			</div>
		</template>

		<div v-if="!current" class="flex flex-1 flex-col items-center justify-center gap-3 border-t border-outline-gray-1">
			<p class="text-base text-ink-gray-6">A new DocType starts with its name.</p>
			<Button variant="solid" icon-left="lucide-plus" label="New DocType" @click="openNewDoctype" />
		</div>

		<div v-else class="flex min-h-0 flex-1">
			<main class="min-w-0 flex-1 overflow-y-auto">
				<div class="flex flex-col gap-4 px-3 pb-24 pt-5 sm:px-5">
					<div v-if="saved && tryIt" class="flex items-center gap-3 rounded-4 bg-surface-gray-2 py-2 pl-3 pr-2">
						<span class="lucide-circle-check size-4 shrink-0 text-ink-gray-7" aria-hidden="true" />
						<p class="min-w-0 flex-1 text-base text-ink-gray-8">
							<template v-if="current.kind === 'child'">{{ current.name }} is ready. Add it to a parent DocType as a Table field.</template>
							<template v-else>{{ current.name }} is ready. Try it.</template>
						</p>
						<template v-if="current.kind !== 'child'">
							<Button v-if="current.kind !== 'single'" variant="outline" icon-left="lucide-plus" label="New record" @click="explain('new')" />
							<Button variant="outline" :label="current.kind === 'single' ? 'Open' : 'Open list'" @click="explain('open')" />
						</template>
						<Button variant="ghost" icon="lucide-x" label="Dismiss" @click="tryIt = false" />
					</div>

					<template v-if="tab === 'editor'">
						<p class="flex items-center gap-1.5 px-1 text-sm text-ink-gray-5">
							<span class="lucide-box size-3.5" aria-hidden="true" />
							{{ current.module }}
							<span aria-hidden="true">·</span>
							{{ kindLabel }}
							<template v-if="current.kind === 'child'"><span aria-hidden="true">·</span> this form is the row's dialog</template>
						</p>
						<StructureCanvas />
					</template>
					<DraftSettings v-else-if="tab === 'settings'" :name="current.name" :kind="current.kind" :title="titleLabel" class="pt-1" />
					<FormPreview v-else :schema="editor.schema.value" />
				</div>
			</main>
			<AllProperties v-if="tab === 'editor' && panelField" :key="panelField.fieldname" :field="panelField" />
		</div>

		<Dialog v-model="explained" :title="explainTitle" :message="explainMessage" />
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { Badge, Breadcrumbs, Button, Dialog, TabList, Tabs, TabTrigger, Tooltip, toast } from "frappe-ui";
import PageFrame from "@/shell/PageFrame.vue";
import { shellDialog } from "@/shell/dialog";
import { useUnloadGuard } from "@/pages/record/recordSave";
import { EditorKey } from "../context";
import { createEditor, nameOf } from "../editor";
import AllProperties from "./AllProperties.vue";
import DraftSettings from "./DraftSettings.vue";
import FormPreview from "./FormPreview.vue";
import StructureCanvas from "./StructureCanvas.vue";
import { DraftUiKey } from "./draftUi";
import { created, draft, KINDS, openNewDoctype, rememberModule, slugOf, type Draft } from "./newDoctype";

const router = useRouter();

const TABS = [
	{ value: "editor", label: "Editor", icon: "lucide-layout-list" },
	{ value: "settings", label: "Settings", icon: "lucide-settings" },
	{ value: "preview", label: "Preview", icon: "lucide-eye" },
];
const tab = ref("editor");

// The draft this page was opened for; Save keeps it as the "created" DocType.
const current = ref<Draft | null>(draft.value ? { ...draft.value } : null);
draft.value = null;
const kindLabel = computed(() => KINDS.find((one) => one.value === current.value?.kind)?.label);

const editor = createEditor(current.value?.name ?? "new", "design", "details");
provide(EditorKey, editor);
editor.loadDraft(
	[{ fieldname: "title", fieldtype: "Data", label: "Title", added: true } as any],
	[{ name: "tab-details", sections: [{ name: "section-main", label: "Details", columns: [{ name: "column-main", fields: ["title"] }] }] }]
);
// The structure view has no selection; a field opens by its row instead.
watch(
	() => editor.state.selection,
	(selection) => selection && (editor.state.selection = null)
);

const expanded = ref<string | null>(null);
const panel = ref<string | null>(null);
const adding = ref<string | null>(null);
const titleField = ref("title");
const saved = ref(false);
provide(DraftUiKey, {
	kind: current.value?.kind ?? "regular",
	expanded,
	panel,
	adding,
	titleField,
	draft: computed(() => !saved.value),
	rename,
});
const panelField = computed(() => (panel.value ? editor.field(panel.value) : undefined));
const titleLabel = computed(() => editor.field(titleField.value)?.label ?? "");

/** Before the first save a field's name follows its label; nothing refers to it yet. */
function rename(from: string, to: string) {
	const taken = new Set(editor.state.fields.map((one) => one.fieldname).filter((one) => one !== from));
	let fieldname = to;
	for (let n = 2; taken.has(fieldname); n++) fieldname = `${to}_${n}`;
	if (fieldname === from) return;
	editor.field(from)!.fieldname = fieldname;
	const column = editor.columnOf(from);
	if (column) column.fields = column.fields.map((entry) => (nameOf(entry) === from ? fieldname : entry));
	for (const one of [titleField, expanded, panel]) if (one.value === from) one.value = fieldname;
}

// Saved state: the edit count and title field at the last save, to tell what is unsaved.
const savedAt = ref({ edits: 0, title: "" });
const tryIt = ref(false);
const dirty = computed(() => editor.state.acted !== savedAt.value.edits || titleField.value !== savedAt.value.title);
const unsavedNow = computed(() => Boolean(current.value) && (!saved.value || dirty.value));
const unsaved = () => unsavedNow.value;

function save() {
	const one = current.value!;
	const first = !saved.value;
	created.set(one.name, one);
	rememberModule(one.module);
	for (const field of editor.state.fields) field.added = false;
	saved.value = true;
	savedAt.value = { edits: editor.state.acted, title: titleField.value };
	adding.value = null;
	if (!first) return void toast.success(`${one.name} saved`);
	tryIt.value = true;
	toast.success(`${one.name} created`);
	void router.replace(`/doctype/${encodeURIComponent(one.name)}`);
}

const crumbs = computed(() => [
	{ label: "DocType", route: "/doctype" },
	{ label: current.value?.name ?? "New DocType" },
]);

// "Try it" is a stub: each button says where it would go.
const explained = ref(false);
const explainTitle = ref("");
const explainMessage = ref("");
function explain(what: "new" | "open") {
	const one = current.value!;
	const address = `/apps/desk/${slugOf(one.name)}`;
	explainTitle.value = what === "new" ? "New record" : one.kind === "single" ? `Open ${one.name}` : "Open list";
	explainMessage.value =
		what === "new"
			? `Would open ${address}/new: the new-record page, drawn from this form, with System Manager allowed to create.`
			: one.kind === "single"
				? `Would open ${address}: the one ${one.name} record, drawn from this form.`
				: `Would open ${address}: the list, empty, with ${titleLabel.value || "the ID"} as its first column.`;
	explained.value = true;
}

// Nothing exists until Save, so leaving a draft must leave nothing behind, after asking.
onBeforeRouteLeave(async () => {
	if (!unsaved()) return true;
	const one = current.value!;
	const discard = await shellDialog().confirm({
		title: saved.value ? "Discard unsaved changes?" : `Discard ${one.name}?`,
		message: saved.value
			? `${one.name} keeps its last save. The changes since then are lost.`
			: `${one.name} has not been created. Leaving discards it, and nothing is written.`,
		confirmLabel: "Discard",
		cancelLabel: "Keep editing",
	});
	return discard === true;
});
useUnloadGuard(unsaved);
</script>
