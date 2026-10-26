<!--
  PROTOTYPE (#45253): a full-bleed logo drawn as is; a bare mark (transparent at its edges) inset on a
  white plate; no logo, a gray placeholder. `?placeholder=icon` swaps the letter for an app icon.
-->
<template>
	<span
		v-if="logo && bare"
		class="flex shrink-0 items-center justify-center bg-white ring-1 ring-inset ring-outline-gray-2"
		:style="{ ...box, borderRadius: radius }"
	>
		<img :src="logo" alt="" class="object-contain" :style="inset" />
	</span>
	<img
		v-else-if="logo"
		:src="logo"
		alt=""
		class="shrink-0 object-contain"
		:style="box"
		@load="measure"
	/>
	<span
		v-else
		class="flex shrink-0 items-center justify-center bg-surface-gray-3 font-medium text-ink-gray-6"
		:style="{ ...box, borderRadius: radius, fontSize: `${size * 0.42}px` }"
		aria-hidden="true"
	>
		<LucideLayoutGrid v-if="icon" :style="inset" />
		<template v-else>{{ title.charAt(0).toUpperCase() }}</template>
	</span>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import LucideLayoutGrid from "~icons/lucide/layout-grid";

const props = defineProps<{ logo?: string | null; title: string; size: number }>();
const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
const inset = computed(() => ({ width: `${props.size * 0.5}px`, height: `${props.size * 0.5}px` }));
const radius = computed(() => `${props.size * 0.22}px`);
const icon = computed(() => useRoute().query.placeholder === "icon");

// An app icon is opaque at its edge midpoints (only its corners are rounded off); a bare mark is not.
const bare = ref(false);
function measure(event: Event) {
	const image = event.target as HTMLImageElement;
	const side = 64;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = side;
	const context = canvas.getContext("2d");
	if (!context) return;
	context.drawImage(image, 0, 0, side, side);
	const mid = side / 2;
	const edges = [
		[mid, 1],
		[mid, side - 2],
		[1, mid],
		[side - 2, mid],
	];
	bare.value = edges.some(([x, y]) => context.getImageData(x, y, 1, 1).data[3] < 128);
}
</script>
