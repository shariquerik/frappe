<!--
  The panel on frappe-ui's `Sidebar`. It collapses to nothing, as CRM's does, and the collapse is
  the reader's own, kept in this browser. The address still decides which panel this is.
-->
<template>
	<div class="group/sidebar relative flex h-full shrink-0">
		<Sidebar
			v-model:collapsed="collapsed"
			width="14rem"
			:collapsedWidth="collapse === 'icons' ? '3rem' : '0px'"
			:class="collapsed && collapse === 'zero' ? 'border-0' : 'border-l border-outline-gray-1'"
		>
			<div class="flex shrink-0 items-center justify-between py-2 pl-4 pr-2">
				<p v-show="!collapsed" class="truncate text-base font-medium text-ink-gray-8">
					{{ title }}
				</p>
				<Button
					v-if="arrangeable"
					variant="ghost"
					icon="lucide-settings-2"
					label="Arrange this sidebar"
					@click="emit('arrange')"
				/>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
				<nav class="flex flex-col gap-0.5" :aria-label="title">
					<SidebarRow
						v-for="node in tree"
						:key="node.item.key"
						:node="node"
						:context="context"
						:current="current"
						:reserve="reserve"
						:sections="sections"
					/>
				</nav>
			</div>

			<!-- Variant C: frappe-ui's own toggle row, and rows shrink to their icons. -->
			<div v-if="collapse === 'icons'" class="shrink-0 px-2 pb-2">
				<SidebarCollapseToggle />
			</div>
		</Sidebar>

		<SidebarEdge
			v-if="collapse === 'zero'"
			:open="!collapsed"
			@toggle="collapsed = !collapsed"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Button, Sidebar, SidebarCollapseToggle } from "frappe-ui";
import type { NavigationItem } from "@/boot";
import type { SectionMemory } from "@/navigation/sectionMemory";
import { useItemTree } from "@/navigation/useItemTree";
import { useIconSlot } from "@/navigation/iconSlot";
import type { ItemContext } from "@/navigation/types";
import SidebarEdge from "./SidebarEdge.vue";
import SidebarRow from "./SidebarRow.vue";

const props = defineProps<{
	address: string;
	items: NavigationItem[];
	context: ItemContext;
	title?: string;
	current?: string;
	sections?: SectionMemory;
	arrangeable?: boolean;
	/** How the panel collapses: to nothing with the CRM seam, or to an icon column with frappe-ui's toggle. */
	collapse: "zero" | "icons";
}>();
const emit = defineEmits<{ arrange: [] }>();

const COLLAPSED = "frappe:desk:sidebar-collapsed";

// Bound, never `null`: left unset, `Sidebar` collapses itself below the `sm` breakpoint.
const collapsed = ref(readCollapsed());

function readCollapsed(): boolean {
	try {
		return localStorage.getItem(COLLAPSED) === "1";
	} catch {
		return false;
	}
}

watch(collapsed, (value) => {
	try {
		localStorage.setItem(COLLAPSED, value ? "1" : "0");
	} catch {
		// Full or forbidden. The panel still collapses for this page.
	}
});

const tree = useItemTree(
	() => props.items,
	() => `the ${props.address} sidebar`
);

const reserve = useIconSlot(
	() => props.items,
	() => props.context
);
</script>
