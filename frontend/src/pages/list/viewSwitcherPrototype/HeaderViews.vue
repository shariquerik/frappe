<!-- PROTOTYPE (#45851) variant J: every view as a button in the header's right side, before Create; ⋯ holds
     the open view's acts. Modified, Create and the other right-side actions give way to Discard, Save as new and a
     solid Save. -->
<template>
	<div class="flex min-w-0 items-center gap-1" data-proto-header-views>
		<ViewSegments class="overflow-x-auto" />
		<Dropdown :options="actGroups" side="bottom" align="end">
			<div class="flex shrink-0">
				<Button variant="ghost" icon="lucide-ellipsis" label="View options" />
			</div>
		</Dropdown>
		<template v-if="modified">
			<span class="mx-1 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
			<ModifiedCluster primary />
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

defineProps<{ page?: unknown }>();

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const modified = computed(() => state.loaded && isModified(route));
const actGroups = computed(() => viewActGroups(acts, currentKey(route)));
</script>
