import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";

type Event = { type: "NAME_TAKEN" } | { type: "CONTINUES" } | { type: "MODULES_FAIL" };

/**
 * A new DocType, from `/doctype/new` to the editor on a DocType that is not saved yet. In the code
 * this is `newDoctypeFlow.ts` (the dialog opens over the DocType list), `NewDoctypeDialog.vue` (the
 * name check runs on Continue, `taken` beside `checking`) and `editorSource.ts` (`pending`).
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "designNew",
	initial: "asking",
	states: {
		asking: {
			meta: { description: "The New DocType dialog over the DocType list: name, module, kind and naming rule, Continue disabled until name and module are given." },
			on: { CONTINUES: "draft", NAME_TAKEN: "nameTaken", MODULES_FAIL: "modulesFailed" },
		},
		modulesFailed: {
			meta: { description: "The Module list request failed: an error toast over the dialog and a Module dropdown with no options, so Continue stays disabled." },
		},
		nameTaken: {
			meta: { description: "Continue found a DocType with that name: the name field shows 'A DocType named … exists already' and the dialog stays open." },
		},
		draft: {
			meta: { description: "The editor on a DocType nobody has saved: empty canvas, the DocType's name in the header, Save enabled, nothing on the site yet." },
		},
	},
});

const holds = new WeakMap<Scene, Hold>();

const dialog = (scene: Scene) => scene.page.locator("[data-new-doctype]");

export const designNew = defineFlow<Event>({
	id: "design-new",
	title: "Design: new DocType",
	source: "frontend/src/pages/doctypeEditor/newDoctypeFlow.ts, NewDoctypeDialog.vue, editorSource.ts",
	machine,
	async enter(scene) {
		const modules = await scene.hold(/Module(%20| )Def/);
		await modules.release();
		holds.set(scene, modules);
		await scene.goto("/apps/desk/doctype/new");
		await expect(dialog(scene)).toBeVisible();
		await expect(dialog(scene).getByLabel("Name")).toBeFocused();
	},
	events: {
		async MODULES_FAIL(scene) {
			await holds.get(scene)?.abort();
			await scene.goto("/apps/desk/doctype/new");
			await expect(dialog(scene)).toBeVisible();
			await expect(scene.page.getByRole("region", { name: /Notifications/ }).getByRole("listitem")).toBeVisible();
		},
		async NAME_TAKEN(scene) {
			await fill(scene, "ToDo");
			await dialog(scene).getByRole("button", { name: "Continue" }).click();
			await expect(scene.page.getByText("A DocType named ToDo exists already")).toBeVisible();
		},
		async CONTINUES(scene) {
			await fill(scene, "Delivery Route");
			await dialog(scene).getByRole("button", { name: "Continue" }).click();
			await expect(scene.page.getByRole("heading", { name: "Delivery Route", level: 1 })).toBeVisible();
		},
	},
});

async function fill(scene: Scene, name: string): Promise<void> {
	await dialog(scene).getByLabel("Name").fill(name);
	await dialog(scene).getByRole("combobox", { name: "Module" }).click();
	await scene.page.getByRole("option", { name: "Custom" }).first().click();
	await expect(dialog(scene).getByRole("button", { name: "Continue" })).toBeEnabled();
}
