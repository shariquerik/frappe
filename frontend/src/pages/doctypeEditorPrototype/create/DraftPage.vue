<!--
  PROTOTYPE (#45867), throwaway: steps 2 to 5 of the new-DocType flow (comment 6767773108), in
  the look of CRM's desk v2 Forms editor (frappe/crm#3419; rulings frappe/frappe#47023 round 3
  variant g, and #47029). The draft at /<prefix>/doctype/new starts with one "Title" field set as
  the title field. Editor is the form itself, one size up, with a 380px panel: the selected
  field's or section's settings, else "Add a field" (field types). A section's "Add field" asks
  for a label and guesses the type. Settings shows the defaults; Preview draws the record page.
  Save pretends to create the DocType: a toast, the address becomes /doctype/<name>, and "Try it"
  offers the record and the list. Nothing reaches the server, and leaving an unsaved draft leaves
  nothing behind.
  #47098: Settings is the saved DocType's Settings tab with a new DocType's defaults (draft): every
  kind allowed, no record counts, no Danger zone.
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
					<div v-if="current && tab === 'editor'" class="hidden shrink-0 items-center lg:flex">
						<Tooltip text="Undo (Ctrl+Z)">
							<Button variant="ghost" icon="lucide-undo-2" label="Undo" :disabled="!active.state.past.length" @click="active.history.undo()" />
						</Tooltip>
						<Tooltip text="Redo (Ctrl+Shift+Z)">
							<Button variant="ghost" icon="lucide-redo-2" label="Redo" :disabled="!active.state.future.length" @click="active.history.redo()" />
						</Tooltip>
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
						<TabTrigger v-for="one in jumpedChild ? TABS.slice(0, 1) : TABS" :key="one.value" :value="one.value" :label="one.label" :icon-left="one.icon" />
					</TabList>
				</Tabs>
			</div>
		</template>

		<div v-if="!current" class="flex flex-1 flex-col items-center justify-center gap-3 border-t border-outline-gray-1">
			<p class="text-base text-ink-gray-6">A new DocType starts with its name.</p>
			<Button variant="solid" icon-left="lucide-plus" label="New DocType" @click="openNewDoctype" />
		</div>

		<template v-else>
			<div v-if="tab === 'editor'" class="flex flex-1 items-center justify-center border-t border-outline-gray-1 px-6 text-center text-base text-ink-gray-6 lg:hidden">
				The editor needs a wider window, 1024px or more.
			</div>
			<!-- #47099: a child's own editor fills the page; the draft's edits wait. -->
			<ChildScope v-if="tab === 'editor' && jumpedChild" :key="jumpedChild.name" :child="jumpedChild">
				<EditorTab class="hidden lg:flex" :name="jumpedChild.name">
					<template #meta>
						{{ jumpedChild.module }} · Child table<template v-if="jumpedChild.isNew"> · New, saved before {{ current.name }}</template> · This form is the row's dialog.
					</template>
					<template #after-meta>
						<div class="mt-8">
							<p class="mb-1.5 text-sm text-ink-gray-6">{{ jumpedField?.label }} in {{ current.name }}</p>
							<CanvasGrid :field="jumpedField!" own />
						</div>
					</template>
				</EditorTab>
			</ChildScope>
			<EditorTab v-else-if="tab === 'editor'" class="hidden lg:flex" :name="current.name" :meta="meta">
				<template #banner>
					<div v-if="saved && tryIt" class="mb-8 flex items-center gap-3 rounded-4 bg-surface-gray-2 py-2 pl-3 pr-2">
						<span class="lucide-circle-check size-4 shrink-0 text-ink-gray-7" aria-hidden="true" />
						<p class="min-w-0 flex-1 text-base text-ink-gray-8">
							<template v-if="current.kind === 'child'">Ready. Add it to a parent DocType as a Table field.</template>
							<template v-else>{{ current.name }} is ready. Try it.</template>
						</p>
						<template v-if="current.kind !== 'child'">
							<Button v-if="current.kind !== 'single'" size="sm" variant="outline" icon-left="lucide-plus" label="New record" @click="explain('new')" />
							<Button size="sm" variant="outline" :label="current.kind === 'single' ? 'Open' : 'Open list'" @click="explain('open')" />
						</template>
						<Button size="sm" variant="ghost" icon="lucide-x" label="Dismiss" @click="tryIt = false" />
					</div>
				</template>
			</EditorTab>
			<SettingsTab v-else-if="tab === 'settings'" :ui="settings!" />
			<main v-else class="min-w-0 flex-1 overflow-y-auto">
				<div class="px-3 pb-24 pt-6 sm:px-5">
					<FormPreview :schema="editor.schema.value" />
				</div>
			</main>
		</template>

		<Dialog v-model="explained" :title="explainTitle" :message="explainMessage" />
		<NewChildDialog v-if="current" />
		<VariantBar v-if="current" :variants="CHILD" param="child" :fallback="DEFAULT_CHILD_VARIANT" />
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { Badge, Breadcrumbs, Button, Dialog, TabList, Tabs, TabTrigger, Tooltip, toast } from "frappe-ui";
import PageFrame from "@/shell/PageFrame.vue";
import { shellDialog } from "@/shell/dialog";
import { useUnloadGuard } from "@/pages/record/recordSave";
import { EditorKey } from "../context";
import { createEditor, nameOf } from "../editor";
import EditorTab from "./EditorTab.vue";
import FormPreview from "./FormPreview.vue";
import SettingsTab from "./SettingsTab.vue";
import CanvasGrid from "./CanvasGrid.vue";
import ChildScope from "./ChildScope.vue";
import NewChildDialog from "./NewChildDialog.vue";
import VariantBar from "./VariantBar.vue";
import { ChildUiKey, childVariantOf, createChildUi, DEFAULT_CHILD_VARIANT } from "./childTables";
import { createSettingsUi } from "./settings";
import { DraftUiKey } from "./draftUi";
import { created, draft, KINDS, openNewDoctype, rememberModule, slugOf, type Draft } from "./newDoctype";

const router = useRouter();
const route = useRoute();
// #47099: as on a saved DocType, ?child= picks where a Table field's child is edited.
const CHILD = [
	{ key: "A", label: "Child: inline grid" },
	{ key: "B", label: "Child: in the panel" },
	{ key: "C", label: "Child: its own editor" },
];

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
editor.state.selection = null;

const childUi = createChildUi({
	parent: current.value?.name ?? "New DocType",
	parentModule: () => current.value?.module ?? "",
	parentEditor: editor,
	variant: childVariantOf(route.query.child),
	persona: "developer",
	customizing: () => false,
});
provide(ChildUiKey, childUi);
// The variant bar moves ?child=; the page follows without a reload.
watch(
	() => route.query.child,
	(next) => (childUi.variant = childVariantOf(next))
);
const jumpedField = computed(() => (childUi.jumped ? editor.field(childUi.jumped) : undefined));
const jumpedChild = computed(() => childUi.get(jumpedField.value?.options));
const active = computed(() => jumpedChild.value?.editor ?? editor);
function backToParent(select: boolean) {
	const table = childUi.jumped;
	childUi.jumped = null;
	editor.state.selection = select && table ? { kind: "field", fieldname: table } : null;
}

const titleField = ref("title");
const description = ref("");
const labelFocus = ref<string | null>(null);
const saved = ref(false);
provide(DraftUiKey, {
	kind: current.value?.kind ?? "regular",
	titleField,
	description,
	draft: computed(() => !saved.value),
	rename,
	labelFocus,
	focusLabel(fieldname: string) {
		editor.state.selection = { kind: "field", fieldname };
		labelFocus.value = fieldname;
	},
	focusTabLabel(key: string) {
		editor.state.selection = { kind: "tab", key };
		labelFocus.value = key;
	},
});
const meta = computed(() => {
	const one = current.value;
	if (!one) return "";
	if (one.kind === "child") return `${one.module} · Child table. This form is the row's dialog.`;
	return `${one.module} · ${kindLabel.value}`;
});
const titleLabel = computed(() => editor.field(titleField.value)?.label ?? "");
// #47098: the Settings tab, as on a saved DocType but with defaults: no counts, no Danger zone.
const settings = current.value
	? createSettingsUi({
			doctype: current.value.name,
			draft: { kind: current.value.kind, module: current.value.module },
			fields: () => editor.state.fields,
			records: () => null,
			customizing: () => false,
			titleField,
			description,
			app: () => "",
		})
	: null;

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
	const selected = editor.state.selection;
	if (selected?.kind === "field" && selected.fieldname === from) editor.state.selection = { kind: "field", fieldname };
}

// Saved state: the edit count and title field at the last save, to tell what is unsaved.
const savedAt = ref({ edits: 0, title: "" });
const tryIt = ref(false);
const savedDescription = ref("");
const dirty = computed(
	() =>
		editor.state.acted !== savedAt.value.edits ||
		titleField.value !== savedAt.value.title ||
		description.value !== savedDescription.value ||
		Boolean(settings?.dirty) ||
		childUi.dirty()
);
const unsavedNow = computed(() => Boolean(current.value) && (!saved.value || dirty.value));
const unsaved = () => unsavedNow.value;

function save() {
	const one = current.value!;
	const first = !saved.value;
	// #47099: new child tables are written first: the Table field's options must name a DocType that exists.
	const children = childUi.pending().map((child) => (child.isNew ? `Created ${child.name} (child table)` : `Saved ${child.name}`));
	childUi.markSaved();
	created.set(one.name, one);
	rememberModule(one.module);
	for (const field of editor.state.fields) field.added = false;
	saved.value = true;
	savedAt.value = { edits: editor.state.acted, title: titleField.value };
	settings?.markSaved();
	savedDescription.value = description.value;
	const before = children.length ? `${children.join(", ")}, then ` : "";
	if (!first) return void toast.success(before ? `${before}saved ${one.name}` : `${one.name} saved`);
	tryIt.value = true;
	toast.success(before ? `${before}created ${one.name}` : `${one.name} created`);
	void router.replace(`/doctype/${encodeURIComponent(one.name)}`);
}

const crumbs = computed(() =>
	jumpedChild.value
		? [
				{ label: "DocType", route: "/doctype" },
				{ label: current.value!.name, onClick: () => backToParent(false) },
				{ label: jumpedField.value?.label || childUi.jumped!, onClick: () => backToParent(true) },
				{ label: jumpedChild.value.name },
			]
		: [
				{ label: "DocType", route: "/doctype" },
				{ label: current.value?.name ?? "New DocType" },
			]
);

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
