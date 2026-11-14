import { expect, type Locator } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";
import { CUSTOMIZE_TARGET, resetCustomizations, seedSalesInvoice } from "../seed";

type Event =
	| { type: "EDITS_LABEL" }
	| { type: "EDITS_FIELDNAME" }
	| { type: "SAVES" }
	| { type: "SAVES_RENAMED" }
	| { type: "SERVER_ANSWERS" }
	| { type: "SOMEONE_CHANGES_DOCTYPE" }
	| { type: "NETWORK_FAILS" }
	| { type: "RELOADS_AND_REAPPLIES" }
	| { type: "SAVES_AGAIN" }
	| { type: "UNDOES_RENAME" }
	| { type: "OPENS_CUSTOMIZE" }
	| { type: "EDITS_CUSTOMIZE" }
	| { type: "SAVES_CUSTOMIZE" };

/**
 * Save, from the Save button to what the editor does with the answer. In the code this is
 * `EditorSave` (editorSave.ts: `saving`, `banner` and each answer's handler: `saved`, `refused`, the
 * stale `code` that offers Reload) with the Not saved badge from `edits.dirty` (DoctypeEditor.vue).
 * The refused and stale answers are real: the server refuses a fieldname that a deleted field's
 * column still holds, and the stale one follows a change another person makes while Save is in flight.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "save",
	initial: "idle",
	states: {
		idle: {
			meta: { description: "The editor on a saved DocType with nothing changed: no Not saved badge and Save disabled." },
			on: { EDITS_LABEL: "dirty", EDITS_FIELDNAME: "dirtyRenamed", OPENS_CUSTOMIZE: "customizeIdle" },
		},
		dirty: {
			meta: { description: "A field's label is edited: the Not saved badge shows, Undo and Save are enabled, and nothing is written yet." },
			on: { SAVES: "saving" },
		},
		saving: {
			meta: { description: "Save was pressed and the server has not answered: the Save button spins and edits are held until the answer comes." },
			on: { SERVER_ANSWERS: "saved", SOMEONE_CHANGES_DOCTYPE: "stale", NETWORK_FAILS: "failed" },
		},
		saved: {
			meta: { description: "The server wrote the edit: a Saved toast, the Not saved badge gone, Save disabled again and the editor reloaded from the server." },
		},
		stale: {
			meta: { description: "Someone changed the DocType after it was opened: a red banner says Not saved with who changed it and when, and offers Reload and re-apply my edits. The edit stays staged." },
			on: { RELOADS_AND_REAPPLIES: "reapplied" },
		},
		reapplied: {
			meta: { description: "The editor loaded the DocType as it is now and staged the edit again: the banner is gone, the Not saved badge shows and Save works against the new version." },
		},
		failed: {
			meta: { description: "The request never got an answer: an error toast, the edit still staged and Save enabled, so it can be pressed again." },
			on: { SAVES_AGAIN: "saved" },
		},
		dirtyRenamed: {
			meta: { description: "A field is renamed to a fieldname that the DocType's table still holds from a deleted field. The editor cannot know this, so the Not saved badge shows and Save is enabled." },
			on: { SAVES_RENAMED: "refused" },
		},
		refused: {
			meta: { description: "The server refused the rename: a red banner says Not saved and why (the name is held by a deleted field), nothing is written and the rename stays staged. The reason is not drawn on the field or in the panel, because the error names the old fieldname." },
			on: { UNDOES_RENAME: "undone" },
		},
		undone: {
			meta: { description: "Undo took the refused rename back: the Not saved badge is gone and Save is disabled, but the red banner stays, and the refusal now also shows in red under Payment due date, a field that has nothing staged." },
		},
		customizeIdle: {
			meta: { description: "Customize mode on a standard DocType with nothing changed: no Not saved badge and Save disabled." },
			on: { EDITS_CUSTOMIZE: "customizeDirty" },
		},
		customizeDirty: {
			meta: { description: "A standard field's label is changed in Customize: the Not saved badge shows and Save is enabled." },
			on: { SAVES_CUSTOMIZE: "customizeSaved" },
		},
		customizeSaved: {
			meta: { description: "The Customize save is written as a Property Setter: the toast names what it wrote ('Saved 1 property change.') and the editor is clean again." },
		},
	},
});

const SAVE_REQUEST = /save_doctype_editor/;
const DOCTYPE = "UI Sales Invoice";
const holds = new WeakMap<Scene, Hold>();

const editor = (scene: Scene) => scene.page.locator("[data-doctype-editor]");
const saveButton = (scene: Scene) => scene.page.locator("[data-editor-save]");
const banner = (scene: Scene) => scene.page.locator("[data-editor-save-banner]");
const toasts = (scene: Scene) => scene.page.getByRole("region", { name: /Notifications/ });
const field = (scene: Scene, fieldname: string): Locator => scene.page.locator(`[data-canvas-field="${fieldname}"]`);

export const save = defineFlow<Event>({
	id: "save",
	title: "Save: success, stale, refused, failed",
	source: "frontend/src/pages/doctypeEditor/editorSave.ts, SaveBanner.vue, EditorHeader.vue, DoctypeEditor.vue",
	machine,
	async enter(scene) {
		// A rename flow that ends before it renames back leaves this behind, with an index that blocks the seed.
		await scene.api.delete("/api/resource/DocType/UI%20Customer%20Invoice", { failOnStatusCode: false });
		await seedSalesInvoice(scene);
		await leaveDeletedColumn(scene);
		resetCustomizations(scene);
		await clearCustomizations(scene);
		scene.onClose(() => clearCustomizations(scene, true));
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(DOCTYPE)}?mode=design`);
		await expect(editor(scene)).toBeVisible();
		await expect(field(scene, "due_date")).toBeVisible();
		await expect(saveButton(scene)).toBeDisabled();
	},
	events: {
		async EDITS_LABEL(scene) {
			await field(scene, "due_date").click();
			const label = scene.page.locator("[data-panel-label]");
			await label.fill("Payment due on");
			await label.press("Enter");
			await expect(saveButton(scene)).toBeEnabled();
			await expect(scene.page.getByText("Not saved", { exact: true })).toBeVisible();
		},
		async EDITS_FIELDNAME(scene) {
			await field(scene, "due_date").click();
			const name = scene.page.locator("[data-panel-fieldname]");
			await name.fill("legacy_reference");
			await name.press("Enter");
			await expect(saveButton(scene)).toBeEnabled();
			await expect(field(scene, "legacy_reference")).toBeVisible();
		},
		async SAVES(scene) {
			holds.set(scene, await scene.hold(SAVE_REQUEST));
			await saveButton(scene).click();
			await expect(saveButton(scene)).toBeDisabled();
		},
		async SAVES_RENAMED(scene) {
			await saveButton(scene).click();
			await expect(banner(scene)).toBeVisible();
		},
		async SERVER_ANSWERS(scene) {
			await holds.get(scene)?.release();
			await expect(toasts(scene).getByText("Saved", { exact: true })).toBeVisible();
			await expect(saveButton(scene)).toBeDisabled();
		},
		async SOMEONE_CHANGES_DOCTYPE(scene) {
			await changeDescription(scene);
			await holds.get(scene)?.release();
			await expect(banner(scene)).toContainText("Changed by");
		},
		async NETWORK_FAILS(scene) {
			await holds.get(scene)?.abort();
			await expect(toasts(scene).getByRole("listitem")).toBeVisible({ timeout: 30_000 });
			await expect(saveButton(scene)).toBeEnabled();
		},
		async RELOADS_AND_REAPPLIES(scene) {
			await banner(scene).getByRole("button", { name: "Reload and re-apply my edits" }).click();
			await expect(banner(scene)).toBeHidden();
			await expect(saveButton(scene)).toBeEnabled();
		},
		async SAVES_AGAIN(scene) {
			await holds.get(scene)?.release();
			await saveButton(scene).click();
			await expect(toasts(scene).getByText("Saved", { exact: true })).toBeVisible();
		},
		async UNDOES_RENAME(scene) {
			await scene.page.getByRole("button", { name: "Undo" }).click();
			await expect(saveButton(scene)).toBeDisabled();
		},
		async OPENS_CUSTOMIZE(scene) {
			await scene.goto(`/apps/desk/doctype/${CUSTOMIZE_TARGET}?mode=customize`);
			await expect(editor(scene)).toBeVisible();
			await expect(saveButton(scene)).toBeDisabled();
		},
		async EDITS_CUSTOMIZE(scene) {
			await field(scene, "subject").click();
			const label = scene.page.locator("[data-panel-label]");
			await label.fill("Event title");
			await label.press("Enter");
			await expect(saveButton(scene)).toBeEnabled();
		},
		async SAVES_CUSTOMIZE(scene) {
			await saveButton(scene).click();
			await expect(toasts(scene).getByText(/Saved .*property change/)).toBeVisible();
		},
	},
});

/** A field deleted from the DocType leaves its column behind, so its name stays taken. */
async function leaveDeletedColumn(scene: Scene): Promise<void> {
	type DocType = { fields: Array<{ fieldname: string }> };
	const legacy = { doctype: "DocField", fieldname: "legacy_reference", fieldtype: "Data", label: "Legacy reference" };
	const doc = await scene.call<DocType>("frappe.client.get", { doctype: "DocType", name: DOCTYPE });
	await scene.call("frappe.client.save", { doc: { ...doc, fields: [...doc.fields, legacy] } });
	const added = await scene.call<DocType>("frappe.client.get", { doctype: "DocType", name: DOCTYPE });
	await scene.call("frappe.client.save", { doc: { ...added, fields: added.fields.filter((each) => each.fieldname !== "legacy_reference") } });
}

/** Another person's save: once the desk has booted the session has a CSRF token, which an API call must send. */
async function changeDescription(scene: Scene): Promise<void> {
	const token = await scene.page.evaluate(() => (window as unknown as { csrf_token: string }).csrf_token);
	const res = await scene.api.post("/api/method/frappe.client.set_value", {
		headers: { "X-Frappe-CSRF-Token": token },
		data: {
			doctype: "DocType",
			name: DOCTYPE,
			fieldname: "description",
			value: "Customer invoices, with returns and point-of-sale payments.",
		},
	});
	if (!res.ok()) throw new Error(`set_value: ${await res.text()}`);
}

/**
 * Deletes what Customize saves left on the target. The library's `resetCustomizations` deletes with the
 * session cookie only, which the site refuses (CSRF) once the desk has booted in that session, so the
 * clean-up here runs before the page opens and again at close with the page's token.
 */
async function clearCustomizations(scene: Scene, booted = false): Promise<void> {
	const headers: Record<string, string> = {};
	if (booted) {
		const token = await scene.page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token);
		if (token) headers["X-Frappe-CSRF-Token"] = token;
	}
	const rows: Array<[string, string]> = [
		["Property Setter", "doc_type"],
		["Custom Field", "dt"],
		["DocType Layout", "document_type"],
	];
	for (const [kind, field] of rows) {
		const res = await scene.api.get(`/api/resource/${kind}`, {
			params: { filters: JSON.stringify([[field, "=", CUSTOMIZE_TARGET]]), limit_page_length: 500 },
		});
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data) await scene.api.delete(`/api/resource/${kind}/${encodeURIComponent(name)}`, { headers });
	}
}
