import { expect, type Locator, type Page } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Scene } from "../scene";
import { CUSTOMIZE_TARGET, resetCustomizations, seedInvoiceRecords, seedSalesInvoice } from "../seed";

type Event =
	| { type: "OPEN_MORE" }
	| { type: "OPEN_LIST" }
	| { type: "CHOOSE_RENAME" }
	| { type: "CHOOSE_DELETE" }
	| { type: "TYPES_NEW_NAME" }
	| { type: "TYPES_DOCTYPE_NAME" }
	| { type: "CONFIRM_RENAME" }
	| { type: "CONFIRM_DELETE" }
	| { type: "CANCELS" }
	| { type: "DISCARDS" }
	| { type: "OPEN_SECTION_MENU" }
	| { type: "RIGHT_CLICK_SECTION" }
	| { type: "RIGHT_CLICK_COLUMN" }
	| { type: "RIGHT_CLICK_FIELD" }
	| { type: "ADD_COLUMN" }
	| { type: "MOVE_UP" }
	| { type: "REMOVE_SECTION" }
	| { type: "OPEN_TYPE_MENU" }
	| { type: "HOVER_MORE_TYPES" }
	| { type: "PICK_DATETIME" }
	| { type: "OPEN_TAB_MENU" }
	| { type: "PICK_PAYMENTS_TAB" }
	| { type: "OPENS_CUSTOMIZE" }
	| { type: "OPEN_CUSTOMIZE_MORE" }
	| { type: "RESET_ALL" }
	| { type: "RESET_ALL_AFTER_SITE_CHANGES" }
	| { type: "CONFIRM_RESET" }
	| { type: "DEVELOPER_OPENS_MORE" }
	| { type: "CHOOSE_EXPORT" };

/**
 * Every menu of the editor and the dialogs each one opens. In the code: the header's ⋯ menu
 * (`EditorHeader.vue`, its items come from the `danger` and `customize` acts), the section's ⋯
 * (`canvasMenu.ts`), the field panel's Type and Tab menus (`fieldPanel.ts`, `FieldTabRow.vue`), and
 * the dialogs `dangerHost.ts` and `customizeHost.ts` open. The layout crumb's menu is the `layouts`
 * flow; a column, a tab and a field have no ⋯ menu of their own.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "menus",
	initial: "editor",
	states: {
		editor: {
			meta: { description: "Design mode on a saved custom DocType, nothing selected: the header's ⋯ button sits beside Undo, Redo and Save." },
			on: {
				OPEN_MORE: "headerMenu",
				OPEN_SECTION_MENU: "sectionMenu",
				RIGHT_CLICK_SECTION: "sectionContextMenu",
				RIGHT_CLICK_COLUMN: "columnContextMenu",
				RIGHT_CLICK_FIELD: "fieldContextMenu",
				OPEN_TYPE_MENU: "typeMenu",
				OPEN_TAB_MENU: "tabMenu",
				OPENS_CUSTOMIZE: "customizeEditor",
			},
		},
		headerMenu: {
			meta: { description: "The header's ⋯ menu in Design: Open the list, then Rename DocType and Delete DocType." },
			on: { OPEN_LIST: "invoiceList", CHOOSE_RENAME: "renameDialog", CHOOSE_DELETE: "deleteDialog" },
		},
		invoiceList: {
			meta: { description: "Open list: the editor is left for the DocType's own record list." },
		},
		renameDialog: {
			meta: { description: "Rename DocType: the name field holds the current name, the dialog says which table moves and that no other DocType points here, and Rename is disabled until the name changes." },
			on: { TYPES_NEW_NAME: "renameReady", CANCELS: "editor" },
		},
		renameReady: {
			meta: { description: "A new name is typed: the table line follows it, and Rename is enabled." },
			on: { CONFIRM_RENAME: "renamed", CANCELS: "editor" },
		},
		renamed: {
			meta: { description: "The DocType has its new name: a 'Renamed … to …' toast over the editor, now at the new name." },
		},
		deleteDialog: {
			meta: { description: "Delete DocType: says what goes (the DocType, its records and its table), asks for the name typed, and Delete stays disabled until it matches." },
			on: { TYPES_DOCTYPE_NAME: "deleteReady", CANCELS: "editor" },
		},
		deleteReady: {
			meta: { description: "The DocType's name is typed in full: the red Delete button is enabled." },
			on: { CONFIRM_DELETE: "deleted", CANCELS: "editor" },
		},
		deleted: {
			meta: { description: "The DocType is gone: a 'Deleted …' toast over the DocType list." },
		},
		sectionMenu: {
			meta: { description: "A section's ⋯ menu (the Totals section on the Items tab): Move up, Move down, Move to the tab before, Move to the tab after, Add column, Remove section; a move that has nowhere to go is disabled." },
			on: { ADD_COLUMN: "columnAdded", MOVE_UP: "sectionMovedUp", REMOVE_SECTION: "sectionRemoved" },
		},
		sectionContextMenu: {
			meta: { description: "A right-click on the Totals section opens its ⋯ menu where the pointer is, and selects the section: same items as the ⋯ button." },
		},
		columnContextMenu: {
			meta: { description: "A right-click on a column of the Totals section: Move left, Move right and Remove column (the column panel's acts), and the column is selected." },
		},
		fieldContextMenu: {
			meta: { description: "A right-click on a field: Move up, Move down, Move to the column before or after, Move to tab, then Remove (the field panel's acts), and the field is selected." },
		},
		columnAdded: {
			meta: { description: "Add column: the Totals section has a third, empty column, the header says Not saved and Save is enabled." },
			// The header's ⋯ menu offers Rename and Delete only when nothing is pending: it asks first.
			on: { CHOOSE_RENAME: "saveFirstDialog" },
		},
		saveFirstDialog: {
			meta: { description: "Save before you go on?: Rename asked while edits are pending, so the dialog offers Cancel, Discard and Save first." },
			on: { CANCELS: "columnAdded", DISCARDS: "renameDialog" },
		},
		sectionMovedUp: {
			meta: { description: "Move up: the Totals section now sits above the Items table; the header says Not saved." },
		},
		sectionRemoved: {
			meta: { description: "Remove section: the Totals heading is gone and its fields moved into the section above; the header says Not saved." },
		},
		typeMenu: {
			meta: { description: "The field panel's Type menu on a saved Date field: the common types, then More types." },
			on: { HOVER_MORE_TYPES: "typeMenuMore", PICK_DATETIME: "typeChanged" },
		},
		typeMenuMore: {
			meta: { description: "More types: a submenu beside the Type menu lists the types that are not common." },
		},
		typeChanged: {
			meta: { description: "Datetime picked: the panel's Type reads Datetime and the header says Not saved." },
		},
		tabMenu: {
			meta: { description: "The field panel's Tab menu: the form's tabs, to move the selected field to another one." },
			on: { PICK_PAYMENTS_TAB: "fieldMovedToTab" },
		},
		fieldMovedToTab: {
			meta: { description: "Payments picked: the Payments tab opens with the field at the end of its first section, still selected." },
		},
		customizeEditor: {
			meta: { description: "Customize mode on Event, a standard DocType: the crumbs read Event / Customize, and the site has not changed it." },
			on: { OPEN_CUSTOMIZE_MORE: "customizeMenu", DEVELOPER_OPENS_MORE: "customizeMenuDeveloper" },
		},
		customizeMenu: {
			meta: { description: "The header's ⋯ menu in Customize without developer mode: Reset all customizations only." },
			on: { RESET_ALL: "resetNothing", RESET_ALL_AFTER_SITE_CHANGES: "resetList" },
		},
		resetNothing: {
			meta: { description: "Reset Event? when the site has changed nothing: 'Nothing to reset', Reset all disabled." },
			on: { CANCELS: "customizeEditor" },
		},
		resetList: {
			meta: { description: "Reset Event? after the site added custom fields and changed a property: the dialog lists what goes, says the values stay, and Reset all is enabled." },
			on: { CONFIRM_RESET: "resetDone", CANCELS: "customizeEditor" },
		},
		resetDone: {
			meta: { description: "Reset: a 'Reset Event.' toast and the editor loaded again as the app ships it." },
		},
		customizeMenuDeveloper: {
			meta: { description: "The same ⋯ menu on a site in developer mode: Export to an app joins Reset all customizations." },
			on: { CHOOSE_EXPORT: "exportDialog" },
		},
		exportDialog: {
			meta: { description: "Export customizations: the module (Desk, the DocType's own) and the file it writes, Apply on migrate on, Include permissions off, what the file carries, Export." },
		},
	},
});

const page = (scene: Scene): Page => scene.page;

const header = (scene: Scene) => page(scene).locator("[data-editor-more]");

/** The doctype the Design states edit once the seed is in: a saved custom DocType with two records. */
const INVOICE = "UI Sales Invoice";
const RENAMED = "UI Customer Invoice";

export const menus = defineFlow<Event>({
	id: "menus",
	title: "The ⋯ menus and their dialogs",
	source: "frontend/src/pages/doctypeEditor/EditorHeader.vue, canvasMenu.ts, fieldPanel.ts, FieldTabRow.vue, dangerActs.ts, dangerHost.ts, customizeActs.ts, customizeHost.ts",
	machine,
	async enter(scene) {
		await nameBack(scene);
		await seedSalesInvoice(scene);
		await clearRecords(scene);
		await seedInvoiceRecords(scene);
		scene.onClose(() => tidy(scene));
		resetCustomizations(scene);
		await openPage(scene, `/apps/desk/doctype/${encodeURIComponent(INVOICE)}`);
		await expect(page(scene).getByRole("heading", { name: INVOICE, level: 1 })).toBeVisible();
		await expect(header(scene)).toBeVisible();
	},
	events: {
		async OPEN_MORE(scene) {
			await openHeaderMenu(scene);
			await expect(menuItem(scene, /Open UI Sales Invoice list/)).toBeVisible();
		},
		async OPEN_LIST(scene) {
			await menuItem(scene, /Open UI Sales Invoice list/).click();
			await expect(page(scene).getByText("Northwind Traders").first()).toBeVisible();
		},
		async CHOOSE_RENAME(scene) {
			await openHeaderMenu(scene);
			await menuItem(scene, /Rename DocType/).click();
			await expect(page(scene).getByRole("dialog")).toBeVisible();
			// Pending edits ask first, and the question is the dialog now.
			const asks = await page(scene).locator("[data-mode-switch-dialog]").count();
			if (!asks) {
				await expect(page(scene).locator("[data-rename-doctype-dialog]")).toBeVisible();
				await expect(page(scene).locator("[data-rename-links]")).toBeVisible();
			}
		},
		async CHOOSE_DELETE(scene) {
			await openHeaderMenu(scene);
			await menuItem(scene, /Delete DocType/).click();
			await expect(page(scene).locator("[data-delete-doctype-dialog]")).toBeVisible();
		},
		async TYPES_NEW_NAME(scene) {
			await page(scene).getByLabel("New name").fill(RENAMED);
			await expect(page(scene).getByRole("button", { name: "Rename", exact: true })).toBeEnabled();
			await expect(page(scene).locator("[data-rename-doctype-dialog]").getByText(`tab${RENAMED}`)).toBeVisible();
		},
		async TYPES_DOCTYPE_NAME(scene) {
			await page(scene).getByLabel(`Type ${INVOICE} to confirm`).fill(INVOICE);
			await expect(page(scene).getByRole("button", { name: `Delete ${INVOICE}` })).toBeEnabled();
		},
		async CONFIRM_RENAME(scene) {
			// The scene's own clean-up looks for the old name: `tidy` names it back first.
			await page(scene).getByRole("button", { name: "Rename", exact: true }).click();
			await expect(page(scene).getByText(`Renamed ${INVOICE} to ${RENAMED}.`)).toBeVisible();
			await expect(page(scene).getByRole("heading", { name: RENAMED, level: 1 })).toBeVisible();
		},
		async CONFIRM_DELETE(scene) {
			await page(scene).getByRole("button", { name: `Delete ${INVOICE}` }).click();
			await expect(page(scene).getByText(`Deleted ${INVOICE}.`)).toBeVisible();
			await expect(page(scene).locator("[data-doctype-editor]")).toBeHidden();
		},
		async CANCELS(scene) {
			await page(scene).getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
			await expect(page(scene).getByRole("dialog")).toBeHidden();
		},
		async DISCARDS(scene) {
			await page(scene).getByRole("dialog").getByRole("button", { name: "Discard" }).click();
			await expect(page(scene).locator("[data-rename-doctype-dialog]")).toBeVisible();
		},
		async OPEN_SECTION_MENU(scene) {
			await sectionOfItemsTab(scene);
			await expect(menuItem(scene, "Remove section")).toBeVisible();
		},
		async RIGHT_CLICK_SECTION(scene) {
			await page(scene).getByRole("tab", { name: "Items" }).click();
			const totals = sectionsOf(scene).last();
			await totals.scrollIntoViewIfNeeded();
			const box = (await totals.boundingBox())!;
			await page(scene).mouse.click(box.x + box.width - 6, box.y + 10, { button: "right" });
			await expect(menuItem(scene, "Remove section")).toBeVisible();
		},
		async RIGHT_CLICK_COLUMN(scene) {
			await page(scene).getByRole("tab", { name: "Items" }).click();
			const column = sectionsOf(scene).last().locator("[data-canvas-column]").nth(1);
			await column.scrollIntoViewIfNeeded();
			const box = (await column.boundingBox())!;
			await page(scene).mouse.click(box.x + box.width / 2, box.y + box.height - 6, { button: "right" });
			await expect(menuItem(scene, "Remove column")).toBeVisible();
		},
		async RIGHT_CLICK_FIELD(scene) {
			await page(scene).locator("[data-canvas-field]").filter({ hasText: "Posting date" }).first().click({ button: "right" });
			await expect(menuItem(scene, /Move to tab/)).toBeVisible();
		},
		async ADD_COLUMN(scene) {
			await menuItem(scene, "Add column").click();
			await expect(notSaved(scene)).toBeVisible();
			await expect(sectionsOf(scene).last().locator("[data-canvas-column]")).toHaveCount(3);
		},
		async MOVE_UP(scene) {
			await menuItem(scene, "Move up").click();
			await expect(notSaved(scene)).toBeVisible();
			await expect(sectionsOf(scene).first().getByText("Net total")).toBeVisible();
		},
		async REMOVE_SECTION(scene) {
			await menuItem(scene, "Remove section").click();
			await expect(notSaved(scene)).toBeVisible();
			await expect(sectionsOf(scene)).toHaveCount(1);
		},
		async OPEN_TYPE_MENU(scene) {
			await selectField(scene, "Payment due date");
			await page(scene).locator("[data-panel-type]").click();
			await expect(menuItem(scene, "More types")).toBeVisible();
		},
		async HOVER_MORE_TYPES(scene) {
			await menuItem(scene, "More types").hover();
			await expect(menuItem(scene, "Geolocation")).toBeVisible();
		},
		async PICK_DATETIME(scene) {
			await menuItem(scene, "Datetime").click();
			await expect(page(scene).locator("[data-panel-type]")).toContainText("Datetime");
			await expect(notSaved(scene)).toBeVisible();
		},
		async OPEN_TAB_MENU(scene) {
			await selectField(scene, "Payment due date");
			await page(scene).locator("[data-panel-tab]").click();
			await expect(menuItem(scene, "More information")).toBeVisible();
		},
		async PICK_PAYMENTS_TAB(scene) {
			await menuItem(scene, "Payments").click();
			await expect(page(scene).getByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "true");
			await expect(page(scene).locator("[data-panel-tab]")).toContainText("Payments");
		},
		async OPENS_CUSTOMIZE(scene) {
			await openPage(scene, `/apps/desk/doctype/${CUSTOMIZE_TARGET}?mode=customize`);
			await expect(page(scene).getByRole("heading", { name: CUSTOMIZE_TARGET, level: 1 })).toBeVisible();
			await expect(page(scene).locator("[data-crumbs]").getByText("Customize")).toBeVisible();
		},
		async OPEN_CUSTOMIZE_MORE(scene) {
			await header(scene).click();
			await expect(menuItem(scene, "Reset all customizations")).toBeVisible();
			await expect(menuItem(scene, /Export to an app/)).toHaveCount(0);
		},
		async RESET_ALL(scene) {
			await menuItem(scene, "Reset all customizations").click();
			await expect(page(scene).locator("[data-reset-all-dialog]")).toBeVisible();
			await expect(page(scene).getByText(`This site has not changed ${CUSTOMIZE_TARGET}. Nothing to reset.`)).toBeVisible();
		},
		async RESET_ALL_AFTER_SITE_CHANGES(scene) {
			await siteChangesEvent(scene);
			await menuItem(scene, "Reset all customizations").click();
			await expect(page(scene).locator("[data-reset-all-dialog]")).toBeVisible();
			await expect(page(scene).getByText("Removes what this site changed:")).toBeVisible();
		},
		async CONFIRM_RESET(scene) {
			await page(scene).getByRole("button", { name: "Reset all", exact: true }).click();
			await expect(page(scene).getByText(`Reset ${CUSTOMIZE_TARGET}.`)).toBeVisible();
		},
		async DEVELOPER_OPENS_MORE(scene) {
			// The site under test is not in developer mode: boot says it is, as it does on a developer's site.
			await page(scene).route(/shell\.boot\.get_boot(\?|$)/, async (route) => {
				const response = await route.fetch();
				const body = await response.json();
				const boot = body.message ?? body.data ?? body;
				boot.developer_mode = true;
				await route.fulfill({ response, json: body });
			});
			await openPage(scene, `/apps/desk/doctype/${CUSTOMIZE_TARGET}?mode=customize`);
			await expect(page(scene).getByRole("heading", { name: CUSTOMIZE_TARGET, level: 1 })).toBeVisible();
			await header(scene).click();
			await expect(menuItem(scene, /Export to an app/)).toBeVisible();
		},
		async CHOOSE_EXPORT(scene) {
			await menuItem(scene, /Export to an app/).click();
			await expect(page(scene).locator("[data-export-dialog]")).toBeVisible();
			await expect(page(scene).locator("[data-export-file]")).toContainText("custom/event.json");
		},
	},
});

/** Opens a page; the shared test site sometimes fails the desk's first requests, so a failed start is tried once more. */
async function openPage(scene: Scene, path: string): Promise<void> {
	await scene.goto(path);
	for (let attempt = 0; attempt < 2; attempt++) {
		if (!(await page(scene).getByText("The desk could not start.").isVisible())) return;
		await scene.goto(path);
	}
}

function menuItem(scene: Scene, name: string | RegExp): Locator {
	return page(scene).getByRole("menuitem", { name });
}

/** Opens the header's menu unless the path already has it open. */
async function openHeaderMenu(scene: Scene): Promise<void> {
	if (!(await page(scene).getByRole("menu").isVisible())) await header(scene).click();
	await expect(page(scene).getByRole("menu")).toBeVisible();
}

const notSaved = (scene: Scene): Locator => page(scene).getByText("Not saved", { exact: true });

const sectionsOf = (scene: Scene): Locator => page(scene).locator("[data-canvas-section]");

/** Opens the Items tab and the ⋯ menu of its last section, Totals. */
async function sectionOfItemsTab(scene: Scene): Promise<void> {
	await page(scene).getByRole("tab", { name: "Items" }).click();
	const totals = sectionsOf(scene).last();
	await totals.scrollIntoViewIfNeeded();
	await totals.hover();
	await totals.getByRole("button", { name: "Section actions" }).click();
}

async function selectField(scene: Scene, label: string): Promise<void> {
	await page(scene).locator("[data-canvas-field]").filter({ hasText: label }).first().click();
	await expect(page(scene).locator("[data-panel-type]")).toBeVisible();
}

/** The site customizes Event after the editor loaded: a custom field and a changed label. */
/** `scene.insert` for after the page has booted: it sends the CSRF token the session holds by then. */
async function insertNow(scene: Scene, doctype: string, doc: Record<string, unknown>): Promise<void> {
	const res = await scene.api.post(`/api/resource/${doctype}`, { data: { doctype, ...doc }, headers: await csrf(scene) });
	if (!res.ok()) throw new Error(`insert ${doctype}: ${await res.text()}`);
	const { data } = (await res.json()) as { data: { name: string } };
	scene.track(doctype, data.name);
}

async function siteChangesEvent(scene: Scene): Promise<void> {
	await insertNow(scene, "Custom Field", { dt: CUSTOMIZE_TARGET, fieldname: "catering_notes", fieldtype: "Small Text", label: "Catering notes", insert_after: "location" });
	await insertNow(scene, "Custom Field", { dt: CUSTOMIZE_TARGET, fieldname: "room_booking", fieldtype: "Data", label: "Room booking", insert_after: "location" });
	await insertNow(scene, "Property Setter", {
		doctype_or_field: "DocField",
		doc_type: CUSTOMIZE_TARGET,
		field_name: "subject",
		property: "label",
		property_type: "Data",
		value: "Event title",
	});
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
	await clearCustomizations(scene);
}

/** What `resetCustomizations` removes, with the CSRF token it lacks: this flow adds site changes to Event after the page opened. */
async function clearCustomizations(scene: Scene): Promise<void> {
	const kinds: Array<[string, string]> = [["Property Setter", "doc_type"], ["Custom Field", "dt"], ["DocType Layout", "document_type"]];
	for (const [kind, field] of kinds) {
		const res = await scene.api.get(`/api/resource/${encodeURIComponent(kind)}`, { params: { filters: JSON.stringify([[field, "=", CUSTOMIZE_TARGET]]), limit_page_length: 500 }, failOnStatusCode: false });
		if (!res.ok()) continue;
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data) await remove(scene, `/api/resource/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`);
	}
}
