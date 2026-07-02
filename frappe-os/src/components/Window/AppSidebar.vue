<script setup lang="ts">
// The app window's left sidebar: a Home entry (when the app has a dashboard) plus the app's
// modules, each listing its doctypes with a live record count. Counts load when the app
// window first renders / the app changes. Built on frappe-ui's Sidebar primitives
// (SidebarSection + SidebarItem) so item styling follows espresso.
import { computed, watch } from "vue";
import { SidebarItem } from "frappe-ui";
import { useOS } from "@/desktop";
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow, BuiltinSurface } from "@/surface/types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();
const ICON = os.DATA.ICON;
const s = computed(() => props.win.surface as BuiltinSurface);
const app = computed(() => os.DATA.APP[s.value.appId!]);
const mode = computed(() => s.value.view);

// Reshape each module into a labelled group of SidebarItems: the module name is the group
// label, its doctypes are SidebarItems (icon, live count as the suffix, active + click wired
// to the OS). We render the group ourselves (rather than frappe-ui's SidebarSection) so the
// per-row gap matches the design.
const navGroups = computed(() =>
	(app.value.modules || []).map((mod) => ({
		label: mod.name,
		items: mod.doctypes.map((dt) => {
			const m = os.getMeta(dt);
			const count = os.countFor(dt).data;
			return {
				label: dt,
				icon: m ? m.icon : ICON.table,
				suffix: count == null ? "" : String(count),
				isActive:
					(mode.value === "list" || mode.value === "form") && s.value.doctype === dt,
				onClick: () => os.openList(props.win.id, dt),
			};
		}),
	})),
);
// Live sidebar counts: one plain count per doctype the app exposes, loaded when the app
// window first renders / the app changes.
watch(
	() => s.value.appId,
	() => (app.value.modules || []).forEach((mod) => mod.doctypes.forEach((dt) => os.loadCount(dt))),
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
		<div v-for="grp in navGroups" :key="grp.label" class="flex flex-col gap-1">
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
