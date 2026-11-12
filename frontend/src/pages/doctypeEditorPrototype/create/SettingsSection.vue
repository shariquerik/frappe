<!-- PROTOTYPE (#47098), throwaway: one Settings section's content by its key; `only` narrows it to
     one setting (variant C's panel). It names the section for its rows' search. -->
<template>
	<SettingsNaming v-if="section === 'naming'" :only="only" />
	<SettingsFormList v-else-if="section === 'form' || section === 'list'" :part="section === 'form' ? 'form' : 'list'" :only="only" />
	<SettingsPermissions v-else-if="section === 'permissions'" :can-customize="canCustomize" @customize="$emit('customize')" />
	<SettingsDanger v-else-if="section === 'danger'" />
</template>

<script setup lang="ts">
import { provide } from "vue";
import SettingsDanger from "./SettingsDanger.vue";
import SettingsFormList from "./SettingsFormList.vue";
import SettingsNaming from "./SettingsNaming.vue";
import SettingsPermissions from "./SettingsPermissions.vue";
import { SettingsSectionKey } from "./settings";

const props = defineProps<{ section: string; only?: string; canCustomize?: boolean }>();
defineEmits<{ customize: [] }>();
provide(SettingsSectionKey, props.section);
</script>
