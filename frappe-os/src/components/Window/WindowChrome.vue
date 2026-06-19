<script setup lang="ts">
// The window's macOS title bar: the drag/zoom surface plus the traffic-light controls
// (close / minimize / zoom) that every window type shares. Simple windows (applet /
// settings / record) get an app logo + title from props; app windows pass their rich nav
// (breadcrumbs, search, presence) through the default slot. Styled on frappe-ui CSS tokens.
import { computed } from "vue";
import { useOS } from "@/desktop";
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow } from "@/surface/types";

const props = defineProps<{ win: OsWindow; title?: string | null; logo?: string }>();
const os = useOS();
const g = computed(() => os.geoMap.value[props.win.id] || {});
const inSplit = computed(
	() =>
		os.state.split &&
		(os.state.split[0] === props.win.id || os.state.split[1] === props.win.id),
);
const focused = computed(() => os.state.activeId === props.win.id);
// The bar is static except the grab cursor (disabled when maximized/split).
const barClass = computed(() => [
	"relative flex items-center gap-2 h-11 px-2.5 flex-shrink-0 select-none border-b border-outline-gray-1 bg-surface-gray-1",
	g.value.max || inSplit.value ? "cursor-default" : "cursor-grab",
]);
// Reusable traffic-light / control button classes (close / minimize / zoom).
const chromeBtn =
	"inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-gray-5";
</script>

<template>
	<div
		:class="barClass"
		@pointerdown="os.startDrag(win.id, $event)"
		@dblclick="os.toggleZoom(win.id)"
	>
		<span class="mr-1.5 flex flex-shrink-0 items-center gap-0.5" @pointerdown.stop>
			<button :class="chromeBtn" title="Close" @click="os.closeWin(win.id)">
				<span class="lucide-x size-[14px]"></span>
			</button>
			<button :class="chromeBtn" title="Minimize" @click="os.minimizeWin(win.id)">
				<span class="lucide-minus size-[14px]"></span>
			</button>
			<button :class="chromeBtn" title="Zoom" @click="os.toggleZoom(win.id)">
				<span class="lucide-square size-[13px]"></span>
			</button>
		</span>
		<slot>
			<img
				v-if="logo"
				:src="logo"
				alt=""
				class="h-[17px] w-[17px] flex-shrink-0 rounded object-contain"
			/>
			<span
				class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold"
				:class="focused ? 'text-ink-gray-8' : 'text-ink-gray-5'"
				>{{ title }}</span
			>
			<span class="flex-1"></span>
		</slot>
	</div>
</template>
