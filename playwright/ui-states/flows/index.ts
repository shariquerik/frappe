import type { AnyFlow } from "../flow";
import { designNew } from "./designNew";
import { designSaved } from "./designSaved";
import { designInvoice } from "./designInvoice";
import { customize } from "./customize";
import { selection } from "./selection";
import { addField } from "./addField";
import { dragBin } from "./dragBin";
import { finder } from "./finder";
import { menus } from "./menus";
import { layouts } from "./layouts";
import { settings } from "./settings";
import { preview } from "./preview";
import { child } from "./child";
import { condition } from "./condition";
import { save } from "./save";

/** Canvas order: the flows of the ticket, top to bottom. */
export const flows: AnyFlow[] = [
	designNew,
	designSaved,
	designInvoice,
	customize,
	selection,
	addField,
	dragBin,
	finder,
	menus,
	layouts,
	settings,
	preview,
	child,
	condition,
	save,
];
