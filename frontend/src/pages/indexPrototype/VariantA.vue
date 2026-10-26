<!--
  PROTOTYPE (#45253) variant A, "Launcher": no bar, a large centred filter box, and large
  borderless tiles centred on the page, as on a phone's home screen or desk v1's apps screen.
-->
<template>
	<div class="relative flex h-full flex-col bg-surface-base">
		<!-- No bar. `?avatar=` places the person's menu: the corner, the rail's foot, or around the box. -->
		<div v-if="place === 'corner'" class="absolute right-5 top-4 z-10">
			<PrototypeUserMenu v-slot="{ user }" :side="MENU_SIDE[place]" :align="MENU_ALIGN[place]">
				<button
					type="button"
					class="flex rounded-full focus-visible:ring-0 focus-visible:focus-ring"
					:aria-label="user.full_name"
				>
					<Avatar :image="user.user_image" :label="user.full_name" size="lg" />
				</button>
			</PrototypeUserMenu>
		</div>
		<!-- Where the rail draws it inside every app: 50px column, 11px side padding, 12px from the foot. -->
		<div v-else-if="place === 'rail'" class="absolute bottom-3 left-[11px] z-10">
			<PrototypeUserMenu v-slot="{ user }" :side="MENU_SIDE[place]" :align="MENU_ALIGN[place]">
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
			<div class="mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-[18vh]">
				<PrototypeUserMenu v-if="place === 'above'" v-slot="{ user }" side="bottom" align="center">
					<button
						type="button"
						class="mb-6 flex flex-col items-center gap-2 rounded-5 px-3 py-2 transition hover:bg-surface-gray-2 focus-visible:ring-0 focus-visible:focus-ring"
					>
						<Avatar :image="user.user_image" :label="user.full_name" size="3xl" />
						<span class="text-base font-medium text-ink-gray-8">{{ user.full_name }}</span>
					</button>
				</PrototypeUserMenu>

				<div v-if="place === 'inline'" class="flex w-full items-center gap-3" :style="{ maxWidth: boxWidth }">
					<TextInput
						ref="filterBox"
						v-model="query"
						size="lg"
						variant="subtle"
						class="min-w-0 flex-1"
						placeholder="Find an app"
						@keydown="onKeydown"
					>
						<template #prefix>
							<LucideSearch class="size-4 text-ink-gray-5" />
						</template>
					</TextInput>
					<PrototypeUserMenu v-slot="{ user }" side="bottom" align="end">
						<button
							type="button"
							class="flex shrink-0 rounded-full focus-visible:ring-0 focus-visible:focus-ring"
							:aria-label="user.full_name"
						>
							<Avatar :image="user.user_image" :label="user.full_name" size="2xl" />
						</button>
					</PrototypeUserMenu>
				</div>
				<TextInput
					v-else
					ref="filterBox"
					v-model="query"
					size="lg"
					variant="subtle"
					class="w-full"
					:style="{ maxWidth: boxWidth }"
					placeholder="Find an app"
					@keydown="onKeydown"
				>
					<template #prefix>
						<LucideSearch class="size-4 text-ink-gray-5" />
					</template>
					<template v-if="place === 'inside'" #suffix>
						<PrototypeUserMenu v-slot="{ user }" side="bottom" align="end">
							<button
								type="button"
								class="-mr-1 flex rounded-full focus-visible:ring-0 focus-visible:focus-ring"
								:aria-label="user.full_name"
								@mousedown.prevent
							>
								<Avatar :image="user.user_image" :label="user.full_name" size="md" />
							</button>
						</PrototypeUserMenu>
					</template>
				</TextInput>

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

				<div v-else-if="!matches.length" class="mt-16 flex flex-col items-center gap-3">
					<p class="text-base text-ink-gray-5">No app matches “{{ query }}”.</p>
					<Button label="Clear" @click="query = ''" />
				</div>

				<!-- As many columns as tiles, up to six, so a short row sits centred under the box. -->
				<ul
					v-else
					class="mt-12 grid gap-x-4 gap-y-6"
					:style="{ gridTemplateColumns: `repeat(${Math.min(matches.length, 6)}, 112px)` }"
				>
					<li v-for="(app, index) in matches" :key="app.app">
						<a
							:href="app.href"
							class="group flex flex-col items-center gap-2 rounded-5 p-2 outline-none transition hover:bg-surface-gray-2 focus-visible:focus-ring"
							:class="query && index === 0 ? 'bg-surface-gray-2' : ''"
						>
							<AppLogo
								:logo="app.logo"
								:title="app.title"
								:size="56"
								class="transition group-hover:scale-[1.04]"
							/>
							<span
								class="line-clamp-2 text-center text-sm leading-snug text-ink-gray-8"
								:title="app.title"
							>
								{{ app.title }}
							</span>
						</a>
					</li>
				</ul>
			</div>
		</ScrollArea>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { useRoute } from "vue-router";
import { Avatar, Button, ScrollArea, Skeleton, TextInput } from "frappe-ui";
import type { Boot } from "@/boot";
import LucideSearch from "~icons/lucide/search";
import AppLogo from "./AppLogo.vue";
import PrototypeUserMenu from "./PrototypeUserMenu.vue";
import { useIndex } from "./useIndex";

const boot = inject<Boot>("boot")!;
const filterBox = ref(null);
const { apps, loading, query, matches, onKeydown } = useIndex(boot, filterBox);

const route = useRoute();
const PLACES = ["corner", "rail", "inline", "above", "inside"] as const;
const place = computed(() => {
	const asked = route.query.avatar as (typeof PLACES)[number];
	return PLACES.includes(asked) ? asked : "rail";
});
// From the first logo's left edge to the last one's right edge: a tile is 112px with its 56px logo
// centred, so 28px in on each side. Never under three columns' span, so one or two apps still get a
// usable box. Off every app, not the matches, so typing does not resize the box under the cursor.
const TILE = 112;
const LOGO = 56;
const GAP = 16;
const boxWidth = computed(() => {
	const columns = Math.max(3, Math.min(apps.value.length, 6));
	return `${columns * TILE + (columns - 1) * GAP - (TILE - LOGO)}px`;
});

const MENU_SIDE = { corner: "bottom", rail: "right", inline: "bottom", above: "bottom", inside: "bottom" } as const;
const MENU_ALIGN = { corner: "end", rail: "end", inline: "end", above: "center", inside: "end" } as const;
</script>
