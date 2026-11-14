<!--
  PROTOTYPE (#47374): the top of a panel that carries what the rail would: the app logo and
  switcher (the app menu), then search. Used where no rail draws them.
-->
<template>
		<div class="flex h-12 shrink-0 items-center px-2">
			<Dropdown :options="menu" align="start">
				<button
					type="button"
					class="flex h-8 min-w-0 items-center gap-2 rounded-4 px-1.5 hover:bg-surface-gray-3"
					@pointerenter="loadApps"
					@focus="loadApps"
				>
					<img v-if="boot.app_logo" :src="boot.app_logo" alt="" class="size-6 rounded-3" />
					<span
						v-else
						class="grid size-6 place-items-center rounded-3 bg-surface-gray-3 text-sm font-medium"
						>{{ appTitle.charAt(0).toUpperCase() }}</span
					>
					<span class="truncate text-base font-medium text-ink-gray-8">{{ title }}</span>
					<span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5" />
				</button>
			</Dropdown>
		</div>

		<div class="shrink-0 px-2 pb-2">
			<button
				type="button"
				class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-sm text-ink-gray-6 hover:bg-surface-gray-3"
				data-key="palette-trigger"
				@click="openPalette"
			>
				<span class="lucide-search size-4" />
				<span class="flex-1 text-left">{{ __("Search") }}</span>
				<KeyboardShortcut combo="Mod+K" class="text-ink-gray-4" />
			</button>
		</div>

</template>

<script setup lang="ts">
import { Dropdown, KeyboardShortcut } from "frappe-ui";
import { __ } from "@/i18n";
import { openPalette } from "../palette";
import { useAppMenu } from "./appMenu";

defineProps<{ title: string }>();

const { boot, appTitle, menu, loadApps } = useAppMenu();
</script>
