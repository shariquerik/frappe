<script setup lang="ts">
// The app icon tile shared by the desktop and the dock: a 46px rounded tile showing either an app
// logo or a fallback glyph, lifted by a soft drop shadow. The shadow is a `filter` (not box-shadow)
// so it hugs the icon's real squircle silhouette instead of a CSS rounded-rect.
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		logo?: string;
		icon?: string;
		label: string;
		radius?: string; // Tailwind rounding class; dock uses rounded-xl, desktop rounded-[11px].
		glyph?: string; // fallback glyph size class
		shadow?: string; // drop-shadow filter for the tile's depth (dock passes a larger one when floating)
	}>(),
	{ radius: "rounded-[11px]", glyph: "size-[22px]", shadow: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" },
);

const edgeStyle = computed(() => `filter:${props.shadow};`);
</script>

<template>
	<span class="relative inline-flex h-[46px] w-[46px] shrink-0" :class="radius" :style="edgeStyle">
		<img v-if="logo" :src="logo" :alt="label" class="h-full w-full object-contain" :class="radius" />
		<span
			v-else
			class="inline-flex h-full w-full items-center justify-center border border-outline-gray-2 bg-surface-base text-ink-gray-6"
			:class="radius"
		>
			<span :class="[icon, glyph]"></span>
		</span>
	</span>
</template>
