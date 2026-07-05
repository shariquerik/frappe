<script setup lang="ts">
// A desktop window — the thin dispatcher. This file owns only the macOS geometry (drag/
// resize/split/maximize → `styleWin`) and the window-type branch; the title bar
// (WindowChrome), the app nav (AppToolbar/AppSidebar) and the dashboard body (AppDashboard)
// are extracted siblings. App bodies (list/form) render through DoctypeView, settings through
// AppSettings, and applet-backed surfaces (ADR-0012) through a resolved component.
import { computed, provide, shallowRef, watch } from "vue";
import type { Component } from "vue";
import { useOS } from "@/desktop";
import { OS_KEY, tryGetOsApi } from "@/data/os-api";
import { resolveApplet as resolveOsApplet } from "@/registry";
import { DoctypeView } from "@/components/Views";
import { AppSettings, Settings } from "@/components/Settings";
import { Finder } from "@/components/Finder";
import WindowChrome from "./WindowChrome.vue";
import AppToolbar from "./AppToolbar.vue";
import { TOOLBAR_SLOT, WINDOW_FOCUSED } from "@/components/window-chrome";
import { WORKING_STATE_CONTEXT } from "@/desktop/use-working-state";
import AppSidebar from "./AppSidebar.vue";
import AppDashboard from "./AppDashboard.vue";
import EmptyAppPane from "./EmptyAppPane.vue";
import AspectRail from "./AspectRail.vue";
import AspectPane from "./AspectPane.vue";
import { windowRole, sidebarKind, DEFAULT_ASPECT, aspectById } from "@/surface";
// OsWindow feeds defineProps, so these come from concrete modules, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see DoctypeView.vue).
import type { BuiltinSurface, AppletSurface, Geo, OsWindow, Surface } from "@/surface/types";
import type { ResizeDir } from "@/desktop/geometry";
import type { ViewProps } from "@/config/types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();

// Window role (app/settings/system) is derived from the id; the surface is the content.
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
// Hand the focus state to the view body (the list "New" button quiets to subtle off-focus).
provide(WINDOW_FOCUSED, focused);

// The Working-state context (ADR-0029): this window's id + its live surface, so a mounted surface
// body (OSList/OSForm, later applets) reaches its per-window×subject working state via
// `useWorkingState` without threading props. `surf` is reactive, so the bound entry follows
// in-window navigation that keeps the body mounted (record→record on one doctype).
provide(WORKING_STATE_CONTEXT, { winId: props.win.id, surface: surf });
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
// Outline token (not a hardcoded black ring) so the frame stays visible in dark mode.
	const RING = "0 0 0 1px var(--outline-gray-2)";
const SHADOW_ACTIVE = `${RING}, 0 16px 40px -16px rgba(20,16,50,0.45), 0 4px 12px -6px rgba(0,0,0,0.25)`;
const SHADOW_INACTIVE = `${RING}, 0 10px 28px -18px rgba(20,16,50,0.35)`;

// Only the runtime geometry lives inline (arbitrary px from the drag/resize store,
// focus-dependent border/shadow). The static box — absolute/flex/col/bg/overflow —
// is Tailwind on the root element.
const styleWin = computed(() => {
	const dw = os.desktopRef.w || 1280;
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

// Rounding + clipping live on the inner content layer, but only for free-floating
// windows — maximized/split windows are flush, no corners.
const contentClass = computed(() => (g.value.max || inSplit.value ? "" : "rounded-[10px]"));

// Resize grips: 4 edge strips (z-50) under 4 corner squares (z-[60]) so the diagonal
// cursor wins at the overlaps. Each band straddles the border — 7px outside, 3px in —
// so the cursor appears mostly outside the window. `dir` is the edge mask the store
// resolves into x/y/w/h.
const resizeHandles: { dir: ResizeDir; cls: string }[] = [
	{ dir: "n", cls: "-top-[7px] inset-x-0 z-50 h-[10px] [cursor:ns-resize]" },
	{ dir: "s", cls: "-bottom-[7px] inset-x-0 z-50 h-[10px] [cursor:ns-resize]" },
	{ dir: "w", cls: "inset-y-0 -left-[7px] z-50 w-[10px] [cursor:ew-resize]" },
	{ dir: "e", cls: "inset-y-0 -right-[7px] z-50 w-[10px] [cursor:ew-resize]" },
	{ dir: "nw", cls: "-top-[7px] -left-[7px] z-[60] h-[16px] w-[16px] [cursor:nwse-resize]" },
	{ dir: "ne", cls: "-top-[7px] -right-[7px] z-[60] h-[16px] w-[16px] [cursor:nesw-resize]" },
	{ dir: "sw", cls: "-bottom-[7px] -left-[7px] z-[60] h-[16px] w-[16px] [cursor:nesw-resize]" },
	{ dir: "se", cls: "-bottom-[7px] -right-[7px] z-[60] h-[16px] w-[16px] [cursor:nwse-resize]" },
];

// view model for app windows: `mode` is the surface's built-in view name.
const mode = computed(() => s.value.view);
const showSidebar = computed(() => !os.state.sidebarHidden[props.win.id]);

// The window sidebar is surface-driven (ADR-0018): a form shows the Aspect rail (the record's
// Aspects), every other surface keeps the app nav rail (AppSidebar).
const sidebar = computed(() => sidebarKind(surf.value));

// Selected Aspect — a coordinate ON the form Surface (ADR-0018), so it is URL-addressable,
// restored on reload and stepped by browser back/forward. Absent = the default ('details').
const aspect = computed(() => (surf.value.kind === "builtin" && surf.value.aspect) || DEFAULT_ASPECT);
const activeAspect = computed(() => aspectById(aspect.value));
// A non-Details Aspect of a form swaps the main pane to its (placeholder) pane; Details and
// every non-form surface keep the generic DoctypeView / dashboard body.
const showAspectPane = computed(() => sidebar.value === "aspect" && aspect.value !== DEFAULT_ASPECT);

// view props for DoctypeView (each view fetches its own list/doc/field-schema from the store)
const viewProps = computed<ViewProps>(() => {
	const dt = s.value.doctype!;
	const base = {
		doctype: dt,
		recordName: s.value.recordName,
		meta: dt ? os.getMeta(dt) : null,
		presence: os.presenceFor(s.value).map((p) => ({ label: p.label })),
	};
	return {
		...base,
		view: mode.value,
		// Primary open (left-click): follows the user's row open-target preference (ADR-0018).
		onOpen: (d, name) => os.openRow(props.win.id, d, name),
		// Explicit same-window open (context-menu "Open") — always inline, ignores the preference.
		onOpenInline: (d, name) => os.openRecordInline(props.win.id, d, name),
		// "Open in New Window" (list-row menu): mint a fresh app instance already on the
		// record's form — an ordinary Instance, not a record-only window (ADR-0017).
		onOpenNewWindow: (d, name) => os.openRecordNewWindow(d, name),
		onNew: (d) => os.openNew(props.win.id, d),
		onCreated: (d, name) => os.openRecordInline(props.win.id, d, name),
	};
});
</script>

<template>
	<div
		v-show="!g.min"
		:data-win-id="win.id"
		class="absolute"
		:style="styleWin"
		@pointerdown="os.focusWin(win.id)"
	>
		<!-- Clipped content layer: rounding + overflow live here so the resize grips
		     (siblings below) can extend past the window edge without being clipped. -->
		<div
			class="absolute inset-0 flex flex-col overflow-hidden bg-surface-base"
			:class="contentClass"
		>
			<!-- ===== APPLET WINDOW (ADR-0012 polymorphic surface) ===== -->
			<!-- An applet shows the nav rail only when it opts in (ADR-0026 `nav` capability);
			     otherwise it is full-window (sidebar === 'none'). The choice is the applet's own,
			     orthogonal to native-vs-framed, and follows sidebarKind like every other surface —
			     geometry/focus/URL stay surface-agnostic. -->
			<template v-if="isApplet">
				<WindowChrome :win="win" :title="app.name" :logo="app.logo" />
				<div class="flex min-h-0 flex-1 bg-surface-base">
					<AppSidebar v-if="sidebar === 'nav' && showSidebar" :win="win" />
					<div class="flex min-w-0 flex-1 flex-col">
						<component :is="resolved" v-if="resolved" v-bind="applet.props" />
					</div>
				</div>
			</template>

			<!-- ===== APP WINDOW ===== -->
			<template v-else-if="role === 'app'">
				<WindowChrome :win="win">
					<AppToolbar :win="win" />
				</WindowChrome>
				<div class="flex min-h-0 flex-1 bg-surface-base">
					<!-- surface-driven sidebar (ADR-0018): Aspect rail for a form, nav rail otherwise -->
					<template v-if="showSidebar">
						<AspectRail v-if="sidebar === 'aspect'" :selected="aspect" @select="os.openAspect(win.id, $event)" />
						<AppSidebar v-else :win="win" />
					</template>
					<div class="flex min-w-0 flex-1 flex-col">
						<AppDashboard v-if="mode === 'dashboard'" :win="win" />
						<EmptyAppPane v-else-if="mode === 'empty'" :app-name="app.name" />
						<AspectPane v-else-if="showAspectPane && activeAspect" :aspect="activeAspect" />
						<DoctypeView v-else v-bind="viewProps" />
					</div>
				</div>
			</template>

			<!-- ===== SETTINGS WINDOW ===== -->
			<template v-else-if="role === 'settings'">
				<WindowChrome :win="win" :title="`${app.name} settings`" />
				<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
					<AppSettings :win="win" />
				</div>
			</template>

			<!-- ===== FINDER WINDOW (singleton system pane, ADR-0024) ===== -->
			<template v-else-if="role === 'system' && s.view === 'finder'">
				<WindowChrome :win="win" title="Finder" />
				<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
					<Finder :win="win" />
				</div>
			</template>

			<!-- ===== SETTINGS WINDOW (singleton per-user system pane) ===== -->
			<template v-else-if="role === 'system'">
				<WindowChrome :win="win" title="Settings" />
				<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
					<Settings :win="win" />
				</div>
			</template>
		</div>

		<!-- resize handles: 4 edges + 4 corners straddling the window border (mostly
		     outside it). Edges are thin strips, corners are squares stacked above them
		     (z order) so the diagonal cursor wins at the overlaps. -->
		<template v-if="resizable">
			<div
				v-for="h in resizeHandles"
				:key="h.dir"
				@pointerdown="os.startResize(win.id, h.dir, $event)"
				class="absolute"
				:class="h.cls"
			></div>
		</template>
	</div>
</template>
