import { expect, type Locator } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import { seedSalesInvoice } from "../seed";
import type { Scene } from "../scene";

type Event =
	| { type: "CLICK_FIELD" }
	| { type: "CLICK_CHECK" }
	| { type: "CLICK_TABLE" }
	| { type: "CLICK_SECTION" }
	| { type: "CLICK_COLUMN" }
	| { type: "CLICK_TAB" }
	| { type: "CLICK_BLANK" }
	| { type: "CLOSE_PANEL" }
	| { type: "HOVER_COLUMN" }
	| { type: "RENAME_TAB" }
	| { type: "CANCEL_RENAME" }
	| { type: "OPEN_SETTINGS" }
	| { type: "BACK_TO_EDITOR" }
	| { type: "ADD_FIELD" }
	| { type: "ADD_SECTION" }
	| { type: "UNDO" };

/**
 * What is selected on the Design canvas of UI Sales Invoice, and what the right panel shows for it.
 * In the code the selection is `DesignCanvas.selection` (one of four kinds, or null) in
 * `designCanvas.ts`; `EditorPanel.vue` picks FieldPanel, ContainerPanel, PanelTray or the plain
 * "Add a field" list from it. There is no multiple selection: a click replaces the selection.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "selection",
	initial: "nothing",
	states: {
		nothing: {
			meta: { description: "Nothing selected: the right panel says 'Select a field or a section heading to edit it here' and lists every field type to add." },
			on: {
				CLICK_FIELD: "field",
				HOVER_COLUMN: "columnHovered",
				ADD_FIELD: "newField",
				ADD_SECTION: "newSection",
			},
		},
		columnHovered: {
			meta: { description: "Nothing selected, the pointer over the free space of a column: a ring shows the click would select that column." },
			on: { CLICK_COLUMN: "column" },
		},
		field: {
			meta: { description: "A Link field selected: a ring on the canvas, the panel shows Label, Type, Links to, Required and the rest of that field's properties." },
			on: { CLICK_CHECK: "checkField", CLOSE_PANEL: "nothing", CLICK_BLANK: "nothing", OPEN_SETTINGS: "settingsHidesPanel" },
		},
		settingsHidesPanel: {
			meta: { description: "The Settings tab open while a field stays selected: the panel is gone, and the Editor tab brings the same selection back." },
			on: { BACK_TO_EDITOR: "field" },
		},
		checkField: {
			meta: { description: "A Check field selected: the panel is the field panel again, with the Check field's own rows and no Links to row." },
			on: { CLICK_TABLE: "tableField", CLOSE_PANEL: "nothing" },
		},
		tableField: {
			meta: { description: "A Table field selected on the Items tab, opened by its tab first: the panel adds the child DocType, its grid columns and an Edit link." },
			on: { CLICK_SECTION: "section" },
		},
		section: {
			meta: { description: "A section selected: the panel header changes to the section, with Heading, Columns, Description, switches and Conditions instead of field rows." },
			on: { CLICK_COLUMN: "column", CLICK_BLANK: "nothing" },
		},
		column: {
			meta: { description: "A column selected: a ring around the column, the panel shows Label, Hide label and Conditions for the column." },
			on: { CLICK_TAB: "tab" },
		},
		tab: {
			meta: { description: "A tab selected: the tab strip marks it, and the panel shows its Label, Order buttons, Conditions and the hint on moving fields to it." },
			on: { RENAME_TAB: "tabRenaming", CLICK_BLANK: "nothing" },
		},
		tabRenaming: {
			meta: { description: "A double-click on the tab name turned it into a text input, with the tab still selected and its panel open." },
			on: { CANCEL_RENAME: "tab" },
		},
		newField: {
			meta: { description: "A field type clicked in the panel: the new field sits on the canvas, selected, with its panel open and its label ready to type." },
			on: { UNDO: "staleField" },
		},
		staleField: {
			meta: { description: "The new field was undone while selected: the canvas shows no ring and the panel falls back to the list, though the editor still holds the selection of a field that is gone." },
		},
		newSection: {
			meta: { description: "A section added from the canvas menu: it sits on the canvas selected, with its panel open." },
			on: { UNDO: "staleSection" },
		},
		staleSection: {
			meta: { description: "The new section was undone while selected: the section is gone and the panel falls back to the 'Add a field' list, with no ring on the canvas." },
		},
	},
});

const page = (scene: Scene) => scene.page;
const field = (scene: Scene, fieldname: string) => page(scene).locator(`[data-canvas-field="${fieldname}"]`);
const panel = (scene: Scene) => page(scene).locator("[data-editor-panel]");
const title = (scene: Scene) => panel(scene).locator("[data-panel-title]");

/** The first labelled section of the open tab: the canvas gives sections generated names, so the label is read from its input. */
async function section(scene: Scene): Promise<{ box: Locator; label: string }> {
	const found = await page(scene).evaluate(() => {
		const inputs = [...document.querySelectorAll<HTMLInputElement>("[data-canvas-section-label]")];
		const input = inputs.find((one) => one.value && one.offsetParent !== null);
		return input ? { name: input.closest("[data-canvas-section]")!.getAttribute("data-canvas-section")!, label: input.value } : null;
	});
	if (!found) throw new Error("no labelled section on this tab");
	return { box: page(scene).locator(`[data-canvas-section="${found.name}"]`), label: found.label };
}

/** The first column of the open tab's first labelled section. */
async function firstColumn(scene: Scene): Promise<{ column: Locator; x: number; y: number }> {
	const column = (await section(scene)).box.locator("[data-canvas-column]").first();
	const box = await column.boundingBox();
	if (!box) throw new Error("column has no box");
	// Below its fields, where only the column's own band is.
	return { column, x: box.x + box.width / 2, y: box.y + box.height - 4 };
}

export const selection = defineFlow<Event>({
	id: "selection",
	title: "Selections",
	source: "frontend/src/pages/doctypeEditor/designCanvas.ts (selection), EditorPanel.vue, CanvasField.vue, CanvasSection.vue, CanvasColumn.vue, CanvasTabs.vue, ContainerPanel.vue, FieldPanel.vue",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(page(scene).locator("[data-doctype-editor]")).toBeVisible();
		await expect(field(scene, "customer")).toBeVisible();
		await expect(panel(scene).getByText("Select a field or a section heading to edit it here.")).toBeVisible();
	},
	events: {
		async CLICK_FIELD(scene) {
			await field(scene, "customer").click();
			await expect(field(scene, "customer")).toHaveAttribute("data-canvas-selected", "true");
			await expect(title(scene)).toHaveText("Customer");
		},
		async CLICK_CHECK(scene) {
			await field(scene, "is_return").click();
			await expect(field(scene, "is_return")).toHaveAttribute("data-canvas-selected", "true");
			await expect(title(scene)).toHaveText("Is return (credit note)");
		},
		async CLICK_TABLE(scene) {
			await expect(field(scene, "items")).toBeHidden();
			await page(scene).getByRole("tab", { name: "Items" }).first().click();
			await field(scene, "items").click();
			await expect(field(scene, "items")).toHaveAttribute("data-canvas-selected", "true");
			await expect(title(scene)).toHaveText("Items");
		},
		async CLICK_SECTION(scene) {
			const { box, label } = await section(scene);
			await box.click({ position: { x: 4, y: 4 } });
			await expect(box).toHaveAttribute("data-canvas-selected", "true");
			await expect(title(scene)).toHaveText(label);
		},
		async CLICK_COLUMN(scene) {
			const { column, x, y } = await firstColumn(scene);
			await page(scene).mouse.click(x, y);
			await expect(column).toHaveAttribute("data-canvas-selected", "true");
			await expect(panel(scene).locator("[data-panel-subtitle]")).toHaveText("Column");
		},
		async CLICK_TAB(scene) {
			await page(scene).getByRole("tab", { name: "Payments" }).click();
			await expect(page(scene).getByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "true");
			await expect(title(scene)).toHaveText("Payments");
		},
		async CLICK_BLANK(scene) {
			await page(scene).locator("[data-editor-canvas]").click({ position: { x: 4, y: 300 } });
			await expect(panel(scene).getByText("Select a field or a section heading to edit it here.")).toBeVisible();
		},
		async CLOSE_PANEL(scene) {
			await panel(scene).getByRole("button", { name: "Close" }).click();
			await expect(panel(scene).getByText("Select a field or a section heading to edit it here.")).toBeVisible();
		},
		async HOVER_COLUMN(scene) {
			const { column, x, y } = await firstColumn(scene);
			await page(scene).mouse.move(x, y);
			await expect(column.locator("[data-canvas-column-ring]")).toBeVisible();
		},
		async RENAME_TAB(scene) {
			await page(scene).getByRole("tab", { name: "Payments" }).dblclick();
			await expect(page(scene).locator("[data-canvas-tab] input")).toBeFocused();
		},
		async CANCEL_RENAME(scene) {
			await page(scene).keyboard.press("Escape");
			await expect(page(scene).locator("[data-canvas-tab] input")).toBeHidden();
		},
		async OPEN_SETTINGS(scene) {
			await page(scene).getByRole("tab", { name: "Settings" }).click();
			await expect(panel(scene)).toBeHidden();
		},
		async BACK_TO_EDITOR(scene) {
			await page(scene).getByRole("tab", { name: "Editor" }).click();
			await expect(title(scene)).toHaveText("Customer");
		},
		async ADD_FIELD(scene) {
			await panel(scene).locator('[data-panel-new-type="Data"]').click();
			await expect(title(scene)).toHaveText("Data");
		},
		async ADD_SECTION(scene) {
			await page(scene).locator("[data-canvas-add-section]").getByRole("button", { name: "Add section" }).click();
			await expect(panel(scene).locator("[data-panel-subtitle]")).toHaveText(/^Section/);
		},
		async UNDO(scene) {
			await page(scene).getByRole("button", { name: "Undo" }).click();
			await expect(page(scene).getByRole("button", { name: "Undo" })).toBeDisabled();
			// Proof the selection outlived the undo: Redo brings the item back already selected.
			await page(scene).getByRole("button", { name: "Redo" }).click();
			await expect(page(scene).locator("[data-editor-canvas] [data-canvas-selected]")).toBeVisible();
			await page(scene).getByRole("button", { name: "Undo" }).click();
			await expect(page(scene).getByRole("button", { name: "Undo" })).toBeDisabled();
			await expect(page(scene).locator("[data-editor-canvas] [data-canvas-selected]")).toBeHidden();
		},
	},
});
