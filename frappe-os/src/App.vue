<script setup lang="ts">
// Frappe OS desktop root: wallpaper, desktop icons, windows, split-exit pill,
// menu bar, dock, command palette. Owns the global keyboard
// (⌘K / Esc), pointer (drag/resize + dock auto-hide) listeners, and the
// data-theme attribute that drives frappe-ui's light/dark tokens.
import { computed, onMounted, onBeforeUnmount } from "vue";
import { ToastProvider } from "frappe-ui";
import { useOS } from "@/desktop";
import { MenuBar } from "./components/MenuBar";
import { Dock } from "./components/Dock";
import { OSWindow } from "./components/Window";
import { CommandPalette } from "./components/CommandPalette";

const os = useOS();
const ICON = os.DATA.ICON;

const wp = computed(() => os.currentWp.value);
const desktopIcons = [
	{ label: "Frappe Cloud", icon: ICON.drive, open: () => os.openApp("frappe") },
	{ label: "Reports", icon: ICON.grid, open: () => os.openApp("erpnext") },
];
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
	window.addEventListener("keydown", onKey);
	window.addEventListener("pointermove", move);
	window.addEventListener("pointerup", up);
});
onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKey);
	window.removeEventListener("pointermove", move);
	window.removeEventListener("pointerup", up);
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
		:data-theme="os.state.theme"
		:data-active-window="os.state.activeId || ''"
		class="relative h-screen w-full overflow-hidden bg-surface-gray-3 text-ink-gray-8 [font-family:var(--font-sans)] isolate"
	>
		<!-- wallpaper -->
		<div
			class="absolute inset-0 z-0"
			:style="{ background: wp.bg }"
			@contextmenu.prevent="os.openSystemSettings('Wallpaper')"
		></div>

		<!-- desktop icons -->
		<div class="absolute right-[18px] top-[46px] z-[1] flex flex-col gap-[14px]">
			<button
				v-for="(di, i) in desktopIcons"
				:key="i"
				class="flex w-[76px] cursor-pointer flex-col items-center gap-[5px] rounded-lg border-none bg-transparent px-0.5 py-1.5 hover:bg-[var(--surface-alpha-white-3)]"
				@click="di.open()"
			>
				<span
					class="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[11px] border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-[var(--shadow-sm)]"
				>
					<span :class="di.icon" class="size-[22px]"></span>
				</span>
				<span :style="deskLabelStyle">{{ di.label }}</span>
			</button>
		</div>

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
