// PROTOTYPE (#45867): the editor, handed to every part of the page.
import type { InjectionKey } from "vue";
import type { Editor } from "./editor";

export const EditorKey: InjectionKey<Editor> = Symbol("DoctypeEditorPrototype");

interface DragEnd {
	item: HTMLElement;
	to: HTMLElement;
	from: HTMLElement;
	oldIndex?: number;
	newIndex?: number;
}

/** Sortable's `end`, as one act: the dragged node and the list it landed in, by data attributes. */
export function onDrop(editor: Editor, event: DragEnd) {
	editor.state.dragging = null;
	const { item, to, from, oldIndex, newIndex } = event;
	if (newIndex === undefined) return;
	if (to === from && oldIndex === newIndex) return;
	const fieldname = item.dataset.fieldname;
	if (fieldname) {
		const column = to.dataset.columnKey;
		if (column) editor.acts.moveField(fieldname, column, newIndex);
		return;
	}
	const container = item.dataset.containerKey;
	const parent = to.dataset.parentKey;
	if (container && parent) editor.acts.moveContainer(container, parent, newIndex);
}
