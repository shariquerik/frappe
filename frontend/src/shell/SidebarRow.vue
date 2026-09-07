<!--
  One panel row on frappe-ui's `SidebarItem` and `SidebarSection`, with `NavigationRow`'s rules:
  the section the address is in opens itself and offers no control; a reader's toggle is remembered.
-->
<template>
	<!-- A heading with no destination: a section. Nested sections do not indent. -->
	<SidebarSection
		v-if="heading && !destination"
		:label="label"
		:collapsible="collapsible"
		:collapsed="!open"
		:data-key="item.key"
		@update:collapsed="toggle"
	>
		<SidebarRow
			v-for="child in node.children"
			:key="child.item.key"
			:node="child"
			:context="context"
			:current="current"
			:reserve="reserve"
			:sections="sections"
		/>
	</SidebarSection>

	<template v-else>
		<!-- A destination in this prefix. -->
		<SidebarItem
			v-if="destination && 'to' in destination"
			:to="destination.to"
			:label="label"
			:active="isCurrent"
			:data-key="item.key"
			:data-sidebar="destination.sidebar"
		>
			<template #prefix><Icon :name="item.icon" :reserve="reserve" /></template>
		</SidebarItem>

		<!-- Outside this prefix: a full document load. `SidebarItem` has no anchor form under a router. -->
		<SidebarItem
			v-else-if="destination && 'href' in destination"
			:label="label"
			:active="isCurrent"
			:data-key="item.key"
			@click="leave(destination.href)"
		>
			<template #prefix><Icon :name="item.icon" :reserve="reserve" /></template>
		</SidebarItem>

		<!-- Rows fetched on demand; they land at this row's own level. -->
		<SidebarItem v-else-if="expander" :label="label" :data-key="item.key" @click="expand">
			<template #prefix><Icon :name="item.icon" :reserve="reserve" /></template>
		</SidebarItem>

		<div
			v-if="node.children.length && open"
			class="ml-3 flex flex-col gap-0.5 border-l border-outline-gray-2 pl-1"
		>
			<SidebarRow
				v-for="child in node.children"
				:key="child.item.key"
				:node="child"
				:context="context"
				:current="current"
				:reserve="reserve"
				:sections="sections"
			/>
		</div>

		<SidebarRow
			v-for="child in expandedNodes"
			:key="child.item.key"
			:node="child"
			:context="context"
			:current="current"
			:reserve="reserve"
		/>
	</template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { SidebarItem, SidebarSection } from "frappe-ui";
import { buildTree, containsKey, type ItemNode } from "@/navigation/tree";
import type { SectionMemory } from "@/navigation/sectionMemory";
import { labelOf, renderingOf } from "@/navigation/registry";
import Icon from "@/icons/Icon.vue";
import type { ItemContext } from "@/navigation/types";

const props = defineProps<{
	node: ItemNode;
	context: ItemContext;
	current?: string;
	reserve?: boolean;
	sections?: SectionMemory;
}>();

const item = computed(() => props.node.item);
const isCurrent = computed(() => !!props.current && props.current === item.value.key);
const rendering = computed(() => renderingOf(item.value, props.context));
const label = computed(() => labelOf(item.value, props.context));

const destination = computed(() => {
	const value = rendering.value;
	return value && ("to" in value || "href" in value) ? value : null;
});
const expander = computed(() => {
	const value = rendering.value;
	return value && "expand" in value ? value : null;
});
const heading = computed(
	() => (rendering.value && "group" in rendering.value) || props.node.children.length > 0
);

const shippedOpen = computed(() => !item.value.keep_closed);
const holdsCurrent = computed(() => !!props.current && containsKey(props.node, props.current));
const collapsible = computed(() => !!item.value.collapsible && !holdsCurrent.value);

function settled(): boolean {
	return props.sections?.recall(item.value.key) ?? shippedOpen.value;
}

const open = ref(holdsCurrent.value || settled());

watch([() => item.value.keep_closed, holdsCurrent], () => {
	open.value = holdsCurrent.value || settled();
});

function toggle() {
	open.value = !open.value;
	props.sections?.remember(item.value.key, open.value);
}

function leave(href: string) {
	window.location.assign(href);
}

const expanded = ref(false);
const expandedNodes = ref<ItemNode[]>([]);
let generation = 0;

watch(
	() => props.context,
	() => {
		generation += 1;
		expanded.value = false;
		expandedNodes.value = [];
	}
);

async function expand() {
	if (!expander.value || expanded.value) return;
	expanded.value = true;
	const mine = generation;

	try {
		const nodes = buildTree(await expander.value.expand());
		if (mine === generation) expandedNodes.value = nodes;
	} catch (error) {
		if (mine === generation) expanded.value = false;
		console.error(`[frappe] could not expand navigation item '${item.value.key}'`, error);
	}
}
</script>
