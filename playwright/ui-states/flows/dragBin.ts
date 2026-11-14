import { expect, type Locator } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import { seedInvoiceRecords, seedSalesInvoice, CUSTOMIZE_TARGET } from "../seed";
import type { Scene } from "../scene";

type Event =
	| { type: "GRABS_FIELD" }
	| { type: "MOVES_TO_BIN" }
	| { type: "RELEASES_ON_BIN" }
	| { type: "CONFIRMS" }
	| { type: "CANCELS" }
	| { type: "DROPS_IN_COLUMN" }
	| { type: "DROPS_ON_TAB" }
	| { type: "GRABS_SECTION" }
	| { type: "DROPS_SECTION" }
	| { type: "GRABS_COLUMN" }
	| { type: "DROPS_COLUMN" }
	| { type: "GRABS_TAB" }
	| { type: "DROPS_TAB" }
	| { type: "OPENS_CUSTOMIZE" }
	| { type: "GRABS_STANDARD_FIELD" }
	| { type: "RELEASES_TO_HIDE" }
	| { type: "GRABS_HIDDEN_FIELD" }
	| { type: "RELEASES_ON_HIDDEN" };

/**
 * Dragging in the editor canvas and the bin under it. In the code this is `canvasDrops.ts` (the
 * drop handlers), `CanvasColumn.vue` (`startDrag`/`dropOnBin`), `FieldBin.vue` (the pill, which
 * tracks the pointer itself) and `fieldPanel.ts` (`removeField`, the confirm the bin shares with
 * the panel trash). Only a placed field's drag shows the bin; sections, columns and tabs reorder
 * and have no bin to drop on.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "dragBin",
	initial: "idle",
	states: {
		idle: {
			meta: { description: "The Design canvas of UI Sales Invoice at rest: no drag in flight, so the bin is hidden." },
			on: {
				GRABS_FIELD: "draggingField",
				GRABS_SECTION: "draggingSection",
				GRABS_COLUMN: "draggingColumn",
				GRABS_TAB: "draggingTab",
				OPENS_CUSTOMIZE: "customizeIdle",
			},
		},
		draggingField: {
			meta: { description: "A placed field is held and has moved: it follows the pointer, a drop line marks where it would land, and the bin shows at the canvas's bottom reading 'Drop here to remove'." },
			on: { MOVES_TO_BIN: "overBin", DROPS_IN_COLUMN: "fieldMoved", DROPS_ON_TAB: "fieldOnOtherTab" },
		},
		overBin: {
			meta: { description: "The held field is over the bin: the pill turns red and reads 'Release to remove'." },
			on: { RELEASES_ON_BIN: "removeConfirm" },
		},
		removeConfirm: {
			meta: { description: "The field was released on the bin: the 'Remove Customer?' dialog says its column and values stay in the database, with Remove and Cancel; nothing is staged yet." },
			on: { CONFIRMS: "fieldRemoved", CANCELS: "idle" },
		},
		fieldRemoved: {
			meta: { description: "Remove was confirmed: the field is gone from the canvas and from the field list, the header shows 'Not saved' and Undo is enabled." },
		},
		fieldMoved: {
			meta: { description: "The field was released in the other column of its section: it sits there now, the header shows 'Not saved' and Undo is enabled." },
		},
		fieldOnOtherTab: {
			meta: { description: "The field was released on a tab's name: it left the open tab for the end of the Items tab's first section, so it is gone from this view and the header shows 'Not saved'." },
		},
		draggingSection: {
			meta: { description: "A section is held by its grip: the section follows the pointer and a faded copy marks its place. No bin shows, because a section cannot be dropped on it." },
			on: { DROPS_SECTION: "sectionMoved" },
		},
		sectionMoved: {
			meta: { description: "The section was released above the other: the order changed, and the header shows 'Not saved'." },
		},
		draggingColumn: {
			meta: { description: "A column is held by the grip on its ring: the column follows the pointer and a faded copy marks its place. No bin shows." },
			on: { DROPS_COLUMN: "columnMoved" },
		},
		columnMoved: {
			meta: { description: "The column was released before its neighbour: the two columns swapped, and the header shows 'Not saved'." },
		},
		draggingTab: {
			meta: {
				transient: true,
				description: "A tab is held to reorder the strip. It cannot be reached with a mouse: the tab is one button and the drag options filter every button out, so a press on the tab never starts a drag.",
			},
			on: { DROPS_TAB: "tabMoved" },
		},
		tabMoved: {
			meta: {
				transient: true,
				description: "The tab was released before its neighbour. Not reachable, as the drag never starts.",
			},
		},
		customizeIdle: {
			meta: { description: "The Customize canvas of Event: a standard DocType, whose fields are standard and can be hidden but not removed." },
			on: { GRABS_STANDARD_FIELD: "customizeDragging" },
		},
		customizeDragging: {
			meta: { description: "A standard field is held in Customize: the bin shows, reading 'Drop here to hide' instead of remove." },
			on: { RELEASES_TO_HIDE: "fieldHidden" },
		},
		fieldHidden: {
			meta: { description: "The field was released on the bin: no confirm, it stays on the canvas faded as hidden, and the header shows 'Not saved'." },
			on: { GRABS_HIDDEN_FIELD: "hiddenOverBin" },
		},
		hiddenOverBin: {
			meta: { description: "The already hidden field is held over the bin: the pill still reads 'Release to hide', though a hidden field cannot be hidden again." },
			on: { RELEASES_ON_HIDDEN: "dropRefused" },
		},
		dropRefused: {
			meta: { description: "The hidden field was released on the bin: nothing happened and nothing says so; the field is still hidden and the bin is gone." },
		},
	},
});

const bin = (scene: Scene) => scene.page.locator("[data-canvas-bin]");
const field = (scene: Scene, fieldname: string) => scene.page.locator(`[data-canvas-field="${fieldname}"]`);
const dialog = (scene: Scene) => scene.page.getByRole("dialog");

export const dragBin = defineFlow<Event>({
	id: "drag-bin",
	title: "Drag and the bin",
	source: "frontend/src/pages/doctypeEditor/canvasDrops.ts, CanvasColumn.vue, FieldBin.vue, fieldPanel.ts (removeField)",
	machine,
	async enter(scene) {
		const name = await seedSalesInvoice(scene);
		await clearRecords(scene);
		await seedInvoiceRecords(scene);
		await scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
		await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
		await expect(field(scene, "posting_date")).toBeVisible();
		await expect(bin(scene)).toHaveCSS("opacity", "0");
	},
	events: {
		async GRABS_FIELD(scene) {
			await grab(scene, field(scene, "posting_date"));
			await expect(bin(scene)).toHaveCSS("opacity", "1");
			await expect(bin(scene)).not.toHaveAttribute("data-over", /.*/);
			await expect(bin(scene)).toContainText("Drop here to remove");
		},
		async MOVES_TO_BIN(scene) {
			await moveTo(scene, bin(scene));
			await expect(bin(scene)).toHaveAttribute("data-over", "true");
			await expect(bin(scene)).toContainText("Release to remove");
		},
		async RELEASES_ON_BIN(scene) {
			await scene.page.mouse.up();
			await expect(dialog(scene).getByText("Remove Posting date?")).toBeVisible();
		},
		async CONFIRMS(scene) {
			await dialog(scene).getByRole("button", { name: "Remove" }).click();
			await expect(field(scene, "posting_date")).toHaveCount(0);
			await expect(scene.page.getByText("Not saved")).toBeVisible();
		},
		async CANCELS(scene) {
			await dialog(scene).getByRole("button", { name: "Cancel" }).click();
			await expect(dialog(scene)).toHaveCount(0);
			await expect(field(scene, "posting_date")).toBeVisible();
		},
		async DROPS_IN_COLUMN(scene) {
			await moveTo(scene, field(scene, "due_date"));
			await scene.page.mouse.up();
			await expect(scene.page.getByText("Not saved")).toBeVisible();
			await expect(scene.page.locator('[data-canvas-column]:nth-child(2)').locator('[data-canvas-field="posting_date"]')).toBeVisible();
		},
		async DROPS_ON_TAB(scene) {
			await moveTo(scene, scene.page.getByRole("tab", { name: "Items" }));
			await scene.page.mouse.up();
			await expect(scene.page.getByText("Not saved")).toBeVisible();
			await expect(field(scene, "posting_date")).toHaveCount(0);
		},
		async GRABS_SECTION(scene) {
			await scene.page.getByRole("tab", { name: "Items" }).click();
			const section = scene.page.locator('[data-canvas-section="totals_section"]');
			await expect(section).toBeVisible();
			await section.hover();
			await grab(scene, section.locator(".section-grip"));
			// Up over the other section, so the faded copy marks where it would land.
			await moveTo(scene, scene.page.locator("[data-canvas-section]").first(), "right");
			await expect(scene.page.locator(".sortable-drag").first()).toBeVisible();
			await expect(bin(scene)).toHaveCSS("opacity", "0");
		},
		async DROPS_SECTION(scene) {
			const first = scene.page.locator("[data-canvas-section]").first();
			await moveTo(scene, first, "right");
			await scene.page.mouse.up();
			await expect(scene.page.getByText("Not saved")).toBeVisible();
			await expect(scene.page.locator("[data-canvas-section]").first()).toHaveAttribute("data-canvas-section", "totals_section");
		},
		async GRABS_COLUMN(scene) {
			await scene.page.getByRole("tab", { name: "Items" }).click();
			const second = scene.page.locator('[data-canvas-section="totals_section"] [data-canvas-column]').nth(1);
			await expect(second).toBeVisible();
			const box = (await second.boundingBox())!;
			// The free space under the column's last field takes the hover, and with it the ring and the grip.
			await scene.page.mouse.move(box.x + box.width / 2, box.y + box.height - 6, { steps: 5 });
			await expect(second.locator("[data-canvas-column-grip]")).toBeVisible();
			await grab(scene, second.locator("[data-canvas-column-grip]"));
			await expect(scene.page.locator(".sortable-drag").first()).toBeVisible();
			await expect(bin(scene)).toHaveCSS("opacity", "0");
		},
		async DROPS_COLUMN(scene) {
			const first = scene.page.locator('[data-canvas-section="totals_section"] [data-canvas-column]').first();
			await moveTo(scene, first, "left");
			await scene.page.mouse.up();
			await expect(scene.page.getByText("Not saved")).toBeVisible();
			await expect(
				scene.page.locator('[data-canvas-section="totals_section"] [data-canvas-column]').first().locator('[data-canvas-field="net_total"]'),
			).toBeVisible();
		},
		async GRABS_TAB(scene) {
			// The press lands on the tab's button, which the drag options filter out.
			await grab(scene, scene.page.getByRole("tab", { name: "Payments" }));
			await moveTo(scene, scene.page.getByRole("tab", { name: "Details" }));
			await expect(scene.page.locator(".sortable-drag, .sortable-fallback")).toHaveCount(0);
		},
		async DROPS_TAB(scene) {
			await scene.page.mouse.up();
		},
		async OPENS_CUSTOMIZE(scene) {
			await scene.goto(`/apps/desk/doctype/${CUSTOMIZE_TARGET}?mode=customize`);
			await expect(scene.page.locator("[data-doctype-editor]")).toBeVisible();
			await expect(scene.page.locator("[data-canvas-field]").first()).toBeVisible();
		},
		async GRABS_STANDARD_FIELD(scene) {
			await grab(scene, scene.page.locator("[data-canvas-field]").first());
			await expect(bin(scene)).toHaveCSS("opacity", "1");
			await expect(bin(scene)).toContainText("Drop here to hide");
		},
		async RELEASES_TO_HIDE(scene) {
			await moveTo(scene, bin(scene));
			await expect(bin(scene)).toContainText("Release to hide");
			await scene.page.mouse.up();
			await expect(scene.page.getByText("Not saved")).toBeVisible();
			await expect(scene.page.locator("[data-canvas-field] .opacity-50").first()).toBeVisible();
		},
		async GRABS_HIDDEN_FIELD(scene) {
			const hidden = scene.page.locator("[data-canvas-field]:has(.opacity-50)").first();
			await grab(scene, hidden);
			await moveTo(scene, bin(scene));
			await expect(bin(scene)).toHaveAttribute("data-over", "true");
			await expect(bin(scene)).toContainText("Release to hide");
		},
		async RELEASES_ON_HIDDEN(scene) {
			await scene.page.mouse.up();
			await expect(bin(scene)).toHaveCSS("opacity", "0");
		},
	},
});

/** Presses on the middle of the target and moves a little, which is what starts Sortable's fallback drag. */
async function grab(scene: Scene, target: Locator): Promise<void> {
	const box = await target.boundingBox();
	if (!box) throw new Error("nothing to grab");
	const x = box.x + Math.min(box.width / 2, 60);
	const y = box.y + box.height / 2;
	await scene.page.mouse.move(x, y);
	await scene.page.mouse.down();
	await scene.page.mouse.move(x + 6, y + 6, { steps: 4 });
	await scene.page.mouse.move(x + 14, y + 12, { steps: 4 });
}

/** Moves the held pointer over the target in small steps, so the lists and the bin see each move. */
async function moveTo(scene: Scene, target: Locator, at: "center" | "right" | "left" = "center"): Promise<void> {
	const box = await target.boundingBox();
	if (!box) throw new Error("nothing to move to");
	const x = at === "left" ? box.x + 8 : at === "right" ? box.x + box.width - 10 : box.x + box.width / 2;
	const y = box.y + (at === "right" ? 8 : box.height / 2);
	await scene.page.mouse.move(x, y, { steps: 25 });
	await scene.page.waitForTimeout(150);
	await scene.page.mouse.move(x + 1, y + 1, { steps: 2 });
}

/** A deleted custom DocType leaves its table on this SQLite site, so rows of an earlier run can still be there. */
async function clearRecords(scene: Scene): Promise<void> {
	for (const doctype of ["UI Sales Invoice", "UI Customer"]) {
		const res = await scene.api.get(`/api/resource/${encodeURIComponent(doctype)}`, { params: { limit_page_length: 200 }, failOnStatusCode: false });
		if (!res.ok()) continue;
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data)
			await scene.api.delete(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { failOnStatusCode: false });
	}
}
