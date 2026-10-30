<!-- PROTOTYPE (#45867): Details, New Record and Quick Entry drawn by the record page's own
     `FormLayout`, with the edit seam injected. Quick Entry sits in a dialog-sized frame. -->
<template>
	<div
		:class="
			frame === 'dialog'
				? 'mx-auto w-full max-w-xl rounded-6 bg-surface-base p-5 shadow-xl ring-1 ring-outline-gray-1'
				: 'w-full'
		"
	>
		<div v-if="frame === 'dialog'" class="mb-5 flex items-center justify-between">
			<span class="text-xl-semibold text-ink-gray-9">New {{ editor.state.doctype }}</span>
			<span class="lucide-x size-4 text-ink-gray-5" aria-hidden="true" />
		</div>
		<div class="relative" @click.capture="selectTab">
			<FormLayout v-model:doc="doc" v-model:tab="tab" :layout="editor.schema.value" @update:active-tab="active = $event" />
		</div>
		<div v-if="frame === 'dialog'" class="mt-6 flex justify-end">
			<Button variant="solid" label="Create" disabled />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch } from "vue";
import { Button } from "frappe-ui";
import { FormLayout, identifyTabs } from "@framework/ui/FormLayout";
import { CommitKey, LayoutEditKey, NO_COMMIT } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import EditColumns from "./EditColumns.vue";
import EditFields from "./EditFields.vue";
import EditSections from "./EditSections.vue";

defineProps<{ frame?: "page" | "dialog" }>();
const editor = inject(EditorKey)!;

// The canvas fills nothing in: the controls draw empty.
const doc = ref<Record<string, any>>({});
const tab = ref("");
const active = ref("");

provide(CommitKey, NO_COMMIT);
provide(LayoutEditKey, { sections: EditSections, columns: EditColumns, fields: EditFields });

const tabs = computed(() => identifyTabs(editor.schema.value));
// A click on the strip shows that tab and selects it, so its label and condition can be edited.
function selectTab(event: MouseEvent) {
	const strip = (event.target as HTMLElement).closest('[role="tab"]');
	if (!strip) return;
	requestAnimationFrame(() => {
		const shown = tabs.value.find((one) => one.identity === active.value);
		if (shown?.name) editor.state.selection = { kind: "tab", key: shown.name };
	});
}

// A tab selected anywhere (a new one, or one picked in the outline) is the tab shown.
watch(
	() => editor.state.selection,
	(selected) => {
		if (selected?.kind !== "tab") return;
		requestAnimationFrame(() => {
			const shown = tabs.value.find((one) => one.name === selected.key);
			if (shown) tab.value = shown.identity;
		});
	}
);
</script>
