<script setup lang="ts">
// A desktop window — app window (unified title/toolbar bar + sidebar nav +
// dashboard/list/form body) or a record pop-out. The macOS chrome (traffic
// lights, drag/resize, split/maximize geometry) is custom, styled with frappe-ui
// CSS variable tokens; primitives (Button, Avatar) come from frappe-ui.
import { computed, provide, shallowRef, watch } from "vue";
import type { Component } from "vue";
import { Button, Avatar } from "frappe-ui";
import { useOS } from "@/store";
import { OS_KEY, tryGetOsApi } from "@/os-api";
import { resolveApplet as resolveOsApplet } from "@/store/registry";
import { DoctypeView } from "@/components/Views";
import { SettingsDialog } from "@/components/Settings";
import StatusPill from "@/components/StatusPill.vue";
import { windowRole } from "@/surface";
import type { BuiltinSurface, AppletSurface, Geo, OsWindow, Surface, ViewProps } from "@/types";
import type { Crumb } from "./types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();
const ICON = os.DATA.ICON;

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
	return `border-radius:12px;left:${g.value.x}px;top:${g.value.y}px;width:${g.value.w}px;height:${g.value.h}px;z-index:${g.value.z};border:1px solid ${focused.value ? "var(--outline-gray-4)" : "var(--outline-gray-2)"};box-shadow:${focused.value ? "var(--shadow-2xl)" : "var(--shadow-lg)"};`;
});
// The title bar is entirely static except the grab cursor (disabled when maximized/split),
// so it's Tailwind classes plus one conditional cursor utility — no inline style.
const barClass = computed(() => [
	"relative flex items-center gap-2 h-11 px-2.5 flex-shrink-0 select-none border-b border-outline-gray-1 bg-surface-gray-1",
	g.value.max || inSplit.value ? "cursor-default" : "cursor-grab",
]);
const resizable = computed(() => !g.value.max && !inSplit.value);

// Reusable chrome traffic-light / control button classes (close / minimize / zoom).
const chromeBtn =
	"inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-gray-5";

// view model for app windows: `mode` is the surface's built-in view name.
const mode = computed(() => s.value.view);
const showSidebar = computed(() => !os.state.sidebarHidden[props.win.id]);
const navGroups = computed(() =>
	(app.value.modules || []).map((mod) => ({
		module: mod.name,
		items: mod.doctypes.map((dt) => {
			const m = os.getMeta(dt);
			const active =
				(mode.value === "list" || mode.value === "form") && s.value.doctype === dt;
			const count = os.countFor(dt).data;
			return {
				label: dt,
				icon: m ? m.icon : ICON.table,
				count: count == null ? "" : count,
				active,
			};
		}),
	})),
);
// Live sidebar counts: one plain count per doctype the app exposes, loaded when the
// app window first renders / the app changes.
watch(
	() => role.value === "app" && !isApplet.value && s.value.appId,
	() => {
		if (role.value !== "app" || isApplet.value) return;
		(app.value.modules || []).forEach((mod) => mod.doctypes.forEach((dt) => os.loadCount(dt)));
	},
	{ immediate: true },
);
const crumbs = computed(() => {
	const out: Crumb[] = [];
	if (role.value === "record") return out;
	if (app.value.hasDashboard)
		out.push({
			label: app.value.dashTitle || "Home",
			clickable: mode.value !== "dashboard",
			go: () => os.goHome(props.win.id),
		});
	if (mode.value === "list" || mode.value === "form")
		out.push({
			label: s.value.doctype,
			clickable: mode.value === "form",
			go: () => os.openList(props.win.id, s.value.doctype!),
		});
	if (mode.value === "form") {
		if (s.value.recordName === "new") {
			out.push({ label: "New " + s.value.doctype, clickable: false });
		} else {
			const r = os.recordObj(s.value.doctype!, s.value.recordName!);
			const m = os.getMeta(s.value.doctype!);
			out.push({
				label: (r && (r[m?.titleField || ""] || r.name)) || s.value.recordName!,
				clickable: false,
			});
		}
	}
	return out;
});
// Back is the window's authoritative nav history (not a stateless form->list->home
// guess): it pops whatever the user actually visited in this window.
const canBack = computed(() => !!(props.win.back && props.win.back.length));
function back() {
	os.winBack(props.win.id);
}
function popOutCurrent() {
	os.popOut(s.value.doctype!, s.value.recordName!);
}
function openAppSettings() {
	os.openSettings(s.value.appId!);
}

// view props for DoctypeView (each view fetches its own list/doc/field-schema from the store)
const viewProps = computed<ViewProps>(() => {
	if (role.value === "record") {
		const dt = s.value.doctype!;
		return {
			doctype: dt,
			view: "form",
			recordName: s.value.recordName,
			meta: os.getMeta(dt),
			presence: os.presenceFor(s.value).map((p) => ({ label: p.label })),
		};
	}
	const dt = s.value.doctype!;
	return {
		doctype: dt,
		view: mode.value,
		recordName: s.value.recordName,
		meta: dt ? os.getMeta(dt) : null,
		presence: os.presenceFor(s.value).map((p) => ({ label: p.label })),
		onOpen: (d, name) => os.openRecordInline(props.win.id, d, name),
		onNew: (d) => os.openNew(props.win.id, d),
		onCreated: (d, name) => os.openRecordInline(props.win.id, d, name),
	};
});
const barPresence = computed(() => viewProps.value.presence);

// dashboard data
const greeting = computed(() => "Good afternoon, " + (os.state.userName || "Faris").split(" ")[0]);
const dateLine = computed(
	() => os.clockText.value.replace(/\s\d.*$/, "") + " · " + app.value.name,
);
// Dashboard cards: curated label/sub from config, value live from card_value (count,
// or a sum when the card names a fieldname). Recents: the app's recentDoctype, newest
// first, off the live list cache. Both load when the dashboard renders / the app changes.
function formatValue(value: unknown) {
	const n = Number(value);
	return isFinite(n) ? n.toLocaleString() : String(value);
}
const stats = computed(() =>
	(app.value.cards || []).map((card) => {
		const value = os.countFor(card.doctype, card.filters, card.fieldname).data;
		const m = os.getMeta(card.doctype);
		return {
			label: card.label,
			sub: card.sub,
			doctype: card.doctype,
			icon: m?.icon || ICON.table,
			value: value == null ? "—" : formatValue(value),
		};
	}),
);
const recents = computed(() => {
	const rd = app.value.recentDoctype,
		rm = os.getMeta(rd);
	if (!rm) return [];
	return (os.listFor(rd).data || []).slice(0, 6).map((r) => {
		const stv = r[rm.statusField || ""];
		return {
			title: r[rm.titleField] || r.name,
			sub: rd + " · " + r.name,
			icon: rm.icon,
			status: stv,
			theme: (rm.statusThemes || {})[stv] || "gray",
			when: (r.modified || "").slice(0, 10),
			name: r.name,
			rd,
		};
	});
});
watch(
	() => role.value === "app" && mode.value === "dashboard" && s.value.appId,
	() => {
		if (role.value !== "app" || mode.value !== "dashboard") return;
		(app.value.cards || []).forEach((card) =>
			os.loadCount(card.doctype, card.filters, card.fieldname),
		);
		if (app.value.recentDoctype) os.loadList(app.value.recentDoctype);
	},
	{ immediate: true },
);
const actions = computed(() =>
	(app.value.modules[0].doctypes || []).slice(0, 4).map((dt) => ({ label: "New " + dt, dt })),
);
const team = computed(() => {
	const dots: Record<string, string> = {
		"Faris Ansari": "var(--surface-green-5)",
		"Aditya N": "var(--surface-green-5)",
		"Hussain R": "var(--outline-gray-3)",
		"Riya Sharma": "var(--surface-amber-5)",
	};
	return [
		{ name: "Faris Ansari", role: "System Manager" },
		{ name: "Aditya N", role: "Sales Manager" },
		{ name: "Riya Sharma", role: "Support Lead" },
		{ name: "Hussain R", role: "Finance" },
	].map((t) => ({ ...t, dot: dots[t.name] || "var(--outline-gray-3)" }));
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
		<!-- ===== COMPONENT WINDOW (ADR-0012 polymorphic surface) ===== -->
		<template v-if="isApplet">
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
				<img
					v-if="app.logo"
					:src="app.logo"
					alt=""
					class="h-[17px] w-[17px] flex-shrink-0 rounded object-contain"
				/>
				<span
					class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold"
					:class="focused ? 'text-ink-gray-8' : 'text-ink-gray-5'"
					>{{ app.name }}</span
				>
				<span class="flex-1"></span>
			</div>
			<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
				<component :is="resolved" v-if="resolved" v-bind="applet.props" />
			</div>
		</template>

		<!-- ===== APP WINDOW ===== -->
		<template v-else-if="role === 'app'">
			<div
				:class="barClass"
				@pointerdown="os.startDrag(win.id, $event)"
				@dblclick="os.toggleZoom(win.id)"
			>
				<!-- traffic lights -->
				<span class="mr-1 flex flex-shrink-0 items-center gap-0.5" @pointerdown.stop>
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
				<span class="mr-0.5 h-[18px] w-px flex-shrink-0 bg-[var(--outline-gray-2)]"></span>
				<button
					class="inline-flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-ink-gray-5"
					title="Toggle sidebar"
					@click="os.toggleSidebar(win.id)"
					@pointerdown.stop
				>
					<span class="lucide-panel-left size-[16px]"></span>
				</button>
				<button
					v-if="canBack"
					class="inline-flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-outline-gray-2 bg-surface-base text-ink-gray-6"
					title="Back"
					@click="back"
					@pointerdown.stop
				>
					<span class="lucide-chevron-left size-[15px]"></span>
				</button>
				<!-- breadcrumbs -->
				<div class="flex min-w-0 items-center gap-1.5 overflow-hidden" @pointerdown.stop>
					<template v-for="(cr, ci) in crumbs" :key="ci">
						<span
							v-if="ci > 0"
							class="lucide-chevron-right size-[13px] text-ink-gray-3 flex-shrink-0"
						></span>
						<span
							@click="cr.clickable && cr.go && cr.go()"
							class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
							:class="
								cr.clickable
									? 'cursor-pointer font-normal text-ink-gray-6'
									: 'cursor-default font-semibold text-ink-gray-9'
							"
							>{{ cr.label }}</span
						>
					</template>
				</div>
				<div class="flex-1"></div>
				<Button
					v-if="mode === 'form'"
					variant="subtle"
					size="sm"
					label="Pop out"
					@click="popOutCurrent"
					@pointerdown.stop
				>
					<template #prefix
						><span class="lucide-external-link size-[13px]"></span
					></template>
				</Button>
				<Button
					variant="subtle"
					size="sm"
					title="Search"
					@click="os.openPalette()"
					@pointerdown.stop
				>
					<span class="lucide-search size-[14px]"></span>
				</Button>
				<div class="flex flex-shrink-0 items-center" @pointerdown.stop>
					<Avatar
						v-for="(p, i) in barPresence"
						:key="i"
						:label="p.label"
						size="sm"
						:title="p.label"
						class="-ml-1.5 shadow-[0_0_0_2px_var(--surface-gray-1)]"
					/>
				</div>
				<Button
					variant="subtle"
					size="sm"
					title="App settings"
					@click="openAppSettings"
					@pointerdown.stop
				>
					<span class="lucide-settings size-[15px]"></span>
				</Button>
			</div>
			<!-- body -->
			<div class="flex min-h-0 flex-1 bg-surface-base">
				<!-- sidebar -->
				<div
					v-if="showSidebar"
					class="flex w-[228px] flex-shrink-0 flex-col overflow-hidden border-r border-outline-gray-1 bg-surface-gray-1"
				>
					<div class="flex-1 overflow-auto px-2 py-2.5">
						<div
							v-if="app.hasDashboard"
							class="mb-0.5 flex h-8 cursor-pointer items-center gap-2.5 rounded-[7px] px-[9px]"
							@click="os.goHome(win.id)"
							:class="
								mode === 'dashboard'
									? 'bg-surface-gray-3 font-semibold text-ink-gray-9'
									: 'font-normal text-ink-gray-7'
							"
						>
							<span class="lucide-layout-grid size-[15px] flex-shrink-0"></span>
							<span class="text-[13px]">{{ app.dashTitle || "Home" }}</span>
						</div>
						<div v-for="(grp, gi) in navGroups" :key="gi" class="mt-[14px]">
							<div class="mb-1 px-2 text-[11px] font-semibold text-ink-gray-5">
								{{ grp.module }}
							</div>
							<div
								v-for="(it, ii) in grp.items"
								:key="ii"
								class="my-px flex h-[30px] cursor-pointer items-center gap-2.5 rounded-[7px] px-[9px]"
								@click="os.openList(win.id, it.label)"
								:class="it.active ? 'bg-surface-gray-3' : ''"
							>
								<span
									:class="it.icon"
									class="size-[15px] text-ink-gray-5 flex-shrink-0"
								></span>
								<span
									class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
									:class="
										it.active
											? 'font-semibold text-ink-gray-9'
											: 'font-normal text-ink-gray-7'
									"
									>{{ it.label }}</span
								>
								<span
									class="ml-auto flex-shrink-0 text-[11px] tabular-nums text-ink-gray-4"
									>{{ it.count }}</span
								>
							</div>
						</div>
					</div>
				</div>
				<!-- content -->
				<div class="flex min-w-0 flex-1 flex-col">
					<!-- DASHBOARD -->
					<div
						v-if="mode === 'dashboard'"
						class="flex-1 overflow-auto px-[30px] pb-[34px] pt-[26px]"
					>
						<div class="mb-[3px] text-[12px] text-ink-gray-5">{{ dateLine }}</div>
						<div
							class="mb-[22px] text-[23px] font-semibold tracking-[-0.01em] text-ink-gray-9"
						>
							{{ greeting }}
						</div>
						<div class="mb-6 grid grid-cols-4 gap-[14px]">
							<div
								v-for="(st, i) in stats"
								:key="i"
								class="flex cursor-pointer flex-col gap-[9px] rounded-[11px] border border-outline-gray-2 bg-surface-base px-4 py-[15px] shadow-[var(--shadow-sm)]"
								@click="os.openList(win.id, st.doctype)"
							>
								<div class="flex items-center justify-between">
									<span class="text-[12px] text-ink-gray-6">{{ st.label }}</span>
									<span
										:class="st.icon"
										class="size-[15px] text-ink-gray-4"
									></span>
								</div>
								<div
									class="text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink-gray-9"
								>
									{{ st.value }}
								</div>
								<div class="text-[11.5px] text-ink-gray-5">{{ st.sub }}</div>
							</div>
						</div>
						<div class="grid gap-[18px] [grid-template-columns:1.6fr_1fr]">
							<div
								class="overflow-hidden rounded-[11px] border border-outline-gray-2 bg-surface-base"
							>
								<div
									class="flex items-center justify-between border-b border-outline-gray-1 px-4 py-[13px]"
								>
									<span class="text-[13px] font-semibold text-ink-gray-8"
										>Recent activity</span
									>
									<span
										class="inline-flex items-center gap-1.5 text-[11px] text-ink-green-7"
										><span
											class="h-1.5 w-1.5 rounded-full bg-surface-green-5"
										></span
										>Live</span
									>
								</div>
								<div
									v-for="(r, i) in recents"
									:key="i"
									class="flex cursor-pointer items-center gap-2.5 border-b border-outline-gray-1 px-4 py-2.5"
									@click="os.openRecordInline(win.id, r.rd, r.name)"
								>
									<span
										class="inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-surface-gray-2 text-ink-gray-6"
										><span :class="r.icon" class="size-[15px]"></span
									></span>
									<div class="flex min-w-0 flex-1 flex-col gap-0.5">
										<span
											class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-ink-gray-8"
											>{{ r.title }}</span
										>
										<span
											class="overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-ink-gray-5"
											>{{ r.sub }}</span
										>
									</div>
									<StatusPill
										v-if="r.status != null"
										:value="r.status"
										:theme="r.theme"
									/>
									<span
										class="w-14 flex-shrink-0 text-right text-[11px] text-ink-gray-4"
										>{{ r.when }}</span
									>
								</div>
							</div>
							<div class="flex flex-col gap-4">
								<div
									class="rounded-[11px] border border-outline-gray-2 bg-surface-base px-4 py-[14px]"
								>
									<div
										class="mb-[11px] text-[13px] font-semibold text-ink-gray-8"
									>
										Create
									</div>
									<div class="flex flex-col gap-2">
										<Button
											v-for="(ac, i) in actions"
											:key="i"
											variant="subtle"
											size="md"
											class="!justify-start"
											:label="ac.label"
											@click="os.openList(win.id, ac.dt)"
										>
											<template #prefix
												><span class="lucide-plus size-[14px]"></span
											></template>
										</Button>
									</div>
								</div>
								<div
									class="flex-1 rounded-[11px] border border-outline-gray-2 bg-surface-base px-4 py-[14px]"
								>
									<div
										class="mb-[11px] text-[13px] font-semibold text-ink-gray-8"
									>
										Your team
									</div>
									<div class="flex flex-col gap-3">
										<div
											v-for="(tm, i) in team"
											:key="i"
											class="flex items-center gap-2.5"
										>
											<Avatar :label="tm.name" size="sm" />
											<div class="flex min-w-0 flex-col">
												<span
													class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-ink-gray-8"
													>{{ tm.name }}</span
												><span class="text-[11px] text-ink-gray-4">{{
													tm.role
												}}</span>
											</div>
											<span
												class="ml-auto h-[7px] w-[7px] flex-shrink-0 rounded-full"
												:style="{ background: tm.dot }"
											></span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<!-- LIST / FORM -->
					<DoctypeView v-else v-bind="viewProps" />
				</div>
			</div>
		</template>

		<!-- ===== SETTINGS WINDOW ===== -->
		<template v-else-if="role === 'settings'">
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
				<img
					v-if="app.logo"
					:src="app.logo"
					alt=""
					class="h-[17px] w-[17px] flex-shrink-0 rounded object-contain"
				/>
				<span
					class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold"
					:class="focused ? 'text-ink-gray-8' : 'text-ink-gray-5'"
					>{{ app.name }} settings</span
				>
				<span class="flex-1"></span>
			</div>
			<div class="flex min-h-0 flex-1 flex-col bg-surface-base">
				<SettingsDialog :win="win" />
			</div>
		</template>

		<!-- ===== RECORD WINDOW ===== -->
		<template v-else>
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
				<img
					v-if="app.logo"
					:src="app.logo"
					alt=""
					class="h-[17px] w-[17px] flex-shrink-0 rounded object-contain"
				/>
				<span
					class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold"
					:class="focused ? 'text-ink-gray-8' : 'text-ink-gray-5'"
					>{{ s.recordName }}</span
				>
				<span class="flex-1"></span>
			</div>
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
