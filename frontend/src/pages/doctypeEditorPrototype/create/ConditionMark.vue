<!-- PROTOTYPE (#47100), throwaway: a small gray mark on the canvas for a field, section or tab
     with a condition; its tooltip says each rule in words, one per line ("Visible if Is POS is on"). -->
<template>
	<Tooltip v-if="lines.length">
		<template #content>
			<div class="max-w-[320px] space-y-1 whitespace-normal break-words" data-condition-tooltip>
				<p v-for="line in lines" :key="line">{{ line }}</p>
			</div>
		</template>
		<span class="grid size-4 shrink-0 place-items-center" aria-label="Has conditions" data-condition-mark>
			<span class="lucide-split size-3.5 text-ink-gray-5" aria-hidden="true" />
		</span>
	</Tooltip>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Tooltip } from "frappe-ui";
import { EditorKey } from "../context";
import { DraftUiKey } from "./draftUi";
import { conditionScope, summarize } from "./conditions";

const props = defineProps<{ rules: { label: string; value?: string }[] }>();
const editor = inject(EditorKey)!;
const ui = inject(DraftUiKey, null);
const lines = computed(() => {
	const set = props.rules.filter((one) => one.value);
	if (!set.length) return [];
	const scope = conditionScope(editor.state.fields, { submittable: ui?.kind === "submittable" });
	return set.map((one) => {
		const said = summarize(one.value, scope, "");
		return said.kind === "code" ? `${one.label} (code) ${said.text}` : `${one.label} ${said.text}`;
	});
});
</script>
