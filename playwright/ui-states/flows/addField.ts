import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Scene } from "../scene";
import { seedSalesInvoice } from "../seed";

type Event =
	| { type: "SEARCH" }
	| { type: "SEARCH_MISS" }
	| { type: "CLEAR" }
	| { type: "CLICK_TYPE" }
	| { type: "DRAG_TYPE" };

/**
 * The right panel with nothing selected: "Add a field" and its field types. In the code this is
 * `EditorPanel.vue` (the `v-else` branch), `NewFieldTypes.vue` (`query` decides list or "No field
 * type matches.") and `newField.ts` (`addFieldType` puts the field where the canvas is looking).
 * NOTE: #47462 (fields not on the layout as the first group of the panel) is not merged, so this
 * flow is captured on the current tip and is marked for recapture once #47462 lands.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "addField",
	initial: "listed",
	states: {
		listed: {
			meta: { description: "Nothing is selected: the panel reads 'Select a field or a section heading to edit it here.' and offers 'Add a field', a search box and every field type from A to Z." },
			on: { SEARCH: "searching", SEARCH_MISS: "noMatch", CLICK_TYPE: "addedByClick", DRAG_TYPE: "addedByDrag" },
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
	},
});

const search = (scene: Scene) => scene.page.getByPlaceholder("Search field types");
const types = (scene: Scene) => scene.page.locator("[data-new-field-types]");

export const addField = defineFlow<Event>({
	id: "add-field",
	title: "Add a field",
	source:
		"frontend/src/pages/doctypeEditor/EditorPanel.vue, NewFieldTypes.vue, newField.ts, canvasDrops.ts. NOTE: #47462 (fields not on the layout as the first group of the panel) is not merged; this flow is marked for recapture once it lands.",
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
