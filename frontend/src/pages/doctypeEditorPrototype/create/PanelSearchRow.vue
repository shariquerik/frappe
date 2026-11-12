<!-- PROTOTYPE (#47098), throwaway: the panel's property search, opened by the header's search
     button: a small input at the property rows' edges and a × that closes it. Escape or × clears
     the search and closes the row. -->
<template>
	<div class="flex items-center gap-1 px-4 pb-2" data-panel-search>
		<TextInput ref="input" v-model="query" size="sm" class="min-w-0 flex-1" placeholder="Search properties" @keydown.esc.stop="$emit('close')">
			<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
		</TextInput>
		<Button variant="ghost" size="sm" icon="lucide-x" label="Close search" tooltip="Close search" @click="$emit('close')" />
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Button, TextInput } from "frappe-ui";

defineEmits<{ close: [] }>();
const query = defineModel<string>({ required: true });
const input = ref<{ inputElement: HTMLInputElement | null } | null>(null);
onMounted(() => input.value?.inputElement?.focus());
</script>
