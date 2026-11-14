import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Scene } from "../scene";
import { seedSalesInvoice } from "../seed";

type Event =
	| { type: "OPEN_MENU" }
	| { type: "CLOSE_MENU" }
	| { type: "PICK_SIDE_PANEL" }
	| { type: "PICK_QUICK_ENTRY" }
	| { type: "PLACE_FIELD" }
	| { type: "CHOOSE_ADD" }
	| { type: "SUBMIT_NO_TITLE" }
	| { type: "FILL_IT" }
	| { type: "CREATE" }
	| { type: "OPEN_MENU_AGAIN" }
	| { type: "CHOOSE_RENAME" }
	| { type: "RENAME" }
	| { type: "CHOOSE_CONDITION" }
	| { type: "CLEAR_CONDITION" }
	| { type: "ADD_SECOND" }
	| { type: "CLEAR_SECOND_CONDITION" }
	| { type: "CHOOSE_DELETE" };

/**
 * The layout crumb in the editor header and what hangs off it. In the code: `LayoutMenu.vue` and
 * `LayoutMenuBody.vue` (the popover), `layoutMenu.ts` (rows and acts), `layoutDialogs.ts` and
 * `AddLayoutDialog.vue` (the dialogs), `layoutActs.ts` (the `layouts` acts), `DesignCanvas.openLayout`
 * (which layout the canvas draws), `SidePanelCanvas.vue` and `QuickEntryCanvas.vue` (the canvases).
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "layouts",
	initial: "details",
	states: {
		details: {
			meta: { description: "The editor on the Details layout of a saved DocType: the layout crumb in the header names it, the canvas draws the form." },
			on: { OPEN_MENU: "menu" },
		},
		menu: {
			meta: { description: "The layout menu open under the crumb: Details, Side panel, Quick entry and New record, each with where its layout comes from, then 'Add layout…'." },
			on: { CLOSE_MENU: "details", PICK_SIDE_PANEL: "sidePanelEmpty", PICK_QUICK_ENTRY: "quickEntry", CHOOSE_ADD: "addDialog" },
		},
		sidePanelEmpty: {
			meta: { description: "The Side panel layout when it has no fields: the 380px record panel with its locked built-ins block and 'No fields on the side panel yet'." },
			on: { PLACE_FIELD: "sidePanelFilled" },
		},
		sidePanelFilled: {
			meta: { description: "The Side panel after a field is placed from the tray: the field shows as a label-left row under the built-ins block." },
		},
		quickEntry: {
			meta: { description: "The Quick entry layout inside a frame of the Create dialog: title, close mark, the fields, and the inert Create button." },
		},
		addDialog: {
			meta: { description: "The 'Add a layout' dialog: Title, Based on, Show it when, Start from, with Create disabled until title and condition are filled." },
			on: { SUBMIT_NO_TITLE: "addTitleMissing", FILL_IT: "addDialogFilled" },
		},
		addTitleMissing: {
			meta: {
				description: "Create pressed with the Title empty: the browser's own 'Please fill out this field' bubble on Title, and no layout is added.",
				transient: true,
			},
		},
		addDialogFilled: {
			meta: { description: "The 'Add a layout' dialog with a title and a condition filled: Create is enabled." },
			on: { CREATE: "added" },
		},
		added: {
			meta: { description: "The new conditional layout is open: the crumb now reads its title, and the canvas draws a copy of Details." },
			on: { OPEN_MENU_AGAIN: "menuWithLayout" },
		},
		menuWithLayout: {
			meta: { description: "The menu with a conditional layout under Details (its title, its condition in gray, its source) and the open layout's acts: Rename, Edit condition, Delete layout." },
			on: { CHOOSE_RENAME: "renameDialog", CHOOSE_CONDITION: "conditionDialog", CHOOSE_DELETE: "deleted" },
		},
		renameDialog: {
			meta: { description: "The 'Rename layout' dialog with the current title in its field and a Rename button." },
			on: { RENAME: "renamed" },
		},
		renamed: {
			meta: { description: "The layout after Rename: the crumb shows the new title." },
		},
		conditionDialog: {
			meta: { description: "The 'Edit condition' dialog with the current condition, a hint about JavaScript on doc and a Save condition button." },
			on: { CLEAR_CONDITION: "conditionCleared" },
		},
		conditionCleared: {
			meta: { description: "Save condition with an empty condition: no default Details layout exists yet, so the layout becomes the default one and the crumb reads Details again." },
			on: { ADD_SECOND: "secondAdded" },
		},
		secondAdded: {
			meta: { description: "A second conditional layout, 'Weekend orders', added next to the default one made from the first: its title is on the crumb." },
			on: { CLEAR_SECOND_CONDITION: "conditionRefused" },
		},
		conditionRefused: {
			meta: { description: "Save condition with an empty condition while another Details layout is already the default: the editor refuses, because only one Details layout can have no condition." },
		},
		deleted: {
			meta: { description: "Delete layout ran: the conditional layout is gone and the canvas falls back to Details." },
		},
	},
});

const crumb = (scene: Scene) => scene.page.locator("[data-layout-crumb]");
const menu = (scene: Scene) => scene.page.locator("[data-layout-menu]");
const addDialog = (scene: Scene) => scene.page.locator("[data-add-layout-dialog]");
const textDialog = (scene: Scene) => scene.page.locator("[data-layout-text-dialog]");

export const layouts = defineFlow<Event>({
	id: "layouts",
	title: "Layout menu, Add a layout, Side panel, Quick entry",
	source:
		"frontend/src/pages/doctypeEditor/LayoutMenu.vue, LayoutMenuBody.vue, layoutMenu.ts, layoutDialogs.ts, AddLayoutDialog.vue, layoutActs.ts, SidePanelCanvas.vue, QuickEntryCanvas.vue",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
		await expect(crumb(scene)).toHaveText("Details");
	},
	events: {
		async OPEN_MENU(scene) {
			await openMenu(scene);
		},
		async OPEN_MENU_AGAIN(scene) {
			await openMenu(scene);
			await expect(menu(scene).locator("[data-layout-act='rename']")).toBeVisible();
		},
		async CLOSE_MENU(scene) {
			await scene.page.keyboard.press("Escape");
			await expect(menu(scene)).toBeHidden();
		},
		async PICK_SIDE_PANEL(scene) {
			await menu(scene).locator("[data-layout-row='Side Panel']").click();
			await expect(crumb(scene)).toHaveText("Side panel");
			await expect(scene.page.locator("[data-canvas-side-panel]")).toBeVisible();
		},
		async PICK_QUICK_ENTRY(scene) {
			await menu(scene).locator("[data-layout-row='Quick Entry']").click();
			await expect(crumb(scene)).toHaveText("Quick entry");
			await expect(scene.page.locator("[data-canvas-quick-entry]")).toBeVisible();
		},
		async PLACE_FIELD(scene) {
			await scene.page.locator("[data-panel-tray-field='customer']").click();
			await expect(scene.page.locator("[data-canvas-side-panel-empty]")).toBeHidden();
		},
		async CHOOSE_ADD(scene) {
			await menu(scene).locator("[data-layout-add]").click();
			await expect(addDialog(scene)).toBeVisible();
		},
		async SUBMIT_NO_TITLE(scene) {
			await addDialog(scene).locator("[data-add-layout-condition] input, input[data-add-layout-condition]").fill("doc.status == 'Overdue'");
			await addDialog(scene).locator("[data-add-layout-title]").focus();
			await scene.page.keyboard.press("Enter");
			await expect(addDialog(scene).locator("[data-add-layout-title]:invalid, [data-add-layout-title] :invalid")).toHaveCount(1);
			await expect(addDialog(scene)).toBeVisible();
		},
		async FILL_IT(scene) {
			await addDialog(scene).getByLabel("Title").fill("Overdue invoices");
			await addDialog(scene).getByLabel("Show it when").fill("doc.status == 'Overdue'");
			await expect(addDialog(scene).locator("[data-add-layout-submit]")).toBeEnabled();
		},
		async CREATE(scene) {
			await addDialog(scene).locator("[data-add-layout-submit]").click();
			await expect(crumb(scene)).toHaveText("Overdue invoices");
		},
		async CHOOSE_RENAME(scene) {
			await menu(scene).locator("[data-layout-act='rename']").click();
			await expect(textDialog(scene)).toBeVisible();
		},
		async RENAME(scene) {
			await textDialog(scene).getByLabel("Title").fill("Overdue and unpaid");
			await textDialog(scene).getByRole("button", { name: "Rename" }).click();
			await expect(crumb(scene)).toHaveText("Overdue and unpaid");
		},
		async CHOOSE_CONDITION(scene) {
			await menu(scene).locator("[data-layout-act='edit_condition']").click();
			await expect(textDialog(scene)).toBeVisible();
		},
		async CLEAR_CONDITION(scene) {
			await textDialog(scene).getByLabel("Show it when").fill("");
			await textDialog(scene).getByRole("button", { name: "Save condition" }).click();
			await expect(crumb(scene)).toHaveText("Details");
		},
		async ADD_SECOND(scene) {
			await openMenu(scene);
			await menu(scene).locator("[data-layout-add]").click();
			await expect(addDialog(scene)).toBeVisible();
			await addDialog(scene).getByLabel("Title").fill("Weekend orders");
			await addDialog(scene).getByLabel("Show it when").fill("doc.is_pos == 1");
			await addDialog(scene).locator("[data-add-layout-submit]").click();
			await expect(crumb(scene)).toHaveText("Weekend orders");
		},
		async CLEAR_SECOND_CONDITION(scene) {
			await openMenu(scene);
			await menu(scene).locator("[data-layout-act='edit_condition']").click();
			await expect(textDialog(scene)).toBeVisible();
			await textDialog(scene).getByLabel("Show it when").fill("");
			await textDialog(scene).getByRole("button", { name: "Save condition" }).click();
			await expect(scene.page.getByText(/Only one Details layout can have no condition/).first()).toBeVisible();
		},
		async CHOOSE_DELETE(scene) {
			await menu(scene).locator("[data-layout-act='delete']").click();
			await expect(crumb(scene)).toHaveText("Details");
		},
	},
});

async function openMenu(scene: Scene): Promise<void> {
	await crumb(scene).click();
	await expect(menu(scene)).toBeVisible();
}
