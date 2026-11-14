import { expect, type Locator } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";
import { seedInvoiceRecords, seedSalesInvoice } from "../seed";

type Event =
	| { type: "EDIT_CHILD" }
	| { type: "CHILD_LOADS" }
	| { type: "CHILD_FAILS" }
	| { type: "EDIT_AGAIN" }
	| { type: "OPENS_PREVIEW" }
	| { type: "OPENS_SETTINGS" }
	| { type: "EDITS_ITEM_LABEL" }
	| { type: "BACK_VIA_TABLE_CRUMB" }
	| { type: "BACK_VIA_DOCTYPE_CRUMB" }
	| { type: "ADDS_TABLE_FIELD" }
	| { type: "CHOOSES_NEW_CHILD" }
	| { type: "NAMES_TAKEN_CHILD" }
	| { type: "NAMES_NEW_CHILD" }
	| { type: "EDITS_NEW_CHILD" };

/**
 * A Table field's child DocType opened in the editor, from `&table=<fieldname>` in the address. In
 * the code: `useChildTables.ts` (the address, the crumbs), `childTables.ts` (`show` loads the child
 * once, `open`), `EditorHeader.vue` (child crumbs), `EditorCanvas.vue` (the row grid), `NewChildDialog.vue`
 * and `childSource.ts` (a child made from the parent's editor, not saved yet).
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "child",
	initial: "parentTable",
	states: {
		parentTable: {
			meta: { description: "The parent's Items tab with its Table field selected: the panel names the child table and offers 'Edit UI Sales Invoice Item'." },
			on: { EDIT_CHILD: "childLoading", ADDS_TABLE_FIELD: "childPicker" },
		},
		childLoading: {
			meta: { description: "Edit was clicked and the child's editor has not loaded: the address already has the child's table, but the screen still shows the parent with nothing to say it is loading." },
			on: { CHILD_LOADS: "childOpen", CHILD_FAILS: "childFailed" },
		},
		childFailed: {
			meta: { description: "The child's load failed: an error toast, the screen stays on the parent while the address still names the child table." },
			on: { EDIT_AGAIN: "childStillParent" },
		},
		childStillParent: {
			meta: { description: "Edit clicked again once the server answers: nothing happens, because the address already names the child table, so the parent stays and the child never opens." },
		},
		childOpen: {
			meta: { description: "The child's editor: the crumbs read DocType / UI Sales Invoice / Items / UI Sales Invoice Item, the form's grid is drawn under the meta line and the panel edits the grid columns." },
			on: { OPENS_PREVIEW: "childPreview", OPENS_SETTINGS: "childSettings", EDITS_ITEM_LABEL: "childEdited", BACK_VIA_DOCTYPE_CRUMB: "backToParent" },
		},
		childPreview: {
			meta: { description: "The child's Preview tab: one row's dialog drawn from the fields as edited, with 'Changes here are not saved'; Undo and Redo are hidden." },
		},
		childSettings: {
			meta: { description: "The child's Settings tab: only Form and List and search; Track changes and Editable grid, with no Danger zone and no header ⋯ menu." },
		},
		childEdited: {
			meta: { description: "A label changed in the child: the header says Not saved, Save is enabled, and the grid in the child's own form follows." },
			on: { BACK_VIA_TABLE_CRUMB: "parentWithChildEdits" },
		},
		parentWithChildEdits: {
			meta: { description: "Back on the parent through the 'Items' crumb: the Table field is selected again, the header still says Not saved, and the grid shows the child's new label." },
		},
		backToParent: {
			meta: { description: "Back on the parent through the DocType's name in the crumbs: it shows as it was left, the Items tab open and the Table field still selected, with nothing to say a child editor was open." },
		},
		childPicker: {
			meta: { description: "A Table field was added from the panel and has no child yet; its Child table list is open, with 'New child table…' at its foot (the list does not open by itself after the add, as the code's comment says: here a click opened it)." },
			on: { CHOOSES_NEW_CHILD: "newChildDialog" },
		},
		newChildDialog: {
			meta: { description: "New child table: the name is prefilled from the parent and the field's label, with where the child will live; Create is enabled." },
			on: { NAMES_TAKEN_CHILD: "newChildTaken", NAMES_NEW_CHILD: "newChildChosen" },
		},
		newChildTaken: {
			meta: { description: "Create found a DocType with that name: 'A DocType named … exists already' under the name, and the dialog stays open." },
		},
		newChildChosen: {
			meta: { description: "Create was clicked: the dialog closes without opening anything, the Table field now names the new child ('Edit … ↗' beside 'No grid columns yet') and the header says Not saved." },
			on: { EDITS_NEW_CHILD: "newChildEditor" },
		},
		newChildEditor: {
			meta: { description: "The new child's editor, before any save: the crumbs end in its name without a layout menu, an empty row form, Not saved in the header, nothing on the site yet." },
		},
	},
});

const holds = new WeakMap<Scene, Hold>();
const PARENT = "UI Sales Invoice";
const CHILD = "UI Sales Invoice Item";
const INVOICE = PARENT;
const RENAMED = "UI Customer Invoice";

const page = (scene: Scene) => scene.page;
const notSaved = (scene: Scene): Locator => page(scene).getByText("Not saved", { exact: true });
const crumbs = (scene: Scene): Locator => page(scene).locator("[data-crumbs]");

export const child = defineFlow<Event>({
	id: "child",
	title: "Child editor",
	source: "frontend/src/pages/doctypeEditor/useChildTables.ts, childTables.ts, childSource.ts, EditorHeader.vue, EditorCanvas.vue, NewChildDialog.vue, TableFieldRows.vue",
	machine,
	async enter(scene) {
		await nameBack(scene);
		await seedSalesInvoice(scene);
		await clearRecords(scene);
		await seedInvoiceRecords(scene);
		scene.onClose(() => tidy(scene));
		// Holds only the child's editor load; the parent's own load passes. Released by CHILD_LOADS.
		holds.set(scene, await scene.hold(/get_doctype_editor\?.*UI(%20|\+| )Sales(%20|\+| )Invoice(%20|\+| )Item/));
		await openPage(scene, `/apps/desk/doctype/${encodeURIComponent(PARENT)}`);
		await expect(page(scene).getByRole("heading", { name: PARENT, level: 1 })).toBeVisible();
		await page(scene).getByRole("tab", { name: "Items" }).click();
		await page(scene).locator("[data-canvas-field]").filter({ hasText: "Items" }).first().click();
		await expect(page(scene).locator("[data-open-child]")).toBeVisible();
	},
	events: {
		async EDIT_CHILD(scene) {
			await page(scene).locator("[data-open-child]").click();
			await expect(page(scene)).toHaveURL(/table=items/);
		},
		async CHILD_LOADS(scene) {
			await holds.get(scene)!.release();
			await childEditorShown(scene);
		},
		async CHILD_FAILS(scene) {
			await holds.get(scene)!.abort();
			await expect(page(scene).getByRole("region", { name: /Notifications/ }).getByRole("listitem")).toBeVisible();
		},
		async EDIT_AGAIN(scene) {
			await holds.get(scene)!.release();
			await page(scene).locator("[data-open-child]").click();
			// A moment to let a child editor show if it were going to.
			await scene.settle(1500);
			await expect(page(scene).locator("[data-child-grid]")).toHaveCount(0);
		},
		async OPENS_PREVIEW(scene) {
			await page(scene).getByRole("tab", { name: "Preview" }).click();
			await expect(page(scene).getByText("A row of Items opens this form.")).toBeVisible();
		},
		async OPENS_SETTINGS(scene) {
			await page(scene).getByRole("tab", { name: "Settings" }).click();
			await expect(page(scene).getByText("Editable grid")).toBeVisible();
		},
		async EDITS_ITEM_LABEL(scene) {
			await page(scene).locator("[data-canvas-field]").filter({ hasText: "Item" }).first().click();
			const label = page(scene).locator("[data-panel-label]");
			await label.fill("Item code");
			await label.press("Enter");
			await expect(notSaved(scene)).toBeVisible();
		},
		async BACK_VIA_TABLE_CRUMB(scene) {
			await crumbs(scene).getByRole("button", { name: "Items" }).click();
			await expect(page(scene).locator("[data-open-child]")).toBeVisible();
			await expect(page(scene).locator("[data-grid-summary]")).toContainText("Item code");
		},
		async BACK_VIA_DOCTYPE_CRUMB(scene) {
			await crumbs(scene).getByRole("button", { name: PARENT, exact: true }).click();
			await expect(page(scene).locator("[data-child-grid]")).toHaveCount(0);
			await expect(page(scene).getByRole("heading", { name: PARENT, level: 1 })).toBeVisible();
		},
		async ADDS_TABLE_FIELD(scene) {
			// Clicking the canvas's margin clears the selection, which brings the type list back.
			await page(scene).locator("[data-editor-canvas]").click({ position: { x: 4, y: 300 } });
			await page(scene).locator('[data-panel-new-type="Table"]').click();
			// The list opens by itself in the code's comment; open it as a person would if it has not.
			await page(scene).locator("[data-child-picker]").click();
			await expect(page(scene).locator("[data-new-child]")).toBeVisible();
		},
		async CHOOSES_NEW_CHILD(scene) {
			await page(scene).locator("[data-new-child]").click();
			await expect(page(scene).locator("[data-new-child-dialog]")).toBeVisible();
		},
		async NAMES_TAKEN_CHILD(scene) {
			await page(scene).locator("[data-new-child-dialog]").getByLabel("Name").fill("UI Customer");
			await page(scene).getByRole("button", { name: "Create" }).click();
			await expect(page(scene).getByText("A DocType named UI Customer exists already")).toBeVisible();
		},
		async NAMES_NEW_CHILD(scene) {
			await page(scene).locator("[data-new-child-dialog]").getByLabel("Name").fill("UI Sales Invoice Payment");
			await page(scene).getByRole("button", { name: "Create" }).click();
			await expect(page(scene).locator("[data-new-child-dialog]")).toBeHidden();
			await expect(page(scene).locator("[data-grid-summary]")).toContainText("No grid columns yet");
		},
		async EDITS_NEW_CHILD(scene) {
			await page(scene).locator("[data-open-child]").click();
			await expect(page(scene).locator("[data-child-grid]")).toBeVisible();
		},
	},
});

async function childEditorShown(scene: Scene): Promise<void> {
	await expect(crumbs(scene).getByText(CHILD)).toBeVisible();
	await expect(page(scene).locator("[data-child-grid]")).toBeVisible();
}

/**
 * The scene's own API calls carry no CSRF token, which the server refuses once the page has booted
 * (the session then holds one): the clean-up and the writes made after the page opened send it.
 */
async function csrf(scene: Scene): Promise<Record<string, string>> {
	const token = await scene.page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token).catch(() => undefined);
	return token ? { "X-Frappe-CSRF-Token": token } : {};
}

async function remove(scene: Scene, path: string): Promise<void> {
	await scene.api.delete(path, { headers: await csrf(scene), failOnStatusCode: false });
}

/** A run that was killed leaves its records in the tables a re-seeded DocType takes over: clear them. */
async function clearRecords(scene: Scene): Promise<void> {
	for (const doctype of ["UI Sales Invoice", "UI Customer"]) {
		const res = await scene.api.get(`/api/resource/${encodeURIComponent(doctype)}`, { params: { limit_page_length: 500 }, failOnStatusCode: false });
		if (!res.ok()) continue;
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data) await remove(scene, `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
	}
}

/**
 * Names a rename of the invoice may have left behind (the `menus` flow's, and the Danger zone flow's).
 * A SQLite rename keeps the old index name on the renamed table, so the next seed of "UI Sales
 * Invoice" fails until the DocType is named back.
 */
async function nameBack(scene: Scene): Promise<void> {
	for (const name of ["UI Customer Invoice", "UI Tax Invoice"]) {
		const found = await scene.api.get(`/api/resource/DocType/${encodeURIComponent(name)}`, { failOnStatusCode: false });
		if (!found.ok()) continue;
		await scene.api.post("/api/method/frappe.desk.doctype_editor.danger.rename_doctype", { data: { doctype: name, new_name: "UI Sales Invoice" }, headers: await csrf(scene), failOnStatusCode: false });
	}
}

/** Whatever the scene's own clean-up missed, once the scene closes: records first, then the DocTypes. */
async function tidy(scene: Scene): Promise<void> {
	await nameBack(scene);
	await clearRecords(scene);
	for (const name of ["UI Sales Invoice", "UI Sales Invoice Item", "UI Customer"]) {
		await remove(scene, `/api/resource/DocType/${encodeURIComponent(name)}`);
	}
}


/** Opens a page; the shared test site sometimes fails the desk's first requests, so a failed start is tried once more. */
async function openPage(scene: Scene, path: string): Promise<void> {
	await scene.goto(path);
	for (let attempt = 0; attempt < 2; attempt++) {
		if (!(await page(scene).getByText("The desk could not start.").isVisible())) return;
		await scene.goto(path);
	}
}
