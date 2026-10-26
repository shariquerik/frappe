<!-- PROTOTYPE variant B: each block is a card that names its binding and links to it; the save
     mark is in the card's header; button blocks' Save and Discard sit in the pane header. -->
<template>
	<SettingsHeader :title="pane.label" :description="pane.description">
		<template v-if="state.hasButtonBlocks" #actions>
			<Badge
				v-if="state.buttonErrorCount.value"
				theme="red"
				:label="`${state.buttonErrorCount.value} not saved`"
			/>
			<Badge
				v-else-if="state.buttonDirtyCount.value"
				theme="orange"
				:label="`${state.buttonDirtyCount.value} unsaved`"
			/>
			<Button
				v-if="state.buttonDirtyCount.value"
				label="Discard"
				variant="ghost"
				:disabled="state.saving.value"
				@click="state.discardButtons()"
			/>
			<Button
				variant="solid"
				label="Save"
				:disabled="!state.buttonDirtyCount.value"
				:loading="state.saving.value"
				@click="state.saveButtons()"
			/>
		</template>
	</SettingsHeader>
	<SettingsBody>
		<div class="mt-6 space-y-5">
			<section
				v-for="block in pane.blocks"
				:key="block.key"
				class="rounded-lg border border-outline-gray-2"
				:class="state.blocks[block.key].status === 'error' && 'border-outline-red-2'"
			>
				<header
					class="flex items-center justify-between gap-2 rounded-t-lg border-b border-outline-gray-1 bg-surface-gray-1 px-4 py-2"
				>
					<div class="flex min-w-0 items-center gap-2">
						<h3 class="truncate text-base font-semibold text-ink-gray-8">
							{{ block.label ?? pane.label }}
						</h3>
						<Badge v-if="block.app !== appOf(prefix)" :label="`from ${block.app}`" />
						<Badge v-if="block.save === 'button'" label="Save with button" theme="blue" />
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<StatusMark
							:status="state.blocks[block.key].status"
							:message="state.blocks[block.key].message"
						/>
						<span v-if="block.binding" class="text-sm text-ink-gray-5">
							{{ bindingLabel(block.binding) }}
						</span>
						<RecordLinks
							v-if="block.binding?.type === 'Single'"
							:only="block.binding"
							compact
							variant="ghost"
						/>
					</div>
				</header>
				<p v-if="block.description" class="px-4 pt-2 text-sm text-ink-gray-5">
					{{ block.description }}
				</p>
				<div class="px-4">
					<BlockRows :block="block" :pane="state" :prefix="prefix" :pane-key="pane.key" />
				</div>
			</section>
		</div>
	</SettingsBody>
</template>

<script setup lang="ts">
import { Badge, Button, SettingsBody, SettingsHeader } from "frappe-ui";
import { bindingLabel, type PaneSpec } from "../panes";
import type { PaneState } from "../bindings";
import BlockRows from "../BlockRows.vue";
import RecordLinks from "../RecordLinks.vue";
import StatusMark from "../StatusMark.vue";

defineProps<{ pane: PaneSpec; prefix: string; state: PaneState }>();

const appOf = (prefix: string) => (prefix === "desk" ? "frappe" : prefix);
</script>
