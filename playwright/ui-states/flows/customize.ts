import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";
import { CUSTOMIZE_TARGET, resetCustomizations } from "../seed";

type Event =
	| { type: "LOADS" }
	| { type: "FAILS" }
	| { type: "OPENS_CORE_DOCTYPE" }
	| { type: "SELECTS_STANDARD_FIELD" }
	| { type: "SELECTS_CUSTOM_FIELD" }
	| { type: "SELECTS_CHANGED_FIELD" }
	| { type: "EDITS_LABEL" };

/**
 * Customize mode on a standard DocType, with Event standing in for Sales Invoice. In the code this
 * is `DoctypeEditor.vue` (`load`, `pageState`, `state`), `mode.py` (the refusal), `customizeView.ts`
 * (`marks`, `lock`) and `CustomizeMarks.vue` / `PanelRow.vue` for the marks the screen draws.
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "customize",
	initial: "loading",
	states: {
		loading: {
			meta: { description: "The editor has asked the server for Event in Customize mode and nothing has come back: the page shows 'Loading Event…' under the shell header." },
			on: { LOADS: "loaded", FAILS: "failed" },
		},
		failed: {
			meta: { description: "The load failed on the server: the page shows a failed state with the message and a Try again button." },
		},
		loaded: {
			meta: { description: "Customize mode on Event with this site's changes marked: a Custom badge on the field the site added, a dot on a standard field it changed, an eye on a hidden one." },
			on: {
				SELECTS_STANDARD_FIELD: "standardFieldSelected",
				SELECTS_CUSTOM_FIELD: "customFieldSelected",
				SELECTS_CHANGED_FIELD: "changedFieldSelected",
				OPENS_CORE_DOCTYPE: "coreRefused",
			},
		},
		coreRefused: {
			meta: { description: "Customize was asked for a core DocType (User): the server refuses with a permission error, so the page shows the generic No permission state and not the server's reason." },
		},
		standardFieldSelected: {
			meta: { description: "A standard field the app makes mandatory (Subject) is selected: its panel shows the Fieldname and the Required row locked, with the reason in the lock's tooltip." },
		},
		customFieldSelected: {
			meta: { description: "A field the site added (Venue Room) is selected: its panel has nothing locked, and Fieldname and Type are editable as on a custom DocType." },
			on: { EDITS_LABEL: "dirty" },
		},
		changedFieldSelected: {
			meta: { description: "A standard field the site relabelled (All Day, now 'All-day event') is selected: the Label row carries a dot that resets it to the app's value." },
		},
		dirty: {
			meta: { description: "The label of the custom field was edited: the header shows 'Not saved' and Save is enabled; nothing is written to the site yet." },
		},
	},
});

const holds = new WeakMap<Scene, Hold>();

const route = (doctype: string) => `/apps/desk/doctype/${encodeURIComponent(doctype)}?mode=customize`;
const editor = (scene: Scene) => scene.page.locator("[data-doctype-editor]");
const field = (scene: Scene, fieldname: string) => scene.page.locator(`[data-canvas-field="${fieldname}"]`);

export const customize = defineFlow<Event>({
	id: "customize",
	title: "Customize: Sales Invoice",
	source: "frontend/src/pages/doctypeEditor/DoctypeEditor.vue, editorSource.ts, customizeView.ts, CustomizeMarks.vue, PanelRow.vue; frappe/desk/doctype_editor/mode.py",
	machine,
	async enter(scene) {
		resetCustomizations(scene);
		await seedCustomizations(scene);
		// Only Event's load is held: the core DocType's refusal must reach the page.
		const load = await scene.hold(new RegExp(`get_doctype_editor\\?doctype=${CUSTOMIZE_TARGET}(&|$)`));
		holds.set(scene, load);
		await scene.goto(route(CUSTOMIZE_TARGET));
		await expect(scene.page.getByText(`Loading ${CUSTOMIZE_TARGET}…`)).toBeVisible();
	},
	events: {
		async LOADS(scene) {
			await holds.get(scene)?.release();
			await expect(field(scene, "subject")).toBeVisible();
			await expect(field(scene, "custom_venue_room")).toBeVisible();
		},
		async FAILS(scene) {
			await holds.get(scene)?.abort();
			await expect(scene.page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
		},
		async OPENS_CORE_DOCTYPE(scene) {
			await scene.goto(route("User"));
			await expect(scene.page.getByText("You do not have permission to see this.")).toBeVisible();
		},
		async SELECTS_STANDARD_FIELD(scene) {
			await select(scene, "subject");
			await expect(scene.page.locator("[data-editor-panel] [data-row-lock]").first()).toBeVisible();
		},
		async SELECTS_CUSTOM_FIELD(scene) {
			await select(scene, "custom_venue_room");
			await expect(scene.page.locator("[data-editor-panel] [data-panel-label]")).toHaveValue("Venue Room");
		},
		async SELECTS_CHANGED_FIELD(scene) {
			await select(scene, "all_day");
			await expect(scene.page.locator("[data-editor-panel] [data-row-changed]").first()).toBeVisible();
		},
		async EDITS_LABEL(scene) {
			const label = scene.page.locator("[data-editor-panel] [data-panel-label]");
			await label.fill("Venue room or hall");
			await label.blur();
			await expect(scene.page.getByText("Not saved")).toBeVisible();
		},
	},
});

async function select(scene: Scene, fieldname: string): Promise<void> {
	await field(scene, fieldname).click();
	await expect(field(scene, fieldname)).toHaveAttribute("data-canvas-selected", /.*/);
	await expect(editor(scene)).toBeVisible();
}

/** What a site's owner would have done: one field added, one relabelled, one hidden. */
async function seedCustomizations(scene: Scene): Promise<void> {
	await clearCustomizations(scene);
	await post(scene, "Custom Field", {
		dt: CUSTOMIZE_TARGET,
		fieldname: "custom_venue_room",
		label: "Venue Room",
		fieldtype: "Data",
		insert_after: "location",
	});
	await post(scene, "Property Setter", setter("all_day", "label", "Data", "All-day event"));
	await post(scene, "Property Setter", setter("color", "hidden", "Check", "1"));
}

function setter(fieldname: string, property: string, propertyType: string, value: string) {
	return {
		doc_type: CUSTOMIZE_TARGET,
		doctype_or_field: "DocField",
		field_name: fieldname,
		property,
		property_type: propertyType,
		value,
	};
}

async function post(scene: Scene, doctype: string, doc: Record<string, unknown>): Promise<void> {
	const res = await scene.api.post(`/api/resource/${doctype}`, { data: { doctype, ...doc } });
	if (!res.ok()) throw new Error(`insert ${doctype}: ${await res.text()}`);
}

/** Removes what an earlier run left on the target, so the seed below starts from the app's own Event. */
async function clearCustomizations(scene: Scene): Promise<void> {
	for (const [kind, key] of [["Property Setter", "doc_type"], ["Custom Field", "dt"]]) {
		const res = await scene.api.get(`/api/resource/${kind}`, {
			params: { filters: JSON.stringify([[key, "=", CUSTOMIZE_TARGET]]), limit_page_length: 500 },
		});
		const { data } = (await res.json()) as { data: Array<{ name: string }> };
		for (const { name } of data)
			await scene.api.delete(`/api/resource/${kind}/${encodeURIComponent(name)}`, { failOnStatusCode: false });
	}
}
