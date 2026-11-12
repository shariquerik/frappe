<!-- PROTOTYPE (#47056): a background run, small, beside a new selection in the bar. -->
<template>
	<button
		class="flex h-7 items-center gap-2 rounded-4 bg-surface-gray-2 px-2 text-sm text-ink-gray-7 hover:bg-surface-gray-3"
		@click="shownResult = run.id"
	>
		<LoadingIndicator v-if="run.state === 'running'" class="size-3" />
		<Icon v-else name="lucide-check" class="size-3.5" />
		{{ run.action.label }} {{ run.processed }}/{{ run.total }}
	</button>
</template>

<script setup lang="ts">
import { Icon, LoadingIndicator } from "frappe-ui";
import { shownResult, type Run } from "./store";

defineProps<{ run: Run }>();
</script>
