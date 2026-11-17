<!-- PROTOTYPE (#45851) variant I: the view as a button in the header's right side, before Create; its menu lists
     the views by layer, then the open view's acts. Modified, Create and the other right-side actions give way to
     Discard, Save as new and a solid Save. -->
<template>
	<div class="flex shrink-0 items-center gap-2" data-proto-header-button>
		<Dropdown :options="options" side="bottom" align="end">
			<div class="flex shrink-0">
				<Button
					variant="subtle"
					:icon-left="view ? iconOf(view.type) : 'lucide-list'"
					icon-right="lucide-chevron-down"
					:label="view?.label ?? key"
				/>
			</div>
		</Dropdown>
		<span v-if="modified" class="mx-0.5 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
		<ModifiedCluster primary />
	</div>
</template>

<script setup lang="ts">
import { Button, Dropdown } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ModifiedCluster from "./ModifiedCluster.vue";
import { viewActGroups, viewGroups } from "./menus";
import { currentKey, iconOf, isModified, protoState, useViewActs, viewOf } from "./store";

defineProps<{ page?: unknown }>();

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const key = computed(() => currentKey(route));
const view = computed(() => (state.loaded ? viewOf(key.value) : undefined));
const modified = computed(() => state.loaded && isModified(route));
const options = computed(() => [
	...viewGroups(acts, key.value),
	...viewActGroups(acts, key.value).map((group) => ({ ...group, hideLabel: true })),
]);
</script>
