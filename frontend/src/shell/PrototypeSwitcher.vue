<!--
  PROTOTYPE: the floating bar that flips between the frame's variants. Not part of the design
  under review; it draws only while a variant is on, so today's frame never shows it.
-->
<template>
	<div
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface-gray-7 px-2 py-1 text-xs text-ink-white shadow-xl"
		role="toolbar"
		aria-label="Prototype variant"
	>
		<button
			type="button"
			class="rounded-full px-2 py-1 hover:bg-surface-gray-6"
			aria-label="Previous variant"
			@click="step(-1)"
		>
			←
		</button>
		<span class="whitespace-nowrap">
			<strong>{{ current.key }}</strong> — {{ current.name }}
			<span class="ml-2 text-ink-gray-4">
				rail={{ state.railKey ?? "–" }} sidebar={{ state.sidebar ?? "–" }} row={{
					state.rowKey ?? "–"
				}}
			</span>
		</span>
		<button
			type="button"
			class="rounded-full px-2 py-1 hover:bg-surface-gray-6"
			aria-label="Next variant"
			@click="step(1)"
		>
			→
		</button>
		<button
			type="button"
			class="rounded-full px-2 py-1 text-ink-gray-4 hover:bg-surface-gray-6"
			@click="off"
		>
			off
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { CurrentNavigation } from "@/navigation/current";
import { setVariant, VARIANTS, variant, type Variant } from "./shellVariant";

defineProps<{ state: CurrentNavigation }>();

const route = useRoute();
const router = useRouter();

const current = computed(
	() => VARIANTS.find((entry) => entry.key === variant.value) ?? VARIANTS[0]
);

function step(by: number) {
	const at = VARIANTS.findIndex((entry) => entry.key === current.value.key);
	const next = VARIANTS[(at + by + VARIANTS.length) % VARIANTS.length].key;
	go(next);
}

function off() {
	go(null);
}

// The address carries the key so a variant is shareable; the store keeps it across rail clicks.
function go(next: Variant | null) {
	setVariant(next);
	router.replace({ query: { ...route.query, variant: next ?? "off" }, hash: route.hash });
}

function onKeydown(event: KeyboardEvent) {
	const target = event.target as HTMLElement | null;
	if (target?.closest("input, textarea, [contenteditable]")) return;
	if (event.key === "ArrowLeft") step(-1);
	if (event.key === "ArrowRight") step(1);
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>
