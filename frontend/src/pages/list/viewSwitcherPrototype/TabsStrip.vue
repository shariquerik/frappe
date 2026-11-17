<!-- PROTOTYPE (#45851) variant B: a strip of view tabs between the header and the controls row.
     Every view is a tab, in layer order; "All views" groups them by layer; ⋯ holds the open tab's acts;
     the modified state sits at the strip's right end. -->
<template>
	<div
		class="flex shrink-0 items-center justify-between gap-3 border-b border-outline-gray-1"
		:class="gutter"
		data-proto-tabs
	>
		<div class="flex min-w-0 items-center gap-1">
			<Tabs
				class="min-w-0 [&_[role='tablist']]:gap-5 [&_[role='tablist']]:py-2 [&_[role='tab']]:rounded-4"
				:modelValue="key"
				:tabs="tabs"
				@update:modelValue="acts.open(String($event))"
			>
				<template #tab-suffix="{ tab }">
					<span
						v-if="tab.data?.isDefault"
						class="lucide-house ml-1 size-3.5 text-ink-gray-5"
						aria-label="Default"
					/>
				</template>
			</Tabs>
			<Dropdown :options="allViews" side="bottom" align="start">
				<div class="ml-3 flex shrink-0">
					<Button variant="ghost" icon-right="lucide-chevron-down" label="All views" />
				</div>
			</Dropdown>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<ModifiedCluster />
			<Dropdown :options="actGroups" side="bottom" align="end">
				<div class="flex shrink-0">
					<Button variant="ghost" icon="lucide-ellipsis" label="View options" />
				</div>
			</Dropdown>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button, Dropdown, Tabs } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ModifiedCluster from "./ModifiedCluster.vue";
import { viewActGroups, viewGroups } from "./menus";
import { GROUPS, currentKey, iconOf, protoState, resolvedDefault, useViewActs, viewsIn } from "./store";

defineProps<{ gutter: string }>();

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const key = computed(() => currentKey(route));

const tabs = computed(() =>
	state.loaded
		? GROUPS.flatMap(({ layer }) => viewsIn(layer)).map((view) => ({
				value: view.key,
				label: view.label,
				iconLeft: iconOf(view.type),
				data: { isDefault: view.key === resolvedDefault.value },
		  }))
		: []
);
const allViews = computed(() => viewGroups(acts, key.value).map((group) => ({ ...group, hideLabel: false })));
const actGroups = computed(() => viewActGroups(acts, key.value));
</script>
