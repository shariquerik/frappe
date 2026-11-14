import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Scene } from "../scene";
import { seedSalesInvoice } from "../seed";

type Event =
	| { type: "ADD_CONDITION" }
	| { type: "PICK_FIELD" }
	| { type: "ADD_SECOND" }
	| { type: "SHOW_CODE" }
	| { type: "TYPE_UNREADABLE" }
	| { type: "CLEAR" }
	| { type: "DONE" }
	| { type: "ESCAPE" }
	| { type: "OPEN_FILTERS" }
	| { type: "ADD_TWO_ON_ONE_FIELD" };

/**
 * The rule dialog of a field's Visible if row, opened from the panel of Payment due date. In the code
 * this is `RuleRow.vue` (a `draft` and an `open` flag), `RuleEditor.vue` (`draft.mode` picks the builder or
 * the textarea) and `ruleDraft.ts` (`mode`, `readable`, `problem`, `changed` are the state; the draft is
 * staged once, when the dialog closes, whether by Done, the close button or Escape).
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "condition",
	initial: "empty",
	states: {
		empty: {
			meta: { description: "The dialog opens on a field with no condition: the note 'Always visible. Add a condition to show it only sometimes.' with an Add condition button, the Rules | Code toggle, Clear condition disabled and Done." },
			on: { ADD_CONDITION: "blankRow", SHOW_CODE: "codeEmpty", ESCAPE: "unchanged" },
		},
		blankRow: {
			meta: { description: "Add condition made a row with nothing chosen yet: 'Where', a Field picker, and an empty operator and value, with Add condition under it." },
			on: { PICK_FIELD: "ruleAdded" },
		},
		ruleAdded: {
			meta: { description: "A rule is in the builder: 'Where Is return (credit note) Equals Yes'. Clear condition is enabled now." },
			on: { ADD_SECOND: "twoRules", SHOW_CODE: "codeOfRule", CLEAR: "empty", DONE: "applied", ESCAPE: "applied" },
		},
		twoRules: {
			meta: { description: "A second condition is added: the rows are joined by 'And' on a bracket, each with its own field, operator and value, and the word 'and' is a toggle for 'or'." },
		},
		codeEmpty: {
			meta: { description: "The Code toggle with no condition: an empty textarea with the example doc.status === \"Open\" as its placeholder, and 'JavaScript. doc is the record.' under it." },
		},
		codeOfRule: {
			meta: { description: "The Code toggle on the rule just built: the textarea holds the same rule as text in monospace (`is_return`, a bare fieldname) with 'JavaScript. doc is the record.' under it." },
			on: { TYPE_UNREADABLE: "codeUnreadable" },
		},
		codeUnreadable: {
			meta: { description: "Code the builder cannot read: the note says 'The rules can't show this condition. It stays as code, as written.' and the Rules option of the toggle is disabled." },
		},
		applied: {
			meta: { description: "The dialog is closed (by Done or Escape: both stage the draft): the Visible if row reads 'Is return (credit note) is on', the canvas field carries a rule mark, and the header shows 'Not saved'." },
		},
		unchanged: {
			meta: { description: "Escape on an untouched dialog: it closes, the Visible if row still reads 'Always' and nothing is staged (Save stays disabled)." },
			on: { OPEN_FILTERS: "filtersEmpty" },
		},
		filtersEmpty: {
			meta: { description: "The same dialog on a Link field's Filters: no 'and'/'or' choice, a note 'Every UI Customer is offered. Add a filter to offer fewer.' and an Add filter button." },
			on: { ADD_TWO_ON_ONE_FIELD: "filtersProblem" },
		},
		filtersProblem: {
			meta: { description: "Two filters name Territory: a red line under the builder says 'Territory has two filters, and a Link search keeps only one', and the draft is not staged." },
		},
	},
});

const dialog = (scene: Scene) => scene.page.getByRole("dialog");
const ROW = '[data-rule-row="due_date.depends_on"]';

export const condition = defineFlow<Event>({
	id: "condition",
	title: "Condition dialog",
	source:
		"frontend/src/pages/doctypeEditor/RuleRow.vue, RuleEditor.vue, ruleDraft.ts, ruleWords.ts, linkFilters.ts, FieldRules.vue, LinkFiltersRow.vue",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
		await scene.page.locator('[data-canvas-field="due_date"]').click();
		await scene.page.locator(ROW).click();
		await expect(dialog(scene)).toBeVisible();
		await expect(dialog(scene).locator("[data-slot=condition-empty]")).toBeVisible();
	},
	events: {
		async ADD_CONDITION(scene) {
			await dialog(scene).locator("[data-slot=condition-empty]").click();
			await expect(dialog(scene).getByRole("button", { name: "Field", exact: true })).toBeVisible();
		},
		async PICK_FIELD(scene) {
			await dialog(scene).getByRole("button", { name: "Field", exact: true }).click();
			await scene.page.getByRole("option", { name: "Is return (credit note)" }).click();
			await expect(dialog(scene).getByRole("combobox", { name: /Operator/ })).toHaveText("Equals");
			await expect(dialog(scene).getByRole("button", { name: "Clear condition" })).toBeEnabled();
		},
		async ADD_SECOND(scene) {
			await dialog(scene).getByRole("button", { name: "Add condition" }).click();
			await scene.page.getByRole("menuitem", { name: "Add condition", exact: true }).click();
			await dialog(scene).getByRole("button", { name: "Field", exact: true }).click();
			await scene.page.getByRole("option", { name: "Status" }).click();
			await expect(dialog(scene).getByRole("combobox", { name: /Operator/ })).toHaveCount(2);
		},
		async SHOW_CODE(scene) {
			await dialog(scene).getByRole("radio", { name: "Code" }).click();
			await expect(dialog(scene).locator("[data-rule-code]")).toBeVisible();
		},
		async TYPE_UNREADABLE(scene) {
			await dialog(scene).locator("[data-rule-code]").fill('frappe.user.has_role("Accounts Manager") && doc.is_return');
			await expect(dialog(scene).getByText("The rules can't show this condition. It stays as code, as written.")).toBeVisible();
		},
		async CLEAR(scene) {
			await dialog(scene).getByRole("button", { name: "Clear condition" }).click();
			await expect(dialog(scene).locator("[data-slot=condition-empty]")).toBeVisible();
		},
		async DONE(scene) {
			await dialog(scene).getByRole("button", { name: "Done" }).click();
			await expect(dialog(scene)).toBeHidden();
			await expect(scene.page.locator(ROW)).toContainText("is on");
		},
		async ESCAPE(scene) {
			const changed = await dialog(scene).getByRole("button", { name: "Clear condition" }).isEnabled();
			await scene.page.keyboard.press("Escape");
			await expect(dialog(scene)).toBeHidden();
			if (changed) await expect(scene.page.locator(ROW)).toContainText("is on");
			else await expect(scene.page.locator(ROW)).toContainText("Always");
		},
		async OPEN_FILTERS(scene) {
			await scene.page.locator('[data-canvas-field="customer"]').click();
			const row = scene.page.locator('[data-rule-row="customer.link_filters"]');
			await expect(row).toBeEnabled();
			await row.click();
			await expect(dialog(scene).locator("[data-slot=condition-empty]")).toBeVisible();
		},
		async ADD_TWO_ON_ONE_FIELD(scene) {
			await addFilter(scene, "North");
			await addFilter(scene, "South");
			await expect(dialog(scene).locator("[data-slot=condition-error]")).toContainText("has two filters");
		},
	},
});

async function addFilter(scene: Scene, territory: string): Promise<void> {
	const empty = dialog(scene).locator("[data-slot=condition-empty]");
	if (await empty.count()) await empty.click();
	else await dialog(scene).getByRole("button", { name: "Add filter" }).click();
	await dialog(scene).getByRole("button", { name: "Field", exact: true }).click();
	await scene.page.getByRole("option", { name: "Territory" }).click();
	await dialog(scene).getByRole("combobox", { name: "Select an Option" }).or(dialog(scene).getByText("Select an Option")).last().click();
	await scene.page.getByRole("option", { name: territory }).click();
	await expect(dialog(scene).getByText(territory, { exact: true })).toBeVisible();
}
