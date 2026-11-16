import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";
import { seedSalesInvoice } from "../seed";

type Event =
	| { type: "LOADS" }
	| { type: "FAILS" }
	| { type: "RETRY" }
	| { type: "OPEN_ITEMS" }
	| { type: "OPEN_ITEMS_SLOW" }
	| { type: "OPEN_ITEMS_FAILING" }
	| { type: "OPEN_PAYMENTS" }
	| { type: "OPEN_MORE" }
	| { type: "PICK_RULE_FIELD" };

/**
 * The editor on a layout with four tabs, sections in columns, a child Table and `depends_on`
 * rules ("UI Sales Invoice", a stand-in for ERPNext's Sales Invoice). In the code: `DoctypeEditor.vue`
 * (`state` is null until `loadEditor` lands), `CanvasTabs.vue` (the strip draws from two tabs up),
 * `CanvasTable.vue` and `childFields.ts` (the Table's columns come from the child's meta), `RuleMark.vue`.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "designInvoice",
	initial: "loading",
	states: {
		loading: {
			meta: { description: "The DocType request has not come back: 'Loading UI Sales Invoice…' in an empty page, no header, no tabs." },
			on: { LOADS: "details", FAILS: "failed" },
		},
		failed: {
			meta: { description: "The DocType request failed: 'Something went wrong. This page could not load.' with Try again, and no editor." },
			on: { RETRY: "details" },
		},
		details: {
			meta: { description: "The loaded editor on the Details tab of a four-tab layout: tab strip (Details, Items, Payments, More information), the Customer section in two columns, and a rule mark beside 'Return against'." },
			on: {
				OPEN_ITEMS: "items",
				OPEN_ITEMS_SLOW: "itemsColumnsPending",
				OPEN_ITEMS_FAILING: "itemsColumnsFailed",
				OPEN_PAYMENTS: "payments",
				OPEN_MORE: "more",
				PICK_RULE_FIELD: "ruleField",
			},
		},
		ruleField: {
			meta: { description: "'Return against' selected: the right panel shows its settings and, under Conditions, the rule that shows it only when 'Is return (credit note)' is on." },
		},
		items: {
			meta: { description: "The Items tab, selected (the right panel shows the tab's label, order and Visible if): the child Table field drawn as a grid with the child DocType's four columns (Item, Quantity, Rate, Amount), then the Totals section with a rule mark on 'Discount amount'." },
		},
		itemsColumnsPending: {
			meta: { description: "The Items tab while the child DocType's meta has not arrived: the Table field shows a grey loading bar in place of its grid." },
		},
		itemsColumnsFailed: {
			meta: { description: "The Items tab after the child DocType's meta request failed: the Table field shows the red line 'Could not load the columns of UI Sales Invoice Item.' with a Try again button." },
		},
		payments: {
			meta: { description: "The Payments tab, selected (tab settings in the right panel): an 'Include payment (POS)' check, then a Payment details section with a rule mark on its heading (it shows only when that check is on) and one on 'Paid amount' (required only then)." },
		},
		more: {
			meta: { description: "The More information tab, the last of the strip and selected (tab settings in the right panel, the move-right arrow disabled): a Status Select and a Remarks Small Text." },
		},
	},
});

const holds = new WeakMap<Scene, Hold>();
const LOAD = /get_doctype_editor/;
const CHILD_META = /doctype\/UI(%20| )Sales(%20| )Invoice(%20| )Item\/meta/;
const NAME = "UI Sales Invoice";

const editor = (scene: Scene) => scene.page.locator("[data-doctype-editor]");
const table = (scene: Scene) => editor(scene).locator('[data-canvas-field="items"]');
const tab = (scene: Scene, name: string) => editor(scene).getByRole("tab", { name });

async function opened(scene: Scene): Promise<void> {
	await expect(editor(scene).getByRole("textbox", { name: "Section label" }).first()).toBeVisible();
	await expect(tab(scene, "Details")).toHaveAttribute("aria-selected", "true");
}

export const designInvoice = defineFlow<Event>({
	id: "design-invoice",
	title: "Design: Sales Invoice",
	source: "frontend/src/pages/doctypeEditor/DoctypeEditor.vue, CanvasTabs.vue, CanvasTable.vue, childFields.ts, RuleMark.vue, editorSource.ts",
	machine,
	async enter(scene) {
		await seedSalesInvoice(scene);
		const load = await scene.hold(LOAD);
		holds.set(scene, load);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(NAME)}?mode=design`);
		await expect(scene.page.getByText(`Loading ${NAME}…`)).toBeVisible();
	},
	events: {
		async LOADS(scene) {
			await holds.get(scene)?.release();
			await opened(scene);
		},
		async FAILS(scene) {
			await holds.get(scene)?.abort();
			await expect(scene.page.getByText("Something went wrong")).toBeVisible();
		},
		async RETRY(scene) {
			await holds.get(scene)?.release();
			await scene.page.getByRole("button", { name: "Try again" }).click();
			await opened(scene);
		},
		async OPEN_ITEMS(scene) {
			await tab(scene, "Items").click();
			await expect(editor(scene).locator('[data-canvas-section="totals_section"]')).toBeVisible();
			await expect(table(scene).getByText("Quantity", { exact: true })).toBeVisible();
		},
		async OPEN_ITEMS_SLOW(scene) {
			await scene.hold(CHILD_META);
			await tab(scene, "Items").click();
			await expect(editor(scene).locator('[data-canvas-section="totals_section"]')).toBeVisible();
			await expect(table(scene).getByText("Quantity", { exact: true })).toHaveCount(0);
		},
		async OPEN_ITEMS_FAILING(scene) {
			await (await scene.hold(CHILD_META)).abort();
			await tab(scene, "Items").click();
			await expect(editor(scene).locator('[data-canvas-section="totals_section"]')).toBeVisible();
			await scene.settle(1500);
			await expect(table(scene).getByText("Quantity", { exact: true })).toHaveCount(0);
		},
		async OPEN_PAYMENTS(scene) {
			await tab(scene, "Payments").click();
			await expect(editor(scene).getByText("Include payment (POS)")).toBeVisible();
		},
		async OPEN_MORE(scene) {
			await tab(scene, "More information").click();
			await expect(editor(scene).getByText("Remarks", { exact: true })).toBeVisible();
		},
		async PICK_RULE_FIELD(scene) {
			await editor(scene).locator('[data-canvas-field="return_against"]').click();
			await expect(scene.page.locator("[data-editor-panel]").getByText("Conditions")).toBeVisible();
		},
	},
});
