<!-- PROTOTYPE (#45851) variant H: a Views column at the list body's left, beside the rows: the page's own
     side column (BodyColumns), so it works on every prefix, sidebar or not. It shuts to a strip and resizes.
     A row's ⋯ holds its acts, as in C. -->
<template>
	<div v-if="!collapsed" class="flex h-full min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-3 pt-3.5" data-proto-panel>
		<p class="flex h-7 items-center px-2 text-base font-medium text-ink-gray-9">Views</p>
		<SidebarViews flat />
	</div>
</template>

<script setup lang="ts">
import SidebarViews from "./SidebarViews.vue";

defineProps<{ collapsed?: boolean; page?: unknown }>();
</script>
