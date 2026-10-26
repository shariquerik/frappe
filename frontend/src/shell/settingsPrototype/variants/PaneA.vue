<!-- PROTOTYPE variant A: blocks are headed lists of rows. The Single's record link is a header
     action; a block's save mark sits on its heading; button blocks share a Save bar at the foot. -->
<template>
	<SettingsHeader :title="pane.label" :description="pane.description">
		<template #actions>
			<RecordLinks :pane="pane" />
		</template>
	</SettingsHeader>
	<SettingsBody>
		<section v-for="block in pane.blocks" :key="block.key" class="mt-8 first:mt-6">
			<div class="flex h-7 items-center justify-between gap-2">
				<h3 v-if="block.label" class="text-base font-semibold text-ink-gray-8">
					{{ block.label }}
				</h3>
				<span v-else />
				<StatusMark
					:status="state.blocks[block.key].status"
					:message="state.blocks[block.key].message"
				/>
			</div>
			<p v-if="block.description" class="text-sm text-ink-gray-5">{{ block.description }}</p>
			<BlockRows :block="block" :pane="state" :prefix="prefix" :pane-key="pane.key" />
		</section>
	</SettingsBody>
	<div
		v-if="state.hasButtonBlocks && (state.buttonDirtyCount.value || state.buttonErrorCount.value)"
		class="flex shrink-0 items-center justify-between gap-3 border-t border-outline-gray-2 bg-surface-elevation-1 px-[4.4rem] py-3 pb-14"
	>
		<span class="text-base" :class="state.buttonErrorCount.value ? 'text-ink-red-4' : 'text-ink-gray-6'">
			{{ footText }}
		</span>
		<div class="flex gap-2">
			<Button label="Discard" :disabled="state.saving.value" @click="state.discardButtons()" />
			<Button
				variant="solid"
				label="Save"
				:loading="state.saving.value"
				@click="state.saveButtons()"
			>
				<template #suffix><span class="text-xs opacity-60">⌘S</span></template>
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button, SettingsBody, SettingsHeader } from "frappe-ui";
import type { PaneSpec } from "../panes";
import type { PaneState } from "../bindings";
import BlockRows from "../BlockRows.vue";
import RecordLinks from "../RecordLinks.vue";
import StatusMark from "../StatusMark.vue";

const props = defineProps<{ pane: PaneSpec; prefix: string; state: PaneState }>();

const footText = computed(() => {
	const failed = props.state.buttonErrorCount.value;
	if (failed) return `${failed} block${failed > 1 ? "s" : ""} did not save`;
	const count = props.state.buttonDirtyCount.value;
	return `${count} unsaved change${count > 1 ? "s" : ""}`;
});
</script>
