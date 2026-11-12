<!-- PROTOTYPE (#47097), throwaway: ?switcher=A's "This layout" card, first in the panel while
     nothing is selected: where the open layout shows, its source, a variant's condition (with
     Edit), and its acts (Reset to app layout in Customize, Delete variant). -->
<template>
	<PanelSection label="This layout" :divided="false" data-layout-card>
		<PanelRow label="Shows in" :box="false">
			<p class="py-1 text-p-base text-ink-gray-8">{{ entry.where }}</p>
		</PanelRow>
		<PanelRow label="Source" :box="false">
			<div class="flex h-7 items-center"><Badge :label="entry.badge" theme="gray" /></div>
		</PanelRow>
		<PanelRow v-if="entry.variant" label="Shows when" :box="false">
			<div class="flex min-h-7 items-center gap-1">
				<code class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-8" :title="entry.variant.condition">{{ entry.variant.condition }}</code>
				<Button variant="ghost" size="sm" icon="lucide-pencil" label="Edit condition" tooltip="Edit condition" @click="ui.editing.value = entry.variant!" />
			</div>
		</PanelRow>
		<div v-if="ui.canReset(entry.id) || entry.variant" class="flex flex-wrap gap-2 pt-0.5">
			<Button v-if="ui.canReset(entry.id)" variant="subtle" size="sm" icon-left="lucide-rotate-ccw" label="Reset to app layout" @click="ui.reset(entry.id)" />
			<Button v-if="entry.variant" variant="subtle" size="sm" icon-left="lucide-trash-2" label="Delete variant" @click="ui.remove(entry.id)" />
		</div>
	</PanelSection>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Badge, Button } from "frappe-ui";
import { LayoutUiKey } from "./layouts";
import PanelRow from "./PanelRow.vue";
import PanelSection from "./PanelSection.vue";

const ui = inject(LayoutUiKey)!;
const entry = computed(() => ui.current.value);
</script>
