<script setup lang="ts">
// macOS-style top menu bar. Every menu renders from the actions resolver (menuOptions over a
// `menubar:<menu>` Region) — no literal option arrays — so any menu is app/site/user customizable
// the way File always was (ADR-0001/0014/0032). frappe-ui Dropdown renders grouped label + onClick
// items (dividers between groups); the Frappe system logo and the front app's logo+name are just the
// two dropdowns' triggers. Keyboard-shortcut chips from the original are omitted.
import { computed, onMounted } from "vue";
import { Avatar } from "frappe-ui";
import OSDropdown from "@/components/OSDropdown.vue";
import { useOS } from "@/desktop";
import {
  menuOptions, SYSTEM_REGION, APP_REGION,
  FILE_REGION, EDIT_REGION, VIEW_REGION, WINDOW_REGION, HELP_REGION,
} from "@/actions";
import { useAccount } from "@/data/account";
import { windowRole, systemWindowTitle } from "@/surface";
import type { OsWindow } from "@/types";

const os = useOS();

// The five text menus, left-to-right; system + app carry logo triggers so they stay explicit.
// `slot` is the region's short tail, used as the stable `data-menu` test hook.
const textMenus = [
	{ region: FILE_REGION, label: "File", slot: "file" },
	{ region: EDIT_REGION, label: "Edit", slot: "edit" },
	{ region: VIEW_REGION, label: "View", slot: "view" },
	{ region: WINDOW_REGION, label: "Window", slot: "window" },
	{ region: HELP_REGION, label: "Help", slot: "help" },
];

// A menu is EARNED (ADR-0039 rule 1): its title renders only when at least one real, eligible
// Action resolves into its Region for the current Context. So File/Edit/View appear and disappear
// with focus, while the frame menus (Window/Help) stay because the OS always backs them. Resolve
// once per menu here — the template renders only the non-empty ones.
const visibleTextMenus = computed(() =>
	textMenus
		.map((menu) => ({ ...menu, options: menuOptions(menu.region, os) }))
		.filter((menu) => menu.options.length > 0),
);

// The menu-bar avatar shares the own-user doc with Settings ▸ Account (useAccount is a
// singleton, load() no-ops once loaded), so the photo shows here without a second fetch.
const account = useAccount();
onMounted(() => account.load());
const userImage = computed(() => (account.state.doc?.user_image as string) || "");
const activeWin = computed(() => os.state.windows.find((w) => w.id === os.state.activeId));
const appIdOf = (w?: OsWindow) => (w && (w.surface as { appId?: string }).appId) || null;
const aid = computed(() => appIdOf(activeWin.value));
const aname = computed(() => (aid.value ? os.DATA.APP[aid.value].name : "Finder"));
const appLogo = computed(() => (aid.value ? os.DATA.APP[aid.value].logo : null));
// The bold app-menu label names what's front-most. An app's settings pane keeps the app's own
// identity here (name + logo) — the "CRM settings" title lives only in its window chrome — so
// only the desktop-wide singletons (per-user Settings / Finder) rename the menu bar.
const title = computed(() => {
	const win = activeWin.value;
	if (win && windowRole(win.id) === "system") {
		const view = (win.surface as { view?: string }).view;
		return systemWindowTitle("system", view, aname.value) ?? aname.value;
	}
	return aname.value;
});
const frappeLogo = os.DATA.APP.frappe.logo;
// The logged-in user's name from the live boot session (used as the avatar label, which
// degrades a missing/loading name to a neutral placeholder — no demo data leaks through).
const userName = computed(() => os.state.userName);

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
		class="os-menubar absolute left-0 right-0 top-0 z-[90000] flex h-8 items-center gap-0.5 px-2.5"
		:class="barTextClass"
		:style="barStyle"
	>
		<OSDropdown :options="menuOptions(SYSTEM_REGION, os)" placement="bottom-start">
			<button :class="btnCls(false)">
				<img :src="frappeLogo" alt="Frappe" class="block h-4 w-4 object-contain" />
			</button>
		</OSDropdown>

		<span class="h-[16px] w-px flex-shrink-0" :class="dividerClass"></span>

		<OSDropdown :options="menuOptions(APP_REGION, os)" placement="bottom-start">
			<button :class="btnCls(true)">
				<img
					v-if="appLogo && aid !== 'frappe'"
					:src="appLogo"
					alt=""
					class="mr-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-[3px] object-contain"
				/>{{ title }}
			</button>
		</OSDropdown>
		<OSDropdown
			v-for="menu in visibleTextMenus"
			:key="menu.region"
			:options="menu.options"
			placement="bottom-start"
			><button :class="btnCls(false)" :data-menu="menu.slot">{{ menu.label }}</button></OSDropdown
		>
		<!-- The empty middle doubles as the window's drag handle: with the title bar gone
		     (window-controls-overlay), this is what the user grabs to move the window.
		     Ignored in a normal browser tab. -->
		<div class="flex-1 self-stretch" style="-webkit-app-region: drag"></div>
		<button
			class="inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
			:class="iconHover"
			title="Spotlight (⌘K)"
			@click="os.openPalette()"
		>
			<span class="lucide-search size-[15px]"></span>
		</button>
		<span class="px-2 text-[12.5px] tabular-nums">{{ os.clockText.value }}</span>
		<button
			class="ml-1 inline-flex cursor-pointer items-center rounded-full border-none bg-transparent p-0 transition hover:opacity-80"
			title="Account settings"
			@click="os.openSettings('Account')"
		>
			<Avatar class="!size-6 !text-[10px]" :image="userImage" :label="userName" />
		</button>
	</div>
</template>

<style scoped>
/* Installed as a PWA with window-controls-overlay, this bar rises into the vacated title-bar
   strip, so it must keep clear of the OS window buttons drawn over it: the macOS traffic lights
   at the left, the ⋮ app menu at the right. env(titlebar-area-*) gives the exact free region on
   a real install; the fixed floors (78px / 148px) keep the corners clear even when those vars
   aren't populated (e.g. DevTools emulation). No effect in a normal browser tab or standalone. */
@media (display-mode: window-controls-overlay) {
	.os-menubar {
		padding-left: max(env(titlebar-area-x, 0px), 100px);
		padding-right: max(
			calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)),
			160px
		);
	}
}
</style>
