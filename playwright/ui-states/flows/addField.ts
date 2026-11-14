import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Scene } from "../scene";
import { seedSalesInvoice } from "../seed";

/** A default Details layout of UI Sales Invoice that leaves three fields out: a site Form Layout row. */
function detailsLeavingOut(): string {
	let count = 0;
	const column = (...fields: string[]) => ({ fields });
	const section = (label: string, ...columns: Array<{ fields: string[] }>) => ({ label, name: `section_${++count}`, columns });
	return JSON.stringify([
		{
			label: "Details",
			name: "details_tab",
			sections: [
				section("Customer", column("naming_series", "customer", "posting_date"), column("due_date", "is_return", "return_against")),
			],
		},
		{
			label: "Items",
			name: "items_tab",
			sections: [
				{ name: `section_${++count}`, columns: [column("items")] },
				section("Totals", column("apply_discount"), column("net_total", "grand_total")),
			],
		},
		{
			label: "Payments",
			name: "payments_tab",
			sections: [{ name: `section_${++count}`, columns: [column("is_pos")] }, section("Payment details", column(), column("paid_amount"))],
		},
		{ label: "More information", name: "more_tab", sections: [{ name: `section_${++count}`, columns: [column("status")] }] },
	]);
}

type Event =
	| { type: "SEARCH" }
	| { type: "SEARCH_MISS" }
	| { type: "CLEAR" }
	| { type: "CLICK_TYPE" }
	| { type: "DRAG_TYPE" }
	| { type: "LAYOUT_LEAVES_FIELDS_OUT" }
	| { type: "SEARCH_GROUP" }
	| { type: "SEARCH_GROUP_MISS" }
	| { type: "PLACE_GROUP_FIELD" }
	| { type: "PLACE_REST" };

/**
 * The right panel with nothing selected: the fields the layout leaves off (a group that shows only
 * while some are off), then "Add a field" / "New field" and its field types. In the code this is
 * `EditorPanel.vue` (`PanelTray` is the `v-else`), `PanelTray.vue` (`showsGroup`, `fieldQuery`,
 * `place`), `NewFieldTypes.vue` (`query` decides list or "No field type matches.") and `newField.ts`
 * (`addFieldType` puts the field where the canvas is looking). The group's fields come from
 * `designCanvas.offLayout`; its rows are click-only, they do not drag.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "addField",
	initial: "listed",
	states: {
		listed: {
			meta: { description: "Nothing is selected: the panel reads 'Select a field or a section heading to edit it here.' and offers 'Add a field', a search box and every field type from A to Z." },
			on: {
				SEARCH: "searching",
				SEARCH_MISS: "noMatch",
				CLICK_TYPE: "addedByClick",
				DRAG_TYPE: "addedByDrag",
				LAYOUT_LEAVES_FIELDS_OUT: "groupListed",
			},
		},
		searching: {
			meta: { description: "'link' is typed in the search box: the list is cut down to the types with that word in their name, and a clear (x) button shows in the box." },
			on: { CLEAR: "listed", SEARCH_MISS: "noMatch" },
		},
		noMatch: {
			meta: { description: "The search matches no type: the list is replaced by 'No field type matches.' under the search box." },
			on: { CLEAR: "listed" },
		},
		addedByClick: {
			meta: { description: "A click on 'Check' added a field of that type at the end of the section in view: it sits on the canvas, selected, and the panel shows its settings with the label in the caret." },
		},
		addedByDrag: {
			meta: { description: "A type was dragged from the list onto the canvas, above 'Payment due date': the new field sits on that exact place, selected, and the panel shows its settings." },
		},
		groupListed: {
			meta: { description: "The Details layout leaves three fields out: the panel opens with 'Fields not on this layout 3' first (a 'Find a field' box, each field with its type), and the type list below is headed 'New field' instead of 'Add a field'." },
			on: { SEARCH_GROUP: "groupSearch", SEARCH_GROUP_MISS: "groupNoMatch", PLACE_GROUP_FIELD: "groupFieldPlaced" },
		},
		groupSearch: {
			meta: { description: "'rem' is typed in 'Find a field': the group is cut down to Remarks; the count in its heading still reads 3." },
		},
		groupNoMatch: {
			meta: { description: "'Find a field' matches no field: the group's list is replaced by 'No field matches.', the heading count still reads 3." },
		},
		groupFieldPlaced: {
			meta: { description: "A click on Remarks in the group placed it at the end of the section in view: it is on the canvas, the group lists two fields now and the header shows 'Not saved'." },
			on: { PLACE_REST: "groupGone" },
		},
		groupGone: {
			meta: { description: "The last field off the layout was placed: the group is gone and the type list is headed 'Add a field' again." },
		},
	},
});

const search = (scene: Scene) => scene.page.getByPlaceholder("Search field types");
const types = (scene: Scene) => scene.page.locator("[data-new-field-types]");
const group = (scene: Scene) => scene.page.locator("[data-panel-tray]");
const groupRows = (scene: Scene) => group(scene).locator("[data-panel-tray-field]");

export const addField = defineFlow<Event>({
	id: "add-field",
	title: "Add a field",
	source:
		"frontend/src/pages/doctypeEditor/EditorPanel.vue, PanelTray.vue, NewFieldTypes.vue, newField.ts, canvasDrops.ts, designCanvas.ts (offLayout)",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
		await expect(scene.page.locator('[data-canvas-field="due_date"]')).toBeVisible();
		await expect(scene.page.getByText("Select a field or a section heading to edit it here.")).toBeVisible();
		await expect(types(scene).locator('[data-panel-new-type="Check"]')).toBeVisible();
	},
	events: {
		async SEARCH(scene) {
			await search(scene).fill("link");
			await expect(types(scene).locator("[data-panel-new-type]")).toHaveCount(2);
			await expect(types(scene).locator('[data-panel-new-type="Dynamic Link"]')).toBeVisible();
		},
		async SEARCH_MISS(scene) {
			await search(scene).fill("barcodes");
			await expect(scene.page.getByText("No field type matches.")).toBeVisible();
		},
		async CLEAR(scene) {
			await scene.page.locator("[data-types-clear]").or(scene.page.getByRole("button", { name: "Clear" })).first().click();
			await expect(search(scene)).toHaveValue("");
			await expect(types(scene).locator('[data-panel-new-type="Check"]')).toBeVisible();
		},
		async CLICK_TYPE(scene) {
			await types(scene).locator('[data-panel-new-type="Check"]').click();
			await expect(scene.page.locator("[data-editor-panel] [data-panel-label]")).toHaveValue("Check");
			await expect(scene.page.locator('[data-canvas-selected]')).toBeVisible();
		},
		async LAYOUT_LEAVES_FIELDS_OUT(scene) {
			await scene.insert("Form Layout", {
				dt: "UI Sales Invoice",
				title: "Invoice",
				type: "Details",
				layout: detailsLeavingOut(),
				omitted: JSON.stringify([]),
			});
			await scene.goto("/apps/desk/doctype/UI%20Sales%20Invoice?mode=design");
			await expect(scene.page.locator('[data-canvas-field="due_date"]')).toBeVisible();
			await expect(groupRows(scene)).toHaveCount(3);
		},
		async SEARCH_GROUP(scene) {
			await scene.page.locator("[data-panel-tray-search]").fill("rem");
			await expect(groupRows(scene)).toHaveCount(1);
			await expect(groupRows(scene).first()).toContainText("Remarks");
		},
		async SEARCH_GROUP_MISS(scene) {
			await scene.page.locator("[data-panel-tray-search]").fill("warehouse");
			await expect(scene.page.getByText("No field matches.")).toBeVisible();
		},
		async PLACE_GROUP_FIELD(scene) {
			await group(scene).locator('[data-panel-tray-field="remarks"]').click();
			await expect(groupRows(scene)).toHaveCount(2);
			await expect(scene.page.locator('[data-canvas-field="remarks"]')).toBeVisible();
		},
		async PLACE_REST(scene) {
			for (const fieldname of ["discount_amount", "mode_of_payment"]) {
				await group(scene).locator(`[data-panel-tray-field="${fieldname}"]`).click();
				await expect(group(scene).locator(`[data-panel-tray-field="${fieldname}"]`)).toHaveCount(0);
			}
			await expect(group(scene)).toHaveCount(0);
			await expect(scene.page.getByText("Add a field", { exact: true })).toBeVisible();
		},
		async DRAG_TYPE(scene) {
			const { page } = scene;
			const source = await types(scene).locator('[data-panel-new-type="Currency"]').boundingBox();
			const target = await page.locator('[data-canvas-field="due_date"]').boundingBox();
			if (!source || !target) throw new Error("drag ends not on screen");
			await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
			await page.mouse.down();
			await page.mouse.move(source.x - 40, source.y + 10, { steps: 6 });
			await page.mouse.move(target.x + target.width / 2, target.y + 6, { steps: 16 });
			await page.mouse.move(target.x + target.width / 2, target.y + 4, { steps: 4 });
			await page.mouse.up();
			await expect(page.locator("[data-editor-panel] [data-panel-label]")).toHaveValue("Currency");
		},
	},
});
