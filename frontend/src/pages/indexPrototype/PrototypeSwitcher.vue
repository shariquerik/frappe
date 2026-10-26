<!-- PROTOTYPE (#45253): the floating variant and data switcher. Not part of any design under review. -->
<template>
	<div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
	<div
		v-if="current === 'A'"
		class="flex items-center gap-1 rounded-full bg-gray-900 p-1 text-xs text-white shadow-xl ring-1 ring-white/10"
	>
		<button
			v-for="(label, key) in EXTRAS"
			:key="key"
			type="button"
			class="rounded-full px-2 py-1"
			:class="extras.has(key) ? 'bg-white text-gray-900' : 'hover:bg-white/10'"
			@click="toggleExtra(key)"
		>
			{{ label }}
		</button>
	</div>
	<div
		class="flex items-center gap-1 rounded-full bg-gray-900 py-1 pl-1 pr-3 text-sm text-white shadow-xl ring-1 ring-white/10"
	>
		<button type="button" class="rounded-full px-2 py-1 hover:bg-white/10" @click="step(-1)">←</button>
		<span class="min-w-40 text-center font-medium">{{ current }} ({{ names[current] }})</span>
		<button type="button" class="rounded-full px-2 py-1 hover:bg-white/10" @click="step(1)">→</button>
		<span class="mx-2 h-4 w-px bg-white/20" />
		<button
			v-for="name in DATA_CASES"
			:key="name"
			type="button"
			class="rounded-full px-2 py-1"
			:class="name === dataCase ? 'bg-white text-gray-900' : 'hover:bg-white/10'"
			@click="set({ data: name === 'real' ? undefined : name })"
		>
			{{ name }}
		</button>
	</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DATA_CASES } from "./useIndex";
import { EXTRAS, useExtras, type Extra } from "./extras";

const props = defineProps<{ names: Record<string, string>; current: string }>();
const route = useRoute();
const router = useRouter();
const dataCase = computed(() => (route.query.data as string) ?? "real");

function set(patch: Record<string, string | undefined>) {
	router.replace({ query: { ...route.query, ...patch } });
}

const extras = useExtras();
function toggleExtra(key: Extra) {
	const next = new Set(extras.value);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	set({ extras: next.size ? [...next].join(",") : undefined });
}

function step(by: number) {
	const keys = Object.keys(props.names);
	const next = keys[(keys.indexOf(props.current) + by + keys.length) % keys.length];
	set({ variant: next });
}

function onKey(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	if (target.closest("input, textarea, [contenteditable]")) return;
	if (event.key === "ArrowLeft") step(-1);
	if (event.key === "ArrowRight") step(1);
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>
