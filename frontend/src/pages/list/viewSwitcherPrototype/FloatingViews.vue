<!-- PROTOTYPE (#45851) variants E and F: the view as a floating island over the last rows, where the bulk bar
     floats; selecting rows swaps it for the bulk bar. Its menus open upward, the one exception to "below".
     E ("all"): every view as a button; ⋯ holds the open view's acts.
     F ("pill"): List | Cards, then the open view's name; its menu lists the views by layer, then the acts.
     Modified, the island grows Discard, Save as new and Save. -->
<template>
	<Transition
		enter-active-class="transition duration-150 ease-out"
		enter-from-class="translate-y-2 opacity-0"
		leave-active-class="transition duration-100 ease-in"
		leave-to-class="translate-y-2 opacity-0"
	>
		<div
			v-if="state.loaded && !bulkOpen"
			class="absolute inset-x-0 z-20 mx-auto w-max max-w-[calc(100%-2rem)]"
			:style="{ bottom: `${FOOTER_HEIGHT + 16}px` }"
		>
			<div
				class="flex h-11 w-max max-w-full items-center gap-1 rounded-6 bg-surface-base p-2 text-base shadow-[0_1px_2px_rgb(0_0_0/.06),0_8px_24px_rgb(0_0_0/.12),0_24px_48px_rgb(0_0_0/.1)] ring-1 ring-outline-gray-3"
				role="toolbar"
				aria-label="Views"
				data-proto-floating
			>
				<template v-if="mode === 'all'">
					<ViewSegments class="overflow-x-auto" />
					<span class="mx-1 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
					<Dropdown :options="actGroups" side="top" align="end">
						<div class="flex shrink-0">
							<Button variant="ghost" icon="lucide-ellipsis" label="View options" />
						</div>
					</Dropdown>
				</template>
				<template v-else>
					<TabButtons :modelValue="typeOf" :options="typeTabs" @update:modelValue="acts.open(String($event))" />
					<span class="mx-1 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
					<Dropdown :options="pillOptions" side="top" align="start">
						<div class="flex min-w-0 shrink">
							<Button variant="ghost" icon-right="lucide-chevron-up" :label="view?.label ?? key" data-proto-pill />
						</div>
					</Dropdown>
				</template>
				<template v-if="modified">
					<span class="mx-1 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
					<ModifiedCluster class="!gap-1" />
				</template>
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { Button, Dropdown, TabButtons } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ModifiedCluster from "./ModifiedCluster.vue";
import ViewSegments from "./ViewSegments.vue";
import { useBulkOpen } from "./bulkOpen";
import { viewActGroups, viewGroups } from "./menus";
import { currentKey, iconOf, isModified, protoState, useViewActs, viewOf, viewsIn } from "./store";

const props = defineProps<{ mode: "all" | "pill" }>();

// ListFooter: border-t, py-2 and a h-7 row. The island keeps the bulk bar's 16px above it.
const FOOTER_HEIGHT = 45;

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const bulkOpen = useBulkOpen();
const key = computed(() => currentKey(route));
const view = computed(() => viewOf(key.value));
const modified = computed(() => state.loaded && isModified(route));
const actGroups = computed(() => viewActGroups(acts, key.value));

// F: the plain types as a toggle; on a saved view the toggle shows the view's type.
const typeTabs = computed(() =>
	viewsIn(null).map((each) => ({ label: each.label, value: each.key, icon: iconOf(each.type) }))
);
const typeOf = computed(() => (view.value ? view.value.type.toLowerCase() : key.value));
const pillOptions = computed(() => [
	...viewGroups(acts, key.value).filter((group) => !group.hideLabel),
	...actGroups.value.map((group) => ({ ...group, hideLabel: true })),
]);
void props;
</script>
