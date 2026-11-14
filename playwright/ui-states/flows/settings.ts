import { expect, type Locator } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";
import { CUSTOMIZE_TARGET, resetCustomizations, seedInvoiceRecords, seedSalesInvoice } from "../seed";

type Event =
	| { type: "LOADS" }
	| { type: "FAILS" }
	| { type: "RETRY" }
	| { type: "OPEN_FORM" }
	| { type: "OPEN_LIST" }
	| { type: "OPEN_PERMISSIONS" }
	| { type: "OPEN_DANGER" }
	| { type: "PICK_PATTERN" }
	| { type: "PICK_FIELD" }
	| { type: "EDIT_SERIES" }
	| { type: "EDIT_FORM" }
	| { type: "EDIT_LIST" }
	| { type: "ADD_ROLE" }
	| { type: "ROLES_FAIL" }
	| { type: "EDIT_THEN_DANGER" }
	| { type: "ASK_RENAME_DIRTY" }
	| { type: "OPEN_NEW" }
	| { type: "OPEN_CUSTOMIZE" }
	| { type: "EDIT_CUSTOMIZE" }
	| { type: "OPEN_CHANGE_KIND" }
	| { type: "PICK_SUBMITTABLE" }
	| { type: "CONFIRM_KIND" }
	| { type: "KIND_FAILS" }
	| { type: "OPEN_RENAME" }
	| { type: "COUNT_FAILS" }
	| { type: "TYPE_NAME" }
	| { type: "TYPE_TAKEN" }
	| { type: "CONFIRM_RENAME" }
	| { type: "OPEN_DELETE" }
	| { type: "TYPE_PARTIAL" }
	| { type: "TYPE_DOCTYPE" }
	| { type: "CONFIRM_DELETE" }
	| { type: "DELETE_FAILS" }
	| { type: "CANCEL" }
	| { type: "DEVELOPER" }
	| { type: "OPEN_MAKE_STANDARD" }
	| { type: "PICK_MODULE" }
	| { type: "CONFIRM_STANDARD" }
	| { type: "OPEN_MOVE" }
	| { type: "MOVE_MODULES_FAIL" }
	| { type: "PICK_MOVE_MODULE" }
	| { type: "CONFIRM_MOVE" };

/**
 * The Settings header tab of the DocType editor: five sections in a list on the left (Naming, Form,
 * List and search, Permissions, Danger zone) and the open one on the right. In the code this is
 * `SettingsTab.vue` (the open section is `place`, a ref the page owns), `settingsRows.ts` (which rows
 * and sections a DocType shows), `settingsView.ts` (each edit is an act, so it joins Save and undo)
 * and `dangerActs.ts` / `dangerHost.ts` (each Danger zone act asks about pending edits, then its
 * own dialog, then writes at once, outside Save).
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "settings",
	initial: "loading",
	states: {
		loading: {
			meta: { description: "The editor is still reading the DocType: the page says 'Loading UI Sales Invoice…' and the Settings tab does not exist yet." },
			on: { LOADS: "naming", FAILS: "failed" },
		},
		failed: {
			meta: { description: "The DocType could not be read: the page shows the failure with a Try again button, and no tabs." },
			on: { RETRY: "naming" },
		},
		naming: {
			meta: { description: "Settings opens on Naming: the rule list with Naming Series chosen, its series and each series' next name, and Allow rename." },
			on: {
				OPEN_FORM: "form",
				OPEN_LIST: "list",
				OPEN_PERMISSIONS: "permissions",
				OPEN_DANGER: "danger",
				PICK_PATTERN: "namingPattern",
				PICK_FIELD: "namingField",
				EDIT_SERIES: "seriesDialog",
				ROLES_FAIL: "rolesFailed",
				OPEN_NEW: "newDoctype",
				OPEN_CUSTOMIZE: "customizeSettings",
			},
		},
		namingPattern: {
			meta: { description: "By pattern picked: the pattern box and a live next name open under the rule, the header says Not saved and Save is on." },
		},
		namingField: {
			meta: { description: "From a field picked: a field picker opens under the rule with the note that two records cannot share a value, and the header says Not saved." },
		},
		seriesDialog: {
			meta: { description: "Edit series opened over Naming: every series with its next name, a radio for the default, Remove and Add a series, Cancel and Done." },
			on: { CANCEL: "naming" },
		},
		form: {
			meta: { description: "The Form section: Record (kind is fixed once saved, title and image field), Creating, Tracking and Attachments rows." },
			on: { EDIT_FORM: "formDirty" },
		},
		formDirty: {
			meta: { description: "A Form switch and the Max attachments number changed: the header says Not saved and Save is on; nothing is written yet." },
			on: { EDIT_THEN_DANGER: "dangerDirty" },
		},
		list: {
			meta: { description: "The List and search section: default view, default sort, Search by chips, global search, links and import rows." },
			on: { EDIT_LIST: "listDirty" },
		},
		listDirty: {
			meta: { description: "A Search by chip was added: the header says Not saved and Save is on." },
		},
		permissions: {
			meta: { description: "The Permissions section: a roles-by-rights grid with System Manager, a More column and an Add a role picker." },
			on: { ADD_ROLE: "permissionsDirty" },
		},
		permissionsDirty: {
			meta: { description: "A role was added: Desk User joins System Manager in the grid with Read ticked, the header says Not saved and Save is on." },
		},
		rolesFailed: {
			meta: { description: "The Role list request failed: the Permissions grid shows, and the Add a role picker opens on 'No results' with no error message anywhere." },
		},
		danger: {
			meta: { description: "The Danger zone: Change kind, Rename DocType and Delete DocType rows, each with its red button; the Delete row counts the records it removes." },
			on: {
				OPEN_CHANGE_KIND: "changeKindDialog",
				OPEN_RENAME: "renameDialog",
				COUNT_FAILS: "renameCountFailed",
				OPEN_DELETE: "deleteDialog",
				OPEN_MOVE: "moveDialog",
				MOVE_MODULES_FAIL: "moveModulesFailed",
				DEVELOPER: "dangerDeveloper",
			},
		},
		dangerDirty: {
			meta: { description: "The Danger zone while edits are pending: the header says Not saved, and every act will first ask what to do with them." },
			on: { ASK_RENAME_DIRTY: "unsavedAsk" },
		},
		unsavedAsk: {
			meta: { description: "Rename was clicked with pending edits: 'Save before you go on?' with Cancel, Discard and Save first." },
			on: { CANCEL: "dangerDirty" },
		},
		changeKindDialog: {
			meta: { description: "Change kind: the five kinds with Regular picked; Single and Child table are disabled with the reason, and Change kind is disabled until another kind is picked." },
			on: { PICK_SUBMITTABLE: "changeKindPicked", CANCEL: "danger" },
		},
		changeKindPicked: {
			meta: { description: "Submittable picked: a note says what the change adds (Amended From and the Submit, Cancel and Amend rights) and Change kind is on." },
			on: { CONFIRM_KIND: "kindChanged", KIND_FAILS: "kindFailed", CANCEL: "danger" },
		},
		kindChanged: {
			meta: { description: "The kind changed at once: a success toast, and the Danger zone and the Form section now say Submittable." },
		},
		kindFailed: {
			meta: { description: "The server refused the change: the dialog is closed and an error toast says so; the kind is as before." },
		},
		renameDialog: {
			meta: { description: "Rename: the new name field holds the current name, the table line and the count of Link and Table fields that follow; Rename is disabled until the name changes." },
			on: { TYPE_NAME: "renameTyped", TYPE_TAKEN: "renameTaken", CANCEL: "danger" },
		},
		renameCountFailed: {
			meta: { description: "Rename opened while the count of pointing fields failed: the dialog shows the table line only, with no sign that a count was left out." },
		},
		renameTyped: {
			meta: { description: "A new name typed: the table line names the new table and Rename is on." },
			on: { CONFIRM_RENAME: "renamed" },
		},
		renameTaken: {
			meta: { description: "The name of a DocType that exists, confirmed: the server refuses; the page shows the error toast." },
		},
		renamed: {
			meta: { description: "The rename went through: a success toast, and the editor reopened under the new name, still on the Danger zone." },
		},
		deleteDialog: {
			meta: { description: "Delete: what goes (the DocType, its 2 records and its table), a box to type the name into, and Delete disabled." },
			on: { TYPE_PARTIAL: "deleteMismatch", TYPE_DOCTYPE: "deleteReady", CANCEL: "danger" },
		},
		deleteMismatch: {
			meta: { description: "Part of the name typed: Delete stays disabled; nothing says what is still missing." },
		},
		deleteReady: {
			meta: { description: "The whole name typed: the red Delete button turns on." },
			on: { CONFIRM_DELETE: "deleted", DELETE_FAILS: "deleteFailed", CANCEL: "cancelled" },
		},
		deleted: {
			meta: { description: "The DocType was deleted: a success toast, and the editor leaves for the DocType list, which no longer has it." },
		},
		deleteFailed: {
			meta: { description: "The server failed the delete: the dialog closes with an error toast, and the DocType and its records are still there." },
		},
		cancelled: {
			meta: { description: "Cancel after typing the name: the dialog is gone, the Danger zone is as it was and nothing was deleted." },
		},
		moveDialog: {
			meta: { description: "Move to another module (a custom DocType, so only the module changes): a Module picker listing every other module, Move disabled until one is picked." },
			on: { PICK_MOVE_MODULE: "movePicked", CANCEL: "danger" },
		},
		moveModulesFailed: {
			meta: { description: "The Module list request failed: an error toast over the Move dialog, and a Module picker with no options, so Move can never turn on." },
		},
		movePicked: {
			meta: { description: "A module picked: the line says only the module changes because a custom DocType has no files; Move is on." },
			on: { CONFIRM_MOVE: "moved", CANCEL: "danger" },
		},
		moved: {
			meta: { description: "The move went through: a success toast, and the Danger zone now says the DocType is in the new module." },
		},
		dangerDeveloper: {
			meta: { description: "The Danger zone in developer mode: a Make it standard row joins the three." },
			on: { OPEN_MAKE_STANDARD: "makeStandardDialog" },
		},
		makeStandardDialog: {
			meta: { description: "Make standard: a Module picker and the line 'The module, and with it the app its files go in', Make standard disabled." },
			on: { PICK_MODULE: "makeStandardPicked", CANCEL: "dangerDeveloper" },
		},
		makeStandardPicked: {
			meta: { description: "A module picked: the dialog warns that it writes the DocType's files into the module's app and cannot be undone here; Make standard is on." },
			on: { CONFIRM_STANDARD: "standardMade", CANCEL: "dangerDeveloper" },
		},
		standardMade: {
			meta: { description: "Make standard confirmed, with the server's reply stubbed (the real call writes files into an app): a success toast; the row stays because the stub changed nothing." },
		},
		newDoctype: {
			meta: { description: "Settings on a DocType nobody has saved: Kind is a choice (it is fixed once saved) and the Danger zone does not exist yet." },
		},
		customizeSettings: {
			meta: { description: "Settings in Customize on Event (the Form section): the header reads Event / Customize, there is no Danger zone, and rows the app's DocType owns show locked." },
			on: { EDIT_CUSTOMIZE: "customizeEdited" },
		},
		customizeEdited: {
			meta: { description: "Customize with two settings changed: each changed row is marked as different from the app and offers a reset." },
		},
	},
});

interface Holds {
	modules: Hold;
	editor: Hold;
	roles: Hold;
	effects: Hold;
	kind: Hold;
	remove: Hold;
}

const holds = new WeakMap<Scene, Holds>();
const NAME = "UI Sales Invoice";
const RENAMED = "UI Tax Invoice";
const toasts = (scene: Scene) => scene.page.getByRole("region", { name: /Notifications/ }).getByRole("listitem");
const pane = (scene: Scene) => scene.page.locator("[data-editor-settings]");
const section = (scene: Scene, key: string) => scene.page.locator(`[data-section="${key}"]`);
const header = (scene: Scene) => scene.page.getByText("Not saved", { exact: true });

/** SQLite keeps a custom DocType's table after the DocType is deleted, so rows of a killed run are still there. */
async function dropLeftovers(scene: Scene): Promise<void> {
	for (const doctype of [NAME, "UI Customer"]) {
		const res = await scene.api.get(`/api/resource/${encodeURIComponent(doctype)}`, { params: { limit_page_length: 500 } });
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data) {
			const gone = await scene.api.delete(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { failOnStatusCode: false });
			if (!gone.ok()) throw new Error(`leftover ${doctype} ${name}: ${(await gone.text()).slice(0, 600)}`);
		}
	}
}

/**
 * Undoes the path. The harness's own close() sends DELETEs without a CSRF token, which the site
 * refuses once the page has loaded (the session then has a token), so this sends the page's token.
 * A DocType renamed by the path goes back to its name first: SQLite keeps the old table's index
 * names, and the next run could not create "UI Sales Invoice" over them.
 */
async function purge(scene: Scene): Promise<void> {
	const csrf = await scene.page.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token ?? "").catch(() => "");
	const headers: Record<string, string> = csrf ? { "X-Frappe-CSRF-Token": csrf } : {};
	const renamed = await scene.api.get(`/api/resource/DocType/${encodeURIComponent(RENAMED)}`, { failOnStatusCode: false });
	if (renamed.ok()) {
		const back = await scene.api.post("/api/method/frappe.desk.doctype_editor.danger.rename_doctype", {
			headers,
			data: { doctype: RENAMED, new_name: NAME },
		});
		if (!back.ok()) console.error("rename back failed", (await back.text()).slice(0, 500));
	}
	for (const doctype of [NAME, "UI Customer"]) {
		const res = await scene.api.get(`/api/resource/${encodeURIComponent(doctype)}`, { params: { limit_page_length: 500 }, failOnStatusCode: false });
		if (!res.ok()) continue;
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data)
			await scene.api.delete(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { headers, failOnStatusCode: false });
	}
	for (const doctype of [NAME, "UI Sales Invoice Item", "UI Customer", RENAMED]) {
		const gone = await scene.api.delete(`/api/resource/DocType/${encodeURIComponent(doctype)}`, { headers, failOnStatusCode: false });
		if (!gone.ok() && gone.status() !== 404) console.error("purge", doctype, gone.status(), (await gone.text()).slice(0, 300));
	}
}

async function seed(scene: Scene): Promise<void> {
	await seedSalesInvoice(scene);
	await dropLeftovers(scene);
	await seedInvoiceRecords(scene);
}

async function openSettings(scene: Scene): Promise<void> {
	await scene.page.getByRole("tab", { name: "Settings" }).click();
	await expect(pane(scene)).toBeVisible();
}

async function openSection(scene: Scene, key: string): Promise<void> {
	await scene.page.locator(`[data-section-link="${key}"]`).click();
	await expect(section(scene, key)).toBeVisible();
}

async function toggleRow(scene: Scene, key: string): Promise<void> {
	await scene.page.locator(`[data-setting="${key}"] [role="switch"]`).click();
}

async function dirtyForm(scene: Scene): Promise<void> {
	await openSection(scene, "form");
	await toggleRow(scene, "track_changes");
	await expect(header(scene)).toBeVisible();
}

async function dangerButton(scene: Scene, key: string): Promise<void> {
	await scene.page.locator(`[data-danger="${key}"]`).click();
}

function dialog(scene: Scene, attribute: string): Locator {
	return scene.page.locator(`[${attribute}]`);
}

export const settings = defineFlow<Event>({
	id: "settings",
	title: "Settings and the Danger zone",
	source:
		"frontend/src/pages/doctypeEditor/SettingsTab.vue, settingsRows.ts, settingsView.ts, SettingsSection.vue, SettingsNaming.vue, SettingsPermissions.vue, SettingsDanger.vue, dangerActs.ts, dangerHost.ts, ChangeKindDialog.vue, RenameDoctypeDialog.vue, DeleteDoctypeDialog.vue, ModuleDialog.vue",
	machine,
	async enter(scene) {
		resetCustomizations(scene);
		await seed(scene);
		scene.onClose(() => purge(scene));
		const all: Holds = {
			editor: await scene.hold(/get_doctype_editor/),
			modules: await scene.hold(/\/document\/Module(%20| )Def/),
			roles: await scene.hold(/\/document\/Role(\?|$)/),
			effects: await scene.hold(/danger\.rename_effects/),
			kind: await scene.hold(/danger\.change_kind/),
			remove: await scene.hold(/danger\.delete_doctype/),
		};
		holds.set(scene, all);
		// Held from the start: the editor's load waits until LOADS or FAILS.
		for (const hold of [all.modules, all.roles, all.effects, all.kind, all.remove]) await hold.release();
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(NAME)}`);
		await expect(scene.page.getByText(`Loading ${NAME}…`)).toBeVisible();
	},
	events: {
		async LOADS(scene) {
			await holds.get(scene)!.editor.release();
			await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
			await openSettings(scene);
			await expect(section(scene, "naming")).toBeVisible();
		},
		async FAILS(scene) {
			await holds.get(scene)!.editor.abort();
			await expect(scene.page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 60_000 });
		},
		async RETRY(scene) {
			await holds.get(scene)!.editor.release();
			await scene.page.getByRole("button", { name: "Try again" }).click();
			await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
			await openSettings(scene);
			await expect(section(scene, "naming")).toBeVisible();
		},
		async OPEN_FORM(scene) {
			await openSection(scene, "form");
		},
		async OPEN_LIST(scene) {
			await openSection(scene, "list");
		},
		async OPEN_PERMISSIONS(scene) {
			await openSection(scene, "permissions");
			await expect(scene.page.locator('[data-perm-role="System Manager"]')).toBeVisible();
		},
		async OPEN_DANGER(scene) {
			await openSection(scene, "danger");
			await expect(scene.page.locator('[data-danger="delete_doctype"]')).toBeVisible();
			await expect(scene.page.getByText(`Deletes ${NAME} and its 2 records.`)).toBeVisible();
		},
		async PICK_PATTERN(scene) {
			await scene.page.locator('[data-naming-rule="format"]').click();
			await expect(scene.page.locator("[data-naming-control]")).toBeVisible();
			await expect(header(scene)).toBeVisible();
		},
		async PICK_FIELD(scene) {
			await scene.page.locator('[data-naming-rule="field"]').click();
			await expect(scene.page.getByText("Two records cannot share a value of")).toBeVisible();
			await expect(header(scene)).toBeVisible();
		},
		async EDIT_SERIES(scene) {
			await scene.page.locator("[data-series-edit]").click();
			await expect(scene.page.locator("[data-series-dialog]")).toBeVisible();
		},
		async EDIT_FORM(scene) {
			await openSection(scene, "form");
			await toggleRow(scene, "track_changes");
			await scene.page.locator('[data-setting="max_attachments"] input').fill("5");
			await scene.page.locator('[data-setting="max_attachments"] input').blur();
			await expect(header(scene)).toBeVisible();
		},
		async EDIT_LIST(scene) {
			await openSection(scene, "list");
			await scene.page.locator('[data-setting="search_fields"]').getByPlaceholder("Add a field").click();
			await scene.page.getByRole("option", { name: "Status" }).first().click();
			await expect(header(scene)).toBeVisible();
		},
		async ADD_ROLE(scene) {
			await openSection(scene, "permissions");
			await scene.page.locator("[data-perm-add]").click();
			await scene.page.getByRole("option", { name: "Desk User" }).click();
			await expect(scene.page.locator('[data-perm-role="Desk User"]')).toBeVisible();
			await expect(header(scene)).toBeVisible();
		},
		async ROLES_FAIL(scene) {
			await holds.get(scene)!.roles.abort();
			await openSection(scene, "permissions");
			await expect(scene.page.locator('[data-perm-role="System Manager"]')).toBeVisible();
			await scene.page.locator("[data-perm-add]").click();
			await expect(scene.page.getByRole("listbox")).toBeVisible();
		},
		async EDIT_THEN_DANGER(scene) {
			await openSection(scene, "danger");
			await expect(scene.page.locator('[data-danger="delete_doctype"]')).toBeVisible();
			await expect(header(scene)).toBeVisible();
		},
		async ASK_RENAME_DIRTY(scene) {
			await dangerButton(scene, "rename_doctype");
			await expect(dialog(scene, "data-mode-switch-dialog")).toBeVisible();
		},
		async OPEN_NEW(scene) {
			await scene.goto("/apps/desk/doctype/new?name=Delivery%20Route&module=Custom&custom=1&naming_rule=Set%20by%20user");
			await expect(scene.page.getByRole("heading", { name: "Delivery Route", level: 1 })).toBeVisible();
			await openSettings(scene);
			await openSection(scene, "form");
			await expect(scene.page.locator('[data-setting="kind"]')).toBeVisible();
		},
		async OPEN_CUSTOMIZE(scene) {
			await scene.goto(`/apps/desk/doctype/${CUSTOMIZE_TARGET}?mode=customize`);
			await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
			await openSettings(scene);
			await openSection(scene, "form");
			await expect(scene.page.locator('[data-setting="title_field"]')).toBeVisible();
		},
		async EDIT_CUSTOMIZE(scene) {
			await openSection(scene, "form");
			await toggleRow(scene, "track_changes");
			await openSection(scene, "list");
			await toggleRow(scene, "allow_import");
			await expect(header(scene)).toBeVisible();
		},
		async OPEN_CHANGE_KIND(scene) {
			await dangerButton(scene, "change_kind");
			await expect(dialog(scene, "data-change-kind-dialog")).toBeVisible();
		},
		async PICK_SUBMITTABLE(scene) {
			await dialog(scene, "data-change-kind-dialog").getByRole("radio", { name: /Submittable/ }).click();
			await expect(dialog(scene, "data-kind-notes")).toContainText("Amended From");
		},
		async CONFIRM_KIND(scene) {
			await dialog(scene, "data-change-kind-dialog").getByRole("button", { name: "Change kind" }).click();
			await expect(toasts(scene).getByText(`${NAME} is a Submittable DocType now.`)).toBeVisible();
			await expect(scene.page.getByText(`${NAME} is a Submittable DocType.`)).toBeVisible();
		},
		async KIND_FAILS(scene) {
			await holds.get(scene)!.kind.abort();
			await dialog(scene, "data-change-kind-dialog").getByRole("button", { name: "Change kind" }).click();
			await expect(toasts(scene).first()).toBeVisible();
			await expect(dialog(scene, "data-change-kind-dialog")).toBeHidden();
		},
		async OPEN_RENAME(scene) {
			await dangerButton(scene, "rename_doctype");
			await expect(dialog(scene, "data-rename-doctype-dialog")).toBeVisible();
			await expect(dialog(scene, "data-rename-links")).toBeVisible();
		},
		async COUNT_FAILS(scene) {
			await holds.get(scene)!.effects.abort();
			await dangerButton(scene, "rename_doctype");
			await expect(dialog(scene, "data-rename-doctype-dialog")).toBeVisible();
			await scene.settle(1500);
			await expect(dialog(scene, "data-rename-links")).toHaveCount(0);
		},
		async TYPE_NAME(scene) {
			await dialog(scene, "data-rename-doctype-dialog").getByLabel("New name").fill("UI Tax Invoice");
			await expect(dialog(scene, "data-rename-doctype-dialog").getByRole("button", { name: "Rename" })).toBeEnabled();
		},
		async TYPE_TAKEN(scene) {
			await dialog(scene, "data-rename-doctype-dialog").getByLabel("New name").fill("ToDo");
			await dialog(scene, "data-rename-doctype-dialog").getByRole("button", { name: "Rename" }).click();
			await expect(toasts(scene).first()).toBeVisible();
		},
		async CONFIRM_RENAME(scene) {
			await dialog(scene, "data-rename-doctype-dialog").getByRole("button", { name: "Rename" }).click();
			await expect(toasts(scene).getByText(`Renamed ${NAME} to UI Tax Invoice.`)).toBeVisible();
			await expect(scene.page).toHaveURL(/UI(%20| )Tax(%20| )Invoice/);
			await expect(scene.page.locator('[data-danger="delete_doctype"]')).toBeVisible();
		},
		async OPEN_DELETE(scene) {
			await dangerButton(scene, "delete_doctype");
			await expect(dialog(scene, "data-delete-doctype-dialog")).toBeVisible();
		},
		async TYPE_PARTIAL(scene) {
			await dialog(scene, "data-delete-doctype-dialog").getByLabel(`Type ${NAME} to confirm`).fill("UI Sales");
			await expect(dialog(scene, "data-delete-doctype-dialog").getByRole("button", { name: `Delete ${NAME}` })).toBeDisabled();
		},
		async TYPE_DOCTYPE(scene) {
			await dialog(scene, "data-delete-doctype-dialog").getByLabel(`Type ${NAME} to confirm`).fill(NAME);
			await expect(dialog(scene, "data-delete-doctype-dialog").getByRole("button", { name: `Delete ${NAME}` })).toBeEnabled();
		},
		async CONFIRM_DELETE(scene) {
			await dialog(scene, "data-delete-doctype-dialog").getByRole("button", { name: `Delete ${NAME}` }).click();
			await expect(toasts(scene).getByText(`Deleted ${NAME}.`)).toBeVisible();
			await expect(scene.page).toHaveURL(/\/apps\/desk\/doctype$|\/apps\/desk\/doctype\/?\?|\/doctype\/view/);
		},
		async DELETE_FAILS(scene) {
			await holds.get(scene)!.remove.abort();
			await dialog(scene, "data-delete-doctype-dialog").getByRole("button", { name: `Delete ${NAME}` }).click();
			await expect(toasts(scene).first()).toBeVisible();
			await expect(dialog(scene, "data-delete-doctype-dialog")).toBeHidden();
		},
		async CANCEL(scene) {
			const open = scene.page.locator(
				"[data-change-kind-dialog], [data-rename-doctype-dialog], [data-delete-doctype-dialog], [data-module-dialog], [data-mode-switch-dialog], [data-series-dialog]",
			);
			await scene.page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
			await expect(open).toHaveCount(0);
		},
		async DEVELOPER(scene) {
			await scene.page.route(/shell\.boot\.get_boot(\?|$)/, async (route) => {
				const response = await route.fetch();
				const body = await response.json();
				const boot = body.message ?? body.data ?? body;
				boot.developer_mode = true;
				await route.fulfill({ response, json: body });
			});
			await scene.goto(`/apps/desk/doctype/${encodeURIComponent(NAME)}`);
			await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
			await openSettings(scene);
			await openSection(scene, "danger");
			await expect(scene.page.locator('[data-danger="make_standard"]')).toBeVisible();
		},
		async OPEN_MOVE(scene) {
			await dangerButton(scene, "move_doctype");
			await expect(dialog(scene, "data-module-dialog")).toBeVisible();
		},
		async MOVE_MODULES_FAIL(scene) {
			await holds.get(scene)!.modules.abort();
			await dangerButton(scene, "move_doctype");
			await expect(dialog(scene, "data-module-dialog")).toBeVisible();
			await expect(toasts(scene).first()).toBeVisible();
		},
		async PICK_MOVE_MODULE(scene) {
			await dialog(scene, "data-module-dialog").getByRole("combobox").click();
			await scene.page.getByRole("option", { name: /^Desk/ }).first().click();
			await expect(dialog(scene, "data-module-dialog").getByRole("button", { name: "Move" })).toBeEnabled();
		},
		async CONFIRM_MOVE(scene) {
			await dialog(scene, "data-module-dialog").getByRole("button", { name: "Move" }).click();
			await expect(toasts(scene).getByText(`Moved ${NAME} to Desk.`)).toBeVisible();
			await expect(scene.page.getByText("In the Desk module.")).toBeVisible();
		},
		async OPEN_MAKE_STANDARD(scene) {
			await dangerButton(scene, "make_standard");
			await expect(dialog(scene, "data-module-dialog")).toBeVisible();
		},
		async PICK_MODULE(scene) {
			await dialog(scene, "data-module-dialog").getByRole("combobox").click();
			await scene.page.getByRole("option", { name: /Core/ }).first().click();
			await expect(dialog(scene, "data-module-dialog").getByRole("button", { name: "Make standard" })).toBeEnabled();
		},
		async CONFIRM_STANDARD(scene) {
			await scene.page.route(/danger\.make_standard/, (route) =>
				route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: null }) }),
			);
			await dialog(scene, "data-module-dialog").getByRole("button", { name: "Make standard" }).click();
			await expect(toasts(scene).getByText(/is standard now/)).toBeVisible();
		},
	},
	settle: {
		loading: async (scene) => {
			await expect(scene.page.getByText(`Loading ${NAME}…`)).toBeVisible();
		},
	},
});
