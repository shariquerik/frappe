<script setup lang="ts">
// The app window's left sidebar: a Home entry (when the app has a dashboard) plus the app's
// modules, each listing its doctypes with a live record count. Counts load when the app
// window first renders / the app changes. Styled on frappe-ui tokens.
import { computed, watch } from "vue";
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
					<span :class="it.icon" class="size-[15px] text-ink-gray-5 flex-shrink-0"></span>
					<span
						class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
						:class="
							it.active
								? 'font-semibold text-ink-gray-9'
								: 'font-normal text-ink-gray-7'
						"
						>{{ it.label }}</span
					>
					<span class="ml-auto flex-shrink-0 text-[11px] tabular-nums text-ink-gray-4">{{
						it.count
					}}</span>
				</div>
			</div>
		</div>
	</div>
</template>
