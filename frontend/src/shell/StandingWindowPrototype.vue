<!--
  PROTOTYPE (#46025), throwaway: stub standing windows beside the composer, dev only, behind
  `?proto=1`. Never merged; the build ticket rewrites it.
-->
<template>
	<div
		class="pointer-events-none fixed z-40 flex items-end"
		:style="rowStyle"
		data-standing-row
	>
		<template v-for="app in shown" :key="app.app">
			<!-- The open frame -->
			<FloatingWindow
				v-if="states[app.app] === 'open'"
				mode="docked"
				:minimizable="false"
				role="dialog"
				aria-modal="false"
				:aria-labelledby="`standing-title-${app.app}`"
				class="pointer-events-auto border border-outline-gray-2 shadow-2xl"
				:style="{ width: `${tweaks.width}px`, maxHeight: maxHeight }"
				:data-standing-window="app.app"
				@keydown.esc="tweaks.esc && minimise(app.app)"
			>
				<template #header>
					<div class="flex shrink-0 items-center gap-2 px-3 pt-3">
						<span
							class="size-4 shrink-0 text-ink-gray-5"
							:class="app.icon"
							aria-hidden="true"
						/>
						<span
							:id="`standing-title-${app.app}`"
							class="min-w-0 truncate text-base font-medium text-ink-gray-8"
							aria-live="polite"
						>
							{{ app.title }}
						</span>
						<div class="ml-auto flex shrink-0 items-center">
							<Tooltip v-for="act in app.actions" :key="act.label" :text="act.label">
								<Button
									:icon="act.icon"
									variant="ghost"
									:theme="act.theme"
									:label="act.label"
								/>
							</Tooltip>
							<span
								v-if="app.actions.length"
								class="mx-1 h-4 border-l border-outline-gray-2"
								aria-hidden="true"
							/>
							<Tooltip :text="__('Minimise')">
								<Button
									icon="lucide-minus"
									variant="ghost"
									:label="__('Minimise')"
									@click="minimise(app.app)"
								/>
							</Tooltip>
							<Tooltip v-if="closable(app)" :text="__('Close')">
								<Button icon="lucide-x" variant="ghost" :label="__('Close')" />
							</Tooltip>
						</div>
					</div>
				</template>
				<div class="p-3">
					<component :is="app.body" :tall="tweaks.tall" />
				</div>
			</FloatingWindow>

			<!-- The minimised form: a pill that fits its content -->
			<div
				v-else-if="tweaks.minimised === 'pill'"
				class="pointer-events-auto flex h-10 max-w-[400px] cursor-pointer items-center gap-2 rounded-full border border-outline-gray-2 bg-surface-elevation-1 pl-3.5 pr-1 shadow-2xl"
				:data-standing-minimised="app.app"
				@click="restore(app.app)"
			>
				<span class="size-4 shrink-0 text-ink-gray-5" :class="app.icon" aria-hidden="true" />
				<button
					type="button"
					class="min-w-0 truncate text-base font-medium text-ink-gray-8 focus:outline-none"
					aria-live="polite"
				>
					{{ app.title }}
				</button>
				<div class="flex shrink-0 items-center" @click.stop>
					<Tooltip v-for="act in app.actions" :key="act.label" :text="act.label">
						<Button
							:icon="act.icon"
							variant="ghost"
							:theme="act.theme"
							:label="act.label"
							class="!rounded-full"
						/>
					</Tooltip>
				</div>
			</div>

			<!-- The minimised form: a bar the width of the frame, the frame's header alone -->
			<div
				v-else
				class="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-6 border border-outline-gray-2 bg-surface-elevation-1 py-2 pl-3 pr-2 shadow-2xl"
				:style="{ width: `${tweaks.width}px` }"
				:data-standing-minimised="app.app"
				@click="restore(app.app)"
			>
				<span class="size-4 shrink-0 text-ink-gray-5" :class="app.icon" aria-hidden="true" />
				<button
					type="button"
					class="min-w-0 truncate text-base font-medium text-ink-gray-8 focus:outline-none"
					aria-live="polite"
				>
					{{ app.title }}
				</button>
				<div class="ml-auto flex shrink-0 items-center" @click.stop>
					<Tooltip v-for="act in app.actions" :key="act.label" :text="act.label">
						<Button :icon="act.icon" variant="ghost" :theme="act.theme" :label="act.label" />
					</Tooltip>
					<span
						v-if="app.actions.length"
						class="mx-1 h-4 border-l border-outline-gray-2"
						aria-hidden="true"
					/>
					<Tooltip :text="__('Restore')">
						<Button
							icon="lucide-chevron-up"
							variant="ghost"
							:label="__('Restore')"
							@click="restore(app.app)"
						/>
					</Tooltip>
					<Tooltip v-if="closable(app)" :text="__('Close')">
						<Button icon="lucide-x" variant="ghost" :label="__('Close')" />
					</Tooltip>
				</div>
			</div>
		</template>
	</div>

	<!-- Tweak panel (dev chrome, not part of the design) -->
	<div
		v-if="tweaks.panel"
		class="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-xs text-white shadow-xl"
	>
		<span class="font-semibold">#46025 prototype</span>
		<label v-for="(choices, key) in TWEAKS" :key="key" class="flex items-center gap-1">
			{{ key }}
			<select
				v-model="tweaks[key]"
				class="h-6 rounded-2 border-0 bg-gray-800 py-0 pl-1 pr-6 text-xs text-white"
			>
				<option v-for="choice in choices" :key="String(choice)" :value="choice">
					{{ choice }}
				</option>
			</select>
		</label>
		<label v-for="app in APPS" :key="app.app" class="flex items-center gap-1">
			{{ app.app }}
			<select
				v-model="states[app.app]"
				class="h-6 rounded-2 border-0 bg-gray-800 py-0 pl-1 pr-6 text-xs text-white"
			>
				<option v-for="state in ['closed', 'open', 'minimised']" :key="state">
					{{ state }}
				</option>
			</select>
		</label>
		<select
			class="h-6 rounded-2 border-0 bg-gray-800 py-0 pl-1 pr-6 text-xs text-white"
			@change="composer(($event.target as HTMLSelectElement).value)"
		>
			<option value="">composer…</option>
			<option>closed</option>
			<option>docked</option>
			<option>floating</option>
		</select>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { Avatar, Button, Textarea, Tooltip } from "frappe-ui";
import { FloatingWindow } from "frappe-ui/experimental";
import { __ } from "@/i18n";
import { COMMENT_WRITER } from "@/pages/record/composer/commentDraft";
import { closeComposer, openComposer } from "./composer";

const MARGIN = 24;

const query = new URLSearchParams(location.search);
const TWEAKS = {
	width: [240, 280, 400],
	tall: [false, true],
	gap: [8, 12],
	align: ["bottom", "baseline"],
	minimised: ["pill", "bar"],
	closable: [true, false],
	esc: [true, false],
	panel: [true, false],
} as const;
const tweaks = reactive<Record<string, any>>({
	width: Number(query.get("width") ?? 280),
	tall: query.get("tall") === "1",
	gap: Number(query.get("gap") ?? 12),
	align: query.get("align") ?? "bottom",
	minimised: query.get("minimised") ?? "pill",
	closable: query.get("closable") !== "0",
	esc: query.get("esc") !== "0",
	panel: query.get("panel") !== "0",
});

const CallBody = defineComponent({
	props: { tall: Boolean },
	setup: (props) => () =>
		h("div", { class: "flex flex-col gap-3" }, [
			h("div", { class: "flex items-center gap-3" }, [
				h(Avatar, { label: "Emma Williams", size: "2xl" }),
				h("div", { class: "min-w-0" }, [
					h("div", { class: "truncate text-base font-medium text-ink-gray-8" }, "Emma Williams"),
					h("div", { class: "truncate text-p-sm text-ink-gray-5" }, "+1 415 555 0142 · 04:12"),
				]),
			]),
			h(Textarea, { placeholder: __("Take a note…"), rows: 3 }),
			props.tall
				? h("div", { class: "flex flex-col gap-2" }, [
						h("div", { class: "text-sm font-medium text-ink-gray-5" }, "Earlier calls"),
						...[...EARLIER, ...EARLIER].map(([when, note]) =>
							h("div", { class: "flex flex-col gap-0.5 border-t border-outline-gray-1 pt-2" }, [
								h("div", { class: "text-sm text-ink-gray-5" }, when),
								h("div", { class: "text-p-sm text-ink-gray-8" }, note),
							])
						),
				  ])
				: null,
		]),
});

const EARLIER = [
	["28 Oct, 11:02 · 06:40", "Asked for the revised quote with the annual discount."],
	["24 Oct, 16:18 · 02:05", "Left a voicemail about the demo slot."],
	["21 Oct, 10:47 · 12:31", "Demo of the dispatch board; wants SSO and an audit log."],
	["17 Oct, 15:30 · 03:12", "Intro call, referred by Rohan at Northwind."],
	["14 Oct, 09:55 · 01:48", "Missed, called back the same day."],
	["10 Oct, 12:20 · 08:16", "Pricing for 40 seats, two warehouses."],
	["06 Oct, 17:04 · 04:59", "Wants the trial extended by a week."],
	["02 Oct, 11:41 · 05:22", "Follow-up on the security questionnaire."],
	["29 Sep, 14:13 · 07:03", "First discovery call with the operations team."],
];

const TimerBody = defineComponent({
	setup: () => () =>
		h("div", { class: "flex flex-col gap-1" }, [
			h("div", { class: "text-2xl font-semibold tabular-nums text-ink-gray-9" }, "00:24:13"),
			h("div", { class: "truncate text-p-sm text-ink-gray-5" }, "Site survey · Riverside Clinic"),
		]),
});

const APPS = [
	{
		app: "erpnext",
		icon: "lucide-timer",
		title: "Timesheet · TS-2026-00042",
		closable: true,
		actions: [
			{ label: "Pause", icon: "lucide-pause", theme: "gray" },
			{ label: "Stop", icon: "lucide-square", theme: "gray" },
		],
		body: TimerBody,
	},
	{
		app: "crm",
		icon: "lucide-phone",
		title: "Call · Emma Williams",
		closable: false,
		actions: [
			{ label: "Mute", icon: "lucide-mic-off", theme: "gray" },
			{ label: "Add note", icon: "lucide-notebook-pen", theme: "gray" },
			{ label: "Hang up", icon: "lucide-phone-off", theme: "red" },
		],
		body: CallBody,
	},
];

const states = reactive<Record<string, string>>({
	erpnext: query.get("erpnext") ?? "closed",
	crm: query.get("crm") ?? "open",
});
const shown = computed(() => APPS.filter((app) => states[app.app] !== "closed"));

// The CRM call is the one the closable switch drives; the timer is always closable.
function closable(app: (typeof APPS)[number]) {
	return app.app === "crm" ? tweaks.closable : app.closable;
}

function minimise(app: string) {
	states[app] = "minimised";
}

function restore(app: string) {
	states[app] = "open";
}

// The floating composer's box, polled: the stub has no hook into FloatingWindow's geometry.
const composerBox = ref<DOMRect | null>(null);
const viewport = reactive({ width: innerWidth, height: innerHeight });
let timer = 0;
onMounted(() => {
	timer = window.setInterval(measure, 100);
	measure();
});
onUnmounted(() => clearInterval(timer));

function measure() {
	viewport.width = innerWidth;
	viewport.height = innerHeight;
	const card = document.querySelector<HTMLElement>("[data-composer-window]");
	const floating = card && getComputedStyle(card).position === "fixed";
	composerBox.value = floating ? card.getBoundingClientRect() : null;
}

const bottom = computed(() => {
	const box = composerBox.value;
	return tweaks.align === "bottom" && box ? viewport.height - box.bottom : MARGIN;
});
const rowStyle = computed(() => {
	const box = composerBox.value;
	return {
		gap: `${tweaks.gap}px`,
		right: `${box ? viewport.width - box.left + tweaks.gap : MARGIN}px`,
		bottom: `${bottom.value}px`,
	};
});
const maxHeight = computed(() => `${viewport.height - bottom.value - MARGIN}px`);

const route = useRoute();

function composer(placement: string) {
	if (placement === "closed") return closeComposer();
	const [doctype, name] = recordOnPage();
	if (doctype && name) openComposer(doctype, name, COMMENT_WRITER, undefined, placement as any);
}

function recordOnPage(): [string, string] {
	const params = route.params as Record<string, string>;
	return [(window as any).__protoDoctype ?? params.doctype, params.name ?? params.docname];
}

Object.assign(window, { __proto: { tweaks, states, composer } });
</script>
