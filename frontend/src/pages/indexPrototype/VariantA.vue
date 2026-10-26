<!--
  PROTOTYPE (#45253) variant A, "Launcher": no bar, a large centred filter box, and large
  borderless tiles centred on the page. The person's menu sits where the rail draws it.
  `?extras=` switches on what else the page could hold; see `extras.ts`.
-->
<template>
	<div class="relative flex h-full flex-col bg-surface-base">
		<!-- Where the rail draws it inside every app: 50px column, 11px side padding, 12px from the foot. -->
		<div class="absolute bottom-3 left-[11px] z-10">
			<PrototypeUserMenu v-slot="{ user }" side="right" align="end" :extra="menuExtra">
				<button
					type="button"
					class="flex rounded-full focus-visible:ring-0 focus-visible:focus-ring"
					:aria-label="user.full_name"
				>
					<Avatar :image="user.user_image" :label="user.full_name" size="lg" />
				</button>
			</PrototypeUserMenu>
		</div>

		<ScrollArea class="min-h-0 flex-1">
			<div class="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-[18vh]">
				<Alert
					v-if="has('news') && !newsDismissed"
					class="mb-6 w-full"
					:style="{ maxWidth: boxWidth }"
					title="Desk v2 is here"
					description="Apps now open on the page you work in, not on a module page."
					:primary-action="{ label: 'What\'s new', onClick: () => {} }"
					dismissible
					@dismiss="newsDismissed = true"
				/>

				<TextInput
					ref="filterBox"
					v-model="query"
					size="lg"
					variant="subtle"
					class="w-full"
					:style="{ maxWidth: boxWidth }"
					:placeholder="has('create') ? 'Find an app, or type new…' : 'Find an app'"
					@keydown="onKeys"
				>
					<template #prefix>
						<LucideSearch class="size-4 text-ink-gray-5" />
					</template>
				</TextInput>

				<!-- Quick create: what the query names as a doctype, under the box. -->
				<ul
					v-if="creates.length"
					class="mt-2 flex w-full flex-col rounded-5 border border-outline-gray-1 p-1"
					:style="{ maxWidth: boxWidth }"
				>
					<li v-for="(doctype, index) in creates" :key="doctype.name">
						<ItemListRow
							as="a"
							href="#"
							size="md"
							:active="selectedCreate === index"
							@mouseenter="selectedCreate = index"
						>
							<template #prefix>
								<LucidePlus class="size-4 text-ink-gray-6" />
							</template>
							New {{ doctype.name }}
							<template #suffix>
								<span class="flex items-center gap-1.5 text-sm text-ink-gray-5">
									<AppLogo :logo="logoOf(doctype.app)" :title="doctype.app" :size="14" />
									{{ titleOf(doctype.app) }}
								</span>
							</template>
						</ItemListRow>
					</li>
				</ul>

				<Alert
					v-if="has('setup')"
					class="mt-6 w-full"
					:style="{ maxWidth: boxWidth }"
					theme="gray"
					title="Finish setting up ERPNext"
					description="3 of 7 steps done: your company, chart of accounts and first item."
					:primary-action="{ label: 'Continue setup', onClick: () => {} }"
				/>

				<!-- Arrange mode's own bar: what you can do, and the way out. -->
				<div
					v-if="editing"
					class="mt-6 flex w-full items-center justify-between rounded-5 bg-surface-gray-2 px-3 py-2"
					:style="{ maxWidth: boxWidth }"
				>
					<span class="text-sm text-ink-gray-7">Drag to reorder. Click the eye to hide an app.</span>
					<div class="flex gap-2">
						<Button label="Reset" variant="ghost" @click="resetArrangement" />
						<Button label="Done" variant="solid" @click="finishEditing" />
					</div>
				</div>

				<div
					v-if="loading"
					class="mt-12 grid grid-cols-[repeat(4,112px)] gap-x-4 gap-y-6"
				>
					<div v-for="n in 4" :key="n" class="flex flex-col items-center gap-2 p-2">
						<Skeleton class="size-14 rounded-5" />
						<Skeleton class="h-3 w-16 rounded-2" />
					</div>
				</div>

				<p v-else-if="!apps.length" class="mt-16 text-base text-ink-gray-5">
					No apps you can open yet.
				</p>

				<div v-else-if="!shown.length && !creates.length" class="mt-16 flex flex-col items-center gap-3">
					<p class="text-base text-ink-gray-5">No app matches “{{ query }}”.</p>
					<Button label="Clear" @click="query = ''" />
				</div>

				<Draggable
					v-else-if="editing"
					v-model="editList"
					item-key="app"
					tag="ul"
					class="mt-8 grid gap-x-4 gap-y-6"
					:style="gridStyle(editList.length)"
					:animation="150"
				>
					<template #item="{ element: app }">
						<li class="relative cursor-grab active:cursor-grabbing">
							<div
								class="flex flex-col items-center gap-2 rounded-5 p-2 transition"
								:class="hiddenDraft.has(app.app) ? 'opacity-35' : ''"
							>
								<AppLogo :logo="app.logo" :title="app.title" :size="56" />
								<span class="line-clamp-2 text-center text-sm leading-snug text-ink-gray-8">
									{{ app.title }}
								</span>
							</div>
							<button
								type="button"
								class="absolute right-3 top-1 flex size-6 items-center justify-center rounded-full bg-surface-white text-ink-gray-7 shadow ring-1 ring-outline-gray-2 hover:bg-surface-gray-2"
								:aria-label="hiddenDraft.has(app.app) ? `Show ${app.title}` : `Hide ${app.title}`"
								@click="toggleHidden(app.app)"
							>
								<LucideEyeOff v-if="!hiddenDraft.has(app.app)" class="size-3.5" />
								<LucideEye v-else class="size-3.5" />
							</button>
						</li>
					</template>
				</Draggable>

				<!-- As many columns as tiles, up to six, so a short row sits centred under the box. -->
				<ul v-else-if="shown.length" class="mt-12 grid gap-x-4 gap-y-6" :style="gridStyle(shown.length + (has('setup') ? 1 : 0))">
					<li v-for="(app, index) in shown" :key="app.app" class="group/tile relative">
						<Tooltip :text="resumeText(app)" :disabled="!resumeText(app)" side="bottom">
							<a
								:href="app.href"
								class="group flex flex-col items-center gap-2 rounded-5 p-2 outline-none transition hover:bg-surface-gray-2 focus-visible:focus-ring"
								:class="index === selected ? 'bg-surface-gray-2' : ''"
							>
								<span class="relative">
									<AppLogo
										:logo="app.logo"
										:title="app.title"
										:size="56"
										class="transition group-hover:scale-[1.04]"
									/>
									<span
										v-if="has('default') && defaultApp === app.app"
										class="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface-white text-ink-gray-8 shadow ring-1 ring-outline-gray-2"
										title="Your default app"
									>
										<LucideStar class="size-3 fill-current" />
									</span>
								</span>
								<span
									class="line-clamp-2 text-center text-sm leading-snug text-ink-gray-8"
									:title="app.title"
								>
									{{ app.title }}
								</span>
							</a>
						</Tooltip>

						<!-- A tile's own menu, on hover, for what applies to one app. -->
						<div
							v-if="tileMenu(app).length"
							class="absolute right-2 top-0 opacity-0 transition group-hover/tile:opacity-100 has-[[data-state=open]]:opacity-100"
						>
							<Dropdown :options="tileMenu(app)" side="bottom" align="end">
								<button
									type="button"
									class="flex size-6 items-center justify-center rounded-full bg-surface-white text-ink-gray-7 shadow ring-1 ring-outline-gray-2 hover:bg-surface-gray-2"
									:aria-label="`${app.title} options`"
								>
									<LucideEllipsis class="size-3.5" />
								</button>
							</Dropdown>
						</div>
					</li>

					<!-- With the setup nudge: a way to add apps, in the grid it would join. -->
					<li v-if="has('setup') && !query">
						<a
							href="#"
							class="flex flex-col items-center gap-2 rounded-5 p-2 outline-none transition hover:bg-surface-gray-2 focus-visible:focus-ring"
						>
							<span
								class="flex size-14 items-center justify-center rounded-[12px] border border-dashed border-outline-gray-3 text-ink-gray-5"
							>
								<LucidePlus class="size-5" />
							</span>
							<span class="text-center text-sm leading-snug text-ink-gray-6">Get more apps</span>
						</a>
					</li>
				</ul>

				<section
					v-if="has('pinned') && !query && !editing"
					class="mt-14 w-full"
					:style="{ maxWidth: boxWidth }"
				>
					<h2 class="mb-3 text-sm font-medium text-ink-gray-5">Pinned</h2>
					<div class="flex flex-wrap gap-2">
						<a
							v-for="pin in PINNED"
							:key="pin.label"
							href="#"
							class="inline-flex h-8 items-center gap-2 rounded-4 bg-surface-gray-2 px-2.5 text-sm text-ink-gray-8 transition hover:bg-surface-gray-3 focus-visible:focus-ring"
						>
							<AppLogo :logo="logoOf(pin.app)" :title="pin.app" :size="16" />
							{{ pin.label }}
						</a>
					</div>
				</section>

				<section
					v-if="has('recent') && !query && !editing"
					class="mt-10 w-full"
					:style="{ maxWidth: boxWidth }"
				>
					<h2 class="mb-2 text-sm font-medium text-ink-gray-5">Recent</h2>
					<ul class="flex flex-col">
						<li v-for="item in RECENT" :key="item.title">
							<ItemListRow as="a" href="#" size="lg">
								<template #prefix>
									<AppLogo :logo="logoOf(item.app)" :title="item.app" :size="20" />
								</template>
								<span class="flex min-w-0 items-baseline gap-2">
									<span class="truncate text-ink-gray-8">{{ item.title }}</span>
									<span class="shrink-0 text-sm text-ink-gray-5">{{ item.kind }}</span>
								</span>
								<template #suffix>
									<span class="text-sm text-ink-gray-5">{{ item.when }}</span>
								</template>
							</ItemListRow>
						</li>
					</ul>
				</section>
			</div>
		</ScrollArea>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import {
	Alert,
	Avatar,
	Button,
	Dropdown,
	ItemListRow,
	ScrollArea,
	Skeleton,
	TextInput,
	Tooltip,
	toast,
} from "frappe-ui";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import type { Boot } from "@/boot";
import LucideEllipsis from "~icons/lucide/ellipsis";
import LucideEye from "~icons/lucide/eye";
import LucideEyeOff from "~icons/lucide/eye-off";
import LucidePlus from "~icons/lucide/plus";
import LucideSearch from "~icons/lucide/search";
import LucideStar from "~icons/lucide/star";
import AppLogo from "./AppLogo.vue";
import PrototypeUserMenu from "./PrototypeUserMenu.vue";
import { DOCTYPES, PINNED, RECENT, RESUME, useExtras, type Extra } from "./extras";
import { useIndex, type Tile } from "./useIndex";

const boot = inject<Boot>("boot")!;
const filterBox = ref(null);
const { apps, loading, query } = useIndex(boot, filterBox);

const extras = useExtras();
const has = (extra: Extra) => extras.value.has(extra);

const newsDismissed = ref(false);

// The arrangement is in memory: persistence is a layer question the map has not settled.
const order = ref<string[]>([]);
const hidden = ref(new Set<string>());
const defaultApp = ref<string | null>(null);

const arranged = computed(() => {
	if (!order.value.length) return apps.value;
	const rank = (app: Tile) => {
		const at = order.value.indexOf(app.app);
		return at === -1 ? order.value.length : at;
	};
	return [...apps.value].sort((a, b) => rank(a) - rank(b));
});

const shown = computed(() => {
	const visible = arranged.value.filter((app) => !hidden.value.has(app.app));
	const needle = query.value.trim().toLowerCase();
	return needle ? visible.filter((app) => app.title.toLowerCase().includes(needle)) : visible;
});

// Quick create: "new inv", or just "invoice", names a doctype.
const creates = computed(() => {
	if (!has("create")) return [];
	const needle = query.value.trim().toLowerCase().replace(/^new\s*/, "");
	if (needle.length < 2) return [];
	return DOCTYPES.filter((doctype) => doctype.name.toLowerCase().includes(needle)).slice(0, 3);
});
const selectedCreate = ref(-1);

// Without arrow keys the first match is the one Enter opens; with them, the one you moved to.
const selected = ref(-1);
watch(query, () => {
	selected.value = query.value ? 0 : -1;
	selectedCreate.value = -1;
});

function onKeys(event: KeyboardEvent) {
	const count = shown.value.length;
	const columns = Math.min(count, 6);
	const moves: Record<string, number> = {
		ArrowRight: 1,
		ArrowLeft: -1,
		ArrowDown: columns,
		ArrowUp: -columns,
	};
	if (event.key === "Escape") {
		query.value = "";
	} else if (event.key === "Enter") {
		const target = shown.value[Math.max(selected.value, 0)];
		if (target) window.location.assign(target.href);
	} else if (has("keys") && event.key in moves && count) {
		event.preventDefault();
		const from = selected.value < 0 ? -moves[event.key] : selected.value;
		selected.value = Math.min(Math.max(from + moves[event.key], 0), count - 1);
	}
}

const editing = ref(false);
const editList = ref<Tile[]>([]);
const hiddenDraft = ref(new Set<string>());

function startEditing() {
	query.value = "";
	editList.value = [...arranged.value];
	hiddenDraft.value = new Set(hidden.value);
	editing.value = true;
}
function finishEditing() {
	order.value = editList.value.map((app) => app.app);
	hidden.value = new Set(hiddenDraft.value);
	editing.value = false;
}
function resetArrangement() {
	editList.value = [...apps.value];
	hiddenDraft.value = new Set();
}
function toggleHidden(app: string) {
	const next = new Set(hiddenDraft.value);
	if (next.has(app)) next.delete(app);
	else next.add(app);
	hiddenDraft.value = next;
}

const menuExtra = computed(() =>
	has("arrange") ? [{ label: "Arrange apps", icon: "lucide-layout-grid", onClick: startEditing }] : []
);

function tileMenu(app: Tile) {
	const options = [];
	if (has("default")) {
		const isDefault = defaultApp.value === app.app;
		options.push({
			label: isDefault ? "Stop opening by default" : "Open this app by default",
			icon: "lucide-star",
			onClick: () => {
				defaultApp.value = isDefault ? null : app.app;
				if (!isDefault) toast.success(`You will land in ${app.title} after you log in`);
			},
		});
	}
	if (has("arrange")) {
		options.push({
			label: "Hide",
			icon: "lucide-eye-off",
			onClick: () => {
				hidden.value = new Set([...hidden.value, app.app]);
			},
		});
	}
	return options;
}

function resumeText(app: Tile) {
	if (!has("resume")) return "";
	const where = RESUME[app.app];
	return where ? `Opens ${where}, where you left off` : "";
}

function logoOf(app: string) {
	return apps.value.find((tile) => tile.app === app)?.logo;
}
function titleOf(app: string) {
	return apps.value.find((tile) => tile.app === app)?.title ?? app;
}

// From the first logo's left edge to the last one's right edge: a tile is 112px with its 56px logo
// centred, so 28px in on each side. Never under three columns' span, so one or two apps still get a
// usable box. Off every app, not the matches, so typing does not resize the box under the cursor.
const TILE = 112;
const LOGO = 56;
const GAP = 16;
const boxWidth = computed(() => {
	const tiles = apps.value.length + (has("setup") ? 1 : 0);
	const columns = Math.max(3, Math.min(tiles, 6));
	return `${columns * TILE + (columns - 1) * GAP - (TILE - LOGO)}px`;
});

function gridStyle(count: number) {
	return { gridTemplateColumns: `repeat(${Math.min(Math.max(count, 1), 6)}, ${TILE}px)` };
}
</script>
