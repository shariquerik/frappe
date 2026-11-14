<!--
  PROTOTYPE (#47385), P3: a full-screen menu, the same in every layout. The first level lists the
  rail's items; one with a sidebar drills into its rows, with a back step. It opens on the current
  item's sidebar. The app switcher and search sit at the top, the avatar at the foot.
-->
<template>
	<Transition
		enter-from-class="translate-y-4 opacity-0"
		leave-to-class="opacity-0"
		enter-active-class="transition duration-200 ease-out"
		leave-active-class="transition duration-150"
	>
		<div
			v-if="navOpen"
			class="fixed inset-0 z-50 flex flex-col bg-surface-base"
			data-proto-navpage
			@click.capture="onClick"
		>
			<div class="flex shrink-0 items-start">
				<div class="min-w-0 flex-1"><PanelChrome :title="appTitle" /></div>
				<Button
					class="mr-2 mt-[10px]"
					variant="ghost"
					icon="lucide-x"
					:label="__('Close navigation')"
					@click="navOpen = false"
				/>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto border-t border-outline-gray-1 px-2 pb-3 pt-2">
				<template v-if="openCell && openSidebar">
					<button
						type="button"
						class="mb-1 flex h-9 w-full items-center gap-1 rounded-4 px-1 text-sm text-ink-gray-6 hover:bg-surface-gray-2"
						data-proto-navpage-back
						@click="drilled = null"
					>
						<span class="lucide-chevron-left size-4" />
						{{ __("All") }}
					</button>
					<p class="px-2 pb-1 text-base font-medium text-ink-gray-8">{{ openCell.label }}</p>
					<nav class="flex flex-col gap-0.5">
						<SidebarRow
							v-for="node in sidebarTree"
							:key="`${openSidebar}:${node.item.key}`"
							:node="node"
							:context="contexts.sidebars[openSidebar]"
							:current="openSidebar === current.sidebar ? current.rowKey : undefined"
							:sections="sections[openSidebar]"
						/>
					</nav>
				</template>
				<nav v-else class="flex flex-col gap-0.5">
					<component
						:is="cell.sidebar ? 'button' : 'to' in cell ? RouterLink : 'a'"
						v-for="cell in cells"
						:key="cell.key"
						v-bind="cell.sidebar ? { type: 'button' } : 'to' in cell ? { to: cell.to } : { href: cell.href }"
						class="flex h-10 w-full items-center gap-3 rounded-4 px-2 text-left text-base text-ink-gray-8 hover:bg-surface-gray-2"
						:class="{ 'bg-surface-gray-2': cell.key === current.railKey }"
						@click="cell.sidebar && (drilled = cell.key)"
					>
						<span class="grid size-7 shrink-0 place-items-center rounded-[7px] bg-surface-gray-3">
							<Icon v-if="cell.icon" :name="cell.icon" />
							<span v-else class="text-sm font-medium">{{ cell.label.charAt(0) }}</span>
						</span>
						<span class="min-w-0 flex-1 truncate">{{ cell.label }}</span>
						<span v-if="cell.sidebar" class="lucide-chevron-right size-4 text-ink-gray-5" />
					</component>
				</nav>
			</div>

			<div class="flex h-14 shrink-0 items-center border-t border-outline-gray-1 px-2">
				<UserMenu wide />
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "frappe-ui";
import type { Navigation } from "@/boot";
import { __ } from "@/i18n";
import Icon from "@/icons/Icon.vue";
import type { CurrentNavigation, NavigationContexts } from "@/navigation/current";
import type { SectionMemory } from "@/navigation/sectionMemory";
import { useItemTree } from "@/navigation/useItemTree";
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

const { appTitle } = useAppMenu();

const railTree = useItemTree(() => props.navigation.rail, "the rail");
const cells = computed(() => railCells(railTree.value, props.contexts.rail));

// `null` is the first level; it opens drilled into the current item's sidebar.
const drilled = ref<string | null>(null);
watch(navOpen, (open) => open && (drilled.value = props.current.railKey ?? null), { immediate: true });
const openCell = computed(() => cells.value.find((cell) => cell.key === drilled.value));
const openSidebar = computed(() => {
	const sidebar = openCell.value?.sidebar;
	return sidebar && props.navigation.sidebars[sidebar]?.length ? sidebar : undefined;
});
const sidebarTree = useItemTree(
	() => (openSidebar.value ? props.navigation.sidebars[openSidebar.value] : []),
	"the menu's sidebar"
);

function onClick(event: MouseEvent) {
	if ((event.target as HTMLElement).closest("[aria-expanded]")) keepOpenOnce();
}

function onKey(event: KeyboardEvent) {
	if (event.key === "Escape") navOpen.value = false;
}
onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => document.removeEventListener("keydown", onKey));
</script>
