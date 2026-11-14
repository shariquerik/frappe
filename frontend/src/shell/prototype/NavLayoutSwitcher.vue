<!-- PROTOTYPE (#47374, #47385): the floating variant bar. Not part of any design under review. -->
<template>
	<div
		class="fixed left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-1 text-white"
		:class="lifted ? 'bottom-[4.5rem]' : 'bottom-3'"
		data-prototype-switcher
	>
		<div v-for="bar in bars" :key="bar.name" :class="BAR">
			<button type="button" :class="ARROW" :aria-label="`Previous ${bar.name}`" @click="bar.go(-1)">
				<span class="lucide-chevron-left size-4" />
			</button>
			<span class="min-w-[15rem] px-1 text-center tabular-nums">
				{{ bar.label }}
				<span class="text-gray-400">({{ bar.at }})</span>
			</span>
			<button type="button" :class="ARROW" :aria-label="`Next ${bar.name}`" @click="bar.go(1)">
				<span class="lucide-chevron-right size-4" />
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { setVariant, step, variant, variantKey, VARIANTS } from "./navLayout";
import {
	band,
	NARROW_MODES,
	narrowMode,
	navMode,
	PHONE_STYLES,
	phoneStyle,
	type NarrowMode,
	type PhoneStyle,
} from "./navNarrow";

const BAR =
	"flex items-center gap-1 rounded-full bg-gray-900 p-1 text-xs shadow-2xl sm:text-sm";
const ARROW = "grid size-7 place-items-center rounded-full hover:bg-white/15";

const route = useRoute();
const router = useRouter();

const lifted = computed(() => navMode.value === "phone" && phoneStyle.value === "sheet");

function cycle<T>(list: T[], at: number, by: number) {
	return list[(at + by + list.length) % list.length];
}

const bars = computed(() => {
	const out = [
		{
			name: "layout",
			label: variant.value.label,
			at: `${VARIANTS.findIndex((v) => v.key === variantKey.value) + 1}/${VARIANTS.length}`,
			go: (by: number) => {
				step(by);
				sync();
			},
		},
	];
	if (band.value === "narrow") {
		const at = NARROW_MODES.findIndex((m) => m.key === narrowMode.value);
		out.push({
			name: "narrow mode",
			label: `${NARROW_MODES[at].name} · 768–1023`,
			at: `${at + 1}/${NARROW_MODES.length}`,
			go: (by: number) => {
				narrowMode.value = cycle(NARROW_MODES, at, by).key as NarrowMode;
				sync();
			},
		});
	}
	if (navMode.value === "phone") {
		const at = PHONE_STYLES.findIndex((s) => s.key === phoneStyle.value);
		out.push({
			name: "phone style",
			label: PHONE_STYLES[at].name,
			at: `${at + 1}/${PHONE_STYLES.length}`,
			go: (by: number) => {
				phoneStyle.value = cycle(PHONE_STYLES, at, by).key as PhoneStyle;
				sync();
			},
		});
	}
	return out;
});

// A pasted or edited `?variant=` switches too.
watch(
	() => route.query.variant,
	(key) => typeof key === "string" && setVariant(key)
);

function sync() {
	const query = { ...route.query, variant: variantKey.value, phone: phoneStyle.value, narrow: narrowMode.value };
	router.replace({ query, hash: route.hash });
}

// ← → cycle the layout; Shift+← → cycle the phone style or narrow mode.
function onKey(event: KeyboardEvent) {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
	const target = event.target as HTMLElement;
	if (target.closest("input, textarea, select, [contenteditable], [role=grid], [role=listbox], [role=menu]"))
		return;
	const bar = event.shiftKey ? bars.value[bars.value.length - 1] : bars.value[0];
	bar.go(event.key === "ArrowLeft" ? -1 : 1);
}

onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => document.removeEventListener("keydown", onKey));
</script>
