<!-- PROTOTYPE (#45851): every view as a button in one row, layers apart by a divider: plain types,
     then My, Site and App views. The open view is pressed; the reader's default carries a house. Used by E and G. -->
<template>
	<div class="flex min-w-0 items-center gap-0.5" data-proto-segments>
		<template v-for="(group, at) in groups" :key="group.label">
			<span v-if="at > 0" class="mx-1 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
			<Button
				v-for="view in group.views"
				:key="view.key"
				:variant="view.key === key ? 'subtle' : 'ghost'"
				:class="view.key === key ? 'text-ink-gray-9' : 'text-ink-gray-6'"
				:icon-left="iconOf(view.type)"
				:label="view.label"
				:aria-pressed="view.key === key"
				:title="group.layer ? group.label : undefined"
				@click="acts.open(view.key)"
			>
				<template v-if="view.key === resolvedDefault" #suffix>
					<span class="lucide-house size-3.5 shrink-0 text-ink-gray-5" aria-label="Default" />
				</template>
			</Button>
		</template>
	</div>
</template>

<script setup lang="ts">
import { Button } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { GROUPS, currentKey, iconOf, protoState, resolvedDefault, useViewActs, viewsIn } from "./store";

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const key = computed(() => currentKey(route));
const groups = computed(() =>
	state.loaded
		? GROUPS.map((group) => ({ ...group, views: viewsIn(group.layer) })).filter((group) => group.views.length)
		: []
);
</script>
