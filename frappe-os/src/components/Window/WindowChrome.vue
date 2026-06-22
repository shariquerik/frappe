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
// Solid #f8f9fc surface with a hairline inset bottom (no border, no vibrancy).
const barClass = computed(() => [
	"relative flex items-center gap-2 h-11 px-2.5 flex-shrink-0 select-none bg-[#f8f9fc] shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]",
	g.value.max || inSplit.value ? "cursor-default" : "cursor-grab",
]);
// Traffic dot: a neutral pill that fills with its semantic color on group-hover.
const dot =
	"grid h-[12px] w-[12px] cursor-pointer place-items-center rounded-full border-none bg-[var(--os-ctl-rest)] p-0 ring-1 ring-black/10 transition-colors";
// Glyph: inline SVG (NOT the lucide sprite — it bakes a thin stroke we can't
// thicken); hidden at rest, revealed on group-hover.
const glyph =
	"size-[9px] text-[var(--os-ctl-glyph)] opacity-0 transition-opacity group-hover:opacity-100";
</script>

<template>
	<div
		:class="barClass"
		@pointerdown="os.startDrag(win.id, $event)"
		@dblclick="os.toggleZoom(win.id)"
	>
		<span class="group mr-1.5 flex flex-shrink-0 items-center gap-2" @pointerdown.stop>
			<button
				:class="dot"
				class="group-hover:bg-[var(--os-ctl-close)]"
				title="Close"
				@click="os.closeWin(win.id)"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					:class="glyph"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
			<button
				:class="dot"
				class="group-hover:bg-[var(--os-ctl-min)]"
				title="Minimize"
				@click="os.minimizeWin(win.id)"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					:class="glyph"
				>
					<path d="M5 12h14" />
				</svg>
			</button>
			<button
				:class="dot"
				class="group-hover:bg-[var(--os-ctl-max)]"
				title="Zoom"
				@click="os.toggleZoom(win.id)"
			>
				<!-- chevrons-left-right rotated 45° -->
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					:class="glyph"
					class="rotate-45"
				>
					<path d="m9 7-5 5 5 5" />
					<path d="m15 7 5 5-5 5" />
				</svg>
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
