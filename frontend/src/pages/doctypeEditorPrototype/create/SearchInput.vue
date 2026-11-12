<!-- PROTOTYPE (#47098), throwaway: a small search box (Settings, the Editor's panels). Escape or the
     clear button (Link.vue's) empties it; `slash` lets "/" focus it when no input has the caret. -->
<template>
	<TextInput ref="input" v-model="query" size="sm" :placeholder="placeholder" data-search-input @keydown.esc.stop="query = ''">
		<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
		<template v-if="query" #suffix>
			<button
				type="button"
				aria-label="Clear"
				data-slot="clear"
				class="grid size-4 place-items-center rounded-1 text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				@click.stop="clear"
				@pointerdown.stop
			>
				<span class="lucide-x size-3.5" />
			</button>
		</template>
	</TextInput>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { TextInput } from "frappe-ui";

const props = defineProps<{ placeholder: string; slash?: boolean }>();
const query = defineModel<string>({ required: true });
const input = ref<{ inputElement: HTMLInputElement | null } | null>(null);
function clear() {
	query.value = "";
	input.value?.inputElement?.focus();
}
function onKeydown(event: KeyboardEvent) {
	if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
	if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
	event.preventDefault();
	input.value?.inputElement?.focus();
}
onMounted(() => props.slash && window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>
