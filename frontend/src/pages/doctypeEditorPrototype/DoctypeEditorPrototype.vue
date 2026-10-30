<!--
  PROTOTYPE (#45867), throwaway: the DocType editor at /<prefix>/doctype/<name>.
  Three variants of where the canvas, field list and properties panel sit, switched with
  `?variant=a|b|c`; `?mode=design|customize`, `?layout=…` and `?dev=0` as the modes grilling
  rules. Real meta and Form Layout rows are read; nothing is saved.
-->
<template>
	<PageFrame :scroll="false">
		<template #header>
			<div class="flex min-w-0 flex-1 items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Breadcrumbs :items="crumbs" class="-ml-0.5" />
					<Badge :label="mode === 'design' ? 'Design' : 'Customize'" theme="gray" size="md" />
					<Dropdown v-if="variant === 'c'" :options="layoutMenu" side="bottom" align="start">
						<Button variant="ghost" :label="`${layoutLabel} layout`" icon-right="lucide-chevron-down" />
					</Dropdown>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<TabButtons v-if="variant === 'a'" :options="layoutButtons" :model-value="layout" @update:model-value="setLayout" />
					<Dropdown v-if="canSwitchMode" :options="modeMenu" side="bottom" align="end">
						<Button icon="lucide-more-horizontal" variant="subtle" label="More actions" />
					</Dropdown>
					<Button variant="solid" label="Save" :disabled="!editor.state.log.length" @click="saved = true" />
				</div>
			</div>
		</template>

		<div v-if="editor.state.loading" class="flex flex-1 items-center justify-center text-base text-ink-gray-5">Loading…</div>

		<!-- A: three fixed panes. -->
		<div v-else-if="variant === 'a'" class="flex min-h-0 flex-1 border-t border-outline-gray-1">
			<aside class="flex w-[272px] shrink-0 flex-col border-r border-outline-gray-1">
				<FieldList class="flex-1" />
			</aside>
			<main class="min-w-0 flex-1 overflow-y-auto" @click="editor.state.selection = null">
				<div class="mx-auto max-w-[880px] px-8 pb-24 pt-5">
					<Notice />
					<Canvas />
				</div>
			</main>
			<aside class="flex w-[304px] shrink-0 flex-col border-l border-outline-gray-1">
				<Properties class="flex-1" />
			</aside>
		</div>

		<!-- B: the layout as the page's tab strip; one inspector on the right, Fields | Properties. -->
		<div v-else-if="variant === 'b'" class="flex min-h-0 flex-1 flex-col">
			<nav class="flex shrink-0 gap-5 border-b border-outline-gray-1 px-5">
				<button
					v-for="one in LAYOUTS"
					:key="one.key"
					type="button"
					class="-mb-px border-b py-2.5 text-base"
					:class="layout === one.key ? 'border-outline-gray-9 text-ink-gray-9' : 'border-transparent text-ink-gray-5 hover:text-ink-gray-7'"
					@click="setLayout(one.key)"
				>
					{{ one.label }}
				</button>
			</nav>
			<div class="flex min-h-0 flex-1">
				<main class="min-w-0 flex-1 overflow-y-auto bg-surface-gray-1" @click="editor.state.selection = null">
					<div class="mx-auto my-6 max-w-[880px] rounded-6 bg-surface-base px-8 pb-10 pt-6 shadow-sm ring-1 ring-outline-gray-1">
						<Notice />
						<Canvas />
					</div>
				</main>
				<aside class="flex w-[336px] shrink-0 flex-col border-l border-outline-gray-1">
					<div class="px-3 pt-3">
						<TabButtons :options="[{ label: 'Fields', value: 'fields' }, { label: 'Properties', value: 'properties' }]" v-model="inspector" class="w-full [&>div]:w-full [&_button]:flex-1" />
					</div>
					<FieldList v-if="inspector === 'fields'" class="min-h-0 flex-1" />
					<Properties v-else class="min-h-0 flex-1" />
				</aside>
			</div>
		</div>

		<!-- C: a structure tree on the left, the canvas wide, properties float over it on selection. -->
		<div v-else class="flex min-h-0 flex-1 border-t border-outline-gray-1">
			<aside class="flex w-[256px] shrink-0 flex-col border-r border-outline-gray-1">
				<Outline class="min-h-0 flex-1 basis-1/2" />
				<div class="border-t border-outline-gray-1" />
				<FieldList hide-placed class="min-h-0 flex-1 basis-1/2" />
			</aside>
			<main class="relative min-w-0 flex-1 overflow-y-auto" @click="editor.state.selection = null">
				<div class="mx-auto max-w-[880px] px-8 pb-24 pt-5">
					<Notice />
					<Canvas />
				</div>
			</main>
			<div
				v-if="editor.state.selection"
				class="fixed bottom-16 right-4 top-[96px] z-30 flex w-[320px] flex-col overflow-hidden rounded-6 bg-surface-base shadow-xl ring-1 ring-outline-gray-2"
			>
				<Button class="absolute right-2 top-2 z-10" variant="ghost" icon="lucide-x" label="Close" @click="editor.state.selection = null" />
				<Properties class="min-h-0 flex-1" />
			</div>
		</div>

		<ActLog v-if="showLog" />
		<Dialog v-model="saved" :options="{ title: 'Prototype', message: saveMessage }" />

		<!-- The prototype's own bar: not part of the design. -->
		<div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-surface-gray-9 py-1 pl-1 pr-3 text-sm text-ink-white shadow-xl">
			<button class="flex size-7 items-center justify-center rounded-full hover:bg-surface-gray-7" @click="cycle(-1)"><span class="lucide-chevron-left size-4" /></button>
			<span class="min-w-[150px] text-center">{{ variant.toUpperCase() }} · {{ VARIANTS[variant] }}</span>
			<button class="flex size-7 items-center justify-center rounded-full hover:bg-surface-gray-7" @click="cycle(1)"><span class="lucide-chevron-right size-4" /></button>
			<span class="mx-2 h-4 w-px bg-surface-gray-7" />
			<label class="flex items-center gap-1.5"><input type="checkbox" :checked="dev" @change="setQuery({ dev: dev ? '0' : undefined, mode: undefined })" /> Developer mode</label>
			<label class="ml-3 flex items-center gap-1.5"><input type="checkbox" v-model="showLog" /> Acts</label>
			<span v-if="editor.state.log[0]" class="ml-3 max-w-[260px] truncate font-mono text-xs text-ink-gray-4">{{ editor.state.log[0].act }} {{ editor.state.log[0].args }}</span>
		</div>
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Badge, Breadcrumbs, Button, Dialog, Dropdown, TabButtons } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import PageFrame from "@/shell/PageFrame.vue";
import ActLog from "./ActLog.vue";
import FieldList from "./FieldList.vue";
import Outline from "./Outline.vue";
import Properties from "./Properties.vue";
import FormCanvas from "./canvas/FormCanvas.vue";
import PanelCanvas from "./canvas/PanelCanvas.vue";
import { EditorKey } from "./context";
import { createEditor, LAYOUTS, type LayoutKey, type Mode } from "./editor";

const VARIANTS = { a: "Three panes", b: "Inspector", c: "Outline" } as Record<string, string>;

const route = useRoute();
const router = useRouter();
const doctype = String(route.params.name);
const { meta } = useDoctypeMeta(doctype);

const variant = computed(() => (String(route.query.variant ?? "a") in VARIANTS ? String(route.query.variant ?? "a") : "a"));
const dev = computed(() => route.query.dev !== "0");
const custom = computed(() => Boolean(meta.value?.custom));
// The server picks the mode (#45862 ruling 1); the prototype reads it off the address.
const mode = computed<Mode>(() => {
	if (custom.value) return "design";
	if (!dev.value) return "customize";
	return route.query.mode === "customize" ? "customize" : "design";
});
const canSwitchMode = computed(() => dev.value && !custom.value);

const editor = createEditor(doctype, mode.value);
provide(EditorKey, editor);
watch(mode, (value) => (editor.state.mode = value), { immediate: true });

const stop = watch(
	() => meta.value?.fields,
	(fields) => {
		if (!fields) return;
		editor.load(meta.value);
		queueMicrotask(() => stop());
	},
	{ immediate: true }
);

const layout = computed<LayoutKey>(() => {
	const key = String(route.query.layout ?? "details") as LayoutKey;
	return LAYOUTS.some((one) => one.key === key) ? key : "details";
});
watch(layout, (value) => {
	editor.state.layout = value;
	editor.state.selection = null;
}, { immediate: true });
const layoutLabel = computed(() => LAYOUTS.find((one) => one.key === layout.value)!.label);
const layoutButtons = LAYOUTS.map((one) => ({ label: one.label, value: one.key }));
const layoutMenu = computed(() => LAYOUTS.map((one) => ({ label: `${one.label} layout`, onClick: () => setLayout(one.key) })));

const crumbs = computed(() => [
	{ label: "DocType", route: "/doctype" },
	{ label: doctype, route: `/doctype/${encodeURIComponent(doctype)}` },
	{ label: mode.value === "design" ? "Edit DocType" : "Customize form" },
]);

const modeMenu = computed(() => [
	mode.value === "design"
		? { label: "Customize form instead", icon: "lucide-sliders-horizontal", onClick: () => setQuery({ mode: "customize" }) }
		: { label: "Edit DocType instead", icon: "lucide-pencil-ruler", onClick: () => setQuery({ mode: undefined }) },
]);

const showLog = ref(false);
const saved = ref(false);
const saveMessage = computed(() =>
	mode.value === "design"
		? "Nothing saved. Design would write the DocType's JSON and its layout files (or, for a custom DocType, the database and a site Form Layout row)."
		: "Nothing saved. Customize would write Custom Field, Property Setter and site Form Layout rows through save_customization."
);
const inspector = ref<"fields" | "properties">("fields");
watch(() => editor.state.selection, (selected) => {
	if (selected) inspector.value = "properties";
});

function setQuery(patch: Record<string, string | undefined>) {
	const query = { ...route.query, ...patch };
	for (const key of Object.keys(query)) if (query[key] === undefined) delete query[key];
	router.replace({ query });
}
function setLayout(key: LayoutKey) {
	setQuery({ layout: key === "details" ? undefined : key });
}
function cycle(delta: number) {
	const keys = Object.keys(VARIANTS);
	const next = keys[(keys.indexOf(variant.value) + delta + keys.length) % keys.length];
	setQuery({ variant: next === "a" ? undefined : next });
}
function onKey(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	if (target.closest("input, textarea, [contenteditable]")) return;
	if (event.key === "ArrowLeft") cycle(-1);
	if (event.key === "ArrowRight") cycle(1);
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

const Canvas = defineComponent(() => () =>
	h(layout.value === "side-panel" ? PanelCanvas : FormCanvas, {
		frame: layout.value === "quick-entry" ? "dialog" : "page",
	})
);

// Where this mode's save would write, and the fork a first container edit causes in Customize.
const Notice = defineComponent(() => () => {
	const source = editor.state.source[layout.value];
	const forked = editor.state.forked[layout.value];
	const app = meta.value?.module ? `${meta.value.module} module` : "its app";
	let icon = "lucide-file-code";
	let text = custom.value
		? "Custom DocType: saves to this site's database and a site Form Layout row."
		: `Saves to the DocType's JSON and the layout files in ${app}.`;
	if (mode.value === "customize") {
		icon = "lucide-sliders-horizontal";
		text = "Saves to this site only: custom fields, property setters and this site's layout.";
		if (source === "fallback")
			text += " This layout still comes from the app; your first change to a tab, section or column saves a copy for this site.";
		if (forked) {
			icon = "lucide-git-fork";
			text = `This site now has its own ${layoutLabel.value} layout. Later app changes to it will not reach this site.`;
		}
	}
	return h("div", { class: "mb-5 flex items-start gap-2 text-sm text-ink-gray-5" }, [
		h("span", { class: [icon, "mt-0.5 size-3.5 shrink-0"], "aria-hidden": "true" }),
		h("span", { class: "flex-1" }, text),
		layout.value === "side-panel" || layout.value === "quick-entry"
			? null
			: h(Button, {
					variant: "ghost",
					size: "sm",
					iconLeft: "lucide-plus",
					label: "Add tab",
					class: "-my-1 shrink-0",
					onClick: (event: MouseEvent) => {
						event.stopPropagation();
						editor.acts.addTab();
					},
				}),
	]);
});
</script>
