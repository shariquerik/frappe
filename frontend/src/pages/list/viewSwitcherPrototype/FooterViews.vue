<!-- PROTOTYPE (#45851) variant G: the views docked in the list footer's empty middle, as a spreadsheet's sheet tabs.
     ⋯ holds the open view's acts and opens upward; modified, Discard, Save as new and Save follow. -->
<template>
	<div
		v-if="state.loaded"
		class="absolute bottom-0 left-1/2 z-10 flex h-11 max-w-[calc(100%-44rem)] -translate-x-1/2 items-center gap-1"
		data-proto-footer-views
	>
		<ViewSegments class="overflow-x-auto" />
		<Dropdown :options="actGroups" side="top" align="end">
			<div class="flex shrink-0">
				<Button variant="ghost" icon="lucide-ellipsis" label="View options" />
			</div>
		</Dropdown>
		<template v-if="modified">
			<span class="mx-1 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
			<ModifiedCluster class="!gap-1" />
		</template>
	</div>
</template>

<script setup lang="ts">
import { Button, Dropdown } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ModifiedCluster from "./ModifiedCluster.vue";
import ViewSegments from "./ViewSegments.vue";
import { viewActGroups } from "./menus";
import { currentKey, isModified, protoState, useViewActs } from "./store";

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const modified = computed(() => state.loaded && isModified(route));
const actGroups = computed(() => viewActGroups(acts, currentKey(route)));
</script>
