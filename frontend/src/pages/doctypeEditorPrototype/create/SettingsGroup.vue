<!-- PROTOTYPE (#47098), throwaway: a small group inside a Settings pane: a heading in the Editor
     panel's section style (not collapsible) and a divider above it (SettingsFormList covers the
     first visible one's). A search keeps the rows it matches and hides a group with none. -->
<template>
	<div v-show="ui.groupMatches(section, label)" class="border-t border-outline-gray-1 pb-1 pt-3" :data-settings-group="label">
		<h3 class="flex h-7 items-center text-base font-medium text-ink-gray-9">{{ label }}</h3>
		<slot />
	</div>
</template>

<script setup lang="ts">
import { inject, provide } from "vue";
import { SettingsGroupKey, SettingsKey, SettingsSectionKey } from "./settings";

const props = defineProps<{ label: string }>();
const ui = inject(SettingsKey)!;
const section = inject(SettingsSectionKey, "");
provide(SettingsGroupKey, props.label);
</script>
