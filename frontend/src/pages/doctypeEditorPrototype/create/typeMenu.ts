// PROTOTYPE (#45867): the type chip's menu, shared by the new-field row and a field's inline editor.
import { FIELDTYPES, iconOf } from "../fieldtypes";

export type FieldType = { fieldtype: string; options?: string };

export const COMMON = ["Data", "Email", "Phone", "Int", "Currency", "Date", "Datetime", "Check", "Select", "Link", "Small Text", "Text Editor", "Attach", "Table"];

/** A Data field with options "Email" shows as its own type, as the record page draws it. */
export const typeIcon = (type: FieldType) => (type.options === "Email" ? "lucide-mail" : iconOf(type.fieldtype));

export function typeMenu(pick: (type: FieldType) => void, linkGuess?: string) {
	const asType = (choice: string): FieldType =>
		choice === "Email" ? { fieldtype: "Data", options: "Email" } : { fieldtype: choice, options: choice === "Link" ? linkGuess : undefined };
	return [
		{
			group: "Type",
			hideLabel: true,
			options: COMMON.map((choice) => ({ label: choice, icon: choice === "Email" ? "lucide-mail" : iconOf(choice), onClick: () => pick(asType(choice)) })),
		},
		{
			group: "",
			hideLabel: true,
			options: [
				{
					label: "More types",
					icon: "lucide-shapes",
					submenu: FIELDTYPES.map((group) => ({
						group: group.label,
						options: group.types.filter((one) => !COMMON.includes(one)).map((one) => ({ label: one, icon: iconOf(one), onClick: () => pick({ fieldtype: one }) })),
					})),
				},
			],
		},
	];
}
