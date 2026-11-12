<!-- PROTOTYPE (#47056): a background run in the bar's place: progress while it runs, then the
     counts with "View" and "Retry failed". -->
<template>
	<div class="flex w-full items-center gap-3" :class="floating ? 'min-w-[30rem]' : ''">
		<div class="flex min-w-0 flex-1 flex-col gap-1.5 ps-1">
			<div class="flex items-center gap-2 text-base">
				<LoadingIndicator v-if="run.state === 'running'" class="size-3.5 text-ink-gray-6" />
				<Icon v-else :name="failed ? 'lucide-circle-alert' : 'lucide-circle-check'" class="size-4 text-ink-gray-6" />
				<span class="truncate text-ink-gray-9">{{ heading }}</span>
				<span class="shrink-0 text-ink-gray-5">· {{ run.scope }}</span>
			</div>
			<Progress v-if="run.state === 'running'" :value="percent" size="sm" />
			<RunCounts v-else :run="run" />
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<template v-if="run.state === 'running'">
				<Button variant="ghost" label="Stop" @click="stop(run)" />
			</template>
			<template v-else>
				<Button v-if="failed" variant="subtle" label="Retry failed" @click="retryFailed(run)" />
				<Button variant="ghost" label="View" @click="shownResult = run.id" />
				<Button variant="ghost" icon="lucide-x" label="Dismiss" @click="dismiss(run)" />
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button, Icon, LoadingIndicator, Progress } from "frappe-ui";
import { computed } from "vue";
import RunCounts from "./RunCounts.vue";
import { dismiss, retryFailed, shownResult, stop, type Run } from "./store";
import { headingOf } from "./runText";

const props = defineProps<{ run: Run; floating: boolean }>();

const percent = computed(() => Math.round((props.run.processed / props.run.total) * 100));
const failed = computed(() => props.run.outcomes.filter((o) => o.status === "failed").length);
const heading = computed(() => headingOf(props.run));
</script>
