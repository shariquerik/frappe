<script setup lang="ts">
// The window's macOS title bar: the drag/zoom surface plus the traffic-light controls
// (close / minimize / zoom) that every window type shares. Simple windows (applet /
// settings / record) get an app logo + title from props; app windows pass their rich nav
// (breadcrumbs, search, presence) through the default slot. Styled on frappe-ui CSS tokens.
import { computed } from "vue";
import LucideX from "~icons/lucide/x";
import LucideMinus from "~icons/lucide/minus";
import LucideChevronsLeftRight from "~icons/lucide/chevrons-left-right";
import LucideChevronsRightLeft from "~icons/lucide/chevrons-right-left";
import { useOS } from "@/desktop";
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow } from "@/surface/types";

const props = defineProps<{ win: OsWindow; title?: string | null; logo?: string }>();
const os = useOS();
const focused = computed(() => os.state.activeId === props.win.id);
// When full-screen, the zoom glyph flips from expand to collapse.
const maximized = computed(() => !!os.geoMap.value[props.win.id]?.max);
// The bar is static and uses the default arrow cursor everywhere (no grab cursor —
// it flickered against the controls/menubar which use their own cursors).
// Solid #f8f9fc surface with a hairline inset bottom (no border, no vibrancy).
const barClass =
	"relative flex items-center gap-2 h-11 px-2.5 flex-shrink-0 select-none cursor-default bg-[#f8f9fc] shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]";
// Traffic dot: a neutral pill that fills with its semantic color on group-hover.
const dot =
	"grid h-[12px] w-[12px] cursor-pointer place-items-center rounded-full border-none bg-surface-gray-5 p-0 transition-colors";
// Glyph: imported lucide icons (real <svg>, not the mask-based `lucide-*` class) so we
// can override the per-icon stroke-width to 3 — heavy enough to read at 9px — without
// touching the pack-wide 1.5. Hidden at rest, revealed on group-hover.
const glyph =
	"size-[9px] text-ink-gray-8 [--tw-text-opacity:0.55] opacity-0 transition-opacity group-hover:opacity-100";
</script>

<template>
	<div
		:class="barClass"
		@pointerdown="os.startDrag(win.id, $event)"
		@dblclick="os.toggleZoom(win.id)"
	>
		<span
			class="group mr-1.5 flex flex-shrink-0 cursor-default items-center gap-2"
			@pointerdown.stop
		>
			<button
				:class="dot"
				class="group-hover:bg-surface-red-6"
				title="Close"
				@click="os.closeWin(win.id)"
			>
				<LucideX :class="glyph" :stroke-width="3" />
			</button>
			<button
				:class="dot"
				class="group-hover:bg-surface-yellow-6"
				title="Minimize"
				@click="os.minimizeWin(win.id)"
			>
				<LucideMinus :class="glyph" :stroke-width="3" />
			</button>
			<button
				:class="dot"
				class="group-hover:bg-surface-green-6"
				:title="maximized ? 'Restore' : 'Zoom'"
				@click="os.toggleZoom(win.id)"
			>
				<!-- chevrons rotated 45°: outward (expand) when windowed, inward (collapse) when full-screen -->
				<LucideChevronsRightLeft
					v-if="maximized"
					class="rotate-45"
					:class="glyph"
					:stroke-width="3"
				/>
				<LucideChevronsLeftRight v-else class="rotate-45" :class="glyph" :stroke-width="3" />
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
