<!--
  PROTOTYPE (#47385), P2: v1's phone navigation. A tab bar at the foot (Menu, Search,
  Notifications, You), the same in every layout. Menu opens a bottom sheet: the app switcher,
  the rail's items as tiles across the top, and the chosen item's sidebar under them. A tile
  with a sidebar swaps the rows below; a tile without one, or a row, goes there and closes.
-->
<template>
	<div class="fixed inset-x-0 bottom-0 z-40" data-proto-tabbar>
		<MobileNav>
			<MobileNavItem :label="__('Menu')" :active="navOpen" data-proto-nav-open @click="navOpen = true">
				<template #default="{ active }">
					<img v-if="boot.app_logo" :src="boot.app_logo" alt="" class="size-6 rounded-3" :class="{ 'opacity-80': !active }" />
					<span v-else class="lucide-layout-grid size-6" />
				</template>
			</MobileNavItem>
			<MobileNavItem :label="__('Search')" icon="lucide-search" @click="openPalette" />
			<MobileNavItem :label="__('Notifications')" icon="lucide-bell" @click="notYet" />
			<div class="flex min-h-14 flex-col items-center justify-center gap-1 py-2">
				<UserMenu />
				<span class="text-xs-medium leading-tighter text-ink-gray-5">{{ __("You") }}</span>
			</div>
		</MobileNav>
	</div>

	<BottomSheet v-model:open="navOpen">
		<div class="flex flex-col pb-4" data-proto-sheet @click.capture="onClick">
			<PanelChrome :title="appTitle" :search="false" />
			<div class="-mt-1 flex gap-1 overflow-x-auto px-2 pb-3" data-proto-sheet-tiles>
				<component
					:is="cell.sidebar ? 'button' : 'to' in cell ? RouterLink : 'a'"
					v-for="cell in cells"
					:key="cell.key"
					v-bind="cell.sidebar ? { type: 'button' } : 'to' in cell ? { to: cell.to } : { href: cell.href }"
					class="flex w-16 shrink-0 flex-col items-center gap-1 rounded-4 py-1.5"
					:class="cell.key === shown ? 'bg-surface-gray-3' : ''"
					@click="cell.sidebar && (picked = cell.key)"
				>
					<span class="grid size-9 place-items-center rounded-4 bg-surface-gray-2 text-ink-gray-8">
						<Icon v-if="cell.icon" :name="cell.icon" />
						<span v-else class="text-sm font-medium">{{ cell.label.charAt(0) }}</span>
					</span>
					<span class="w-full truncate px-0.5 text-center text-xs text-ink-gray-7">{{ cell.label }}</span>
				</component>
			</div>
			<div class="border-t border-outline-gray-1 px-2 pt-2">
				<p class="px-2 pb-1 text-xs font-medium text-ink-gray-5">{{ shownCell?.label }}</p>
				<nav v-if="shownSidebar" class="flex flex-col gap-0.5">
					<SidebarRow
						v-for="node in sidebarTree"
						:key="`${shownSidebar}:${node.item.key}`"
						:node="node"
						:context="contexts.sidebars[shownSidebar]"
						:current="shownSidebar === current.sidebar ? current.rowKey : undefined"
						:sections="sections[shownSidebar]"
					/>
				</nav>
			</div>
		</div>
	</BottomSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { BottomSheet, MobileNav, MobileNavItem, toast } from "frappe-ui";
import type { Navigation } from "@/boot";
import { __ } from "@/i18n";
import Icon from "@/icons/Icon.vue";
import type { CurrentNavigation, NavigationContexts } from "@/navigation/current";
import type { SectionMemory } from "@/navigation/sectionMemory";
import { useItemTree } from "@/navigation/useItemTree";
import { openPalette } from "../palette";
import SidebarRow from "../SidebarRow.vue";
import UserMenu from "../UserMenu.vue";
import { useAppMenu } from "./appMenu";
import { keepOpenOnce, navOpen, railCells } from "./navNarrow";
import PanelChrome from "./PanelChrome.vue";

const props = defineProps<{
	navigation: Navigation;
	contexts: NavigationContexts;
	current: CurrentNavigation;
	sections: Record<string, SectionMemory>;
}>();

const { boot, appTitle } = useAppMenu();

const railTree = useItemTree(() => props.navigation.rail, "the rail");
const cells = computed(() => railCells(railTree.value, props.contexts.rail));

// The tile whose sidebar shows: the one tapped in this sheet, else the current one.
const picked = ref<string | undefined>();
watch(navOpen, (open) => open && (picked.value = undefined));
const shown = computed(() => picked.value ?? props.current.railKey);
const shownCell = computed(() => cells.value.find((cell) => cell.key === shown.value));
const shownSidebar = computed(() => {
	const sidebar = shownCell.value?.sidebar;
	return sidebar && props.navigation.sidebars[sidebar]?.length ? sidebar : undefined;
});
const sidebarTree = useItemTree(
	() => (shownSidebar.value ? props.navigation.sidebars[shownSidebar.value] : []),
	"the sheet's sidebar"
);

function onClick(event: MouseEvent) {
	if ((event.target as HTMLElement).closest("[aria-expanded]")) keepOpenOnce();
}

function notYet() {
	toast.info(__("Notifications are not built yet"));
}
</script>
