<!-- PROTOTYPE: the quiet save mark: Saving…, Saved, or Not saved. -->
<template>
	<span
		v-if="status !== 'idle'"
		class="inline-flex items-center gap-1 text-sm"
		:class="status === 'error' ? 'text-ink-red-4' : 'text-ink-gray-5'"
	>
		<LoadingIndicator v-if="status === 'saving'" class="size-3" />
		<span v-else-if="status === 'saved'" class="lucide-check size-3.5" />
		<span v-else class="lucide-circle-alert size-3.5" />
		<span v-if="!compact">{{ text }}</span>
	</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { LoadingIndicator } from "frappe-ui";
import type { BlockStatus } from "./bindings";

const props = defineProps<{ status: BlockStatus; message?: string; compact?: boolean }>();

const text = computed(
	() =>
		({ saving: "Saving…", saved: "Saved", error: props.message || "Not saved", idle: "" })[
			props.status
		]
);
</script>
