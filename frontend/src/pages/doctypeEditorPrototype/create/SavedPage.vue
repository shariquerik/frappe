<!--
  PROTOTYPE (#47095), throwaway: a DocType that is already saved and has records, in Design mode,
  in the same editor as a new one (#45867's look: header, canvas, 380px panel). The meta and the
  Details layout (its row, else the DocType's breaks) are real reads; counts are real; nothing is
  written. ?variant= picks how a big DocType is crossed: A a finder in the header, B an outline
  on the left, C a field list in the panel.
-->
<template>
	<PageFrame :scroll="false">
		<template #header>
			<div class="flex w-full flex-col">
				<div class="-mx-3 flex h-12 items-center justify-between gap-3 border-b px-3 sm:-mx-5 sm:px-5">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<Breadcrumbs :items="crumbs" class="-ml-0.5 min-w-0" />
						<Badge v-if="dirty" label="Not saved" theme="amber" />
					</div>
					<Combobox
						v-if="variant === 'A' && tab === 'editor' && ready"
						class="hidden w-64 lg:block"
						:model-value="null"
						:options="finderOptions"
						placeholder="Find a field"
						@update:model-value="$event && saved.jumpTo(String($event))"
					/>
					<div v-if="tab === 'editor'" class="hidden shrink-0 items-center lg:flex">
						<Tooltip text="Undo (Ctrl+Z)">
							<Button variant="ghost" icon="lucide-undo-2" label="Undo" :disabled="!editor.state.past.length" @click="editor.history.undo()" />
						</Tooltip>
						<Tooltip text="Redo (Ctrl+Shift+Z)">
							<Button variant="ghost" icon="lucide-redo-2" label="Redo" :disabled="!editor.state.future.length" @click="editor.history.redo()" />
						</Tooltip>
					</div>
					<Tooltip text="No changes to save" :disabled="dirty">
						<div class="flex shrink-0">
							<Button variant="solid" label="Save" :disabled="!dirty" @click="save" />
						</div>
					</Tooltip>
				</div>
				<Tabs
					v-model="tab"
					class="-mx-3 -mb-px sm:-mx-5 [&_[role='tab']]:rounded-4 [&_[role='tablist']]:gap-5 [&_[role='tablist']]:px-3 [&_[role='tablist']]:py-2 sm:[&_[role='tablist']]:px-5"
				>
					<TabList variant="underline">
						<TabTrigger v-for="one in TABS" :key="one.value" :value="one.value" :label="one.label" :icon-left="one.icon" />
					</TabList>
				</Tabs>
			</div>
		</template>

		<div v-if="!ready" class="flex flex-1 items-center justify-center border-t border-outline-gray-1 text-base text-ink-gray-5">Loading {{ doctype }}…</div>
		<template v-else>
			<div v-if="tab === 'editor'" class="flex flex-1 items-center justify-center border-t border-outline-gray-1 px-6 text-center text-base text-ink-gray-6 lg:hidden">
				The editor needs a wider window, 1024px or more.
			</div>
			<EditorTab v-if="tab === 'editor'" class="hidden lg:flex" :name="doctype" :meta="metaLine">
				<template v-if="variant === 'B'" #rail><FieldOutline /></template>
			</EditorTab>
			<main v-else class="min-w-0 flex-1 overflow-y-auto">
				<div class="px-3 pb-24 pt-6 sm:px-5">
					<DraftSettings v-if="tab === 'settings'" :name="doctype" :kind="kind" :title="titleLabel" />
					<FormPreview v-else :schema="editor.schema.value" />
				</div>
			</main>
		</template>
		<VariantBar :variants="VARIANTS" />
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Badge, Breadcrumbs, Button, Combobox, TabList, Tabs, TabTrigger, Tooltip, toast } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import PageFrame from "@/shell/PageFrame.vue";
import { shellDialog } from "@/shell/dialog";
import { useUnloadGuard } from "@/pages/record/recordSave";
import { EditorKey } from "../context";
import { createEditor, nameOf } from "../editor";
import DraftSettings from "./DraftSettings.vue";
import EditorTab from "./EditorTab.vue";
import FieldOutline from "./FieldOutline.vue";
import FormPreview from "./FormPreview.vue";
import VariantBar from "./VariantBar.vue";
import { DraftUiKey } from "./draftUi";
import type { Kind } from "./newDoctype";
import { createSavedUi, fieldIndex, plural, SavedUiKey, type SavedUi } from "./savedDoctype";

const VARIANTS = [
	{ key: "A", label: "Finder in the header" },
	{ key: "B", label: "Outline on the left" },
	{ key: "C", label: "Field list in the panel" },
];
const TABS = [
	{ value: "editor", label: "Editor", icon: "lucide-layout-list" },
	{ value: "settings", label: "Settings", icon: "lucide-settings" },
	{ value: "preview", label: "Preview", icon: "lucide-eye" },
];

const route = useRoute();
const doctype = String(route.params.name);
const variant = computed(() => String(route.query.variant ?? "A"));
const tab = ref(String(route.query.tab ?? "editor"));
const { meta } = useDoctypeMeta(doctype);

const editor = createEditor(doctype, "design", "details");
provide(EditorKey, editor);
const ready = ref(false);
const kind = computed<Kind>(() => {
	const one = meta.value as any;
	if (one?.istable) return "child";
	if (one?.issingle) return "single";
	return one?.is_submittable ? "submittable" : "regular";
});
const titleField = ref("");
const description = ref("");
const labelFocus = ref<string | null>(null);

// SavedUi needs the loaded fields, so it is made once the meta arrives; until then a stand-in.
const saved = ref<SavedUi>(null as any);
provide(SavedUiKey, computed(() => (ready.value ? saved.value : null)));

watch(
	() => meta.value?.fields,
	async (fields) => {
		if (!fields || ready.value) return;
		await editor.load(meta.value as any);
		editor.state.activeTab = editor.tree.value[0]?.name ?? null;
		titleField.value = (meta.value as any).title_field ?? "";
		description.value = (meta.value as any).description ?? "";
		saved.value = createSavedUi(editor, doctype, Boolean((meta.value as any).custom));
		ready.value = true;
		const field = route.query.field;
		if (field) saved.value.jumpTo(String(field));
	},
	{ immediate: true }
);

provide(DraftUiKey, {
	get kind() {
		return kind.value;
	},
	titleField,
	description,
	// A field added in this session still follows its label until Save; saved ones keep theirs.
	draft: computed(() => true),
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
	beforeRemove,
} as any);

/** Renames a field everywhere it is named on the page; one undo step. */
function rename(from: string, to: string) {
	const taken = new Set(editor.state.fields.map((one) => one.fieldname).filter((one) => one !== from));
	let fieldname = to;
	for (let n = 2; taken.has(fieldname); n++) fieldname = `${to}_${n}`;
	if (fieldname === from) return;
	const wasSaved = saved.value.isSaved(from);
	editor.history.group(() => {
		const column = editor.columnOf(from);
		if (column) column.fields = column.fields.map((entry) => (nameOf(entry) === from ? fieldname : entry));
		editor.acts.setField(from, "fieldname", fieldname);
	});
	if (wasSaved) {
		const original = saved.value.original(from);
		delete saved.value.renamed[from];
		if (original !== fieldname) saved.value.renamed[fieldname] = original;
	}
	if (titleField.value === from) titleField.value = fieldname;
	editor.state.selection = { kind: "field", fieldname };
}

/** Removing a field whose column holds values says what stays, once. */
async function beforeRemove(fieldname: string) {
	if (!saved.value.isSaved(fieldname)) return true;
	const field = editor.field(fieldname)!;
	const count = saved.value.counts[saved.value.original(fieldname)] ?? 0;
	const label = field.label || fieldname;
	return (
		(await shellDialog().confirm({
			title: `Remove ${label}?`,
			message: count
				? `Its column and the ${plural(count, "value")} in it stay in the database, but no form, list or report shows them. ${label} also leaves every layout of ${doctype}.`
				: `No record holds a value in it. Its column stays in the database. ${label} also leaves every layout of ${doctype}.`,
			confirmLabel: "Remove field",
			cancelLabel: "Keep it",
		})) === true
	);
}

const metaLine = computed(() => {
	const one = meta.value as any;
	if (!one || !saved.value) return "";
	const records = kind.value === "single" ? "" : ` · ${plural(saved.value.records, "record")}`;
	return `${one.module} · ${one.custom ? "Custom" : "Standard"}${records}`;
});
const titleLabel = computed(() => editor.field(titleField.value)?.label ?? "");

const finderOptions = computed(() => {
	const groups: { group: string; options: { label: string; value: string; description: string }[] }[] = [];
	for (const row of fieldIndex(editor)) {
		let group = groups.find((one) => one.group === row.tab);
		if (!group) groups.push((group = { group: row.tab, options: [] }));
		group.options.push({ label: row.label, value: row.fieldname, description: row.section });
	}
	return groups;
});

const savedAt = ref({ acted: 0, title: "", description: "" });
watch(ready, () => (savedAt.value = { acted: editor.state.acted, title: titleField.value, description: description.value }));
const dirty = computed(
	() =>
		ready.value &&
		(editor.state.acted !== savedAt.value.acted || titleField.value !== savedAt.value.title || description.value !== savedAt.value.description)
);

function save() {
	for (const field of editor.state.fields) field.added = false;
	savedAt.value = { acted: editor.state.acted, title: titleField.value, description: description.value };
	toast.success(`${doctype} saved (prototype: nothing was written)`);
}

const crumbs = computed(() => [{ label: "DocType", route: "/doctype" }, { label: doctype }]);
useUnloadGuard(() => dirty.value);
</script>
