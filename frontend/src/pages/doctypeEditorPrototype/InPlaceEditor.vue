<!--
  PROTOTYPE (#45867): one layout, edited where it renders. A surface (the record page, the
  new-record page, the Create dialog, the side panel) swaps its renderer for this while its
  edit mode is on. It makes the editor for that one layout, draws it through the same
  `LayoutEditKey` seam, and shows the properties of the selection beside it. Nothing saves.
-->
<template>
	<div class="relative" @click="editor.state.selection = null">
		<div v-if="editor.state.loading" class="py-10 text-center text-base text-ink-gray-5">Loading…</div>
		<template v-else>
			<PanelCanvas v-if="layout === 'side-panel'" />
			<div v-else class="flex gap-5">
				<FormCanvas class="min-w-0 flex-1" :values="doc" />
				<!-- In a dialog the card sits inside it: the dialog blocks clicks outside itself. -->
				<aside
					v-if="properties === 'inline'"
					class="-my-1 flex w-[288px] shrink-0 flex-col self-stretch border-l border-outline-gray-1 pl-5"
					@click.stop
				>
					<Properties class="min-h-[420px] flex-1" />
				</aside>
			</div>
		</template>

		<Teleport v-if="properties !== 'inline'" to="body">
			<div
				v-if="editor.state.selection"
				class="fixed top-[112px] z-40 flex max-h-[calc(100vh-200px)] w-[320px] flex-col overflow-hidden rounded-6 bg-surface-base shadow-xl ring-1 ring-outline-gray-2"
				:style="properties === 'left-of-panel' ? { right: 'calc(378px + 16px)' } : { right: '16px' }"
				@click.stop
			>
				<Properties closable class="min-h-0 flex-1" />
			</div>
		</Teleport>
		<Teleport v-if="tweaks.acts" to="body"><ActLog /></Teleport>
	</div>
</template>

<script setup lang="ts">
import { provide, watch } from "vue";
import { Button } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import ActLog from "./ActLog.vue";
import Properties from "./Properties.vue";
import FormCanvas from "./canvas/FormCanvas.vue";
import PanelCanvas from "./canvas/PanelCanvas.vue";
import { EditorKey } from "./context";
import { createEditor, type Editor, type LayoutKey } from "./editor";
import { modeFor, tweaks } from "./tweaks";

const props = defineProps<{
	doctype: string;
	layout: LayoutKey;
	/** The record on screen: the row it uses is the row edited. */
	doc?: Record<string, any>;
	fakeCondition?: string;
	properties?: "float" | "left-of-panel" | "inline";
}>();
const emit = defineEmits<{ ready: [editor: Editor] }>();

const { meta } = useDoctypeMeta(props.doctype);
const editor = createEditor(props.doctype, "design", props.layout);
provide(EditorKey, editor);
emit("ready", editor);

watch(() => modeFor(Boolean(meta.value?.custom)), (mode) => (editor.state.mode = mode), { immediate: true });

const stop = watch(
	() => meta.value?.fields,
	(fields) => {
		if (!fields) return;
		editor.load(meta.value, { doc: props.doc, fakeCondition: props.fakeCondition });
		queueMicrotask(() => stop());
	},
	{ immediate: true }
);
</script>
