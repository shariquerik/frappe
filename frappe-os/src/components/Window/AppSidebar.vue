<script setup lang="ts">
// The app window's left sidebar. Two shapes, chosen by window identity (ADR-0042):
//   • a WORKBENCH window (its id carries a workspace) lists that workspace's derived doctypes —
//     a flat rail, sourced from the server (module → doctypes, exclusions, permission filter);
//   • a plain app / hub window lists the app's curated modules, each a labelled group.
// A Home entry (when the app has a dashboard) sits above either. Built on frappe-ui's SidebarItem
// so item styling follows espresso. Counts load when the window first renders / the app changes.
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

// WORKBENCH rail: the workspace's server-derived doctypes as a flat item list. workbenchItems
// skips any doctype it can't build a row for (with a console.warn), so one edge doctype never
// blanks the sidebar.
const workbenchNav = computed(() => {
	if (!workspace.value) return [];
	const names = os.workspaceDoctypesFor(app.value.id, workspace.value).data;
	return workbenchItems(names, itemFor);
});

// PLAIN / HUB rail: the curated modules, each a labelled group of doctype rows.
const navGroups = computed(() =>
	workspace.value
		? []
		: (app.value.modules || []).map((mod) => ({
				label: mod.name,
				items: mod.doctypes.map(itemFor),
			})),
);

// Live counts. A workbench fetches its derived doctype list first, then a count per doctype; a
// plain/hub window counts every curated module doctype. Re-runs when the window's app or workspace
// changes (a workbench never changes identity, but the same component instance can be reused).
watch(
	[() => s.value.appId, workspace],
	async ([, ws]) => {
		if (ws) {
			const state = await os.loadWorkspaceDoctypes(app.value.id, ws);
			state.data.forEach((dt) => os.loadCount(dt));
		} else {
			(app.value.modules || []).forEach((mod) => mod.doctypes.forEach((dt) => os.loadCount(dt)));
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
		<!-- plain / hub: curated modules, grouped -->
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
