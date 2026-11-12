// PROTOTYPE (#47100), throwaway: a popover opens below the row that was clicked. A row near the
// panel's foot would flip it above, so the panel first scrolls the row up, padding its end while
// the popover is open if it has no room left to scroll.
export function makeRoomBelow(el: HTMLElement | null, need: number) {
	const panel = el?.closest("[data-editor-panel]") as HTMLElement | null;
	if (!el || !panel) return () => {};
	const room = window.innerHeight - el.getBoundingClientRect().bottom - 16;
	if (room >= need) return () => {};
	panel.style.paddingBottom = `${need}px`;
	panel.scrollBy({ top: need - room });
	return () => (panel.style.paddingBottom = "");
}
