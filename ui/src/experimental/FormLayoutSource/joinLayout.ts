import { mapField } from "../../components/FormLayout/buildLayoutFromMeta";
import type { Decorator } from "../../components/FormLayout/buildLayoutFromMeta";
import type {
	Column,
	FieldNode,
	FormLayoutSchema,
	RawMetaField,
	Section,
	Tab,
	TabOverride,
} from "../../components/FormLayout/types";
import { identifyTabs } from "../../components/FormLayout/tabIdentity";
import type { FieldAccess } from "../../composables/useDocPermissions";
import { withAccess } from "./fieldAccess";
import { applyFieldPatch, type FieldPatch } from "./fieldPatch";
import { buildColumn, buildSection } from "./section";
import type { LayoutTree, LayoutTreeColumn, LayoutTreeSection } from "./types";

export interface JoinLayoutOptions {
	/** Child doctype name → its flat meta `fields`, for `Table` columns. */
	childMetas?: Record<string, RawMetaField[]>;
	/** Permlevel gate per field; `read` demotes to read-only, `none` hides. */
	fieldAccess?: (field: RawMetaField) => FieldAccess;
	/**
	 * Per-field UI overlay hook, inherited by nested grid columns. This is what
	 * makes a `Button` field do anything: an undecorated Button renders with no
	 * handler (`ButtonField.vue`), so an app that wants clickable Buttons passes
	 * a decorator here.
	 */
	decorate?: Decorator;
	/**
	 * Per-render field property overrides, keyed by fieldname. Plain data on
	 * purpose — `FormLayout` reads the result off the schema and knows nothing
	 * about who wrote it. A patch's `override` half is applied last by
	 * `resolveFieldConditionals`, so it beats `depends_on` but never a permlevel
	 * denial; the rest lands on the node as it is built.
	 */
	overrides?: Record<string, FieldPatch>;
	/**
	 * Per-render tab overrides, keyed by the tab's **identity** — `identifyTabs`
	 * resolves the same identities here as `FormLayout` does, since the join
	 * leaves every tab's `name` and authored `label` alone.
	 *
	 * Carried, not applied: `FormLayout` is what draws the strip, so it is what
	 * resolves the override against the `depends_on`.
	 */
	tabOverrides?: Record<string, TabOverride>;
}

const LAYOUT_BREAKS = new Set(["Tab Break", "Section Break", "Column Break"]);

/**
 * Join a layout tree (fieldnames as strings, as `get_form_layouts` returns it)
 * against the doctype's meta fields into a render-ready `FormLayoutSchema`.
 * A fieldname the doctype no longer has is dropped, as are layout breaks.
 */
export function joinLayout(
	tree: LayoutTree,
	fields: RawMetaField[],
	options: JoinLayoutOptions = {}
): FormLayoutSchema {
	const byName = new Map(fields.map((field) => [field.fieldname, field]));
	return identifyTabs(tree ?? []).map(
		(tab): Tab => ({
			name: tab.name,
			label: tab.label,
			dependsOn: tab.dependsOn,
			override: options.tabOverrides?.[tab.identity],
			sections: (tab.sections ?? []).map((section) =>
				joinSection(section, byName, options)
			),
		})
	);
}

function joinSection(
	section: LayoutTreeSection,
	byName: Map<string, RawMetaField>,
	options: JoinLayoutOptions
): Section {
	return buildSection(
		section,
		(section.columns ?? []).map((column) =>
			joinColumn(column, byName, options)
		)
	);
}

function joinColumn(
	column: LayoutTreeColumn,
	byName: Map<string, RawMetaField>,
	options: JoinLayoutOptions
): Column {
	return buildColumn(
		column,
		(column.fields ?? []).flatMap((fieldname) =>
			joinField(fieldname, byName, options)
		)
	);
}

function joinField(
	fieldname: string,
	byName: Map<string, RawMetaField>,
	options: JoinLayoutOptions
): FieldNode[] {
	const raw = byName.get(fieldname);
	if (!raw || LAYOUT_BREAKS.has(raw.fieldtype)) return [];
	const node = mapField(
		withAccess(raw, options.fieldAccess),
		options.childMetas ?? {},
		options.decorate
	);
	return [applyFieldPatch(node, options.overrides?.[fieldname])];
}
