<!-- PROTOTYPE (#45253), throwaway: three looks for the index at `/apps`, switched by `?variant=` and `?data=`. -->
<template>
	<div class="h-screen w-screen text-ink-gray-9">
		<component :is="VARIANTS[current]" :key="`${current}:${route.query.data ?? ''}`" />
		<PrototypeSwitcher v-if="dev" :names="NAMES" :current="current" />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import PrototypeSwitcher from "./PrototypeSwitcher.vue";
import VariantA from "./VariantA.vue";
import VariantB from "./VariantB.vue";
import VariantC from "./VariantC.vue";

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
const NAMES = { A: "Launcher", B: "Header bar", C: "Greeting and rows" };
const dev = import.meta.env.DEV;
const route = useRoute();
const current = computed(() => {
	const asked = String(route.query.variant ?? "A");
	return (asked in VARIANTS ? asked : "A") as keyof typeof VARIANTS;
});
</script>
