<!-- PROTOTYPE (#45851) variant C, and H's panel (flat): the sidebar's DocType row opens into its views (ruling 6's
     "Views of a doctype" row), grouped by layer. A row's ⋯ holds its acts; the header shows only the current view.
     Modified, the open row carries a dot; the floating save bar (SaveBar) holds Save, Save as new and Discard. -->
<template>
	<div
		class="flex flex-col gap-0.5"
		:class="flat ? '' : 'ml-3 border-l border-outline-gray-2 pl-1'"
		data-proto-sidebar-views
	>
		<template v-for="group in groups" :key="group.label">
			<p v-if="group.layer !== null" class="flex h-6 items-end pb-0.5 pl-2 text-xs text-ink-gray-5">
				{{ group.label }}
			</p>
			<div v-for="view in group.views" :key="view.key" class="group/view">
				<SidebarItem
					:label="view.label"
					:route="address(view)"
					:active="onPage && view.key === key"
				>
					<template #prefix><span class="size-4 text-ink-gray-6" :class="iconOf(view.type)" aria-hidden="true" /></template>
					<template #suffix>
						<!-- One lane on every row, so hover swaps the mark for ⋯ in place and the label never re-truncates. -->
						<div class="flex w-7 shrink-0 items-center justify-center">
							<span
								v-if="edited(view)"
								class="size-1.5 shrink-0 rounded-full bg-surface-gray-7 group-hover/view:hidden group-has-[[data-state=open]]/view:hidden"
								aria-label="Unsaved changes"
								data-proto-dot
							/>
							<span
								v-else-if="view.key === resolvedDefault"
								class="lucide-house size-3.5 shrink-0 text-ink-gray-5 group-hover/view:hidden group-has-[[data-state=open]]/view:hidden"
								aria-label="Default"
							/>
							<Dropdown :options="rowOptions(view)" side="bottom" align="start">
								<div class="hidden shrink-0 group-hover/view:flex data-[state=open]:flex">
									<Button variant="ghost" size="sm" icon="lucide-ellipsis" label="View options" />
								</div>
							</Dropdown>
						</div>
					</template>
				</SidebarItem>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { Button, Dropdown, SidebarItem } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { routeFor } from "@/router/routeFor";
import { viewActGroups } from "./menus";
import {
	GROUPS,
	currentKey,
	iconOf,
	isModified,
	protoState,
	resolvedDefault,
	viewsIn,
	useViewActs,
	type ProtoView,
} from "./store";

defineProps<{ flat?: boolean }>();

const route = useRoute();
const router = useRouter();
const acts = useViewActs(router, route);
const state = protoState();
const key = computed(() => currentKey(route));

const listPath = computed(() => router.resolve(routeFor(state.doctype)).path);
const onPage = computed(() => route.path.startsWith(listPath.value));
const groups = computed(() =>
	GROUPS.map((group) => ({ ...group, views: viewsIn(group.layer) })).filter((group) => group.views.length)
);

const modified = computed(() => state.loaded && onPage.value && isModified(route));

function edited(view: ProtoView) {
	return modified.value && view.key === key.value && view.layer !== null;
}

function rowOptions(view: ProtoView) {
	return viewActGroups(acts, view.key);
}

function address(view: ProtoView) {
	const query: Record<string, string> = { ...view.base, variant: String(route.query.variant ?? "C") };
	if (route.query.sidebar) query.sidebar = String(route.query.sidebar);
	if (view.stub) query.pv = view.key;
	return { path: `${listPath.value}/view/${view.stub ? view.type.toLowerCase() : view.key}`, query };
}
</script>
