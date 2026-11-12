// PROTOTYPE (#45867): the draft page's editing state, handed to the canvas and the panel.
import type { InjectionKey, Ref } from "vue";
import type { Kind } from "./newDoctype";

export interface DraftUi {
	kind: Kind;
	titleField: Ref<string>;
	/** The DocType's description, typed on the canvas under its name. */
	description: Ref<string>;
	/** Before the first save a fieldname follows its label; nothing refers to it yet. */
	draft: Ref<boolean>;
	rename: (from: string, to: string) => void;
	/** Selects the field and puts the caret in the panel's Label. */
	focusLabel: (fieldname: string) => void;
	/** The panel's Label input asks for focus by this; it clears it once taken. */
	labelFocus: Ref<string | null>;
}

export const DraftUiKey: InjectionKey<DraftUi> = Symbol("DraftUi");

/** Fieldtypes that can be a DocType's title. */
export const TITLE_TYPES = new Set(["Data", "Link", "Select", "Small Text"]);
