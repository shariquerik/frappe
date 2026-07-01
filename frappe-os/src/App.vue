<script setup lang="ts">
// Frappe OS desktop root: wallpaper, desktop icons, windows, split-exit pill,
// menu bar, dock, command palette. Owns the global keyboard
// (⌘K / Esc) and pointer (drag/resize + dock auto-hide) listeners. Theme is
// owned by frappe-ui's useTheme (it writes <html data-theme>); we just boot it.
import { computed, onMounted, onBeforeUnmount } from "vue";
import { ToastProvider, useTheme } from "frappe-ui";
import { useOS } from "@/desktop";
import { cellToPixel, layoutDesktop, CELL_W } from "@/desktop/grid";
import { usePlacements, placementView, writePlacementOverride } from "@/placements";
import { placementSurface, isAppRef } from "@/surface";
import type { SurfaceRef, ResolvedPlacement } from "@/types";
import { MenuBar } from "./components/MenuBar";
import { Dock } from "./components/Dock";
import { OSWindow } from "./components/Window";
import { CommandPalette } from "./components/CommandPalette";

const os = useOS();

// Theme is owned by frappe-ui (light/dark/system): the first useTheme() call
// restores the saved choice, writes <html data-theme>, and installs the
// prefers-color-scheme listener. Call it at boot so the theme applies on load,
// not only once the Appearance pane mounts. The ThemeSwitcher in Settings drives
// the same singleton.
useTheme();

const wp = computed(() => os.currentWp.value);

// The desktop size is a single reactive source (os.deskRef), refreshed on mount and on resize via
// os.syncDeskSize, so the cell→pixel projection, the live drag clamp, AND the drop-snap on release
// all read the same up-to-date dimensions — they can't drift after a window resize.
const desk = os.deskRef;

// The desktop icons are no longer hardcoded — they are the server-resolved `desktop` Placements
// (ADR-0023). Each pin gets a concrete grid cell (stored override, or auto-placed into the next
// free cell), the cell is projected to pixels, and a pin mid-drag follows the cursor by its offset.
interface DesktopIcon {
	key: string;
	ref: SurfaceRef;
	label: string;
	logo?: string;
	icon?: string;
	cell: { column: number; row: number };
	x: number;
	y: number;
}
const pins = computed<ResolvedPlacement[]>(() => usePlacements().desktop());
const desktopIcons = computed<DesktopIcon[]>(() => {
	const list = pins.value;
	const cells = layoutDesktop(list, desk.h);
	const drag = os.iconDragState;
	return list.map((p, i) => {
		const view = placementView(p);
		const cell = cells[i];
		const px = cellToPixel(cell, desk.w);
		const dragging = drag.key === view.key;
		return {
			...view,
			cell,
			x: px.x + (dragging ? drag.dx : 0),
			y: px.y + (dragging ? drag.dy : 0),
		};
	});
});

// Press-and-drag a desktop icon: hand the icon's current top-left and every OTHER pin's cell to the
// pointer loop, which on release snaps to a grid cell and calls back here to persist the move as a
// User-layer override (the frontend's only write path — never the baseline/Site rows). A press that
// doesn't move is a click (openPlacement); the small-delta guard in onClick distinguishes them.
function onIconPointerDown(di: DesktopIcon, e: PointerEvent): void {
	const px = cellToPixel(di.cell, desk.w);
	const occupied = desktopIcons.value.filter((o) => o.key !== di.key).map((o) => o.cell);
	os.startIconDrag(di.key, px.x, px.y, occupied, (cell, moved) => {
		// A real move persists a User-layer position override; a press that didn't move is a click.
		if (moved) writePlacementOverride({ region: "desktop", ref: di.ref, position: cell });
		else openPlacement(di.ref);
	}, e);
}

// Open a desktop pin: a bare-app reference opens the app's default surface (like the dock icon);
// any other reference resolves to its Surface and opens in the owning app's window.
function openPlacement(ref: SurfaceRef): void {
	if (isAppRef(ref)) return os.openApp(ref.app!);
	const surface = placementSurface(ref);
	if (surface) os.openSurface(surface);
}
const deskLabelStyle = computed(() =>
	wp.value.dark
		? "font-size:11.5px;max-width:74px;text-align:center;line-height:1.2;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.45);"
		: "font-size:11.5px;max-width:74px;text-align:center;line-height:1.2;color:var(--ink-gray-7);text-shadow:0 1px 2px var(--surface-alpha-white-5);",
);

function onKey(e: KeyboardEvent) {
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
		e.preventDefault();
		os.state.paletteOpen = !os.state.paletteOpen;
		os.state.paletteQuery = "";
		os.state.menu = null;
	}
	if (e.key === "Escape") {
		os.state.paletteOpen = false;
		os.state.menu = null;
	}
}
const move = (e: PointerEvent) => os.onPointerMove(e);
const up = () => os.onPointerUp();
onMounted(() => {
	os.syncDeskSize();
	window.addEventListener("keydown", onKey);
	window.addEventListener("pointermove", move);
	window.addEventListener("pointerup", up);
	window.addEventListener("resize", os.syncDeskSize);
});
onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKey);
	window.removeEventListener("pointermove", move);
	window.removeEventListener("pointerup", up);
	window.removeEventListener("resize", os.syncDeskSize);
});
</script>

<template>
	<!-- isolation:isolate makes the desktop its own stacking context, so every
       window/chrome z-index stays local. That same sandbox means popovers
       portaled to <body> can't reliably paint above the desktop, so reka-ui
       popovers (frappe-ui Dropdown, …) are portaled into #os-popover-layer
       below, which sits at the top of the desktop's own z-index scale. -->
	<div
		:ref="(el) => os.setDeskEl(el as HTMLElement | null)"
		:data-active-window="os.state.activeId || ''"
		class="relative h-screen w-full overflow-hidden bg-surface-gray-3 text-ink-gray-8 [font-family:var(--font-sans)] isolate"
	>
		<!-- wallpaper -->
		<div
			class="absolute inset-0 z-0"
			:style="{ background: wp.bg }"
			@contextmenu.prevent="os.openSettings('Wallpaper')"
		></div>

		<!-- desktop icons: edge-anchored grid cells (ADR-0023), each absolutely positioned at its
		     cell's projected pixel; drag snaps to a cell and writes a User-layer override. -->
		<button
			v-for="di in desktopIcons"
			:key="di.key"
			class="absolute z-[1] flex cursor-grab flex-col items-center gap-[5px] rounded-lg border-none bg-transparent px-0.5 py-1.5 hover:bg-[var(--surface-alpha-white-3)] active:cursor-grabbing"
			:class="{ 'z-[2] opacity-90': os.iconDragState.key === di.key }"
			:style="{ left: di.x + 'px', top: di.y + 'px', width: CELL_W - 14 + 'px' }"
			@pointerdown="onIconPointerDown(di, $event)"
		>
				<img
					v-if="di.logo"
					:src="di.logo"
					:alt="di.label"
					class="h-[46px] w-[46px] rounded-[11px] object-contain shadow-[var(--shadow-sm)]"
				/>
				<span
					v-else
					class="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[11px] border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-[var(--shadow-sm)]"
				>
					<span :class="di.icon" class="size-[22px]"></span>
				</span>
				<span :style="deskLabelStyle">{{ di.label }}</span>
			</button>

		<!-- windows -->
		<OSWindow v-for="w in os.state.windows" :key="w.id" :win="w" />

		<!-- split exit pill -->
		<button
			v-if="os.state.split"
			class="absolute left-1/2 top-[42px] z-[80] inline-flex h-[30px] -translate-x-1/2 cursor-pointer items-center gap-[7px] rounded-full border border-outline-gray-2 bg-surface-base px-[14px] text-[12px] font-medium text-ink-gray-7 shadow-[var(--shadow-lg)]"
			@click="os.exitSplit()"
		>
			<span class="lucide-columns-2 size-[14px]"></span>Exit split view
		</button>

		<MenuBar />
		<Dock />
		<CommandPalette />
		<ToastProvider />
		<div id="os-popover-layer" class="absolute z-[94000]"></div>
	</div>
</template>
