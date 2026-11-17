<!-- PROTOTYPE (#45851): the header's last crumb as the view's control.
     A: the crumb opens every view, grouped by layer, with this view's acts under them (CRM and Helpdesk's shape).
     C: the sidebar lists the views, so the crumb opens only this view's acts.
     Modified, the crumb carries a dot and the menu opens on the changes: no Save or Discard buttons. -->
<template>
	<div class="flex min-w-0 items-center gap-1" data-proto-header>
		<!-- The crumbs before the view, drawn as frappe-ui's Breadcrumbs draws a crumb that is not the last. -->
		<div class="-ml-0.5 flex shrink-0 items-center whitespace-nowrap leading-tighter">
			<template v-for="crumb in crumbs" :key="crumb.label">
				<RouterLink
					:to="crumb.href"
					class="flex items-center rounded-4 px-0.5 py-1 text-lg-medium leading-tighter text-ink-gray-5 hover:text-ink-gray-7"
				>
					{{ crumb.label }}
				</RouterLink>
				<span class="mx-0.5 text-base text-ink-gray-4" aria-hidden="true">/</span>
			</template>
		</div>
		<Dropdown :options="options" side="bottom" align="start">
			<div class="-ms-1 flex min-w-0 shrink">
				<button
					type="button"
					class="group flex h-7 min-w-0 items-center gap-1 rounded-4 pe-1 ps-0.5 text-lg-medium leading-tighter text-ink-gray-9 focus-visible:focus-ring"
					data-proto-trigger
				>
					<span class="min-w-0 truncate">{{ view?.label ?? key }}</span>
					<span
						v-if="modified && saved"
						class="size-1.5 shrink-0 rounded-full bg-surface-gray-7"
						aria-label="Unsaved changes"
						data-proto-dot
					/>
					<span class="lucide-chevron-down -ms-0.5 size-4 shrink-0 text-ink-gray-5 group-hover:text-ink-gray-8" aria-hidden="true" />
				</button>
			</div>
		</Dropdown>
		<RecordFavourite :favourites="[]" :favourited="favourited" @toggle="toggleFavourite()" />
	</div>
</template>

<script setup lang="ts">
import { Dropdown } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import RecordFavourite from "@/pages/record/RecordFavourite.vue";
import { ask, changeGroup, viewActGroups, viewGroups } from "./menus";
import { currentKey, isModified, protoState, useViewActs, viewOf } from "./store";

const props = defineProps<{
	crumbs: { label: string; href: string }[];
	mode: "all" | "acts";
	favourited: boolean;
	toggleFavourite: () => void;
}>();

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const key = computed(() => currentKey(route));
const view = computed(() => viewOf(key.value));
const modified = computed(() => state.loaded && isModified(route));
// A plain type's changes are a look around: no dot, and (K, L) only "Save as new view…" in the menu.
const saved = computed(() => !!view.value?.layer);

const options = computed(() => {
	// K and L: the floating save bar holds the changes, so the menu does not repeat them.
	const barred = ["K", "L"].includes(String(route.query.variant ?? "").toUpperCase());
	const asNew = {
		group: "Changes",
		hideLabel: true,
		options: [{ label: "Save as new view…", icon: "lucide-copy-plus", onClick: () => ask("save_as_new", key.value) }],
	};
	const changes = !modified.value ? [] : barred && !saved.value ? [asNew] : barred ? [] : [changeGroup(acts, key.value)];
	const actGroups = viewActGroups(acts, key.value);
	if (props.mode === "acts") return [...changes, ...actGroups];
	const acted = actGroups.map((group) => ({ ...group, hideLabel: true }));
	return [...changes, ...viewGroups(acts, key.value), ...acted];
});
</script>
