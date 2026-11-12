<!-- PROTOTYPE (#45867): the drag preview card and the bin, copied from frappe/crm#3419's DragLayer
     and RemoveBin. The bin shows only while a canvas field is dragged: a pill 24px above the
     canvas's bottom, red "Release to remove" when the pointer is over it. -->
<template>
	<div class="pointer-events-none sticky bottom-6 z-10 flex h-0 justify-center">
		<div
			ref="bin"
			class="flex h-9 -translate-y-full items-center gap-2 rounded-8 border px-4 text-base shadow-xl transition-[opacity,background-color,border-color,color] duration-150"
			:class="[
				withBin ? 'opacity-100' : 'opacity-0',
				overBin ? 'border-outline-red-3 bg-surface-red-2 text-ink-red-5' : 'border-outline-gray-2 bg-surface-white text-ink-gray-6',
			]"
		>
			<span class="lucide-trash-2 size-4" aria-hidden="true" />
			{{ overBin ? "Release to remove" : "Drop here to remove" }}
		</div>
	</div>
	<div
		v-if="card"
		class="pointer-events-none fixed left-0 top-0 z-50 flex h-9 max-w-[240px] items-center gap-2 rounded-6 border px-3 text-base opacity-95 shadow-xl"
		:class="overBin ? 'border-outline-red-3 bg-surface-red-2 text-ink-red-5' : 'border-outline-gray-2 bg-surface-white text-ink-gray-8'"
		:style="{ transform: `translate(${pos.x - 20}px, ${cardTop}px)` }"
	>
		<span class="size-4 shrink-0" :class="[card.icon, !overBin && 'text-ink-gray-5']" aria-hidden="true" />
		<span class="truncate">{{ card.label }}</span>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, reactive, ref } from "vue";
import { EditorKey } from "../context";

const card = ref<{ icon: string; label: string } | null>(null);
const withBin = ref(false);
const overBin = ref(false);
const pos = reactive({ x: 0, y: 0 });
const bin = ref<HTMLElement>();
// Over a tab header the card drops 8px below the header, so the tab's name stays readable.
const tabBottom = ref<number | null>(null);
const cardTop = computed(() => (tabBottom.value !== null ? tabBottom.value + 8 : pos.y - (overBin.value ? 62 : 18)));
const editor = inject(EditorKey)!;

function track(event: PointerEvent) {
	pos.x = event.clientX;
	pos.y = event.clientY;
	if (card.value) {
		const under = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;
		const tab = under?.closest<HTMLElement>("[data-tab-key]");
		editor.state.dropTab = tab?.dataset.tabKey ?? null;
		tabBottom.value = tab ? tab.getBoundingClientRect().bottom : null;
	}
	if (!withBin.value || !bin.value) return;
	const box = bin.value.getBoundingClientRect();
	overBin.value =
		event.clientX >= box.left - 8 && event.clientX <= box.right + 8 && event.clientY >= box.top - 8 && event.clientY <= box.bottom + 8;
}
window.addEventListener("pointerdown", track, true);
window.addEventListener("pointermove", track, true);
onBeforeUnmount(() => {
	window.removeEventListener("pointerdown", track, true);
	window.removeEventListener("pointermove", track, true);
});

function start(next: { icon: string; label: string }, withRemoveBin: boolean) {
	card.value = next;
	withBin.value = withRemoveBin;
	overBin.value = false;
}

/** Ends the drag; true when it was released over the bin. */
function end() {
	const wasOverBin = withBin.value && overBin.value;
	card.value = null;
	editor.state.dropTab = null;
	tabBottom.value = null;
	withBin.value = false;
	overBin.value = false;
	return wasOverBin;
}

defineExpose({ start, end, pos });
</script>
