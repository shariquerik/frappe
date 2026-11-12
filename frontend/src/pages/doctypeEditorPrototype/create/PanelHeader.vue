<!-- PROTOTYPE (#45867): icon tile, title, subtitle, remove and close, heading the field or the
     section panel. Copies frappe/crm#3419's PanelHeader. #47098: `searchable` adds a search button
     before remove and close; the panel opens its search row under the header. -->
<template>
	<div class="flex items-start gap-2.5 px-4 pb-3 pt-4">
		<div class="grid size-9 shrink-0 place-items-center rounded-4 bg-surface-gray-2 text-ink-gray-6">
			<span class="size-4" :class="icon" aria-hidden="true" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate text-lg font-semibold text-ink-gray-9">{{ title }}</p>
			<p class="mt-0.5 truncate text-sm text-ink-gray-5">{{ subtitle }}</p>
		</div>
		<div class="-mr-1 flex shrink-0 items-center">
			<Button v-if="searchable" variant="ghost" icon="lucide-search" tooltip="Search properties" label="Search properties" data-panel-search-button @click="$emit('search')" />
			<Button variant="ghost" :icon="removeIcon" :tooltip="removeLabel" :label="removeLabel" @click="$emit('remove')" />
			<Button variant="ghost" icon="lucide-x" tooltip="Close" label="Close" @click="$emit('close')" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from "frappe-ui";

withDefaults(defineProps<{ icon: string; title: string; subtitle: string; removeLabel: string; removeIcon?: string; searchable?: boolean }>(), { removeIcon: "lucide-trash-2" });
defineEmits<{ remove: []; close: []; search: [] }>();
</script>
