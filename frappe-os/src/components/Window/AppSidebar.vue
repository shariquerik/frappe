<script setup lang="ts">
// The app window's left sidebar. Three shapes, chosen by window identity (ADR-0042):
//   • a WORKBENCH window (its id carries a workspace) lists that workspace's derived doctypes —
//     a flat rail, sourced from the server (module → doctypes, exclusions, permission filter);
//   • a HUB window (plain id, app has seeded workspaces) lists the app's workspaces — each row
//     opens that workbench in a NEW window alongside (openWorkspace focuses-or-creates);
//   • a plain FALLBACK window (plain id, no seeded workspaces) lists the curated modules, each a
//     labelled group — the pre-workspace-data shape issue 06 retires.
// A Home entry (when the app has a dashboard) sits above any of them. Built on frappe-ui's
// SidebarItem so item styling follows espresso. Counts load when the window first renders / the
// app changes (a hub shows no counts — its rows are workspaces, not doctypes).
import { computed, watch } from "vue";
import { SidebarItem } from "frappe-ui";
import { useOS } from "@/desktop";
import { windowWorkspace } from "@/surface";
import { workbenchItems } from "./workbench-sidebar";
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow, BuiltinSurface } from "@/surface/types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();
const ICON = os.DATA.ICON;
const s = computed(() => props.win.surface as BuiltinSurface);
const app = computed(() => os.DATA.APP[s.value.appId!]);
const mode = computed(() => s.value.view);
// The workspace on the window's identity — set for a workbench, undefined for a plain/hub window.
const workspace = computed(() => windowWorkspace(props.win.id));

// One nav row for a doctype: icon (its display config, or a table fallback), live record count,
// active state, and a click that opens its list in this window.
function itemFor(dt: string) {
	const m = os.getMeta(dt);
	const count = os.countFor(dt).data;
	return {
		label: dt,
		icon: m ? m.icon : ICON.table,
		suffix: count == null ? "" : String(count),
		isActive: (mode.value === "list" || mode.value === "form") && s.value.doctype === dt,
		onClick: () => os.openList(props.win.id, dt),
	};
}

// WORKBENCH rail: the workspace's derived doctypes as a flat item list, read synchronously off the
// boot-delivered workspace data (ADR-0042, slice 05). workbenchItems skips any doctype it can't
// build a row for (with a console.warn), so one edge doctype never blanks the sidebar.
const workbenchNav = computed(() => {
	if (!workspace.value) return [];
	const names = os.workspaceDoctypes(app.value.id, workspace.value);
	return workbenchItems(names, itemFor);
});

// HUB rail: the app's seeded workspaces (ordered, labelled). Only a plain window whose app ships
// workspace data is a hub — a single-workspace app skips the hub (openApp opens its workbench
// directly), so a plain window with seeded data always has ≥2. Each row opens that workbench in a
// new window alongside; the is_default row is flagged so the primary workbench reads at a glance.
const hubWorkspaces = computed(() => (workspace.value ? [] : os.orderedWorkspaces(app.value.id)));
const isHub = computed(() => hubWorkspaces.value.length > 0);
function workspaceRow(w: { id: string; label: string; isDefault: boolean }) {
	return {
		label: w.label,
		icon: "lucide-layers",
		suffix: w.isDefault ? "Default" : "",
		onClick: () => os.openWorkspace(app.value.id, w.id),
	};
}
const hubItems = computed(() => hubWorkspaces.value.map(workspaceRow));

// PLAIN FALLBACK rail: the app's workspace groups (boot data, or curated modules when the app ships
// none — the fallback lives in the store's workspaceGroups), each a labelled group of doctype rows.
// Only when the window is neither a workbench nor a hub (an app that ships no seeded workspace data).
const navGroups = computed(() =>
	workspace.value || isHub.value
		? []
		: os.workspaceGroups(app.value.id).map((group) => ({
				label: group.label,
				items: group.doctypes.map(itemFor),
			})),
);

// Live counts, read off the boot-delivered doctype sets (ADR-0042, slice 05). A workbench counts
// its workspace's doctypes; the plain fallback counts every workspace-group doctype. A hub loads no
// counts — its rows are workspaces, not doctypes. Re-runs when the window's app or workspace changes
// (a workbench never changes identity, but the same component instance can be reused).
watch(
	[() => s.value.appId, workspace],
	([, ws]) => {
		if (ws) {
			os.workspaceDoctypes(app.value.id, ws).forEach((dt) => os.loadCount(dt));
		} else if (!isHub.value) {
			os.workspaceGroups(app.value.id).forEach((group) => group.doctypes.forEach((dt) => os.loadCount(dt)));
		}
	},
	{ immediate: true },
);
</script>

<template>
	<div
		class="flex w-60 flex-shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-outline-gray-1 bg-surface-sidebar p-2"
	>
		<SidebarItem
			v-if="app.hasDashboard"
			:label="app.dashTitle || 'Home'"
			icon="lucide-layout-grid"
			:isActive="mode === 'dashboard'"
			:onClick="() => os.goHome(win.id)"
		/>
		<!-- workbench: the workspace's doctypes, flat (ADR-0042) -->
		<template v-if="workspace">
			<SidebarItem
				v-for="it in workbenchNav"
				:key="it.label"
				:label="it.label"
				:icon="it.icon"
				:suffix="it.suffix"
				:isActive="it.isActive"
				:onClick="it.onClick"
			/>
		</template>
		<!-- hub: the app's workspaces; each opens its workbench in a new window (ADR-0042) -->
		<template v-else-if="isHub">
			<SidebarItem
				v-for="it in hubItems"
				:key="it.label"
				:label="it.label"
				:icon="it.icon"
				:suffix="it.suffix"
				:onClick="it.onClick"
			/>
		</template>
		<!-- plain fallback: curated modules, grouped (retired by issue 06) -->
		<div v-for="grp in navGroups" v-else :key="grp.label" class="flex flex-col gap-1">
			<div class="px-2 pt-4 pb-0.5 text-sm text-ink-gray-5">{{ grp.label }}</div>
			<SidebarItem
				v-for="it in grp.items"
				:key="it.label"
				:label="it.label"
				:icon="it.icon"
				:suffix="it.suffix"
				:isActive="it.isActive"
				:onClick="it.onClick"
			/>
		</div>
	</div>
</template>
