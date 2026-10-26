// PROTOTYPE: a doctype's layout as settings rows. Tabs and sections become headings and
// column breaks are dropped, since a settings row is one column.

import { mapField } from "@framework/ui/components/FormLayout/buildLayoutFromMeta";
import type { FieldMeta, RawMetaField } from "@framework/ui/components/FormLayout/types";

export interface RowSection {
	name: string;
	label?: string;
	fields: FieldMeta[];
}

export interface RowGroup {
	name: string;
	label?: string;
	sections: RowSection[];
}

const SKIPPED = new Set(["Column Break", "HTML", "Button", "Heading", "Fold", "Image"]);

/** A field list gives one unlabelled group; no list gives the doctype's whole layout. */
export function rowGroups(meta: RawMetaField[], fieldnames?: string[]): RowGroup[] {
	if (fieldnames?.length) {
		const byName = new Map(meta.map((field) => [field.fieldname, field]));
		const fields = fieldnames
			.map((name) => byName.get(name))
			.filter((field): field is RawMetaField => !!field)
			.map(toRow);
		return [{ name: "fields", sections: [{ name: "fields", fields }] }];
	}
	return walkLayout(meta);
}

/** The fieldnames a whole-layout block edits. */
export function dataFields(meta: RawMetaField[]): string[] {
	return walkLayout(meta).flatMap((group) =>
		group.sections.flatMap((section) => section.fields.map((field) => field.fieldname))
	);
}

function walkLayout(meta: RawMetaField[]): RowGroup[] {
	const groups: RowGroup[] = [{ name: "first", sections: [{ name: "first", fields: [] }] }];
	const lastGroup = () => groups[groups.length - 1];
	const lastSection = () => lastGroup().sections[lastGroup().sections.length - 1];

	for (const field of meta) {
		if (field.fieldtype === "Tab Break")
			groups.push({
				name: field.fieldname,
				label: field.label,
				sections: [{ name: field.fieldname, fields: [] }],
			});
		else if (field.fieldtype === "Section Break")
			lastGroup().sections.push({ name: field.fieldname, label: field.label, fields: [] });
		else if (!SKIPPED.has(field.fieldtype) && !field.hidden) lastSection().fields.push(toRow(field));
	}

	return groups
		.map((group) => ({
			...group,
			sections: group.sections.filter((section) => section.fields.length),
		}))
		.filter((group) => group.sections.length);
}

function toRow(field: RawMetaField): FieldMeta {
	return mapField(field, {});
}
