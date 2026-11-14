<!-- PROTOTYPE (#47378), variant C: an add point that opens its form inline, in the tree. -->
<template>
	<div v-if="open" class="my-1 rounded-8 border border-outline-gray-2 bg-surface-gray-1 p-3" data-panel-add-form>
		<RowForm :container="container" :parent-key="parentKey ?? null" @done="open = false" />
	</div>
	<button
		v-else
		type="button"
		class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-sm text-ink-gray-5 hover:bg-surface-gray-2"
		:data-panel-add="container"
		@click="open = true"
	>
		<span class="lucide-plus size-4" /> {{ label ?? "Add row" }}
	</button>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Container } from "./navDraft";
import RowForm from "./RowForm.vue";

defineProps<{ container: Container; parentKey?: string | null; label?: string }>();
const open = ref(false);
</script>
