<!-- PROTOTYPE (#47374): the floating variant bar. Not part of any design under review. -->
<template>
	<div
		class="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-900 py-1 pl-1 pr-1 text-sm text-white shadow-2xl"
		data-prototype-switcher
	>
		<button type="button" :class="ARROW" aria-label="Previous variant" @click="go(-1)">
			<span class="lucide-chevron-left size-4" />
		</button>
		<span class="min-w-[19rem] px-2 text-center tabular-nums">
			{{ variant.label }}
			<span class="text-gray-400">({{ at + 1 }}/{{ VARIANTS.length }})</span>
		</span>
		<button type="button" :class="ARROW" aria-label="Next variant" @click="go(1)">
			<span class="lucide-chevron-right size-4" />
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { setVariant, step, variant, variantKey, VARIANTS } from "./navLayout";

const ARROW = "grid size-7 place-items-center rounded-full hover:bg-white/15";

const route = useRoute();
const router = useRouter();
const at = computed(() => VARIANTS.findIndex((v) => v.key === variantKey.value));

// A pasted or edited `?variant=` switches too.
watch(
	() => route.query.variant,
	(key) => typeof key === "string" && setVariant(key)
);

function go(by: number) {
	step(by);
	router.replace({ query: { ...route.query, variant: variantKey.value }, hash: route.hash });
}

function onKey(event: KeyboardEvent) {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
	const target = event.target as HTMLElement;
	if (target.closest("input, textarea, select, [contenteditable], [role=grid], [role=listbox], [role=menu]"))
		return;
	go(event.key === "ArrowLeft" ? -1 : 1);
}

onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => document.removeEventListener("keydown", onKey));
</script>
