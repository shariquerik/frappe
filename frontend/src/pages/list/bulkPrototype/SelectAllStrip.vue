<!-- PROTOTYPE (#47056): after the header's select-all, a strip over the rows offers every record the
     filter matches, as Gmail does; once taken it says so and offers to clear. -->
<template>
	<div
		v-if="tweaks.selectAll === 'strip' && (canSelectAllMatching || allMatching)"
		class="flex h-8 shrink-0 items-center justify-center gap-1 rounded-4 bg-surface-gray-2 text-base text-ink-gray-7"
	>
		<template v-if="!allMatching">
			<span>All {{ pageCount }} on this page are selected.</span>
			<Button
				variant="ghost"
				size="sm"
				:label="`Select all ${matchingTotal.toLocaleString()} matching ${host?.filterLabel()}`"
				@click="selectAllMatching"
			/>
		</template>
		<template v-else>
			<span v-if="matchingTotal > CAP">
				All {{ matchingTotal.toLocaleString() }} are selected. Bulk actions run on {{ CAP }} at most:
				narrow the filter.
			</span>
			<span v-else>All {{ matchingTotal.toLocaleString() }} matching {{ host?.filterLabel() }} are selected.</span>
			<Button variant="ghost" size="sm" label="Clear selection" @click="clearSelection" />
		</template>
	</div>
</template>

<script setup lang="ts">
import { Button } from "frappe-ui";
import {
	CAP,
	allMatching,
	canSelectAllMatching,
	clearSelection,
	host,
	matchingTotal,
	pageCount,
	selectAllMatching,
} from "./store";
import { tweaks } from "./tweaks";
</script>
