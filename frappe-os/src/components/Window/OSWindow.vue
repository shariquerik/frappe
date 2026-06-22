<script setup lang="ts">
// A desktop window — the thin dispatcher. This file owns only the macOS geometry (drag/
// resize/split/maximize → `styleWin`) and the window-type branch; the title bar
// (WindowChrome), the app nav (AppToolbar/AppSidebar) and the dashboard body (AppDashboard)
// are extracted siblings. App/record bodies render through DoctypeView, settings through
// SettingsDialog, and applet-backed surfaces (ADR-0012) through a resolved component.
import { computed, provide, shallowRef, watch } from "vue";
import type { Component } from "vue";
import { useOS } from "@/desktop";
import { OS_KEY, tryGetOsApi } from "@/data/os-api";
import { resolveApplet as resolveOsApplet } from "@/registry";
import { DoctypeView } from "@/components/Views";
import { SettingsDialog, WallpaperPicker } from "@/components/Settings";
import WindowChrome from "./WindowChrome.vue";
import AppToolbar from "./AppToolbar.vue";
import { TOOLBAR_SLOT } from "./toolbar";
import AppSidebar from "./AppSidebar.vue";
import AppDashboard from "./AppDashboard.vue";
import { windowRole } from "@/surface";
// OsWindow feeds defineProps, so these come from concrete modules, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see DoctypeView.vue).
import type { BuiltinSurface, AppletSurface, Geo, OsWindow, Surface } from "@/surface/types";
import type { ViewProps } from "@/config/types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();

// Window role (app/record/settings) is derived from the id; the surface is the content.
const role = computed(() => windowRole(props.win.id));
const s = computed<BuiltinSurface>(() => props.win.surface as BuiltinSurface);

// An applet-backed surface (ADR-0012) is its own render path: it opens in an app:<id>
// window but replaces the builtin body with a resolved Vue component.
const surf = computed<Surface>(() => props.win.surface);
const isApplet = computed(() => surf.value.kind === "applet");
const applet = computed(() => surf.value as AppletSurface);

// Provide the OS API seam (ADR-0003) so an injected component reaches Frappe OS without
// importing the store. Skipped offline (uninitialised seam) — no applet window exists then.
const osApi = tryGetOsApi();
if (osApi) provide(OS_KEY, osApi);

// The chrome bar's action zone: AppToolbar binds this to a DOM node, the view body teleports
// its primary actions (list "New", form "Save"/menu) into it — one merged bar, not two. Stays
// null for windows without an AppToolbar (record/settings/applet), so those views fall back to
// rendering their actions inline (see TOOLBAR_SLOT).
const toolbarSlot = shallowRef<HTMLElement | null>(null);
provide(TOOLBAR_SLOT, toolbarSlot);

// Resolve the component on demand (ADR-0009 async-by-id); shallowRef keeps it non-reactive.
const resolved = shallowRef<Component | null>(null);
watch(
	() => (isApplet.value ? applet.value.appletId : null),
	async (id) => {
		resolved.value = id ? await resolveOsApplet(id) : null;
	},
	{ immediate: true },
);

const g = computed<Partial<Geo>>(() => os.geoMap.value[props.win.id] || {});
const focused = computed(() => os.state.activeId === props.win.id);
const inSplit = computed(
	() =>
		os.state.split &&
		(os.state.split[0] === props.win.id || os.state.split[1] === props.win.id),
);
const app = computed(() => os.DATA.APP[s.value.appId!]);
const TOP = 32,
	GAP = 1;

// "Frappe card" frame: a constant hairline ring (ring-1 ring-black/10) folded into
// the box-shadow — an inline box-shadow would otherwise override Tailwind's ring —
// plus a focus-dependent contained drop shadow.
const RING = "0 0 0 1px rgba(0,0,0,0.1)";
const SHADOW_ACTIVE = `${RING}, 0 16px 40px -16px rgba(20,16,50,0.45), 0 4px 12px -6px rgba(0,0,0,0.25)`;
const SHADOW_INACTIVE = `${RING}, 0 10px 28px -18px rgba(20,16,50,0.35)`;

// Only the runtime geometry lives inline (arbitrary px from the drag/resize store,
// focus-dependent border/shadow). The static box — absolute/flex/col/bg/overflow —
// is Tailwind on the root element.
const styleWin = computed(() => {
	const dw = os.deskRef.w || 1280;
	if (inSplit.value) {
		const isLeft = os.state.split![0] === props.win.id;
		const half = Math.floor((dw - GAP) / 2);
		const left = isLeft ? 0 : half + GAP;
		return `left:${left}px;top:${TOP}px;width:${half}px;bottom:0;z-index:${g.value.z};border:none;`;
	}
	if (g.value.max)
		return `left:0;top:${TOP}px;right:0;bottom:0;z-index:${g.value.z};border:none;`;
	return `border-radius:10px;left:${g.value.x}px;top:${g.value.y}px;width:${g.value.w}px;height:${g.value.h}px;z-index:${g.value.z};box-shadow:${focused.value ? SHADOW_ACTIVE : SHADOW_INACTIVE};`;
});
const resizable = computed(() => !g.value.max && !inSplit.value);

// view model for app windows: `mode` is the surface's built-in view name.
const mode = computed(() => s.value.view);
const showSidebar = computed(() => !os.state.sidebarHidden[props.win.id]);

// view props for DoctypeView (each view fetches its own list/doc/field-schema from the store)
const viewProps = computed<ViewProps>(() => {
	const dt = s.value.doctype!;
	const base = {
		doctype: dt,
		recordName: s.value.recordName,
		meta: dt ? os.getMeta(dt) : null,
		presence: os.presenceFor(s.value).map((p) => ({ label: p.label })),
	};
	if (role.value === "record") return { ...base, view: "form" };
	return {
		...base,
		view: mode.value,
		onOpen: (d, name) => os.openRecordInline(props.win.id, d, name),
		onNew: (d) => os.openNew(props.win.id, d),
		onCreated: (d, name) => os.openRecordInline(props.win.id, d, name),
	};
});
</script>

<template>
	<div
		v-show="!g.min"
		:data-win-id="win.id"
		class="absolute flex flex-col overflow-hidden bg-surface-base"
		:style="styleWin"
		@pointerdown="os.focusWin(win.id)"
	>
		<!-- ===== APPLET WINDOW (ADR-0012 polymorphic surface) ===== -->
		<template v-if="isApplet">
			<WindowChrome :win="win" :title="app.name" :logo="app.logo" />
			<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
				<component :is="resolved" v-if="resolved" v-bind="applet.props" />
			</div>
		</template>

		<!-- ===== APP WINDOW ===== -->
		<template v-else-if="role === 'app'">
			<WindowChrome :win="win">
				<AppToolbar :win="win" />
			</WindowChrome>
			<div class="flex min-h-0 flex-1 bg-surface-base">
				<AppSidebar v-if="showSidebar" :win="win" />
				<div class="flex min-w-0 flex-1 flex-col">
					<AppDashboard v-if="mode === 'dashboard'" :win="win" />
					<DoctypeView v-else v-bind="viewProps" />
				</div>
			</div>
		</template>

		<!-- ===== SETTINGS WINDOW ===== -->
		<template v-else-if="role === 'settings'">
			<WindowChrome :win="win" :title="`${app.name} settings`" :logo="app.logo" />
			<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
				<SettingsDialog :win="win" />
			</div>
		</template>

		<!-- ===== WALLPAPER WINDOW (singleton system pane) ===== -->
		<template v-else-if="role === 'wallpaper'">
			<WindowChrome :win="win" title="Wallpaper" :logo="app.logo" />
			<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
				<WallpaperPicker />
			</div>
		</template>

		<!-- ===== RECORD WINDOW ===== -->
		<template v-else>
			<WindowChrome :win="win" :title="s.recordName" :logo="app.logo" />
			<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
				<DoctypeView v-bind="viewProps" />
			</div>
		</template>

		<!-- resize handle -->
		<div
			v-if="resizable"
			@pointerdown="os.startResize(win.id, $event)"
			class="absolute bottom-px right-px z-[60] h-[18px] w-[18px] [cursor:nwse-resize]"
		></div>
	</div>
</template>
