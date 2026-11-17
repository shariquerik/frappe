<!-- PROTOTYPE (#45851): the floating variant bar. ← and → (or the arrow keys) cycle `?variant=`; the switch
     plays a site administrator or not; the line under it is the in-memory state. Not part of the design. -->
<template>
	<div
		class="fixed bottom-16 left-20 z-50 flex flex-col items-center gap-1 rounded-6 bg-gray-900 px-3 py-2 text-white shadow-xl ring-1 ring-white/10"
		data-proto-bar
	>
		<div class="flex items-center gap-3">
			<button class="rounded-4 px-2 py-1 hover:bg-white/10" aria-label="Previous variant" @click="cycle(-1)">←</button>
			<span class="min-w-36 text-center text-sm font-medium">{{ current.key }} · {{ current.name }}</span>
			<button class="rounded-4 px-2 py-1 hover:bg-white/10" aria-label="Next variant" @click="cycle(1)">→</button>
			<span class="h-4 w-px bg-white/20" />
			<label class="flex cursor-pointer items-center gap-2 text-sm">
				<input v-model="state.admin" type="checkbox" class="rounded-1" />
				Site administrator
			</label>
		</div>
		<div class="max-w-[20rem] truncate text-xs text-white/60">
			view <b class="text-white/80">{{ key }}</b> ({{ layerText }}) · {{ modified ? "modified" : "saved" }} ·
			default: me {{ state.defaults.user ?? "–" }}, site {{ state.defaults.site ?? "–" }}, app
			{{ state.defaults.app ?? "–" }} → {{ resolvedDefault }}
			<template v-if="state.last"> · {{ state.last }}</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { VARIANTS, currentKey, isModified, protoState, resolvedDefault, variantOf, viewOf } from "./store";

const route = useRoute();
const router = useRouter();
const state = protoState();

const current = computed(() => VARIANTS.find((each) => each.key === variantOf(route)) ?? VARIANTS[0]);
const key = computed(() => currentKey(route));
const layerText = computed(() => viewOf(key.value)?.layer ?? "plain");
const modified = computed(() => isModified(route));

function cycle(step: number) {
	const index = VARIANTS.indexOf(current.value);
	const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
	void router.replace({ query: { ...route.query, variant: next.key } });
}

function onKey(event: KeyboardEvent) {
	const target = event.target as HTMLElement | null;
	if (target?.closest("input, textarea, [contenteditable], [role=menu], [role=dialog], [role=listbox]")) return;
	if (event.key === "ArrowLeft") cycle(-1);
	if (event.key === "ArrowRight") cycle(1);
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>
