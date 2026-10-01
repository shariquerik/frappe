// PROTOTYPE check: do the four scripts draw the same thing and behave the same way?
// Bundles each script (JSX through esbuild's automatic runtime), renders the panel
// section for three orders, then clicks through the note dialog in happy-dom.
import { build } from "esbuild";
import { Window } from "happy-dom";
import { readFileSync, writeFileSync } from "node:fs";

const window = new Window();
for (const name of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "Event"])
	globalThis[name] = name === "window" ? window : window[name];
const { createApp, createSSRApp, h, nextTick } = await import("vue");
const { renderToString } = await import("vue/server-renderer");

const SCRIPTS = ["1-h.js", "2-jsx.jsx", "3-htm.js", "4-template.js"];

const ORDERS = {
	late: order("To Deliver", "2020-01-31", [["Chair", 4, 1200], ["Desk", 1, 9500]]),
	done: order("Completed", "2020-01-31", [["Lamp", 2, 800]]),
	empty: order("To Deliver", "2099-12-31", []),
};

function order(status, delivery_date, items) {
	return {
		status,
		delivery_date,
		items: items.map(([item_name, qty, rate], i) => ({ name: `row-${i}`, item_name, qty, rate })),
	};
}

function stubPage(doc, opened) {
	const added = [];
	return {
		doc,
		docname: "SO-0001",
		added,
		panelSections: { add: (item, where) => added.push({ item, where }) },
		dialog: { open: async (component, props, options) => (opened.push({ component, options }), null) },
		call: async () => {},
	};
}

// Comments differ by syntax (`<!---->`, `<!--v-if-->`, `<!--[-->`) and draw nothing. So does
// whitespace next to a tag: the template keeps a leading space in the "Late" line.
const visible = (html) =>
	html.replace(/<!--.*?-->/g, "").replace(/>\s+/g, ">").replace(/\s+</g, "<").replace(/\s+/g, " ").trim();

const results = [];
for (const file of SCRIPTS) {
	const outfile = `.out/${file.replace(/\.jsx?$/, ".mjs")}`;
	await build({
		entryPoints: [`scripts/${file}`],
		outfile,
		bundle: true,
		format: "esm",
		platform: "node",
		external: ["vue", "htm"],
		alias: { "frappe-ui": "./stubs.js" },
		jsx: "automatic",
		jsxImportSource: "vue",
		logLevel: "silent",
	});
	const script = (await import(`./${outfile}`)).default;

	const opened = [];
	const page = stubPage(ORDERS.late, opened);
	script.onRefresh(page);
	const [{ item, where }] = page.added;

	const html = {};
	for (const [key, doc] of Object.entries(ORDERS))
		html[key] = visible(await renderToString(createSSRApp({ render: () => h(item.component, { page: { ...page, doc } }) })));

	results.push({ file, item: { ...item, component: undefined }, where, html, behaviour: await clickThrough(item.component, page, opened) });
}

// Mounts the section, clicks "Add note", then types into the dialog and saves.
async function clickThrough(OrderSummary, page, opened) {
	const steps = [];
	const root = document.createElement("div");
	createApp({ render: () => h(OrderSummary, { page }) }).mount(root);
	[...root.querySelectorAll("button")].find((b) => b.textContent === "Add note").click();
	await nextTick();
	steps.push(`Add note opens ${opened.length} dialog titled "${opened[0]?.options?.title}"`);

	let closedWith;
	const dialog = document.createElement("div");
	createApp({ render: () => h(opened[0].component, { close: (value) => (closedWith = value) }) }).mount(dialog);
	const save = dialog.querySelector("button");
	steps.push(`Save is disabled while empty: ${save.disabled}`);
	const box = dialog.querySelector("textarea");
	box.value = "Wants delivery on Monday";
	box.dispatchEvent(new Event("input"));
	await nextTick();
	steps.push(`Save is enabled after typing: ${!save.disabled}`);
	save.click();
	steps.push(`close() receives: ${JSON.stringify(closedWith)}`);
	return steps;
}

const [base, ...rest] = results;
let same = true;
for (const result of rest) {
	for (const key of Object.keys(ORDERS)) {
		if (result.html[key] === base.html[key]) continue;
		same = false;
		console.log(`DIFFERS ${result.file} on the "${key}" order:\n  ${base.file}: ${base.html[key]}\n  ${result.file}: ${result.html[key]}`);
	}
	if (JSON.stringify(result.behaviour) !== JSON.stringify(base.behaviour)) {
		same = false;
		console.log(`BEHAVES DIFFERENTLY ${result.file}:`, result.behaviour);
	}
}

console.log(`\nThe "late" order, as ${base.file} draws it:\n  ${base.html.late}\n`);
console.log(base.behaviour.map((step) => `  ${step}`).join("\n"));
console.log(same ? "\nAll four draw the same HTML for all three orders and behave the same.\n" : "\nNOT the same; see above.\n");

const sizes = SCRIPTS.map((file) => {
	const text = readFileSync(`scripts/${file}`, "utf8").replace(/^\/\/.*\n/gm, "");
	return { file, lines: text.split("\n").filter((l) => l.trim()).length, characters: text.replace(/\s/g, "").length };
});
console.table(sizes);
writeFileSync(".out/results.json", JSON.stringify({ same, results, sizes }, null, "\t"));
process.exit(same ? 0 : 1);
