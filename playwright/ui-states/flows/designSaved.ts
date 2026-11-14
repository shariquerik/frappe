import { expect } from "@playwright/test";
import { setup } from "xstate";
import { defineFlow } from "../flow";
import type { Hold, Scene } from "../scene";
import { customDoctype } from "../seed";

type Event =
	| { type: "LOADS" }
	| { type: "FAILS" }
	| { type: "RETRY" }
	| { type: "SERVER_UNREACHABLE" }
	| { type: "DOCTYPE_MISSING" }
	| { type: "APP_DOCTYPE_ASKED" }
	| { type: "LOADS_EMPTY" }
	| { type: "EDITS_LABEL" };

/**
 * A saved custom DocType opened at `/doctype/<name>?mode=design`. In the code this is
 * `DoctypeEditor.vue` (`state` stays null while `loadEditor` runs; a failed read becomes
 * `pageState` through `failedState`) and `editorSource.ts` (`loadEditor`, `holdsRoute`).
 */
const machine = setup({ types: { events: {} as Event } }).createMachine({
	id: "designSaved",
	initial: "loading",
	states: {
		loading: {
			meta: { description: "The page's DocType request has not come back: the shell with 'Loading UI Maintenance Request…' centred in an empty page and no editor header." },
			on: {
				LOADS: "loaded",
				FAILS: "failed",
				SERVER_UNREACHABLE: "offline",
				DOCTYPE_MISSING: "notFound",
				APP_DOCTYPE_ASKED: "noPermission",
				LOADS_EMPTY: "emptyDoctype",
			},
		},
		failed: {
			meta: { description: "The server answered the DocType request with an error: 'Something went wrong. This page could not load.' with a Try again button, and no editor." },
			on: { RETRY: "loaded" },
		},
		offline: {
			meta: { description: "The browser could not reach the server: 'No connection' with Try again, and no editor." },
		},
		notFound: {
			meta: { description: "The address names a DocType that does not exist: 'Not found. This page does not exist, or it was removed.' and a Go to home button." },
		},
		noPermission: {
			meta: { description: "Design mode was asked for a standard (app) DocType on a site without developer mode, which the server refuses with 403: 'No permission'." },
		},
		loaded: {
			meta: { description: "The editor on a saved custom DocType: name in the header, Save disabled, tabs Editor/Settings/Preview, sections with their fields on the canvas and 'Add a field' in the right panel." },
			on: { EDITS_LABEL: "dirty" },
		},
		emptyDoctype: {
			meta: { description: "The editor on a saved DocType with no fields: no sections on the canvas, only 'Add section' and 'Add tab', 'Every field is on this layout' under the off-layout tray, and 'Add a field' in the right panel." },
		},
		dirty: {
			meta: { description: "A section label was changed: the amber 'Not saved' badge beside the layout crumb, Save and Undo enabled, and the edited section selected with its settings in the right panel." },
		},
	},
});

const holds = new WeakMap<Scene, Hold>();
const LOAD = /get_doctype_editor/;
const NAME = "UI Maintenance Request";
const EMPTY = "UI Bare Request";

const open = (scene: Scene, name: string) => scene.goto(`/apps/desk/doctype/${encodeURIComponent(name)}?mode=design`);
const editor = (scene: Scene) => scene.page.locator("[data-doctype-editor]");

async function seedRequest(scene: Scene): Promise<void> {
	await scene.insert(
		"DocType",
		customDoctype(
			NAME,
			[
				{ fieldname: "request_section", fieldtype: "Section Break", label: "Request" },
				{ fieldname: "subject", fieldtype: "Data", label: "Subject", reqd: 1, in_list_view: 1 },
				{ fieldname: "priority", fieldtype: "Select", label: "Priority", options: "Low\nMedium\nHigh\nUrgent", default: "Medium", in_list_view: 1 },
				{ fieldname: "requested_on", fieldtype: "Date", label: "Requested on", default: "Today" },
				{ fieldname: "request_column", fieldtype: "Column Break" },
				{ fieldname: "requester", fieldtype: "Link", label: "Requester", options: "User", reqd: 1 },
				{ fieldname: "location", fieldtype: "Data", label: "Location" },
				{ fieldname: "is_urgent", fieldtype: "Check", label: "Needs same-day visit" },
				{ fieldname: "work_section", fieldtype: "Section Break", label: "Work" },
				{ fieldname: "description", fieldtype: "Text Editor", label: "What needs fixing" },
				{ fieldname: "estimate", fieldtype: "Currency", label: "Estimated cost" },
			],
			{ autoname: "hash", title_field: "subject" },
		),
	);
	scene.track("DocType", NAME);
}

async function seedBare(scene: Scene): Promise<void> {
	await scene.insert("DocType", customDoctype(EMPTY, [], { autoname: "hash" }));
	scene.track("DocType", EMPTY);
}

export const designSaved = defineFlow<Event>({
	id: "design-saved",
	title: "Design: saved custom DocType",
	source: "frontend/src/pages/doctypeEditor/DoctypeEditor.vue (load, pageState), editorSource.ts (loadEditor, holdsRoute), editorEntries.ts",
	machine,
	async enter(scene) {
		await scene.api.delete(`/api/resource/DocType/${encodeURIComponent(NAME)}`, { failOnStatusCode: false });
		await scene.api.delete(`/api/resource/DocType/${encodeURIComponent(EMPTY)}`, { failOnStatusCode: false });
		await seedRequest(scene);
		await seedBare(scene);
		const load = await scene.hold(LOAD);
		holds.set(scene, load);
		await open(scene, NAME);
		await expect(scene.page.getByText(`Loading ${NAME}…`)).toBeVisible();
	},
	events: {
		async LOADS(scene) {
			await holds.get(scene)?.release();
			await expect(editor(scene).getByRole("textbox", { name: "Section label" }).first()).toBeVisible();
		},
		async FAILS(scene) {
			await holds.get(scene)?.abort();
			await expect(scene.page.getByText("Something went wrong")).toBeVisible();
		},
		async RETRY(scene) {
			await holds.get(scene)?.release();
			await scene.page.getByRole("button", { name: "Try again" }).click();
			await expect(editor(scene).getByRole("textbox", { name: "Section label" }).first()).toBeVisible();
		},
		async SERVER_UNREACHABLE(scene) {
			await holds.get(scene)?.release();
			await scene.page.route(LOAD, (route) => route.abort("connectionfailed"));
			await open(scene, NAME);
			await expect(scene.page.getByText("No connection")).toBeVisible();
		},
		async DOCTYPE_MISSING(scene) {
			await holds.get(scene)?.release();
			await open(scene, "UI Fleet Audit Log");
			await expect(scene.page.getByText("This page does not exist, or it was removed.")).toBeVisible();
		},
		async APP_DOCTYPE_ASKED(scene) {
			await holds.get(scene)?.release();
			await open(scene, "ToDo");
			await expect(scene.page.getByText("You do not have permission to see this.")).toBeVisible();
		},
		async LOADS_EMPTY(scene) {
			await holds.get(scene)?.release();
			await open(scene, EMPTY);
			await expect(scene.page.getByRole("heading", { name: EMPTY, level: 1 })).toBeVisible();
			await expect(editor(scene)).toBeVisible();
		},
		async EDITS_LABEL(scene) {
			const label = editor(scene).getByRole("textbox", { name: "Section label" }).first();
			await label.fill("Request details");
			await label.press("Enter");
			await expect(scene.page.getByText("Not saved")).toBeVisible();
		},
	},
});
