<!-- PROTOTYPE (#47056): background runs in a corner tray, as file uploads show; the selection is
     free again the moment a run starts. -->
<template>
	<div
		v-if="background.length"
		class="fixed bottom-16 end-4 z-20 flex w-80 flex-col overflow-hidden rounded-5 bg-surface-base shadow-2xl"
	>
		<div class="flex h-10 items-center justify-between border-b border-outline-gray-1 ps-3 pe-1">
			<span class="text-base font-medium text-ink-gray-9">Bulk actions</span>
			<Button
				variant="ghost"
				:icon="collapsed ? 'lucide-chevron-up' : 'lucide-chevron-down'"
				label="Collapse"
				@click="collapsed = !collapsed"
			/>
		</div>
		<div v-if="!collapsed" class="flex max-h-72 flex-col divide-y divide-outline-gray-1 overflow-y-auto">
			<div v-for="run in background" :key="run.id" class="flex flex-col gap-1.5 px-3 py-2.5">
				<div class="flex items-center gap-2 text-base">
					<span class="truncate text-ink-gray-9">{{ headingOf(run) }}</span>
					<div class="ms-auto flex shrink-0 items-center gap-1">
						<Button v-if="run.state === 'running'" size="sm" variant="ghost" label="Stop" @click="stop(run)" />
						<template v-else>
							<Button size="sm" variant="ghost" label="View" @click="shownResult = run.id" />
							<Button size="sm" variant="ghost" icon="lucide-x" label="Dismiss" @click="dismiss(run)" />
						</template>
					</div>
				</div>
				<span class="truncate text-sm text-ink-gray-5">{{ run.scope }}</span>
				<Progress v-if="run.state === 'running'" :value="Math.round((run.processed / run.total) * 100)" size="sm" />
				<RunCounts v-else :run="run" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button, Progress } from "frappe-ui";
import { computed, ref } from "vue";
import RunCounts from "./RunCounts.vue";
import { headingOf } from "./runText";
import { dismiss, runs, shownResult, stop } from "./store";

const collapsed = ref(false);
const background = computed(() => runs.filter((run) => run.background));
</script>
