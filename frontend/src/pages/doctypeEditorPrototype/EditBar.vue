<!-- PROTOTYPE (#45867): the bar an in-place edit mode shows. It names the layout, says when
     that row is used, and holds Cancel and Done. It floats, or takes the page header's place. -->
<template>
	<div
		:class="
			placement === 'floating'
				? 'fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-surface-base py-1.5 pl-4 pr-1.5 shadow-xl ring-1 ring-outline-gray-2'
				: 'w-full'
		"
		class="flex items-center gap-3 whitespace-nowrap"
	>
		<span class="lucide-pencil-ruler size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
		<div class="flex min-w-0 items-baseline gap-2">
			<span class="text-base-medium text-ink-gray-9">Editing {{ title }}</span>
			<span class="truncate text-sm text-ink-gray-5">
				<template v-if="editor.state.row.condition">
					Used when <code class="font-mono text-ink-gray-7">{{ editor.state.row.condition }}</code>
				</template>
				<template v-else>{{ usedWhen }}</template>
			</span>
		</div>
		<Badge :label="source" theme="gray" />
		<Badge v-if="editor.state.mode === 'customize'" label="Customize" theme="gray" />
		<span class="flex-1" />
		<span class="w-[60px] text-right text-sm text-ink-gray-5">{{ edits }}</span>
		<Button label="Cancel" @click="$emit('cancel')" />
		<Button variant="solid" label="Done" @click="$emit('done')" />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Badge, Button } from "frappe-ui";
import { LAYOUTS, type Editor } from "./editor";

const props = defineProps<{ editor: Editor; placement: "floating" | "header" }>();
defineEmits<{ done: []; cancel: [] }>();
const editor = props.editor;

const kind = computed(() => LAYOUTS.find((one) => one.key === editor.state.layout)!.type);
const title = computed(() => `the ${kind.value} layout`);
const usedWhen = computed(() =>
	editor.state.layout === "quick-entry"
		? "Used by Create"
		: editor.state.layout === "new-record"
			? "Used for every new record"
			: editor.state.layout === "side-panel"
				? "Used on every record"
				: "Default: used when no condition matches"
);
// #45865: the source badge. A first fork in Customize turns it into this site's own copy.
const source = computed(() => {
	const from = editor.state.source[editor.state.layout];
	if (editor.state.forked[editor.state.layout]) return "Site layout (new)";
	if (from === "fallback") return "From DocType fields";
	if (from === "none") return "No layout yet";
	return editor.state.mode === "customize" ? "Site layout" : "App layout";
});
const edits = computed(() => {
	const count = editor.edits.value;
	return count ? `${count} edit${count === 1 ? "" : "s"}` : "";
});
</script>
