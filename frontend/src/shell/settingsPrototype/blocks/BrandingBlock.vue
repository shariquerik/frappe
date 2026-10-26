<!-- PROTOTYPE: a component block with one named binding (`settings`, FCRM Settings). It edits
     the shared draft and calls commit() when a value is final; it never sends the save. -->
<template>
	<div v-if="settings.state.loading" class="h-32 animate-pulse rounded-4 bg-surface-gray-2" />
	<div v-else class="flex gap-6 py-3">
		<div
			class="flex w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-4 border border-outline-gray-2 bg-surface-gray-1 p-4"
		>
			<img
				v-if="doc.brand_logo"
				:src="doc.brand_logo"
				class="size-10 rounded-1 object-contain"
				alt=""
			/>
			<span
				v-else
				class="flex size-10 items-center justify-center rounded-1 bg-surface-gray-4 text-lg font-semibold text-ink-gray-7"
			>
				{{ (doc.brand_name || "CRM").slice(0, 1) }}
			</span>
			<span class="text-base font-medium text-ink-gray-8">{{ doc.brand_name || "CRM" }}</span>
			<span class="text-xs text-ink-gray-5">Preview</span>
		</div>
		<div class="flex flex-1 flex-col gap-3">
			<TextInput
				v-model="doc.brand_name"
				label="Brand name"
				placeholder="CRM"
				@change="settings.commit(['brand_name'])"
			/>
			<div v-if="settings.state.fieldErrors.brand_name" class="text-sm text-ink-red-4">
				{{ settings.state.fieldErrors.brand_name }}
			</div>
			<p class="text-sm text-ink-gray-5">
				A component can call any other API too, for example to upload a logo.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TextInput } from "frappe-ui";
import type { BindingState, BlockState } from "../bindings";

interface BindingHandle {
	state: BindingState;
	status: BlockState;
	commit: (fieldnames: string[]) => void;
}

const props = defineProps<{ bindings: Record<string, BindingHandle> }>();

const settings = computed(() => props.bindings.settings);
const doc = computed(() => settings.value.state.doc);
</script>
