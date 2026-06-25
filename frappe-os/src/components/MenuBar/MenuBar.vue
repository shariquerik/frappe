<script setup lang="ts">
// macOS-style top menu bar. Menus use frappe-ui Dropdown (grouped options render
// dividers); the Frappe system logo replaces the apple glyph, and the active
// app's logo+name show in the app menu. Keyboard-shortcut chips from the original
// are omitted — frappe-ui Dropdown items render label + onClick only.
import { computed } from "vue";
import OSDropdown from "@/components/OSDropdown.vue";
import { useOS } from "@/desktop";
import { fileMenuOptions } from "@/actions";
import { initials } from "@/config/apps";
import { windowRole } from "@/surface";
import type { OsWindow } from "@/types";

const os = useOS();
const activeWin = computed(() => os.state.windows.find((w) => w.id === os.state.activeId));
const appIdOf = (w?: OsWindow) => (w && (w.surface as { appId?: string }).appId) || null;
const aid = computed(() => appIdOf(activeWin.value));
const aname = computed(() => (aid.value ? os.DATA.APP[aid.value].name : "Finder"));
const appLogo = computed(() => (aid.value ? os.DATA.APP[aid.value].logo : null));
const frappeLogo = os.DATA.APP.frappe.logo;
const userName = "Faris Ansari";

function zoomActive() {
	if (activeWin.value) os.toggleZoom(activeWin.value.id);
}
function minActive() {
	if (activeWin.value) os.minimizeWin(activeWin.value.id);
}
function settingsActive() {
	if (aid.value) os.openSettings(aid.value);
}
function homeActive() {
	if (
		activeWin.value &&
		windowRole(activeWin.value.id) === "app" &&
		os.DATA.APP[aid.value!].hasDashboard
	)
		os.goHome(activeWin.value.id);
}
function listActive() {
	if (activeWin.value && windowRole(activeWin.value.id) === "app")
		os.openList(activeWin.value.id, os.DATA.APP[aid.value!].modules[0].doctypes[0]);
}
function quitActive() {
	if (aid.value) {
		os.state.windows = os.state.windows.filter((w) => appIdOf(w) !== aid.value);
		os.state.activeId = null;
		os.state.split = null;
	}
}

const appleMenu = [
	{ group: "a", hideLabel: true, items: [{ label: "About this workspace", onClick: () => {} }] },
	{
		group: "b",
		hideLabel: true,
		items: [
			{ label: "System settings…", onClick: () => os.openSystemSettings() },
			{ label: "Change wallpaper…", onClick: () => os.openSystemSettings("Wallpaper") },
		],
	},
	{
		group: "c",
		hideLabel: true,
		items: [
			{ label: "Lock screen", onClick: () => {} },
			{ label: "Log out…", onClick: () => {} },
		],
	},
];
const appMenu = computed(() => [
	{
		group: "a",
		hideLabel: true,
		items: [
			{ label: aname.value + " settings…", onClick: settingsActive },
			{ label: "Hide " + aname.value, onClick: minActive },
		],
	},
	{
		group: "b",
		hideLabel: true,
		items: [{ label: "Quit " + aname.value, onClick: quitActive }],
	},
]);
// The File menu is the first migrated Region: rendered from resolved first-party `frappe`
// Actions (actions/menubar.ts), not a literal array. The other six menus stay hardcoded
// pending later incremental migration (ADR-0001 dogfooding).
const fileMenu = computed(() => fileMenuOptions(os));
const editMenu = [
	{
		group: "a",
		hideLabel: true,
		items: [
			{ label: "Undo", onClick: () => {} },
			{ label: "Redo", onClick: () => {} },
		],
	},
	{
		group: "b",
		hideLabel: true,
		items: [
			{ label: "Cut", onClick: () => {} },
			{ label: "Copy", onClick: () => {} },
			{ label: "Paste", onClick: () => {} },
		],
	},
];
const viewMenu = [
	{
		group: "a",
		hideLabel: true,
		items: [
			{ label: "Show dashboard", onClick: homeActive },
			{ label: "Show as list", onClick: listActive },
		],
	},
	{ group: "b", hideLabel: true, items: [{ label: "Enter full screen", onClick: zoomActive }] },
];
const windowMenu = [
	{
		group: "a",
		hideLabel: true,
		items: [
			{ label: "Minimize", onClick: minActive },
			{ label: "Zoom", onClick: zoomActive },
		],
	},
	{
		group: "b",
		hideLabel: true,
		items: [
			{ label: "Enter split view", onClick: () => os.enterSplit() },
			{ label: "Exit split view", onClick: () => os.exitSplit() },
		],
	},
];
const helpMenu = [
	{
		group: "a",
		hideLabel: true,
		items: [{ label: "Frappe help", onClick: () => os.openPalette() }],
	},
];

// Chrome over the wallpaper adapts to its darkness: white ink on dark grounds,
// dark ink on light ones. The menu bar only ever sits over the wallpaper (windows
// start below it at TOP=32), so wallpaper darkness alone decides legibility.
const dark = computed(() => os.currentWp.value.dark);
const barTextClass = computed(() => (dark.value ? "text-white" : "text-ink-gray-8"));
const barStyle = computed(() => ({
	background: dark.value
		? "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 100%)"
		: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)",
}));
const dividerClass = computed(() => (dark.value ? "bg-white/25" : "bg-black/10"));
const iconHover = computed(() => (dark.value ? "hover:bg-white/20" : "hover:bg-black/10"));
const hoverCls = computed(() => (dark.value ? "hover:before:bg-white/20" : "hover:before:bg-black/10"));

// Full-height trigger (hit area reaches the very top screen edge, macOS-style) but
// the hover highlight is an INSET pseudo-element, so the pill doesn't fill the whole
// bar height. `isolate` keeps the `before:-z-10` layer above the bar's own scrim;
// text color is inherited from the bar (Tailwind preflight sets button color:inherit).
const btn =
	"relative isolate inline-flex cursor-pointer items-center self-stretch border-none bg-transparent px-[9px] text-[12.5px] [font-family:var(--font-sans)] before:absolute before:inset-x-0 before:inset-y-1 before:-z-10 before:rounded-md before:transition-colors before:content-['']";
const btnCls = (bold: boolean) => [btn, hoverCls.value, bold ? "font-bold" : "font-medium"];
</script>

<template>
	<!-- Transparent + soft top scrim (no frosted glass, no bottom hairline). Ink and
	     scrim flip with the wallpaper's darkness so the menu reads on any ground. -->
	<div
		class="absolute left-0 right-0 top-0 z-[90000] flex h-8 items-center gap-0.5 px-2.5"
		:class="barTextClass"
		:style="barStyle"
	>
		<OSDropdown :options="appleMenu" placement="bottom-start">
			<button :class="btnCls(false)">
				<img :src="frappeLogo" alt="Frappe" class="block h-4 w-4 object-contain" />
			</button>
		</OSDropdown>

		<span class="h-[16px] w-px flex-shrink-0" :class="dividerClass"></span>

		<OSDropdown :options="appMenu" placement="bottom-start">
			<button :class="btnCls(true)">
				<img
					v-if="appLogo && aid !== 'frappe'"
					:src="appLogo"
					alt=""
					class="mr-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-[3px] object-contain"
				/>{{ aname }}
			</button>
		</OSDropdown>
		<OSDropdown :options="fileMenu" placement="bottom-start"
			><button :class="btnCls(false)" data-menu="file">File</button></OSDropdown
		>
		<OSDropdown :options="editMenu" placement="bottom-start"
			><button :class="btnCls(false)">Edit</button></OSDropdown
		>
		<OSDropdown :options="viewMenu" placement="bottom-start"
			><button :class="btnCls(false)">View</button></OSDropdown
		>
		<OSDropdown :options="windowMenu" placement="bottom-start"
			><button :class="btnCls(false)">Window</button></OSDropdown
		>
		<OSDropdown :options="helpMenu" placement="bottom-start"
			><button :class="btnCls(false)">Help</button></OSDropdown
		>
		<div class="flex-1"></div>
		<button
			class="inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
			:class="iconHover"
			title="Spotlight (⌘K)"
			@click="os.openPalette()"
		>
			<span class="lucide-search size-[15px]"></span>
		</button>
		<span class="px-2 text-[12.5px] tabular-nums">{{ os.clockText.value }}</span>
		<span
			class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink-gray-8)] text-[10px] font-semibold text-white"
			>{{ initials(userName) }}</span
		>
	</div>
</template>
