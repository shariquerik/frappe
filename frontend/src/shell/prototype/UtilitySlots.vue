<!--
  PROTOTYPE (#47375): the utility slots, search and a placeholder notifications bell. `icon` draws
  them as rail cells, `row` as panel rows. Where they sit (top or bottom) is the variant's `slots`.
-->
<template>
	<template v-if="form === 'icon'">
		<Tooltip :side="awaySide">
			<template #content>
				<span class="flex items-center gap-2 [&_[data-slot=key]]:text-ink-gray-4">
					{{ __("Search") }} <KeyboardShortcut combo="Mod+K" />
				</span>
			</template>
			<button
				type="button"
				data-key="palette-trigger"
				:class="TRIGGER"
				:aria-label="__('Search')"
				@click="openPalette"
			>
				<span class="lucide-search size-4" aria-hidden="true" />
			</button>
		</Tooltip>
		<Tooltip :text="__('Notifications')" :side="awaySide">
			<button type="button" data-proto-bell :class="TRIGGER" :aria-label="__('Notifications')">
				<span class="lucide-bell size-4" aria-hidden="true" />
				<span class="absolute right-1 top-1 size-1.5 rounded-full bg-surface-gray-7" />
			</button>
		</Tooltip>
	</template>

	<div v-else class="flex flex-col gap-0.5">
		<button
			type="button"
			:class="ROW"
			data-key="palette-trigger"
			@click="openPalette"
		>
			<span class="lucide-search size-4" />
			<span class="flex-1 text-left">{{ __("Search") }}</span>
			<KeyboardShortcut combo="Mod+K" class="text-ink-gray-4" />
		</button>
		<button type="button" :class="ROW" data-proto-bell>
			<span class="lucide-bell size-4" />
			<span class="flex-1 text-left">{{ __("Notifications") }}</span>
			<span class="rounded-full bg-surface-gray-3 px-1.5 text-xs text-ink-gray-6">3</span>
		</button>
	</div>
</template>

<script setup lang="ts">
import { KeyboardShortcut, Tooltip } from "frappe-ui";
import { __ } from "@/i18n";
import { openPalette } from "../palette";
import { awaySide } from "./navLayout";

defineProps<{ form: "icon" | "row" }>();

const TRIGGER =
	"relative flex size-7 shrink-0 items-center justify-center rounded-4 text-base text-ink-gray-8 transition hover:bg-surface-gray-3 focus-visible:ring-0 focus-visible:focus-ring";
const ROW =
	"flex h-7 w-full items-center gap-2 rounded-4 px-2 text-sm text-ink-gray-6 hover:bg-surface-gray-3";
</script>
