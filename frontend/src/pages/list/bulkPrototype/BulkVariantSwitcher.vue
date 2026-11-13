<!-- PROTOTYPE (#47260), throwaway: never merge. Flips the bulk bar placement; top centre so it never covers the island or the footer. -->
<template>
	<div
		class="fixed start-1/2 top-3 z-50 -translate-x-1/2 flex items-center gap-1 rounded-full bg-gray-900 p-1 text-sm text-white shadow-xl"
	>
		<button class="rounded-full px-2 py-1 hover:bg-gray-700" @click="step(-1)">←</button>
		<span class="px-1 font-medium">
			{{ current.key }} · {{ current.name }}
		</span>
		<button class="rounded-full px-2 py-1 hover:bg-gray-700" @click="step(1)">→</button>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { VARIANTS, bulkVariant, setBulkVariant } from "./variant";

const index = computed(() => VARIANTS.findIndex((variant) => variant.key === bulkVariant.value));
const current = computed(() => VARIANTS[index.value]);

function step(by: number) {
	setBulkVariant(VARIANTS[(index.value + by + VARIANTS.length) % VARIANTS.length].key);
}

function onKey(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	if (target.closest("input, textarea, [contenteditable]")) return;
	if (!event.altKey) return;
	if (event.key === "ArrowLeft") step(-1);
	if (event.key === "ArrowRight") step(1);
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>
