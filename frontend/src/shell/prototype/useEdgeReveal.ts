// PROTOTYPE (#47374): v1's floating-dock reveal (`dock.js:231-309`). The pointer within 1px of the
// navigation's window edge opens it; it stays while the pointer is within 90px of that edge, over
// the panel, or focus is inside; Escape closes it.

import { onMounted, onUnmounted, ref, type Ref } from "vue";
import { side } from "./navLayout";

const REVEAL_EDGE = 1;

export function useEdgeReveal(panel: Ref<HTMLElement | null>, stayBand: () => number) {
	const open = ref(false);

	function fromEdge(event: MouseEvent) {
		return side.value === "left" ? event.clientX : window.innerWidth - 1 - event.clientX;
	}

	function onMove(event: MouseEvent) {
		const distance = fromEdge(event);
		if (distance <= REVEAL_EDGE) return void (open.value = true);
		if (!open.value) return;
		const over = panel.value?.contains(event.target as Node);
		const focused = panel.value?.contains(document.activeElement);
		// A menu opened from the panel teleports out of it; leave it open while one shows.
		const menu = document.querySelector("[data-reka-popper-content-wrapper]");
		if (!over && !focused && !menu && distance > stayBand()) open.value = false;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === "Escape" && open.value) open.value = false;
	}

	onMounted(() => {
		document.addEventListener("mousemove", onMove);
		document.addEventListener("keydown", onKey);
	});
	onUnmounted(() => {
		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("keydown", onKey);
	});

	return open;
}
