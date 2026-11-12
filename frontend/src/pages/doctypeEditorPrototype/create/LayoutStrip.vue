<!-- PROTOTYPE (#47097), throwaway: ?switcher=B's strip at the top of the canvas, one line: the
     open layout's name, where it shows, its source badge, and its acts as ghost icon buttons
     (Edit condition, Reset to app layout, Delete variant). -->
<template>
	<!-- With acts the ghost buttons bring their own inset; without, the badge keeps the left 12px. -->
	<div class="mb-8 flex h-10 items-center gap-2 rounded-6 bg-surface-gray-2 pl-3 text-base" :class="acts.length ? 'pr-1' : 'pr-3'" data-layout-strip>
		<span class="size-4 shrink-0 text-ink-gray-6" :class="entry.icon" aria-hidden="true" />
		<span class="min-w-0 shrink truncate font-medium text-ink-gray-8" :title="entry.title">{{ entry.title }}</span>
		<span class="min-w-0 flex-1 truncate text-ink-gray-5">{{ entry.where }}</span>
		<!-- Outline: a subtle gray badge would melt into the strip's own gray. -->
		<Badge :label="entry.badge" theme="gray" variant="outline" class="shrink-0" />
		<div v-if="acts.length" class="flex shrink-0 items-center">
			<Tooltip v-for="act in acts" :key="act.label" :text="act.label">
				<Button variant="ghost" size="sm" :icon="act.icon" :label="act.label" @click="act.onClick" />
			</Tooltip>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Badge, Button, Tooltip } from "frappe-ui";
import { actsOf, LayoutUiKey } from "./layouts";

const ui = inject(LayoutUiKey)!;
const entry = computed(() => ui.current.value);
const acts = computed(() => actsOf(ui, entry.value));
</script>
