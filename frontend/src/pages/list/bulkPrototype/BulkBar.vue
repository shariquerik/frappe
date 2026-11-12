<!-- PROTOTYPE (#47056): the bulk bar. The selection count, "select all matching" when asked for in
     the bar, the actions, and a run's progress chip; the same bar floats or sits in the controls row. -->
<template>
	<div
		class="flex items-center gap-3 text-base"
		:class="
			floating
				? 'rounded-5 bg-surface-base px-3 py-2 shadow-2xl'
				: 'h-7 w-full'
		"
	>
		<template v-if="count">
			<div class="flex items-center gap-2" :class="floating ? 'ps-1' : 'ps-px'">
				<Checkbox :modelValue="true" :disabled="true" aria-hidden="true" />
				<span class="whitespace-nowrap text-ink-gray-9">{{ countText }}</span>
				<Button
					v-if="tweaks.selectAll === 'bar' && canSelectAllMatching"
					variant="ghost"
					:label="`Select all ${matchingTotal.toLocaleString()}`"
					@click="selectAllMatching"
				/>
				<Tooltip v-if="allMatching && matchingTotal > CAP" text="Bulk actions run on 500 at most; narrow the filter">
					<span class="flex items-center gap-1 whitespace-nowrap text-sm text-ink-gray-5">
						<Icon name="lucide-circle-alert" class="size-3.5" />
						Over the {{ CAP }} cap
					</span>
				</Tooltip>
			</div>
			<div class="h-4 w-px bg-outline-gray-2" />
			<BulkActions :side="floating ? 'top' : 'bottom'" />
			<RunChip v-if="barRun" :run="barRun" />
			<div :class="floating ? '' : 'ms-auto'">
				<Button variant="ghost" icon="lucide-x" label="Clear selection" @click="clearSelection" />
			</div>
		</template>
		<RunStrip v-else-if="barRun" :run="barRun" :floating="floating" />
	</div>
</template>

<script setup lang="ts">
import { Button, Checkbox, Icon, Tooltip } from "frappe-ui";
import { computed } from "vue";
import BulkActions from "./BulkActions.vue";
import RunChip from "./RunChip.vue";
import RunStrip from "./RunStrip.vue";
import {
	CAP,
	allMatching,
	canSelectAllMatching,
	clearSelection,
	count,
	matchingTotal,
	runs,
	selectAllMatching,
} from "./store";
import { tweaks } from "./tweaks";

defineProps<{ floating: boolean }>();

const countText = computed(() =>
	allMatching.value ? `All ${matchingTotal.value.toLocaleString()} selected` : `${count.value} selected`
);

/** In "runs in the bar" mode, the newest background run lives here until dismissed. */
const barRun = computed(() =>
	tweaks.runs === "bar" ? runs.find((run) => run.background) : undefined
);
</script>
