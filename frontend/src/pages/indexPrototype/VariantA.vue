<!--
  PROTOTYPE (#45253) variant A, "Launcher": a slim bar, a large centred filter box, and large
  borderless tiles centred on the page, as on a phone's home screen or desk v1's apps screen.
-->
<template>
	<div class="flex h-full flex-col bg-surface-base">
		<header class="flex h-14 shrink-0 items-center justify-between px-5">
			<div class="flex items-center gap-2 text-base font-medium text-ink-gray-8">
				<img :src="FRAMEWORK_LOGO" class="size-6" alt="" />
				{{ siteName }}
			</div>
			<PrototypeUserMenu v-slot="{ user }">
				<button
					type="button"
					class="flex rounded-full focus-visible:ring-0 focus-visible:focus-ring"
					:aria-label="user.full_name"
				>
					<Avatar :image="user.user_image" :label="user.full_name" size="lg" />
				</button>
			</PrototypeUserMenu>
		</header>

		<ScrollArea class="min-h-0 flex-1">
			<div class="mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-[12vh]">
				<TextInput
					ref="filterBox"
					v-model="query"
					size="lg"
					variant="subtle"
					class="w-full max-w-md"
					placeholder="Find an app"
					@keydown="onKeydown"
				>
					<template #prefix>
						<LucideSearch class="size-4 text-ink-gray-5" />
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
import { inject, ref } from "vue";
import { Avatar, Button, ScrollArea, Skeleton, TextInput } from "frappe-ui";
import type { Boot } from "@/boot";
import LucideSearch from "~icons/lucide/search";
import AppLogo from "./AppLogo.vue";
import PrototypeUserMenu from "./PrototypeUserMenu.vue";
import { useIndex } from "./useIndex";

const boot = inject<Boot>("boot")!;
const filterBox = ref(null);
const { apps, loading, query, matches, onKeydown } = useIndex(boot, filterBox);
const siteName = window.location.hostname;
const FRAMEWORK_LOGO = "/assets/frappe/images/frappe-framework-logo.svg";
</script>
