<!--
  PROTOTYPE (#45867), throwaway: steps 2 to 5 of the new-DocType flow (comment 6767773108).
  The draft at /<prefix>/doctype/new is drawn by the record page's own `FormLayout`, starting
  with one "Title" field set as the title field. "Add field" asks for a label and guesses the
  type; click a field to edit it, drag to move it. Save pretends to create the DocType: a toast,
  the address becomes /doctype/<name>, and "Try it" offers the record and the list. Nothing
  reaches the server, and leaving an unsaved draft leaves nothing behind.
-->
<template>
	<PageFrame :scroll="false">
		<template #header>
			<div class="flex min-w-0 flex-1 items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Breadcrumbs :items="crumbs" class="-ml-0.5" />
					<Badge v-if="current && !saved" label="Not saved" theme="gray" size="md" />
				</div>
				<div v-if="current" class="flex shrink-0 items-center gap-2">
					<span v-if="saved && dirty" class="text-sm text-ink-gray-5">Unsaved changes</span>
					<Button icon-left="lucide-settings-2" label="Settings" @click="settings = true" />
					<Button variant="solid" label="Save" :disabled="saved && !dirty" @click="save" />
				</div>
			</div>
		</template>

		<div v-if="!current" class="flex flex-1 flex-col items-center justify-center gap-3 border-t border-outline-gray-1">
			<p class="text-base text-ink-gray-6">A new DocType starts with its name.</p>
			<Button variant="solid" icon-left="lucide-plus" label="New DocType" @click="openNewDoctype" />
		</div>

		<main v-else class="min-h-0 flex-1 overflow-y-auto border-t border-outline-gray-1">
			<div class="mx-auto flex max-w-[880px] flex-col gap-6 px-8 pb-24 pt-6">
				<div v-if="saved && tryIt" class="flex items-center gap-3 rounded-5 bg-surface-gray-2 py-2.5 pl-4 pr-2.5">
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

				<p class="flex items-center gap-1.5 text-sm text-ink-gray-5">
					<span class="lucide-box size-3.5" aria-hidden="true" />
					{{ current.module }}
					<span aria-hidden="true">·</span>
					{{ kindLabel }}
					<template v-if="current.kind === 'child'"><span aria-hidden="true">·</span> this form is the row's dialog</template>
				</p>

				<div class="relative">
					<FormLayout v-model:doc="doc" v-model:tab="tab" :layout="editor.schema.value" />
				</div>
			</div>
		</main>

		<Popover
			:open="Boolean(editing)"
			trigger="manual"
			:reference="anchor"
			side="bottom"
			align="start"
			:offset="8"
			@update:open="(value: boolean) => !value && close()"
		>
			<template #trigger><span class="hidden" /></template>
			<FieldForm v-if="editing" :key="JSON.stringify(editing)" :draft="!saved" @close="close" @rename="rename" />
		</Popover>

		<DraftSettings v-if="current" v-model:open="settings" :name="current.name" :kind="current.kind" :title="titleLabel" />
		<Dialog v-model="explained" :title="explainTitle" :message="explainMessage" />
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { Badge, Breadcrumbs, Button, Dialog, Popover, toast } from "frappe-ui";
import { FormLayout } from "@framework/ui/FormLayout";
import { CommitKey, LayoutEditKey, NO_COMMIT } from "@framework/ui/FormLayout/types";
import PageFrame from "@/shell/PageFrame.vue";
import { shellDialog } from "@/shell/dialog";
import { useUnloadGuard } from "@/pages/record/recordSave";
import { EditorKey } from "../context";
import { createEditor, nameOf } from "../editor";
import EditColumns from "../canvas/EditColumns.vue";
import EditSections from "../canvas/EditSections.vue";
import DraftFields from "./DraftFields.vue";
import DraftSettings from "./DraftSettings.vue";
import FieldForm from "./FieldForm.vue";
import { DraftUiKey, type Editing } from "./draftUi";
import { created, draft, KINDS, openNewDoctype, rememberModule, slugOf, type Draft } from "./newDoctype";

const router = useRouter();

// The draft this page was opened for; Save keeps it as the "created" DocType.
const current = ref<Draft | null>(draft.value ? { ...draft.value } : null);
draft.value = null;
const kindLabel = computed(() => KINDS.find((one) => one.value === current.value?.kind)?.label);

const editor = createEditor(current.value?.name ?? "new", "design", "details");
provide(EditorKey, editor);
editor.loadDraft(
	[{ fieldname: "title", fieldtype: "Data", label: "Title", added: true } as any],
	[{ name: "tab-details", sections: [{ name: "section-main", columns: [{ name: "column-main", fields: ["title"] }] }] }]
);

provide(CommitKey, NO_COMMIT);
provide(LayoutEditKey, { sections: EditSections, columns: EditColumns, fields: DraftFields });
const doc = ref<Record<string, any>>({});
const tab = ref("");

// One popover: "Add field" or a placed field's properties, pointed at what was clicked.
const editing = ref<Editing>(null);
const anchor = ref<Element>();
const titleField = ref("title");
provide(DraftUiKey, {
	editing,
	anchor,
	titleField,
	open: (next, element) => {
		anchor.value = element;
		editing.value = next;
	},
});
const close = () => (editing.value = null);
// The draft page selects only fields, through its popover; a section or column click selects nothing.
watch(
	() => editor.state.selection,
	(selection) => selection && (editor.state.selection = null)
);
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
	if (titleField.value === from) titleField.value = fieldname;
	editing.value = { kind: "field", fieldname };
}

// Saved state: the edit count and title field at the last save, to tell what is unsaved.
const saved = ref(false);
const savedAt = ref({ edits: 0, title: "" });
const tryIt = ref(false);
const dirty = computed(() => editor.edits.value !== savedAt.value.edits || titleField.value !== savedAt.value.title);
const unsaved = () => Boolean(current.value) && (!saved.value || dirty.value);

function save() {
	const one = current.value!;
	const first = !saved.value;
	created.set(one.name, one);
	rememberModule(one.module);
	for (const field of editor.state.fields) field.added = false;
	saved.value = true;
	savedAt.value = { edits: editor.edits.value, title: titleField.value };
	close();
	if (!first) return void toast.success(`${one.name} saved`);
	tryIt.value = true;
	toast.success(`${one.name} created`);
	void router.replace(`/doctype/${encodeURIComponent(one.name)}`);
}

const crumbs = computed(() => [
	{ label: "DocType", route: "/doctype" },
	{ label: current.value?.name ?? "New DocType" },
]);

const settings = ref(false);

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
