import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import { seedInvoiceRecords, seedSalesInvoice } from "../seed";
import type { Hold, Scene } from "../scene";

type Event =
	| { type: "OPENS_PREVIEW" }
	| { type: "OPENS_PREVIEW_SLOW" }
	| { type: "RECORD_ARRIVES" }
	| { type: "RECORD_FAILS" }
	| { type: "LAYOUT_SLOW" }
	| { type: "LAYOUT_ARRIVES" }
	| { type: "LAYOUT_FAILS" }
	| { type: "OPENS_PICKER" }
	| { type: "PICKS_EMPTY_FORM" }
	| { type: "TYPES" }
	| { type: "DELETES_RECORDS" }
	| { type: "EDITS_THEN_PREVIEWS" }
	| { type: "OPENS_NEW_DOCTYPE" };

/**
 * The Preview header tab: the record page's own form on a copy of one record. In the code this is
 * `PreviewTab.vue` (the record picker, `loading`, the copy in `doc`), `previewRefusals.ts` (what
 * Preview never writes) and `DoctypeEditor.vue` (`previewName`, `latest`, the `state.pending`
 * branch that shows "Save the DocType to preview its records.").
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "preview",
	initial: "editorTab",
	states: {
		editorTab: {
			meta: { description: "UI Sales Invoice open in Design on the Editor tab, with two invoices saved: Preview has not been opened yet." },
			on: {
				OPENS_PREVIEW: "loaded",
				OPENS_PREVIEW_SLOW: "recordLoading",
				RECORD_FAILS: "recordFailed",
				LAYOUT_SLOW: "layoutLoading",
				LAYOUT_FAILS: "layoutFailed",
				DELETES_RECORDS: "noRecords",
				EDITS_THEN_PREVIEWS: "draftPreview",
				OPENS_NEW_DOCTYPE: "unsavedDoctype",
			},
		},
		loaded: {
			meta: { description: "Preview of the latest invoice: 'Previewing SINV-… Acme Fabrication' above the Details tab filled with that record, and 'Changes here are not saved.' on the right." },
			on: { OPENS_PICKER: "recordPicker", TYPES: "typedCopy" },
		},
		recordLoading: {
			meta: { description: "The invoice is still being read: 'Loading…' beside the record name, and the form under it is drawn empty until the record arrives." },
			on: { RECORD_ARRIVES: "loaded" },
		},
		recordFailed: {
			meta: { description: "The invoice could not be read: no error shows; the picker quietly falls back to 'an empty form' and the form is blank." },
		},
		layoutLoading: {
			meta: { description: "The form's layout is still being read: the record picker shows, and the area under it is blank, with no loading mark." },
			on: { LAYOUT_ARRIVES: "loaded" },
		},
		layoutFailed: {
			meta: { description: "The form's layout could not be read: the record picker shows and the area under it stays blank, with no error and no retry." },
		},
		recordPicker: {
			meta: { description: "The record picker is open under 'Previewing': 'Empty form' and the two invoices, newest first." },
			on: { PICKS_EMPTY_FORM: "emptyForm" },
		},
		emptyForm: {
			meta: { description: "'Previewing an empty form': the Details tab with no values, as a new invoice would open." },
		},
		typedCopy: {
			meta: { description: "A value was typed into the copy (Remarks on the More information tab): the field takes it, and the note 'Changes here are not saved.' still says nothing is written." },
		},
		noRecords: {
			meta: { description: "A DocType with no records: Preview opens on 'an empty form' straight away, and the picker has nothing else to offer." },
		},
		draftPreview: {
			meta: { description: "Preview while the editor holds an unsaved edit (the 'Not saved' badge is up, Undo and Redo are hidden): the form draws the saved layout, so the renamed section shows its old name." },
		},
		unsavedDoctype: {
			meta: { description: "Preview on a DocType nobody has saved: no form, only the line 'Save the DocType to preview its records.'" },
		},
	},
});

const holds = new WeakMap<Scene, Hold>();

const INVOICE = /\/document\/UI(%20| )Sales(%20| )Invoice\/[^?/]+/;
const LAYOUTS = /get_form_layouts/;

const pane = (scene: Scene) => scene.page.locator("[data-editor-preview]");
const picker = (scene: Scene) => scene.page.locator("[data-preview-record]");
const previewTab = (scene: Scene) => scene.page.getByRole("tab", { name: "Preview" });

export const preview = defineFlow<Event>({
	id: "preview",
	title: "Preview",
	source: "frontend/src/pages/doctypeEditor/PreviewTab.vue, previewRefusals.ts, DoctypeEditor.vue (previewName, latest, state.pending)",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await clearRecords(scene);
		await seedInvoiceRecords(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
		await expect(scene.page.locator('[data-canvas-field="posting_date"]')).toBeVisible();
		await expect(scene.page.getByText("2 records")).toBeVisible();
	},
	events: {
		async OPENS_PREVIEW(scene) {
			await previewTab(scene).click();
			await expect(picker(scene)).toContainText("SINV-");
			await expect(pane(scene).getByText("Acme Fabrication")).toBeVisible();
			await expect(pane(scene).getByText("Loading…")).toHaveCount(0);
		},
		async OPENS_PREVIEW_SLOW(scene) {
			holds.set(scene, await scene.hold(INVOICE));
			await previewTab(scene).click();
			await expect(pane(scene).getByText("Loading…")).toBeVisible();
		},
		async RECORD_ARRIVES(scene) {
			await holds.get(scene)?.release();
			await expect(pane(scene).getByText("Acme Fabrication")).toBeVisible();
			await expect(pane(scene).getByText("Loading…")).toHaveCount(0);
		},
		async RECORD_FAILS(scene) {
			// The transport retries a server error with backoff before the read fails.
			holds.set(scene, await scene.hold(INVOICE));
			await holds.get(scene)?.abort();
			await previewTab(scene).click();
			await expect(picker(scene)).toContainText("an empty form", { timeout: 45_000 });
			await expect(pane(scene).getByText("Loading…")).toHaveCount(0);
		},
		async LAYOUT_SLOW(scene) {
			holds.set(scene, await scene.hold(LAYOUTS));
			await previewTab(scene).click();
			await expect(picker(scene)).toBeVisible();
		},
		async LAYOUT_ARRIVES(scene) {
			await holds.get(scene)?.release();
			await expect(pane(scene).getByText("Acme Fabrication")).toBeVisible();
		},
		async LAYOUT_FAILS(scene) {
			holds.set(scene, await scene.hold(LAYOUTS));
			await holds.get(scene)?.abort();
			await previewTab(scene).click();
			await expect(picker(scene)).toBeVisible();
			await scene.settle(4000);
		},
		async OPENS_PICKER(scene) {
			await picker(scene).click();
			await expect(scene.page.getByRole("option", { name: "Empty form" })).toBeVisible();
		},
		async PICKS_EMPTY_FORM(scene) {
			await scene.page.getByRole("option", { name: "Empty form" }).click();
			await expect(picker(scene)).toContainText("an empty form");
		},
		async TYPES(scene) {
			await pane(scene).getByRole("tab", { name: "More information" }).click();
			const remarks = pane(scene).getByRole("textbox").first();
			await remarks.fill("Deliver after the 15th, call the front desk first.");
			await expect(remarks).toHaveValue(/front desk/);
		},
		async DELETES_RECORDS(scene) {
			await clearRecords(scene);
			await scene.goto("/apps/desk/doctype/UI%20Sales%20Invoice?mode=design");
			await expect(scene.page.locator('[data-canvas-field="posting_date"]')).toBeVisible();
			await previewTab(scene).click();
			await expect(picker(scene)).toContainText("an empty form");
		},
		async EDITS_THEN_PREVIEWS(scene) {
			const label = scene.page.locator('[data-canvas-section="customer_section"] [data-canvas-section-label]');
			await label.fill("Billing customer");
			await label.press("Enter");
			await expect(scene.page.getByText("Not saved")).toBeVisible();
			await previewTab(scene).click();
			await expect(picker(scene)).toContainText("SINV-");
			await expect(pane(scene).getByText("Acme Fabrication")).toBeVisible();
		},
		async OPENS_NEW_DOCTYPE(scene) {
			await scene.goto("/apps/desk/doctype/new");
			const dialog = scene.page.locator("[data-new-doctype]");
			await expect(dialog).toBeVisible();
			await dialog.getByLabel("Name").fill("Delivery Route");
			await dialog.getByRole("combobox", { name: "Module" }).click();
			await scene.page.getByRole("option", { name: "Custom" }).first().click();
			await dialog.getByRole("button", { name: "Continue" }).click();
			await expect(scene.page.getByRole("heading", { name: "Delivery Route", level: 1 })).toBeVisible();
			await previewTab(scene).click();
			await expect(scene.page.getByText("Save the DocType to preview its records.")).toBeVisible();
		},
	},
});

/**
 * Deletes the invoices and customers a run left: a deleted custom DocType keeps its table on this
 * SQLite site. Once the page has booted, the session has a CSRF token and an API write must send it.
 */
async function clearRecords(scene: Scene): Promise<void> {
	const booted = scene.page.url().startsWith("http");
	const token = booted ? await scene.page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token) : undefined;
	const headers = token ? { "X-Frappe-CSRF-Token": token } : undefined;
	for (const doctype of ["UI Sales Invoice", "UI Customer"]) {
		const res = await scene.api.get(`/api/resource/${encodeURIComponent(doctype)}`, { params: { limit_page_length: 200 }, failOnStatusCode: false });
		if (!res.ok()) continue;
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data)
			await scene.api.delete(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { headers, failOnStatusCode: false });
	}
}
