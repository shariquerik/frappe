<!-- PROTOTYPE (#47100) ?fetch=B, throwaway: on a Link field, "Fetch a field from Customer…" opens
     FetchMenu on Customer's fields; the pick becomes a new read-only field after the Link. -->
<template>
	<button
		ref="button"
		type="button"
		class="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-4 px-2 text-left text-base text-ink-gray-8"
		:class="open ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
		data-fetch-add
		@click="toggle"
	>
		<span class="lucide-plus size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
		<span class="min-w-0 truncate">Fetch a field from {{ link.options }}…</span>
	</button>
	<Popover v-if="button" :open="open" trigger="manual" :reference="button" side="bottom" align="end" @update:open="onPopover">
		<FetchMenu :links="[link]" :link="link" @pick="pick" @close="close" />
	</Popover>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Popover } from "frappe-ui";
import type { EditorField } from "../editor";
import FetchMenu from "./FetchMenu.vue";
import { makeRoomBelow } from "./roomBelow";

defineProps<{ link: EditorField }>();
const emit = defineEmits<{ pick: [link: EditorField, source: EditorField] }>();
const button = ref<HTMLElement | null>(null);
const open = ref(false);

function pick(link: EditorField, source: EditorField) {
	open.value = false;
	emit("pick", link, source);
}
let closedAt = 0;
function onPopover(next: boolean) {
	if (next) return;
	open.value = false;
	closedAt = Date.now();
}
let release = () => {};
function toggle() {
	if (Date.now() - closedAt < 300) return;
	if (open.value) return close();
	release = makeRoomBelow(button.value, 400);
	open.value = true;
}
watch(open, (next) => !next && (release(), (release = () => {})));
function close() {
	open.value = false;
	button.value?.focus();
}
</script>
