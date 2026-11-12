<!-- PROTOTYPE (#47095), throwaway: the floating variant switcher. ‹ A (label) ›, or ← and → when
     no input has the caret; the choice lives in ?variant= so a link or a reload keeps it. Dev only.
     #47097: `param` names the query key it switches (default `variant`), so each ticket keeps its own.
     `fallback` is the variant the page shows when the address names none (default the first). -->
<template>
	<div
		v-if="DEV"
		class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface-gray-9 p-1 text-ink-white shadow-xl"
		data-variant-bar
	>
		<button type="button" class="grid size-7 place-items-center rounded-full hover:bg-white/15" aria-label="Previous variant" @click="step(-1)">
			<span class="lucide-chevron-left size-4" aria-hidden="true" />
		</button>
		<span class="min-w-[12rem] px-2 text-center text-sm">
			<span class="font-semibold">{{ current.key }}</span>
			<span class="text-white/70"> ({{ current.label }})</span>
		</span>
		<button type="button" class="grid size-7 place-items-center rounded-full hover:bg-white/15" aria-label="Next variant" @click="step(1)">
			<span class="lucide-chevron-right size-4" aria-hidden="true" />
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const props = withDefaults(defineProps<{ variants: { key: string; label: string }[]; param?: string; fallback?: string }>(), { param: "variant", fallback: "" });
const DEV = import.meta.env.DEV;
const route = useRoute();
const router = useRouter();

const indexOf = (key: unknown) => props.variants.findIndex((one) => one.key === key);
const index = computed(() => {
	const named = indexOf(route.query[props.param]);
	return named >= 0 ? named : Math.max(0, indexOf(props.fallback));
});
const current = computed(() => props.variants[index.value]);

function step(by: number) {
	const next = props.variants[(index.value + by + props.variants.length) % props.variants.length];
	void router.replace({ query: { ...route.query, [props.param]: next.key } });
}

function onKeydown(event: KeyboardEvent) {
	if (!["ArrowLeft", "ArrowRight"].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
	const target = event.target as HTMLElement | null;
	if (target?.closest("input, textarea, select, [contenteditable], [role='listbox'], [role='menu']")) return;
	step(event.key === "ArrowLeft" ? -1 : 1);
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>
