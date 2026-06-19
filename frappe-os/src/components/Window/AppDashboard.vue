<script setup lang="ts">
// The app window's dashboard body: a greeting, a 4-up stat-card grid, a live "Recent
// activity" feed, a Create action list, and the team panel. Card/recent definitions are
// curated config; the values are live from the store, loaded when the dashboard renders /
// the app changes. Styled on frappe-ui tokens; Button/Avatar come from frappe-ui.
//
// NOTE (architecture-review §3 item 4): `greeting` and `team` still hold hardcoded "Faris"
// demo data — moved here verbatim from OSWindow. They should come from boot/session; left
// untouched here to keep this change a pure structural split.
import { computed, watch } from "vue";
import { Button, Avatar } from "frappe-ui";
import { useOS } from "@/desktop";
import StatusPill from "@/components/StatusPill.vue";
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow, BuiltinSurface } from "@/surface/types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();
const ICON = os.DATA.ICON;
const s = computed(() => props.win.surface as BuiltinSurface);
const app = computed(() => os.DATA.APP[s.value.appId!]);

const greeting = computed(() => "Good afternoon, " + (os.state.userName || "Faris").split(" ")[0]);
const dateLine = computed(
	() => os.clockText.value.replace(/\s\d.*$/, "") + " · " + app.value.name,
);
// Dashboard cards: curated label/sub from config, value live from card_value (count, or a
// sum when the card names a fieldname). Recents: the app's recentDoctype, newest first, off
// the live list cache. Both load when the dashboard renders / the app changes.
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
watch(
	() => s.value.appId,
	() => {
		(app.value.cards || []).forEach((card) =>
			os.loadCount(card.doctype, card.filters, card.fieldname),
		);
		if (app.value.recentDoctype) os.loadList(app.value.recentDoctype);
	},
	{ immediate: true },
);
</script>

<template>
	<div class="flex-1 overflow-auto px-[30px] pb-[34px] pt-[26px]">
		<div class="mb-[3px] text-[12px] text-ink-gray-5">{{ dateLine }}</div>
		<div class="mb-[22px] text-[23px] font-semibold tracking-[-0.01em] text-ink-gray-9">
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
					<span :class="st.icon" class="size-[15px] text-ink-gray-4"></span>
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
			<div class="overflow-hidden rounded-[11px] border border-outline-gray-2 bg-surface-base">
				<div
					class="flex items-center justify-between border-b border-outline-gray-1 px-4 py-[13px]"
				>
					<span class="text-[13px] font-semibold text-ink-gray-8">Recent activity</span>
					<span class="inline-flex items-center gap-1.5 text-[11px] text-ink-green-7"
						><span class="h-1.5 w-1.5 rounded-full bg-surface-green-5"></span>Live</span
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
					<StatusPill v-if="r.status != null" :value="r.status" :theme="r.theme" />
					<span class="w-14 flex-shrink-0 text-right text-[11px] text-ink-gray-4">{{
						r.when
					}}</span>
				</div>
			</div>
			<div class="flex flex-col gap-4">
				<div
					class="rounded-[11px] border border-outline-gray-2 bg-surface-base px-4 py-[14px]"
				>
					<div class="mb-[11px] text-[13px] font-semibold text-ink-gray-8">Create</div>
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
					<div class="mb-[11px] text-[13px] font-semibold text-ink-gray-8">Your team</div>
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
								><span class="text-[11px] text-ink-gray-4">{{ tm.role }}</span>
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
</template>
