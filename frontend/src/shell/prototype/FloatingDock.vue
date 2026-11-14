<!--
  PROTOTYPE (#47374), layout C: v1's floating dock. The rail's items park off screen and slide in
  when the pointer reaches the window's edge on the navigation's side. Beside a sidebar it holds the
  items only (the sidebar carries the logo, search and avatar); with no sidebar it holds them too.
  The pin locks it into an in-flow column, which is the rail.
-->
<template>
	<div
		ref="panel"
		class="fixed top-1/2 z-40 flex transition-transform duration-200 ease-out motion-reduce:transition-none"
		:class="side === 'left' ? 'left-2' : 'right-2'"
		:style="{ transform }"
		:inert="!open"
		data-proto-dock
	>
		<RailColumn
			class="!h-auto max-h-[calc(100vh-32px)] rounded-6 border border-outline-gray-2 shadow-2xl"
			:items="items"
			:context="context"
			:current="current"
			:chrome="chrome"
		>
			<template #foot>
				<PinButton class="mt-3" />
			</template>
		</RailColumn>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { NavigationItem } from "@/boot";
import type { ItemContext } from "@/navigation/types";
import RailColumn from "../RailColumn.vue";
import { side } from "./navLayout";
import PinButton from "./PinButton.vue";
import { useEdgeReveal } from "./useEdgeReveal";

defineProps<{
	items: NavigationItem[];
	context: ItemContext;
	current?: string;
	chrome: boolean;
}>();

const panel = ref<HTMLElement | null>(null);
// v1's 90px stay band.
const open = useEdgeReveal(panel, () => 90);

const transform = computed(() => {
	if (open.value) return "translate(0, -50%)";
	return side.value === "left" ? "translate(-150%, -50%)" : "translate(150%, -50%)";
});
</script>
