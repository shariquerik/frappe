<!-- PROTOTYPE (#45867): the review's Tweak panel, docked bottom right. Not part of the design. -->
<template>
	<div class="fixed bottom-4 right-4 z-50 w-[248px] rounded-5 bg-surface-base text-sm text-ink-gray-8 shadow-xl ring-1 ring-outline-gray-2">
		<button type="button" class="flex h-9 w-full items-center gap-2 px-3" @click="shut = !shut">
			<span class="lucide-sliders-horizontal size-3.5" aria-hidden="true" />
			<span class="flex-1 text-left font-medium">Tweaks · prototype</span>
			<span class="size-3.5" :class="shut ? 'lucide-chevron-up' : 'lucide-chevron-down'" aria-hidden="true" />
		</button>
		<div v-if="!shut" class="flex flex-col gap-3 px-3 pb-3">
			<label v-for="row in rows" :key="row.key" class="flex flex-col gap-1">
				<span class="text-ink-gray-5">{{ row.label }}</span>
				<div class="flex rounded-3 bg-surface-gray-2 p-0.5">
					<button
						v-for="option in row.options"
						:key="String(option.value)"
						type="button"
						class="h-6 flex-1 rounded-2"
						:class="tweaks[row.key] === option.value ? 'bg-surface-base text-ink-gray-9 shadow-sm' : 'text-ink-gray-5 hover:text-ink-gray-8'"
						@click="(tweaks as any)[row.key] = option.value"
					>
						{{ option.label }}
					</button>
				</div>
			</label>
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { tweaks } from "./tweaks";

const props = defineProps<{ show: ("properties" | "bar")[] }>();
const shut = ref(!new URLSearchParams(location.search).has("tweaks"));

const ROWS = {
	properties: { key: "properties", label: "Properties", options: [{ label: "Pane", value: "pane" }, { label: "On selection", value: "selection" }] },
	bar: { key: "bar", label: "Edit bar", options: [{ label: "Floating", value: "floating" }, { label: "In header", value: "header" }] },
} as const;
const rows = computed(() => [
	...props.show.map((key) => ROWS[key]),
	{ key: "dev", label: "Developer mode", options: [{ label: "On", value: true }, { label: "Off", value: false }] },
	{ key: "acts", label: "Acts run", options: [{ label: "Hide", value: false }, { label: "Show", value: true }] },
] as any[]);
</script>
