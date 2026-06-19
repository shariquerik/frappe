<script setup lang="ts">
// The app window's title-bar nav, rendered inside WindowChrome's default slot: sidebar
// toggle, back button, the breadcrumb trail, and the right-hand actions (presence avatars +
// the view's teleported New/Save/menu). Global search and app settings live only in the top
// MenuBar. Derives everything from the window's surface via the
// store. Styled on frappe-ui tokens; Button/Avatar come from frappe-ui.
import { computed, inject, shallowRef } from "vue";
import { Button, Avatar } from "frappe-ui";
import StatusPill from "@/components/StatusPill.vue";
import { useOS } from "@/desktop";
import { TOOLBAR_SLOT } from "./toolbar";
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel
// (its `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow, BuiltinSurface } from "@/surface/types";
import type { Crumb } from "./types";

const props = defineProps<{ win: OsWindow }>();
const os = useOS();
const s = computed(() => props.win.surface as BuiltinSurface);
const app = computed(() => os.DATA.APP[s.value.appId!]);
const mode = computed(() => s.value.view);

// Back is the window's authoritative nav history (not a stateless form->list->home
// guess): it pops whatever the user actually visited in this window.
const canBack = computed(() => !!(props.win.back && props.win.back.length));
function back() {
	os.winBack(props.win.id);
}

// The view body teleports its primary actions ("New"/"Save") into this zone, so the merged
// bar carries them alongside the breadcrumb instead of a second toolbar underneath.
const toolbarSlot = inject(TOOLBAR_SLOT, shallowRef<HTMLElement | null>(null));

// The live record count, shown as a badge on the doctype crumb in list mode (the old list
// toolbar's count moved here when the two bars merged). Null until the list view loads it.
const listCount = computed(() => {
	if (mode.value !== "list" || !s.value.doctype) return null;
	const c = os.countFor(s.value.doctype);
	return c.data == null ? null : c.data;
});

// The record's status, shown as a pill next to the form breadcrumb (the form's own title row
// merged up here, mirroring the list count). Read from the live record + curated meta themes.
const formStatus = computed(() => {
	if (mode.value !== "form" || !s.value.doctype || s.value.recordName === "new") return null;
	const meta = os.getMeta(s.value.doctype);
	const field = meta?.statusField;
	if (!field) return null;
	const record = os.recordObj(s.value.doctype, s.value.recordName!);
	const value = record?.[field];
	if (value == null) return null;
	return { value, theme: (meta?.statusThemes || {})[value] || "gray" };
});

const crumbs = computed(() => {
	const out: Crumb[] = [];
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
const barPresence = computed(() => os.presenceFor(s.value).map((p) => ({ label: p.label })));
</script>

<template>
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
		<span
			v-if="listCount != null"
			class="ml-0.5 flex-shrink-0 rounded-full bg-surface-gray-2 px-[7px] py-px text-[12px] text-ink-gray-4"
			>{{ listCount }}</span
		>
	</div>
	<StatusPill
		v-if="formStatus"
		:value="formStatus.value"
		:theme="formStatus.theme"
		class="flex-shrink-0"
	/>
	<div class="flex-1"></div>
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
	<!-- view body teleports its primary actions (New / Save / record menu) into here -->
	<div ref="toolbarSlot" class="flex flex-shrink-0 items-center gap-1.5" @pointerdown.stop></div>
</template>
