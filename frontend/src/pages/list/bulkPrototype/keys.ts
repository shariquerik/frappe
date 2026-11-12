// PROTOTYPE (#47056): a bare key belongs to the list only when nothing else is taking keys.
export function isTyping(event: KeyboardEvent) {
	const target = event.target as HTMLElement | null;
	return (
		event.metaKey ||
		event.ctrlKey ||
		event.altKey ||
		!!target?.closest(
			"input, textarea, select, [contenteditable=''], [contenteditable=true], [role=menu], [role=dialog]"
		)
	);
}
