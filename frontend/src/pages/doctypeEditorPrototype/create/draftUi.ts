// PROTOTYPE (#45867): the draft page's editing state, handed to the structure view's parts.
import type { InjectionKey, Ref } from "vue";
import type { Kind } from "./newDoctype";

export interface DraftUi {
	kind: Kind;
	/** The field whose row is expanded; one at a time. */
	expanded: Ref<string | null>;
	/** The field shown in the All properties panel. */
	panel: Ref<string | null>;
	/** The column with an open new-field row. */
	adding: Ref<string | null>;
	titleField: Ref<string>;
	/** Before the first save a fieldname follows its label; nothing refers to it yet. */
	draft: Ref<boolean>;
	rename: (from: string, to: string) => void;
}

export const DraftUiKey: InjectionKey<DraftUi> = Symbol("DraftUi");

/** Fieldtypes that can be a DocType's title. */
export const TITLE_TYPES = new Set(["Data", "Link", "Select", "Small Text"]);
