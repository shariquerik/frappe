// PROTOTYPE (#45851): whether the bulk bar is up, read off the page, so a floating view bar can give way to it.
import { onMounted, onUnmounted, ref } from "vue";

export function useBulkOpen() {
	const open = ref(false);
	const read = () => (open.value = !!document.querySelector('[role="toolbar"][aria-label="Bulk actions"]'));
	let observer: MutationObserver | null = null;
	onMounted(() => {
		read();
		observer = new MutationObserver(read);
		observer.observe(document.body, { childList: true, subtree: true });
	});
	onUnmounted(() => observer?.disconnect());
	return open;
}
