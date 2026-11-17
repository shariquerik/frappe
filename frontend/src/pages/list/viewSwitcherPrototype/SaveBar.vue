<!-- PROTOTYPE (#45851) variants L and K: the crumb's dropdown as in A (K: the views in the DocType sidebar); modified, a floating bar rises where the bulk bar
     floats, with Discard, Save as new and Save (ruling 9; Save only where the reader can save, ruling 10).
     Selecting rows swaps it for the bulk bar. Only a saved view's changes raise it: on a plain List or Cards a
     filter change is a look around, and the crumb's menu offers "Save as new view…" instead. -->
<template>
	<!-- BulkIsland's fade, so the bar never sits on row text. -->
	<div
		v-if="modified && !bulkOpen"
		class="pointer-events-none absolute inset-x-0 z-10 h-24 bg-[linear-gradient(to_top,var(--surface-base)_30%,transparent)]"
		:style="{ bottom: `${FOOTER_HEIGHT}px` }"
	/>
	<Transition
		enter-active-class="transition duration-150 ease-out"
		enter-from-class="translate-y-2 opacity-0"
		leave-active-class="transition duration-100 ease-in"
		leave-to-class="translate-y-2 opacity-0"
	>
		<div
			v-if="modified && !bulkOpen"
			class="absolute inset-x-0 z-20 mx-auto w-max max-w-[calc(100%-2rem)]"
			:style="{ bottom: `${FOOTER_HEIGHT + 16}px` }"
		>
			<div
				class="flex h-11 w-max max-w-full items-center rounded-6 bg-surface-base py-2 pe-2 ps-3 text-base shadow-[0_1px_2px_rgb(0_0_0/.06),0_8px_24px_rgb(0_0_0/.12),0_24px_48px_rgb(0_0_0/.1)] ring-1 ring-outline-gray-3"
				role="toolbar"
				aria-label="Unsaved view changes"
				data-proto-save-bar
			>
				<span class="me-2 size-1.5 shrink-0 rounded-full bg-surface-gray-7" aria-hidden="true" />
				<span class="truncate text-ink-gray-7">
					Unsaved changes to <span class="font-medium text-ink-gray-9">{{ view?.label ?? key }}</span>
				</span>
				<div class="me-1 ms-3 h-4 shrink-0 border-s border-outline-gray-2" aria-hidden="true" />
				<div class="flex shrink-0 items-center gap-0.5">
					<Button variant="ghost" label="Discard" @click="acts.discard()" />
					<Button
						:variant="saveable ? 'ghost' : 'subtle'"
						label="Save as new"
						@click="ask('save_as_new', key)"
					/>
					<Tooltip v-if="saveable" :text="hint">
						<Button variant="subtle" label="Save" @click="acts.save()" />
					</Tooltip>
				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { Button, Tooltip } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBulkOpen } from "./bulkOpen";
import { ask } from "./menus";
import { can, currentKey, isModified, protoState, useViewActs, viewOf } from "./store";

// ListFooter: border-t, py-2 and a h-7 row. The bar keeps the bulk bar's 16px above it.
const FOOTER_HEIGHT = 45;

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const bulkOpen = useBulkOpen();
const key = computed(() => currentKey(route));
const view = computed(() => viewOf(key.value));
const modified = computed(() => state.loaded && !!view.value?.layer && isModified(route));
const saveable = computed(() => !view.value || can.save(view.value));
const hint = computed(() => {
	const layer = view.value?.layer;
	if (layer === null) return "Saves your own settings of this view";
	if (layer === "app") return "Saves a site copy that overrides the app's view";
	if (layer === "site") return "Saves the view for everyone";
	return "Saves your view";
});
</script>
