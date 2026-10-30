// PROTOTYPE (#45867): ruling 9 of #45863, a `reqd` field in a conditional container.
import type { Editor } from "./editor";
import { nameOf } from "./editor";

/** The label of the conditional container a field sits in, or "" when none is. */
export function conditionalHome(editor: Editor, fieldname: string) {
	for (const tab of editor.tree.value)
		for (const section of tab.sections ?? [])
			for (const column of section.columns ?? [])
				if (column.fields.some((entry) => nameOf(entry) === fieldname)) {
					const holder = [tab, section, column].find((node: any) => node.dependsOn) as any;
					return holder ? holder.label || "an unnamed container" : "";
				}
	return "";
}
