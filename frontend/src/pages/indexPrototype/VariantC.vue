<!--
  PROTOTYPE (#45253) variant C, "Greeting and rows": no bar chrome, a greeting with the person's name,
  the filter box as wide as the list, and compact row tiles (logo beside title) in a narrow column.
-->
<template>
	<div class="flex h-full flex-col bg-surface-gray-1">
		<header class="flex h-12 shrink-0 items-center justify-end px-4">
			<PrototypeUserMenu v-slot="{ user }">
				<button
					type="button"
					class="flex rounded-full focus-visible:ring-0 focus-visible:focus-ring"
					:aria-label="user.full_name"
				>
					<Avatar :image="user.user_image" :label="user.full_name" size="md" />
				</button>
			</PrototypeUserMenu>
		</header>

		<ScrollArea class="min-h-0 flex-1">
			<div class="mx-auto max-w-3xl px-6 pb-16 pt-10">
				<p class="text-sm text-ink-gray-5">{{ siteName }}</p>
				<h1 class="mt-1 text-2xl font-semibold text-ink-gray-9">
					{{ greeting }}, {{ firstName }}
				</h1>

				<TextInput
					ref="filterBox"
					v-model="query"
					size="md"
					variant="outline"
					class="mt-6"
					placeholder="Search apps"
					@keydown="onKeydown"
				>
					<template #prefix>
						<LucideSearch class="size-4 text-ink-gray-5" />
					</template>
					<template #suffix>
						<span v-if="query && matches.length" class="text-xs text-ink-gray-5">
							Enter opens {{ matches[0].title }}
						</span>
					</template>
				</TextInput>

				<div v-if="loading" class="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
					<div v-for="n in 6" :key="n" class="flex items-center gap-3 p-2.5">
						<Skeleton class="size-8 rounded-3" />
						<Skeleton class="h-3 w-24 rounded-2" />
					</div>
				</div>

				<p v-else-if="!apps.length" class="mt-8 text-base text-ink-gray-5">
					You have no apps to open. Ask your administrator for access.
				</p>

				<p v-else-if="!matches.length" class="mt-8 text-base text-ink-gray-5">
					No app is called “{{ query }}”. Press Esc to clear.
				</p>

				<ul v-else class="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
					<li v-for="(app, index) in matches" :key="app.app">
						<a
							:href="app.href"
							class="flex items-center gap-3 rounded-4 p-2.5 outline-none transition hover:bg-surface-gray-3 focus-visible:focus-ring"
							:class="query && index === 0 ? 'bg-surface-gray-3' : ''"
						>
							<AppLogo :logo="app.logo" :title="app.title" :size="32" />
							<span class="truncate text-base text-ink-gray-8" :title="app.title">
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
import { Avatar, ScrollArea, Skeleton, TextInput } from "frappe-ui";
import LucideSearch from "~icons/lucide/search";
import type { Boot } from "@/boot";
import AppLogo from "./AppLogo.vue";
import PrototypeUserMenu from "./PrototypeUserMenu.vue";
import { useIndex } from "./useIndex";

const boot = inject<Boot>("boot")!;
const filterBox = ref(null);
const { apps, loading, query, matches, onKeydown } = useIndex(boot, filterBox);
const siteName = window.location.hostname;
const firstName = boot.session.user.full_name.split(" ")[0];
const hour = new Date().getHours();
const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
</script>
