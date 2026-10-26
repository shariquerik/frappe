<!--
  The panel a linked rail item opens, on frappe-ui's `Sidebar`. Nothing opens it by clicking: the
  address does. It collapses to nothing with the seam, and the collapse is kept in this browser.
-->
<template>
	<div class="group/sidebar relative flex h-full shrink-0">
		<!-- Bound, never `null`: left unset, `Sidebar` collapses itself below the `sm` breakpoint.
		     `border-0` while collapsed, or its 1px sits beside the content's and reads as 2px. -->
		<Sidebar
			v-model:collapsed="collapsed"
			width="14rem"
			collapsedWidth="0px"
			:class="collapsed ? 'border-0' : 'border-l border-outline-gray-1'"
			:inert="collapsed"
		>
			<!-- 48px, no border: level with the page's header row, whose border stops at this panel's edge. -->
			<div class="flex h-12 shrink-0 items-center pl-4 pr-2">
				<p v-if="title" class="truncate text-base font-medium text-ink-gray-8">
					{{ title }}
				</p>
				<Button
					v-if="customizable"
					class="ml-auto"
					variant="ghost"
					icon="lucide-settings-2"
					label="Customize this sidebar"
					@click="emit('customize')"
				/>
			</div>

			<!-- PROTOTYPE (#45263), trigger option "sidebar": a field-shaped button that opens the palette. -->
			<div v-if="trigger === 'sidebar'" class="shrink-0 px-2 pb-2">
				<button
					type="button"
					data-key="palette-trigger"
					class="flex h-7 w-full items-center gap-2 rounded-4 border border-outline-gray-2 bg-surface-white px-2 text-base text-ink-gray-5 transition-colors hover:border-outline-gray-3 focus-visible:ring-0 focus-visible:focus-ring"
					@click="openPalette"
				>
					<span
						class="lucide-search size-4 shrink-0 text-ink-gray-5"
						aria-hidden="true"
					/>
					<span class="truncate">Search</span>
					<KeyboardShortcut class="ml-auto" combo="Mod+K" />
				</button>
			</div>

			<!-- `pt-0.5`: the first row's shadow is otherwise clipped on the viewport's top edge. -->
			<ScrollArea class="min-h-0 flex-1" viewportClass="px-2 pb-2 pt-0.5">
				<nav class="flex flex-col gap-0.5" :aria-label="title">
					<SidebarRow
						v-for="node in tree"
						:key="node.item.key"
						:node="node"
						:context="context"
						:current="current"
						:sections="sections"
					/>
				</nav>
			</ScrollArea>
		</Sidebar>

		<SidebarEdge :open="!collapsed" @toggle="collapsed = !collapsed" />
	</div>
</template>

<script setup lang="ts">
import { inject, ref, watch } from "vue";
import { Button, KeyboardShortcut, ScrollArea, Sidebar } from "frappe-ui";
import { browserMemory } from "@/browserMemory";
import type { Boot, NavigationItem } from "@/boot";
import type { SectionMemory } from "@/navigation/sectionMemory";
import { useItemTree } from "@/navigation/useItemTree";
import type { ItemContext } from "@/navigation/types";
import { openPalette, trigger } from "./palettePrototype/state";
import SidebarEdge from "./SidebarEdge.vue";
import SidebarRow from "./SidebarRow.vue";

// `address` is the scrubbed key, which is also what the arrangement endpoints take for a `Sidebar`.
const props = defineProps<{
	address: string;
	items: NavigationItem[];
	context: ItemContext;
	title?: string;
	current?: string;
	sections?: SectionMemory;
	customizable?: boolean;
}>();
const emit = defineEmits<{ customize: [] }>();

const boot = inject<Boot>("boot")!;
const collapsedMemory = browserMemory(
	"collapsed-sidebar",
	boot.session.user.name,
	(value): value is boolean => typeof value === "boolean",
	"frappe:desk:sidebar-collapsed"
);
const collapsed = ref(collapsedMemory.recall() ?? false);
watch(collapsed, collapsedMemory.remember);

const tree = useItemTree(
	() => props.items,
	() => `the ${props.address} sidebar`
);
</script>
