<!--
  PROTOTYPE (#45253) variant B, "Header bar": an app-style bar that holds the filter box and the
  person, and bordered card tiles in a left-aligned page column under an "Apps" heading.
-->
<template>
	<div class="flex h-full flex-col bg-surface-base">
		<header
			class="flex h-12 shrink-0 items-center gap-4 border-b border-outline-gray-1 px-4"
		>
			<div class="flex w-48 items-center gap-2">
				<img :src="FRAMEWORK_LOGO" class="size-6" alt="" />
				<span class="truncate text-base font-semibold text-ink-gray-9">{{ siteName }}</span>
			</div>
			<div class="flex flex-1 justify-center">
				<TextInput
					ref="filterBox"
					v-model="query"
					size="sm"
					variant="subtle"
					class="w-full max-w-sm"
					placeholder="Filter apps"
					@keydown="onKeydown"
				>
					<template #prefix>
						<LucideSearch class="size-4 text-ink-gray-5" />
					</template>
					<template #suffix>
						<KeyboardShortcut v-if="query && matches.length" combo="Enter" bg />
					</template>
				</TextInput>
			</div>
			<div class="flex w-48 justify-end">
				<PrototypeUserMenu v-slot="{ user }">
					<button
						type="button"
						class="flex items-center gap-2 rounded-4 py-1 pl-1 pr-2 text-sm text-ink-gray-8 transition hover:bg-surface-gray-2 focus-visible:ring-0 focus-visible:focus-ring"
					>
						<Avatar :image="user.user_image" :label="user.full_name" size="md" />
						<span class="max-w-32 truncate">{{ user.full_name }}</span>
						<LucideChevronDown class="size-4 text-ink-gray-5" />
					</button>
				</PrototypeUserMenu>
			</div>
		</header>

		<ScrollArea class="min-h-0 flex-1">
			<div class="mx-auto max-w-5xl px-8 py-8">
				<h1 class="text-xl font-semibold text-ink-gray-9">Apps</h1>
				<p class="mt-1 text-sm text-ink-gray-5">
					{{ loading ? "Loading" : `${apps.length} you can open` }}
				</p>

				<div v-if="loading" class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					<div
						v-for="n in 5"
						:key="n"
						class="flex h-32 flex-col items-center justify-center gap-3 rounded-6 border border-outline-gray-1"
					>
						<Skeleton class="size-10 rounded-4" />
						<Skeleton class="h-3 w-16 rounded-2" />
					</div>
				</div>

				<div
					v-else-if="!apps.length"
					class="mt-6 flex h-40 flex-col items-center justify-center gap-1 rounded-6 border border-dashed border-outline-gray-2"
				>
					<p class="text-base font-medium text-ink-gray-7">No apps yet</p>
					<p class="text-sm text-ink-gray-5">Apps you can open will show here.</p>
				</div>

				<div
					v-else-if="!matches.length"
					class="mt-6 flex h-40 flex-col items-center justify-center gap-3 rounded-6 border border-dashed border-outline-gray-2"
				>
					<p class="text-base text-ink-gray-6">No app matches “{{ query }}”</p>
					<Button label="Clear filter" @click="query = ''" />
				</div>

				<ul
					v-else
					class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
				>
					<li v-for="(app, index) in matches" :key="app.app">
						<a
							:href="app.href"
							class="flex h-32 flex-col items-center justify-center gap-3 rounded-6 border px-3 outline-none transition hover:border-outline-gray-3 hover:bg-surface-gray-1 focus-visible:focus-ring"
							:class="
								query && index === 0
									? 'border-outline-gray-4 bg-surface-gray-1'
									: 'border-outline-gray-1'
							"
						>
							<AppLogo :logo="app.logo" :title="app.title" :size="40" />
							<span
								class="w-full truncate text-center text-sm font-medium text-ink-gray-8"
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
import { Avatar, Button, KeyboardShortcut, ScrollArea, Skeleton, TextInput } from "frappe-ui";
import LucideChevronDown from "~icons/lucide/chevron-down";
import LucideSearch from "~icons/lucide/search";
import type { Boot } from "@/boot";
import AppLogo from "./AppLogo.vue";
import PrototypeUserMenu from "./PrototypeUserMenu.vue";
import { useIndex } from "./useIndex";

const boot = inject<Boot>("boot")!;
const filterBox = ref(null);
const { apps, loading, query, matches, onKeydown } = useIndex(boot, filterBox);
const siteName = window.location.hostname;
const FRAMEWORK_LOGO = "/assets/frappe/images/frappe-framework-logo.svg";
</script>
