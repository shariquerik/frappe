<script setup lang="ts">
// The app window's title-bar nav, rendered inside WindowChrome's default slot: sidebar
// toggle, back button, the breadcrumb trail, and the right-hand actions (pop-out, search,
// presence avatars, app settings). Derives everything from the window's surface via the
// store. Styled on frappe-ui tokens; Button/Avatar come from frappe-ui.
import { computed } from "vue";
import { Button, Avatar } from "frappe-ui";
import { useOS } from "@/desktop";
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
function popOutCurrent() {
	os.popOut(s.value.doctype!, s.value.recordName!);
}
function openAppSettings() {
	os.openSettings(s.value.appId!);
}

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
		<template #prefix><span class="lucide-external-link size-[13px]"></span></template>
	</Button>
	<Button variant="subtle" size="sm" title="Search" @click="os.openPalette()" @pointerdown.stop>
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
</template>
