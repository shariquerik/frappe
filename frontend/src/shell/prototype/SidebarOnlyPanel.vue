<!--
  PROTOTYPE (#47374), layout B: no rail. The rail's top-level items become the panel's sections,
  each holding the sidebar it opens. The logo and app switcher sit in the header, search under it,
  and the avatar in the footer. The current item's section opens itself; the others start closed.
-->
<template>
	<div
		class="flex h-full w-[15rem] shrink-0 flex-col bg-surface-sidebar"
		data-proto-sidebar-only
	>
		<PanelChrome :title="appTitle" />

		<ScrollArea class="min-h-0 flex-1" viewportClass="px-2 pb-2 pt-0.5">
			<nav class="flex flex-col gap-0.5" :aria-label="appTitle">
				<template v-for="entry in entries" :key="entry.key">
					<p
						v-if="entry.kind === 'heading'"
						class="px-2 pb-1 pt-3 text-xs font-medium text-ink-gray-5"
					>
						{{ entry.label }}
					</p>

					<div v-else-if="entry.kind === 'group'" :data-key="entry.key">
						<div
							class="group flex h-7 items-center rounded-4 hover:bg-surface-gray-2"
							:class="{ 'bg-surface-gray-2': entry.key === current.railKey && !isOpen(entry.key) }"
						>
							<button
								type="button"
								class="flex h-full min-w-0 flex-1 items-center gap-2 pl-2 text-left text-sm text-ink-gray-8"
								:aria-expanded="isOpen(entry.key)"
								@click="toggle(entry.key)"
							>
								<Icon :name="entry.icon || 'folder'" />
								<span class="truncate font-medium">{{ entry.label }}</span>
							</button>
							<button
								type="button"
								class="grid size-7 place-items-center text-ink-gray-5"
								:aria-label="isOpen(entry.key) ? __('Collapse') : __('Expand')"
								@click="toggle(entry.key)"
							>
								<span
									class="lucide-chevron-right size-4 transition-transform"
									:class="{ 'rotate-90': isOpen(entry.key) }"
								/>
							</button>
						</div>
						<div
							v-if="isOpen(entry.key)"
							class="ml-[15px] mt-0.5 flex flex-col gap-0.5 border-l border-outline-gray-2 pl-1"
						>
							<SidebarRow
								v-for="node in entry.tree"
								:key="`${entry.sidebar}:${node.item.key}`"
								:node="node"
								:context="contexts.sidebars[entry.sidebar!]"
								:current="entry.sidebar === current.sidebar ? current.rowKey : undefined"
								:sections="sections[entry.sidebar!]"
							/>
						</div>
					</div>

					<SidebarRow
						v-else
						:node="entry.node!"
						:context="contexts.rail"
						:current="current.railKey"
					/>
				</template>
			</nav>
		</ScrollArea>

		<div class="shrink-0 border-t border-outline-gray-1">
			<!-- PROTOTYPE (#47375): the utility slots, above the avatar when they sit at the bottom. -->
			<div v-if="slots === 'bottom'" class="px-2 pt-2">
				<UtilitySlots form="row" />
			</div>
			<div class="flex h-12 items-center px-2">
				<UserMenu wide />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { ScrollArea } from "frappe-ui";
import type { Navigation } from "@/boot";
import { __ } from "@/i18n";
import Icon from "@/icons/Icon.vue";
import type { CurrentNavigation, NavigationContexts } from "@/navigation/current";
import type { SectionMemory } from "@/navigation/sectionMemory";
import { buildTree, type ItemNode } from "@/navigation/tree";
import { labelOf, renderingOf } from "@/navigation/registry";
import { useItemTree } from "@/navigation/useItemTree";
import SidebarRow from "../SidebarRow.vue";
import UserMenu from "../UserMenu.vue";
import { useAppMenu } from "./appMenu";
import PanelChrome from "./PanelChrome.vue";
import { slots } from "./navLayout";
import UtilitySlots from "./UtilitySlots.vue";

const props = defineProps<{
	navigation: Navigation;
	contexts: NavigationContexts;
	current: CurrentNavigation;
	sections: Record<string, SectionMemory>;
}>();

const { appTitle } = useAppMenu();

type Entry = {
	key: string;
	kind: "heading" | "group" | "row";
	label?: string;
	icon?: string;
	sidebar?: string;
	tree?: ItemNode[];
	node?: ItemNode;
};

const railTree = useItemTree(() => props.navigation.rail, "the rail");

// The rail, flat as the rail draws it: a heading labels its children; a linked item becomes a
// section holding its sidebar; an independent item stays a row.
const entries = computed(() => {
	const out: Entry[] = [];
	const walk = (nodes: ItemNode[]) => {
		for (const node of nodes) {
			const item = node.item;
			const rendering = renderingOf(item, props.contexts.rail);
			const label = labelOf(item, props.contexts.rail);
			if (!rendering) continue;
			if ("group" in rendering || (!("to" in rendering) && !("href" in rendering))) {
				if (node.children.length) out.push({ key: item.key, kind: "heading", label });
				walk(node.children);
				continue;
			}
			const sidebar = rendering.sidebar;
			const rows = sidebar ? props.navigation.sidebars[sidebar] : undefined;
			if (sidebar && rows?.length) {
				out.push({ key: item.key, kind: "group", label, icon: item.icon, sidebar, tree: buildTree(rows, () => {}) });
			} else {
				out.push({ key: item.key, kind: "row", node: { ...node, children: [] } });
			}
			walk(node.children);
		}
	};
	walk(railTree.value);
	return out;
});

// A reader's opens and closes, this page session only; the current item's section opens itself.
const toggled = reactive(new Map<string, boolean>());
function isOpen(key: string) {
	return toggled.get(key) ?? key === props.current.railKey;
}
function toggle(key: string) {
	toggled.set(key, !isOpen(key));
}
watch(
	() => props.current.railKey,
	(key) => key && toggled.delete(key)
);
</script>
