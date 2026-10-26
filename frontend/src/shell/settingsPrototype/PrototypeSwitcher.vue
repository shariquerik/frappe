<!-- PROTOTYPE: the variant switcher. It sits inside the dialog, since a click outside closes
     it; ← and → cycle when focus is not in a field or the pane list. Dev builds only. -->
<template>
	<div
		v-if="DEV"
		class="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-900 px-1.5 py-1 text-sm text-white shadow-lg ring-2 ring-fuchsia-500"
	>
		<button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" @click="step(-1)">
			←
		</button>
		<span class="px-1 font-medium">
			PROTOTYPE · {{ current.key }} ({{ current.name }})
		</span>
		<button type="button" class="rounded-full px-2 py-0.5 hover:bg-white/15" @click="step(1)">
			→
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useEventListener } from "@vueuse/core";

const props = defineProps<{ variants: { key: string; name: string }[] }>();

const DEV = import.meta.env.DEV;
const route = useRoute();
const router = useRouter();

const index = computed(() =>
	Math.max(
		0,
		props.variants.findIndex((variant) => variant.key === String(route.query.variant ?? "A"))
	)
);
const current = computed(() => props.variants[index.value]);

function step(by: number) {
	const next = props.variants[(index.value + by + props.variants.length) % props.variants.length];
	router.replace({ query: { ...route.query, variant: next.key }, hash: route.hash });
}

useEventListener(window, "keydown", (event: KeyboardEvent) => {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	const target = event.target as HTMLElement | null;
	if (target?.closest("input, textarea, select, [contenteditable], [role=tablist], [role=combobox]"))
		return;
	step(event.key === "ArrowLeft" ? -1 : 1);
});
</script>
