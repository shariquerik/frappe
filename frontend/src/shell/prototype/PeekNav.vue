<!--
  PROTOTYPE (#47374), layout D: the whole navigation is the dock. Rail and sidebar both hide, the
  page takes the full width, and the pointer at the window's edge slides both in together over the
  page (Linear's and Notion's peek). The pin locks it open in flow.
-->
<template>
	<div
		ref="panel"
		class="fixed inset-y-2 z-40 flex overflow-hidden rounded-6 border border-outline-gray-2 bg-surface-sidebar shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none"
		:class="side === 'left' ? 'left-2 flex-row' : 'right-2 flex-row-reverse'"
		:style="{ transform }"
		:inert="!open"
		data-proto-peek
	>
		<RailColumn :items="items" :context="context" :current="current">
			<template #foot>
				<PinButton class="mt-3" />
			</template>
		</RailColumn>
		<slot />
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
}>();

const panel = ref<HTMLElement | null>(null);
// The panel is wide, so it stays open while the pointer is over it or within 40px past it.
const open = useEdgeReveal(panel, () => (panel.value?.offsetWidth ?? 0) + 48);

const transform = computed(() => {
	if (open.value) return "translateX(0)";
	return side.value === "left" ? "translateX(calc(-100% - 16px))" : "translateX(calc(100% + 16px))";
});
</script>
