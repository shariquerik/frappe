import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Scene } from "../scene";
import { seedSalesInvoice } from "../seed";

type Event =
	| { type: "OPENS" }
	| { type: "CLOSES_WITH_ESCAPE" }
	| { type: "TYPES_A_FIELD_NAME" }
	| { type: "TYPES_NOTHING_KNOWN" }
	| { type: "MOVES_DOWN" }
	| { type: "PICKS_FIELD" }
	| { type: "PICKS_SETTING" }
	| { type: "SELECTS_FIELD_AND_OPENS" };

/**
 * The header's finder (Mod+J) on a custom DocType standing in for Sales Invoice. In the code this is
 * `EditorFinder.vue` (`open`, `query`, `active`) and `editorFinder.ts` (`finderGroups`). It reads the
 * loaded canvas and the field panel and fetches nothing, so it has no loading or failed state.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "finder",
	initial: "closed",
	states: {
		closed: {
			meta: { description: "The editor with the finder closed: a search button with its Ctrl+J hint in the header, no field selected." },
			on: { OPENS: "openEmpty", SELECTS_FIELD_AND_OPENS: "openOnField" },
		},
		openEmpty: {
			meta: { description: "The finder just opened with nothing typed: a search box and the first six fields and settings, grouped, the first row highlighted." },
			on: { TYPES_A_FIELD_NAME: "results", TYPES_NOTHING_KNOWN: "noResults", CLOSES_WITH_ESCAPE: "closed" },
		},
		openOnField: {
			meta: { description: "The finder opened while a field is selected: a 'Properties of …' group leads the list, then the fields and settings." },
		},
		results: {
			meta: { description: "A query that matches fields and settings: only the matching rows remain, in their groups, with the section each is in as a suffix." },
			on: { MOVES_DOWN: "resultsMoved", PICKS_FIELD: "fieldPicked", PICKS_SETTING: "settingPicked", CLOSES_WITH_ESCAPE: "closed" },
		},
		resultsMoved: {
			meta: { description: "The arrow key moved the highlight to the second row, which the list scrolls into view." },
		},
		noResults: {
			meta: { description: "A query that matches nothing: the list shows one line, 'Nothing matches “…”.'" },
		},
		fieldPicked: {
			meta: { description: "A field was picked: the finder closed, the field is selected on the canvas and its panel is open." },
		},
		settingPicked: {
			meta: { description: "A setting was picked: the finder closed, the Settings tab opened on that setting's section (Naming) and scrolled to the row." },
		},
	},
});

const finderButton = (scene: Scene) => scene.page.locator("[data-editor-finder]");
const content = (scene: Scene) => scene.page.locator("[data-editor-finder-content]");
const search = (scene: Scene) => content(scene).getByRole("textbox");
const rows = (scene: Scene) => content(scene).locator("[data-finder-row]");

export const finder = defineFlow<Event>({
	id: "finder",
	title: "Finder (⌘J)",
	source: "frontend/src/pages/doctypeEditor/EditorFinder.vue, editorFinder.ts, panelIndex.ts, DoctypeEditor.vue (`finder`, `find`, `findSetting`)",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(scene.page.locator("[data-canvas-field=customer]")).toBeVisible();
		await expect(finderButton(scene)).toBeVisible();
		await expect(content(scene)).toBeHidden();
	},
	events: {
		async OPENS(scene) {
			await scene.page.keyboard.press("Control+j");
			await expect(search(scene)).toBeFocused();
			await expect(content(scene).getByText("Fields", { exact: true })).toBeVisible();
		},
		async CLOSES_WITH_ESCAPE(scene) {
			await scene.page.keyboard.press("Escape");
			await expect(content(scene)).toBeHidden();
		},
		async TYPES_A_FIELD_NAME(scene) {
			await search(scene).fill("date");
			await expect(content(scene).getByText("Posting date")).toBeVisible();
			await expect(content(scene).getByText("Payment due date")).toBeVisible();
			await expect(content(scene).getByText("Properties", { exact: false })).toHaveCount(0);
		},
		async TYPES_NOTHING_KNOWN(scene) {
			await search(scene).fill("zebra");
			await expect(content(scene).getByText("Nothing matches “zebra”.")).toBeVisible();
		},
		async MOVES_DOWN(scene) {
			await scene.page.keyboard.press("ArrowDown");
			await expect(rows(scene).nth(1)).toHaveAttribute("data-state", "active");
		},
		async PICKS_FIELD(scene) {
			await content(scene).locator('[data-finder-row="field-due_date"]').click();
			await expect(content(scene)).toBeHidden();
			await expect(scene.page.locator("[data-canvas-field=due_date]")).toHaveAttribute("data-canvas-selected", /.*/);
			await expect(scene.page.locator("[data-editor-panel] [data-panel-label]")).toHaveValue("Payment due date");
		},
		async PICKS_SETTING(scene) {
			await search(scene).fill("naming");
			await content(scene).locator('[data-finder-row^="setting-"]').first().click();
			await expect(content(scene)).toBeHidden();
			await expect(scene.page.getByRole("tab", { name: "Settings", selected: true })).toBeVisible();
		},
		async SELECTS_FIELD_AND_OPENS(scene) {
			await scene.page.locator("[data-canvas-field=posting_date]").click();
			await expect(scene.page.locator("[data-editor-panel] [data-panel-label]")).toHaveValue("Posting date");
			await scene.page.keyboard.press("Control+j");
			await expect(content(scene).getByText("Properties of Posting date")).toBeVisible();
		},
	},
});
