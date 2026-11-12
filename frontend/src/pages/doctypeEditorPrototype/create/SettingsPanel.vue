<!-- PROTOTYPE (#47098), throwaway, variant C: the 380px panel editing the setting picked on the page,
     in the Editor panel's look (icon tile, title, the section as subtitle, close); its rows stack. -->
<template>
	<div class="flex items-start gap-2.5 px-4 pb-3 pt-4">
		<div class="grid size-9 shrink-0 place-items-center rounded-4 bg-surface-gray-2 text-ink-gray-6">
			<span class="size-4" :class="icon" aria-hidden="true" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate text-lg font-semibold text-ink-gray-9">{{ title }}</p>
			<p class="mt-0.5 truncate text-sm text-ink-gray-5">{{ subtitle }}</p>
		</div>
		<Button class="-mr-1" variant="ghost" icon="lucide-x" tooltip="Close" label="Close" @click="$emit('close')" />
	</div>
	<div class="border-t border-outline-gray-1 px-4 pb-6 pt-2">
		<SettingsSection :section="section" :only="only" />
	</div>
</template>

<script setup lang="ts">
import { provide } from "vue";
import { Button } from "frappe-ui";
import SettingsSection from "./SettingsSection.vue";
import { SettingsPlaceKey } from "./settings";

defineProps<{ section: string; only: string; title: string; subtitle: string; icon: string }>();
defineEmits<{ close: [] }>();
provide(SettingsPlaceKey, "panel");
</script>
