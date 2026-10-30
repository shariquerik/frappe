<!--
  PROTOTYPE (#45867), throwaway: the DocType editor at /<prefix>/doctype/<name>, rebuilt to the
  review's direction "edit each layout where it renders; keep the page simple". The page edits
  the DocType's Details form only: one canvas, "+" in a column to add a field, drag to move,
  click to select. Quick Entry, the Side Panel, New Record and conditional rows are edited
  where they render (see InPlaceEditor.vue). Real meta and Form Layout rows are read; nothing saves.
-->
<template>
	<PageFrame :scroll="false">
		<template #header>
			<div class="flex min-w-0 flex-1 items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Breadcrumbs :items="crumbs" class="-ml-0.5" />
					<Badge :label="mode === 'design' ? 'Design' : 'Customize'" theme="gray" size="md" />
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<span v-if="editor.edits.value" class="text-sm text-ink-gray-5">{{ editor.edits.value }} unsaved</span>
					<Button icon-left="lucide-settings-2" label="Settings" @click="settings = true" />
					<Dropdown v-if="canSwitchMode" :options="modeMenu" side="bottom" align="end">
						<Button icon="lucide-more-horizontal" variant="subtle" label="More actions" />
					</Dropdown>
					<Button variant="solid" label="Save" :disabled="!editor.edits.value" @click="saved = true" />
				</div>
			</div>
		</template>

		<div v-if="editor.state.loading" class="flex flex-1 items-center justify-center text-base text-ink-gray-5">Loading…</div>

		<div v-else class="flex min-h-0 flex-1 border-t border-outline-gray-1">
			<main class="min-w-0 flex-1 overflow-y-auto" @click="editor.state.selection = null">
				<div class="mx-auto max-w-[880px] px-8 pb-24 pt-5">
					<Notice />
					<FormCanvas />
				</div>
			</main>
			<aside v-if="tweaks.properties === 'pane'" class="flex w-[320px] shrink-0 flex-col border-l border-outline-gray-1">
				<Properties class="flex-1" />
			</aside>
			<div
				v-else-if="editor.state.selection"
				class="fixed bottom-4 right-4 top-[104px] z-30 flex w-[320px] flex-col overflow-hidden rounded-6 bg-surface-base shadow-xl ring-1 ring-outline-gray-2"
			>
				<Properties closable class="min-h-0 flex-1" />
			</div>
		</div>

		<ActLog v-if="tweaks.acts" />
		<SettingsDialog v-model:open="settings" :meta="meta" :mode="mode" />
		<Dialog v-model="saved" :options="{ title: 'Prototype', message: saveMessage }" />
		<TweakPanel :show="['properties']" :class="tweaks.properties === 'pane' ? '!right-[336px]' : editor.state.selection && 'opacity-0 pointer-events-none'" />
	</PageFrame>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, provide, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Badge, Breadcrumbs, Button, Dialog, Dropdown } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import PageFrame from "@/shell/PageFrame.vue";
import ActLog from "./ActLog.vue";
import Properties from "./Properties.vue";
import SettingsDialog from "./SettingsDialog.vue";
import TweakPanel from "./TweakPanel.vue";
import FormCanvas from "./canvas/FormCanvas.vue";
import { EditorKey } from "./context";
import { createEditor } from "./editor";
import { modeFor, tweaks } from "./tweaks";

const route = useRoute();
const doctype = String(route.params.name);
const { meta } = useDoctypeMeta(doctype);

if (route.query.mode === "customize") tweaks.customize = true;
const custom = computed(() => Boolean(meta.value?.custom));
const mode = computed(() => modeFor(custom.value));
const canSwitchMode = computed(() => tweaks.dev && !custom.value);

const editor = createEditor(doctype, mode.value, "details");
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

const crumbs = computed(() => [
	{ label: "DocType", route: "/doctype" },
	{ label: doctype, route: `/doctype/${encodeURIComponent(doctype)}` },
	{ label: mode.value === "design" ? "Edit DocType" : "Customize form" },
]);

const modeMenu = computed(() => [
	mode.value === "design"
		? { label: "Customize form instead", icon: "lucide-sliders-horizontal", onClick: () => (tweaks.customize = true) }
		: { label: "Edit DocType instead", icon: "lucide-pencil-ruler", onClick: () => (tweaks.customize = false) },
]);

const settings = ref(false);
const saved = ref(false);
const saveMessage = computed(() =>
	mode.value === "design"
		? "Nothing saved. Design would write the DocType's JSON and its Details layout file (or, for a custom DocType, the database and a site Form Layout row)."
		: "Nothing saved. Customize would write Custom Field, Property Setter and a site Form Layout row through save_customization."
);

// Where this mode's save writes, and the fork a first container edit causes in Customize.
const Notice = defineComponent(() => () => {
	const source = editor.state.source.details;
	const forked = editor.state.forked.details;
	const app = meta.value?.module ? `the ${meta.value.module} module` : "its app";
	let icon = "lucide-file-code";
	let text = custom.value
		? "Custom DocType: saves to this site's database."
		: `Saves to the DocType's JSON and its layout file in ${app}.`;
	if (mode.value === "customize") {
		icon = "lucide-sliders-horizontal";
		text = "Saves to this site only: custom fields, property setters and this site's layout.";
		if (source === "fallback")
			text += " Your first change to a tab, section or column saves a copy of the form for this site.";
		if (forked) {
			icon = "lucide-git-fork";
			text = "This site now has its own Details layout. Later app changes to it will not reach this site.";
		}
	}
	return h("div", { class: "mb-5 flex items-start gap-2 text-sm text-ink-gray-5" }, [
		h("span", { class: [icon, "mt-0.5 size-3.5 shrink-0"], "aria-hidden": "true" }),
		h("span", { class: "flex-1" }, text),
		h(Button, {
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
