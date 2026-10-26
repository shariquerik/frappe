<!-- PROTOTYPE variant C: each row shows its own save mark; a doctype's tabs are a tab strip;
     button blocks get a floating Save. The pane does not link to the record. -->
<template>
	<SettingsHeader>
		<div class="flex flex-col gap-1">
			<h2 class="text-lg font-semibold text-ink-gray-8">{{ pane.label }}</h2>
			<p v-if="pane.description" class="text-base text-ink-gray-6">{{ pane.description }}</p>
		</div>
	</SettingsHeader>
	<SettingsBody>
		<section v-for="block in pane.blocks" :key="block.key" class="mt-8 first:mt-5">
			<h3 v-if="block.label" class="text-base font-semibold text-ink-gray-8">
				{{ block.label }}
			</h3>
			<p v-if="block.description" class="text-sm text-ink-gray-5">{{ block.description }}</p>
			<BlockRows
				:block="block"
				:pane="state"
				:prefix="prefix"
				:pane-key="pane.key"
				tabs
				row-marks
			/>
		</section>
	</SettingsBody>
	<Transition
		enter-from-class="translate-y-3 opacity-0"
		leave-to-class="translate-y-3 opacity-0"
		enter-active-class="transition duration-150"
		leave-active-class="transition duration-150"
	>
		<div
			v-if="state.hasButtonBlocks && (state.buttonDirtyCount.value || state.buttonErrorCount.value)"
			class="absolute bottom-14 right-8 z-40 flex items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-elevation-3 py-2 pl-4 pr-2 shadow-xl"
		>
			<span
				class="text-base"
				:class="state.buttonErrorCount.value ? 'text-ink-red-4' : 'text-ink-gray-7'"
			>
				{{
					state.buttonErrorCount.value
						? `${state.buttonErrorCount.value} block did not save`
						: `${state.buttonDirtyCount.value} unsaved change${state.buttonDirtyCount.value > 1 ? "s" : ""}`
				}}
			</span>
			<Button label="Discard" variant="ghost" @click="state.discardButtons()" />
			<Button
				variant="solid"
				label="Save"
				:loading="state.saving.value"
				@click="state.saveButtons()"
			/>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { Button, SettingsBody, SettingsHeader } from "frappe-ui";
import type { PaneSpec } from "../panes";
import type { PaneState } from "../bindings";
import BlockRows from "../BlockRows.vue";

defineProps<{ pane: PaneSpec; prefix: string; state: PaneState }>();
</script>
