<!--
  PROTOTYPE (#47385), P1: the layout's own navigation in a drawer from the navigation's side.
  Rail + sidebar and the floating rail draw the rail beside the open sidebar; sidebar only draws
  its one panel. A tap in the rail swaps the sidebar and keeps the drawer open; a row closes it.
-->
<template>
	<Transition
		enter-from-class="opacity-0"
		leave-to-class="opacity-0"
		enter-active-class="transition-opacity duration-200"
		leave-active-class="transition-opacity duration-150"
	>
		<div v-if="navOpen" class="fixed inset-0 z-50 bg-black/30" @click="navOpen = false" />
	</Transition>
	<Transition
		:enter-from-class="offscreen"
		:leave-to-class="offscreen"
		enter-active-class="transition-transform duration-200 ease-out"
		leave-active-class="transition-transform duration-150 ease-in"
	>
		<div
			v-if="navOpen"
			class="fixed inset-y-0 z-50 flex max-w-[85vw] bg-surface-sidebar shadow-2xl"
			:class="side === 'left' ? 'left-0' : 'right-0 flex-row-reverse'"
			data-proto-drawer
			@click.capture="onClick"
		>
			<SidebarOnlyPanel
				v-if="layout === 'sidebar'"
				class="!w-[18rem]"
				:navigation="navigation"
				:contexts="contexts"
				:current="current"
				:sections="sections"
			/>
			<template v-else>
				<div data-proto-drawer-rail class="h-full">
					<RailColumn :items="navigation.rail" :context="contexts.rail" :current="current.railKey" />
				</div>
				<SidebarPanel
					v-if="panel"
					:address="panel.address"
					:items="panel.items"
					:context="panel.context"
					:title="panel.title"
					:current="current.rowKey"
					:sections="sections[panel.address]"
					:collapsed="false"
					floating
				/>
			</template>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import type { Navigation, NavigationItem } from "@/boot";
import type { CurrentNavigation, NavigationContexts } from "@/navigation/current";
import type { SectionMemory } from "@/navigation/sectionMemory";
import type { ItemContext } from "@/navigation/types";
import RailColumn from "../RailColumn.vue";
import SidebarPanel from "../SidebarPanel.vue";
import { layout, side } from "./navLayout";
import { keepOpenOnce, navOpen } from "./navNarrow";
import SidebarOnlyPanel from "./SidebarOnlyPanel.vue";

defineProps<{
	navigation: Navigation;
	contexts: NavigationContexts;
	current: CurrentNavigation;
	sections: Record<string, SectionMemory>;
	panel: { address: string; items: NavigationItem[]; context: ItemContext; title?: string } | null;
}>();

const offscreen = computed(() => (side.value === "left" ? "-translate-x-full" : "translate-x-full"));

// A rail cell or a section header browses; only a row in a sidebar goes somewhere and closes.
function onClick(event: MouseEvent) {
	const target = event.target as HTMLElement;
	if (target.closest("[data-proto-drawer-rail], [aria-expanded]")) keepOpenOnce();
}

function onKey(event: KeyboardEvent) {
	if (event.key === "Escape") navOpen.value = false;
}
onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => document.removeEventListener("keydown", onKey));
</script>
