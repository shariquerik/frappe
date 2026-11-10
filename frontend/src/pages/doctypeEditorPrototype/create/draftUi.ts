// PROTOTYPE (#45867): what the draft page's one popover edits, and the element it points at.
import type { InjectionKey, Ref } from "vue";

export type Editing =
	| { kind: "add"; column: string; index?: number }
	| { kind: "field"; fieldname: string }
	| null;

export interface DraftUi {
	editing: Ref<Editing>;
	anchor: Ref<Element | undefined>;
	titleField: Ref<string>;
	open: (editing: Editing, anchor: Element) => void;
}

export const DraftUiKey: InjectionKey<DraftUi> = Symbol("DraftUi");
