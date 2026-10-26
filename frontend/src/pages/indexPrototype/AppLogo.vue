<!-- PROTOTYPE (#45253): a logo drawn as is, or a gray letter square of the same size when there is none. -->
<template>
	<img v-if="logo" :src="logo" alt="" class="shrink-0 object-contain" :style="box" />
	<span
		v-else
		class="flex shrink-0 items-center justify-center bg-surface-gray-3 font-medium text-ink-gray-7"
		:style="{ ...box, borderRadius: `${size * 0.22}px`, fontSize: `${size * 0.42}px` }"
		aria-hidden="true"
	>
		{{ title.charAt(0).toUpperCase() }}
	</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ logo?: string | null; title: string; size: number }>();
const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
</script>
