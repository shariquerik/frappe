<!-- PROTOTYPE (#47056): a run's done / failed / queued counts. -->
<template>
	<div class="flex items-center gap-3 text-sm text-ink-gray-6">
		<span>{{ done }} done</span>
		<span v-if="failed" class="text-ink-gray-8">{{ failed }} failed</span>
		<span v-if="queued" class="flex items-center gap-1">
			<LoadingIndicator class="size-3" />{{ queued }} queued
		</span>
		<span v-if="skipped">{{ skipped }} not run</span>
	</div>
</template>

<script setup lang="ts">
import { LoadingIndicator } from "frappe-ui";
import { computed } from "vue";
import type { Run } from "./store";

const props = defineProps<{ run: Run }>();
const by = (status: string) => props.run.outcomes.filter((o) => o.status === status).length;
const done = computed(() => by("done"));
const failed = computed(() => by("failed"));
const queued = computed(() => by("queued"));
const skipped = computed(() => props.run.total - props.run.outcomes.length);
</script>
