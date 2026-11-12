<!--
  PROTOTYPE (#47095), throwaway: a DocType that is already saved and has records, in Design mode,
  in the same editor as a new one (#45867's look: header, canvas, 380px panel). The meta and the
  Details layout (its row, else the DocType's breaks) are real reads; counts are real; nothing is
  written. ?finder= picks how a big DocType is crossed (#47095 chose A, the header finder).
  #47096: Customize mode on a standard DocType (?mode=customize; ?as=manager fakes a user without
  developer mode: Customize only, no switch, no Export). ?variant= picks how the mode shows: A a
  chip by the breadcrumbs, B a lock on every standard field, C a banner over the canvas.
  #47097: every layout the DocType's kind allows (?layout= and &row= open one). Round 2: the open
  layout is the last crumb (`DocType / Contact / Details ▾`), its menu holds the open layout's acts,
  the field finder is a search trigger with Cmd/Ctrl+J, Customize's "From ERPNext" moved to the
  canvas meta line, and the Preview reads as the record page's Details column. ?header= picks where
  Design | Customize sits: A in the header, left of Undo; B at the tab strip's right end. The variant
  bar switches ?header=; round 1's ?switcher= is ignored now, and ?variant= still reads #47096's
  B (locks) and C (banner); its A chip is the meta line's "From ERPNext".
  #47098: the Settings tab (SettingsTab; ?settings=A|B|C, the variant bar switches it now). Its
  edits join Save. The ⋯ menu shows in both modes, so Design | Customize moves nothing: Design's
  opens the list and the Danger zone's Rename and Delete dialogs.
-->
<template>
	<PageFrame :scroll="false">
		<template #header>
			<div class="flex w-full flex-col">
				<div class="-mx-3 flex h-12 items-center justify-between gap-3 border-b px-3 sm:-mx-5 sm:px-5">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<LayoutCrumbs :crumbs="crumbs" :ready="ready" :last="jumpedChild?.name" class="-ml-0.5" @picked="tab = 'editor'" />
						<Badge v-if="dirty" label="Not saved" theme="amber" class="shrink-0" />
					</div>
					<div v-if="finder === 'A' && (tab === 'editor' || unified) && ready && !jumpedChild" class="hidden shrink-0 lg:flex">
						<FieldFinder :settings="unified ? settings : null" @tab="tab = $event" />
					</div>
					<TabButtons v-if="switchable && header === 'A'" class="shrink-0" :options="MODES" :model-value="mode" @update:model-value="setMode" />
					<div v-if="tab === 'editor'" class="hidden shrink-0 items-center lg:flex">
						<Tooltip text="Undo (Ctrl+Z)">
							<Button variant="ghost" icon="lucide-undo-2" label="Undo" :disabled="!active.state.past.length" @click="active.history.undo()" />
						</Tooltip>
						<Tooltip text="Redo (Ctrl+Shift+Z)">
							<Button variant="ghost" icon="lucide-redo-2" label="Redo" :disabled="!active.state.future.length" @click="active.history.redo()" />
						</Tooltip>
					</div>
					<Dropdown :options="moreMenu" side="bottom" align="end">
						<Button variant="ghost" icon="lucide-ellipsis" label="More" />
					</Dropdown>
					<Tooltip text="No changes to save" :disabled="dirty">
						<div class="flex shrink-0">
							<Button variant="solid" label="Save" :disabled="!dirty" @click="save" />
						</div>
					</Tooltip>
				</div>
				<div class="relative">
					<Tabs
						v-model="tab"
						class="-mx-3 -mb-px sm:-mx-5 [&_[role='tab']]:rounded-4 [&_[role='tablist']]:gap-5 [&_[role='tablist']]:px-3 [&_[role='tablist']]:py-2 sm:[&_[role='tablist']]:px-5"
					>
						<TabList variant="underline">
							<TabTrigger v-for="one in jumpedChild ? TABS.slice(0, 1) : TABS" :key="one.value" :value="one.value" :label="one.label" :icon-left="one.icon" />
						</TabList>
					</Tabs>
					<!-- B: Design | Customize at the strip's right end, on every tab. -->
					<div v-if="switchable && header === 'B'" class="absolute inset-y-0 right-0 flex items-center">
						<TabButtons :options="MODES" :model-value="mode" @update:model-value="setMode" />
					</div>
				</div>
			</div>
		</template>

		<div v-if="!ready" class="flex flex-1 items-center justify-center border-t border-outline-gray-1 text-base text-ink-gray-5">Loading {{ doctype }}…</div>
		<template v-else>
			<div v-if="tab === 'editor'" class="flex flex-1 items-center justify-center border-t border-outline-gray-1 px-6 text-center text-base text-ink-gray-6 lg:hidden">
				The editor needs a wider window, 1024px or more.
			</div>
			<!-- #47099: a child's own editor fills the page (C's "Edit <child>", every "Edit row form"); the parent's edits wait. -->
			<ChildScope v-if="tab === 'editor' && jumpedChild" :key="jumpedChild.name" :child="jumpedChild">
				<EditorTab class="hidden lg:flex" :name="jumpedChild.name">
					<template #meta>
						{{ jumpedChild.module }} · Child table<template v-if="jumpedChild.custom"> · Custom</template><template v-if="jumpedChild.isNew"> · New, saved before {{ doctype }}</template> · This form is the row's dialog.
					</template>
					<template #after-meta>
						<div class="mt-8" data-child-grid-preview>
							<p class="mb-1.5 text-sm text-ink-gray-6">{{ jumpedField?.label }} in {{ doctype }}</p>
							<CanvasGrid :field="jumpedField!" own />
						</div>
					</template>
				</EditorTab>
			</ChildScope>
			<EditorTab v-else-if="tab === 'editor'" class="hidden lg:flex" :name="doctype">
				<template #meta>
					{{ metaLine.module }} ·
					<Tooltip v-if="customizing" :text="`${doctype} comes from ${customize!.app}. Your changes stay on this site and survive its updates.`">
						<span class="cursor-default" data-meta-app>From {{ customize!.app }}</span>
					</Tooltip>
					<template v-else>{{ metaLine.source }}</template>
					<template v-if="metaLine.records"> · {{ metaLine.records }}</template>
				</template>
				<template v-if="finder === 'B'" #rail><FieldOutline /></template>
				<template v-if="customizing && variant === 'C'" #banner>
					<div class="mb-6 flex items-start gap-2.5 rounded-6 bg-surface-gray-2 px-3.5 py-3 text-p-base text-ink-gray-7">
						<span class="lucide-paintbrush mt-0.5 size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
						<span>You are customizing {{ doctype }} from {{ customize!.app }}. Your changes stay on this site and survive {{ customize!.app }} updates.</span>
					</div>
				</template>
			</EditorTab>
			<!-- ?search=one keeps Settings mounted, so the header's finder can search its rows from any tab. -->
			<SettingsTab
				v-if="unified || tab === 'settings'"
				v-show="tab === 'settings'"
				:ui="settings"
				:can-customize="switchable"
				@customize="setMode('customize')"
			/>
			<main v-if="tab === 'preview'" class="min-w-0 flex-1 overflow-y-auto">
				<div class="px-3 pb-24 pt-6 sm:px-5">
					<FormPreview :schema="editor.schema.value" />
				</div>
			</main>
		</template>
		<CustomizeDialogs v-if="customize" v-model:reset="resetOpen" v-model:export="exportOpen" :doctype="doctype" :ui="customize" />
		<LayoutDialogs v-if="ready" />
		<SettingsDialogs v-if="ready" :ui="settings" />
		<NewChildDialog v-if="ready" :customizing="customizing" />
		<VariantBar :variants="CHILD" param="child" />
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Badge, Button, Dropdown, TabButtons, TabList, Tabs, TabTrigger, Tooltip, toast } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import { routeFor } from "@/router/routeFor";
import PageFrame from "@/shell/PageFrame.vue";
import { shellDialog } from "@/shell/dialog";
import { useUnloadGuard } from "@/pages/record/recordSave";
import { EditorKey } from "../context";
import { createEditor, keyOf, nameOf, type LayoutKey, type Mode } from "../editor";
import CustomizeDialogs from "./CustomizeDialogs.vue";
import { createCustomizeUi, CustomizeKey, summary, type CustomizeUi, type Persona } from "./customize";
import EditorTab from "./EditorTab.vue";
import FieldFinder from "./FieldFinder.vue";
import FieldOutline from "./FieldOutline.vue";
import FormPreview from "./FormPreview.vue";
import LayoutCrumbs from "./LayoutCrumbs.vue";
import LayoutDialogs from "./LayoutDialogs.vue";
import SettingsDialogs from "./SettingsDialogs.vue";
import SettingsTab from "./SettingsTab.vue";
import VariantBar from "./VariantBar.vue";
import CanvasGrid from "./CanvasGrid.vue";
import ChildScope from "./ChildScope.vue";
import NewChildDialog from "./NewChildDialog.vue";
import { ChildUiKey, createChildUi, type ChildVariant } from "./childTables";
import { createLayoutUi, FAKE_VARIANTS, layoutsFor, LayoutUiKey } from "./layouts";
import { DraftUiKey } from "./draftUi";
import type { Kind } from "./newDoctype";
import { createSavedUi, plural, SavedUiKey, type SavedUi } from "./savedDoctype";
import { actRefusal, createSettingsUi, type SettingsUi } from "./settings";

// #47098: the bar switches the Settings tab's page; ?header= (#47097) still reads from the address.
// #47099: the bar switches where a Table field's child is edited.
const CHILD = [
	{ key: "A", label: "Child: inline grid" },
	{ key: "B", label: "Child: in the panel" },
	{ key: "C", label: "Child: its own editor" },
];
const SETTINGS = [
	{ key: "B", label: "Settings: section list" },
	{ key: "A", label: "Settings on one page" },
	{ key: "C", label: "Settings: edit in the panel" },
];
const MODES = [
	{ label: "Design", value: "design" },
	{ label: "Customize", value: "customize" },
];
const TABS = [
	{ value: "editor", label: "Editor", icon: "lucide-layout-list" },
	{ value: "settings", label: "Settings", icon: "lucide-settings" },
	{ value: "preview", label: "Preview", icon: "lucide-eye" },
];

const route = useRoute();
const router = useRouter();
const doctype = String(route.params.name);
const variant = computed(() => String(route.query.variant ?? "A"));
const finder = computed(() => String(route.query.finder ?? "A"));
const header = computed(() => (route.query.header === "B" ? "B" : "A"));
// #47098: ?search=one makes the header's finder search fields, settings and properties, on every tab.
const unified = route.query.search === "one";
const persona: Persona = route.query.as === "manager" ? "manager" : "developer";
const tab = ref(String(route.query.tab ?? "editor"));
const { meta, metas } = useDoctypeMeta(doctype);

const editor = createEditor(doctype, persona === "manager" || route.query.mode === "customize" ? "customize" : "design", "details");
provide(EditorKey, editor);
const ready = ref(false);
const kind = computed<Kind>(() => {
	const one = meta.value as any;
	if (one?.istable) return "child";
	if (one?.issingle) return "single";
	return one?.is_submittable ? "submittable" : "regular";
});
const layoutUi = createLayoutUi(editor, kind);
provide(LayoutUiKey, layoutUi);
const titleField = ref("");
const description = ref("");
const labelFocus = ref<string | null>(null);

// Customize mode: a standard DocType only. A developer switches; a manager is always in it.
const customize = ref<CustomizeUi | null>(null);
const mode = computed(() => editor.state.mode);
const customizing = computed(() => Boolean(customize.value) && mode.value === "customize");
const switchable = computed(() => Boolean(customize.value) && persona === "developer");
provide(CustomizeKey, computed(() => (customizing.value ? customize.value : null)));

// #47099: the Table fields' child DocTypes. ?child= picks where their fields are edited; &table= opens one's editor.
const childVariant = (["A", "B", "C"].includes(String(route.query.child)) ? String(route.query.child) : "A") as ChildVariant;
const childUi = createChildUi({
	parent: doctype,
	parentModule: () => (meta.value as any)?.module ?? "",
	parentEditor: editor,
	variant: childVariant,
	persona,
	customizing: () => customizing.value,
	metas: () => metas.value as any,
	jumped: route.query.table ? String(route.query.table) : null,
});
provide(ChildUiKey, childUi);
// The variant bar moves ?child=; the page follows without a reload.
watch(
	() => route.query.child,
	(next) => (childUi.variant = (["A", "B", "C"].includes(String(next)) ? String(next) : "A") as ChildVariant)
);
const jumpedField = computed(() => (childUi.jumped ? editor.field(childUi.jumped) : undefined));
const jumpedChild = computed(() => (ready.value ? childUi.get(jumpedField.value?.options) : undefined));
watch(
	() => jumpedField.value?.options,
	(name) => name && void childUi.ensure(name),
	{ immediate: true }
);
watch(
	() => childUi.jumped,
	(table) => {
		if (!ready.value) return;
		tab.value = "editor";
		void router.replace({ query: { ...route.query, table: table ?? undefined } });
	}
);
/** The editor Undo and Redo work on: the child's while its editor fills the page. */
const active = computed(() => jumpedChild.value?.editor ?? editor);
/** Back from a child's editor to the parent, with the Table field selected or nothing. */
function backToParent(select: boolean) {
	const table = childUi.jumped;
	childUi.jumped = null;
	if (select && table) saved.value.jumpTo(table);
	else editor.state.selection = null;
}
function setMode(next: Mode) {
	editor.state.mode = next;
	editor.state.selection = null;
	void router.replace({ query: { ...route.query, mode: next === "customize" ? "customize" : undefined } });
}
const resetOpen = ref(false);
const exportOpen = ref(false);
// #47098: ⋯ is there in both modes, so switching moves nothing. Design's opens the list and the
// Danger zone's Rename and Delete (the same dialogs; an act the zone refuses is left out).
const moreMenu = computed(() => {
	if (customizing.value)
		return [
			{ label: "Reset all customizations", icon: "lucide-rotate-ccw", onClick: () => (resetOpen.value = true) },
			...(persona === "developer" ? [{ label: "Export to an app", icon: "lucide-package", onClick: () => (exportOpen.value = true) }] : []),
		];
	const acts = [
		{ act: "rename" as const, label: "Rename DocType…", icon: "lucide-pencil" },
		{ act: "delete" as const, label: "Delete DocType…", icon: "lucide-trash-2" },
	].filter((one) => ready.value && !actRefusal(settings.value, one.act));
	// A child table has no page of its own to open.
	const opens = !ready.value || kind.value === "child" ? [] : [{ label: kind.value === "single" ? `Open ${doctype}` : `Open ${doctype} list`, icon: "lucide-list", route: routeFor(doctype) }];
	return [
		{ group: "Open", hideLabel: true, options: opens },
		{ group: "DocType", hideLabel: true, options: acts.map((one) => ({ label: one.label, icon: one.icon, onClick: () => (settings.value.act = one.act) })) },
	].filter((group) => group.options.length);
});

// SavedUi needs the loaded fields, so it is made once the meta arrives; until then a stand-in.
const saved = ref<SavedUi>(null as any);
// #47098: the Settings tab's state; its pending edits join the header's Save.
const settings = ref<SettingsUi>(null as any);
provide(SavedUiKey, computed(() => (ready.value ? saved.value : null)));

watch(
	() => meta.value?.fields,
	async (fields) => {
		if (!fields || ready.value) return;
		await editor.loadAll(meta.value as any, layoutsFor(kind.value), FAKE_VARIANTS[doctype]);
		if (route.query.layout) editor.openLayout(String(route.query.layout) as LayoutKey, route.query.row ? String(route.query.row) : null);
		titleField.value = (meta.value as any).title_field ?? "";
		description.value = (meta.value as any).description ?? "";
		saved.value = createSavedUi(editor, doctype, Boolean((meta.value as any).custom), kind.value === "single");
		if (!(meta.value as any).custom) customize.value = await createCustomizeUi(editor, doctype, (meta.value as any).module, persona);
		settings.value = createSettingsUi({
			doctype,
			fields: () => editor.state.fields,
			records: () => (kind.value === "single" ? null : saved.value.records),
			customizing: () => customizing.value,
			titleField,
			description,
			app: () => customize.value?.app ?? "",
		});
		ready.value = true;
		const field = route.query.field;
		if (field) saved.value.jumpTo(String(field));
		// #47099: &column= opens a child's field in the panel, as a click on it does.
		const column = route.query.column;
		const table = field ? editor.field(String(field)) : undefined;
		if (column && table?.options) void childUi.ensure(table.options).then(() => (childUi.focus = { table: table.fieldname, fieldname: String(column) }));
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
	// A field the site adds to a standard DocType is a Custom Field: custom_ keeps it clear of the app's.
	if (customizing.value && customize.value!.isCustom(from) && !to.startsWith("custom_")) to = `custom_${to}`;
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
	// Customize cannot remove a standard field; Remove (and Delete) hides it, or shows it again.
	if (customizing.value && customize.value!.isStandard(fieldname)) {
		const hidden = editor.field(fieldname)?.hidden;
		editor.acts.setField(fieldname, "hidden", hidden ? 0 : 1);
		return false;
	}
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

// Customizing, "Standard" reads "From ERPNext" (the template adds its tooltip); a Single has no count.
const metaLine = computed(() => {
	const one = meta.value as any;
	if (!one || !saved.value) return { module: "", source: "", records: "" };
	return {
		module: one.module,
		source: one.custom ? "Custom" : "Standard",
		records: kind.value === "single" ? "" : plural(saved.value.records, "record"),
	};
});

// #47097: the open layout lives in the address (?layout=, &row=), so a link or a reload keeps it.
// Round 2: the crumb's menu works on every tab; a layout opened from Settings or Preview shows in the Editor.
watch(
	() => editor.state.open,
	(open) => {
		if (!ready.value) return;
		const variant = editor.state.variants.find((one) => one.id === open);
		tab.value = "editor";
		void router.replace({ query: { ...route.query, layout: keyOf(open), row: variant?.row } });
	}
);

const savedAt = ref({ acted: 0, title: "", description: "" });
watch(ready, () => (savedAt.value = { acted: editor.state.acted, title: titleField.value, description: description.value }));
const dirty = computed(
	() =>
		ready.value &&
		(editor.state.acted !== savedAt.value.acted ||
			titleField.value !== savedAt.value.title ||
			description.value !== savedAt.value.description ||
			settings.value.dirty ||
			childUi.dirty())
);

function save() {
	// #47099: child DocTypes are written first (the Table field's options must name one that exists).
	const children = childUi.pending().map((one) => {
		if (one.isNew) return `created ${one.name} (child table)`;
		const site = childUi.get(one.name)?.editor.state.mode === "customize" ? summary(childUi.get(one.name)!.customize!.pending) : "";
		return `saved ${one.name}${site ? ` (${site})` : ""}`;
	});
	childUi.markSaved();
	if (children.length) {
		const first = children.join(", ");
		toast.success(`${first[0].toUpperCase()}${first.slice(1)}, then saved ${doctype} (prototype: nothing was written)`);
		customize.value?.markSaved();
		settings.value.markSaved();
		for (const field of editor.state.fields) field.added = false;
		savedAt.value = { acted: editor.state.acted, title: titleField.value, description: description.value };
		return;
	}
	const written = customizing.value ? summary(customize.value!.pending) : "";
	customize.value?.markSaved();
	settings.value.markSaved();
	for (const field of editor.state.fields) field.added = false;
	savedAt.value = { acted: editor.state.acted, title: titleField.value, description: description.value };
	toast.success(`${doctype} saved${written ? `: ${written}` : ""} (prototype: nothing was written)`);
}

// A manager reaches Customize from the DocType's own pages, so the crumbs lead back there. The
// layout crumb follows; the one before it opens Details, the layout every DocType has.
const openDetails = () => layoutUi.open(layoutUi.entries.value[0]);
const crumbs = computed(() =>
	jumpedChild.value
		? [
				...(persona === "manager" ? [{ label: doctype, route: routeFor(doctype) }, { label: "Customize", onClick: () => backToParent(false) }] : [{ label: "DocType", route: "/doctype" }, { label: doctype, onClick: () => backToParent(false) }]),
				{ label: jumpedField.value?.label || childUi.jumped!, onClick: () => backToParent(true) },
			]
		: persona === "manager"
		? [{ label: doctype, route: routeFor(doctype) }, { label: "Customize", onClick: openDetails }]
		: [{ label: "DocType", route: "/doctype" }, { label: doctype, onClick: openDetails }]
);
useUnloadGuard(() => dirty.value);
</script>
