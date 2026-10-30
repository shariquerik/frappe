<!-- PROTOTYPE (#45867): Details, New Record and Quick Entry drawn by the surface's own
     `FormLayout`, with the edit seam injected. The surface draws its own frame around it. -->
<template>
	<div class="relative" @click.capture="selectTab">
		<FormLayout v-model:doc="doc" v-model:tab="tab" :layout="editor.schema.value" @update:active-tab="active = $event" />
	</div>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch } from "vue";
import { FormLayout, identifyTabs } from "@framework/ui/FormLayout";
import { CommitKey, LayoutEditKey, NO_COMMIT } from "@framework/ui/FormLayout/types";
import { EditorKey } from "../context";
import EditColumns from "./EditColumns.vue";
import EditFields from "./EditFields.vue";
import EditSections from "./EditSections.vue";

const editor = inject(EditorKey)!;

// In place, the canvas shows the record's own values, inert; on the DocType page it draws empty.
const props = defineProps<{ values?: Record<string, any> }>();
const doc = ref<Record<string, any>>({ ...(props.values ?? {}) });
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
