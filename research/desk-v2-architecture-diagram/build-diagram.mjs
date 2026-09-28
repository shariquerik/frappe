#!/usr/bin/env node
// PROTOTYPE (frappe/frappe#43434): throwaway. Builds diagram.html from the code.
//
// Usage: node research/desk-v2-architecture-diagram/build-diagram.mjs [--no-graph] [--out <folder>]
//
// 1. Runs ../desk-v2-structure/build-graph.mjs to write graph.json beside this file.
// 2. Places every file in a layer from layers.json and checks every import against it.
// 3. Reads the concept tables and the five flows from frontend/ARCHITECTURE.md.
// 4. Writes diagram.html: one file, no dependencies, opens from disk.
//
// Exits 1 when an import breaks layers.json and is not in its knownBreaks, or when a file
// matches no layer. That is the shape of the CI check; the diagram shows the same result.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..");
// --out writes graph.json and diagram.html elsewhere, so the /desk-architecture route
// does not change the working tree on each request.
const outArg = process.argv.indexOf("--out");
const OUT_DIR = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : here;
const GRAPH = path.join(OUT_DIR, "graph.json");
const OUT = path.join(OUT_DIR, "diagram.html");
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!process.argv.includes("--no-graph")) {
	execFileSync("node", [path.join(here, "..", "desk-v2-structure", "build-graph.mjs"), ROOT, GRAPH], {
		stdio: "inherit",
	});
}

const graph = JSON.parse(fs.readFileSync(GRAPH, "utf8"));
const layerFile = JSON.parse(fs.readFileSync(path.join(here, "layers.json"), "utf8"));
const arch = fs.readFileSync(path.join(ROOT, layerFile.architecture), "utf8");

const layers = layerFile.layers;
const layerById = new Map(layers.map((l) => [l.id, l]));

const unplaced = [];
const boxes = buildBoxes();
const edges = buildEdges();
const knownBreaks = matchKnownBreaks();
const data = {
	// The last commit that changed the code, so the prototype's own commits do not show.
	commit: git("log -1 --format=%h -- frontend ui frappe"),
	branch: "desk-v2",
	builtAt: new Date().toISOString().slice(0, 16).replace("T", " "),
	architecture: layerFile.architecture,
	layers: layers.map((l) => ({ ...l, concepts: conceptsOf(l) })),
	boxes,
	edges,
	knownBreaks,
	loops: graph.folderCycles,
	flows: readFlows(),
	extensions: extensionPoints(),
	unplaced,
};

fs.writeFileSync(OUT, fs.readFileSync(path.join(here, "diagram.template.html"), "utf8").replace("/*DATA*/null", JSON.stringify(data)));
report();

// A box is the part of one graph folder that falls in one layer. Most folders sit in one
// layer; `frappe` splits because bundler.py belongs to the build.
function buildBoxes() {
	const out = new Map();
	for (const node of graph.nodes) {
		for (const file of node.fileList) {
			const layer = layerOf(file.path);
			if (!layer) {
				unplaced.push(file.path);
				continue;
			}
			const id = `${node.id}@${layer}`;
			if (!out.has(id)) {
				out.set(id, { id, folder: node.id, layer, files: [], lines: 0, externals: node.externals });
			}
			const box = out.get(id);
			box.files.push(file);
			box.lines += file.lines;
		}
	}
	return [...out.values()];
}

function buildEdges() {
	const out = new Map();
	for (const edge of graph.edges) {
		for (const [from, to] of edge.pairs) {
			const fromBox = boxOf(edge.from, from);
			const toBox = boxOf(edge.to, to);
			if (!fromBox || !toBox) continue;
			const id = `${fromBox.id}>${toBox.id}>${edge.kind}`;
			if (!out.has(id)) {
				out.set(id, {
					id,
					from: fromBox.id,
					to: toBox.id,
					kind: edge.kind,
					status: statusOf(edge.kind, fromBox.layer, toBox.layer),
					pairs: [],
				});
			}
			out.get(id).pairs.push({ from, to, line: edge.kind === "import" ? importLine(from, to) : null });
		}
	}
	for (const e of out.values()) e.count = e.pairs.length;
	return [...out.values()];
}

function statusOf(kind, from, to) {
	if (layerFile.notUse[kind]) return "callback";
	if (from === to) return "inside";
	return layerById.get(from).mayUse.includes(to) ? "allowed" : "break";
}

// Marks each breaking file pair as known (listed with its ticket) or new.
function matchKnownBreaks() {
	const seen = new Set();
	for (const edge of edges) {
		if (edge.status !== "break") continue;
		for (const pair of edge.pairs) {
			const i = layerFile.knownBreaks.findIndex((k) => pair.from.startsWith(k.from) && pair.to.startsWith(k.to));
			pair.known = i >= 0 ? i : null;
			if (i >= 0) seen.add(i);
		}
		edge.status = edge.pairs.every((p) => p.known !== null) ? "known" : "break";
	}
	return layerFile.knownBreaks.map((k, i) => ({ ...k, stillThere: seen.has(i) }));
}

function layerOf(file) {
	let best = null;
	for (const layer of layers) {
		for (const p of layer.paths) {
			if ((file === p || file.startsWith(p)) && (!best || p.length > best.length)) best = { id: layer.id, length: p.length };
		}
	}
	return best?.id;
}

function boxOf(folder, file) {
	const layer = layerOf(file);
	return layer && boxes.find((b) => b.id === `${folder}@${layer}`);
}

// The line of `from` that imports `to`, found by the target's file name. Good enough to link.
function importLine(from, to) {
	const base = path.basename(to).replace(/\.(ts|vue|js|mjs|py)$/, "");
	const name = base === "index" || base === "__init__" ? path.basename(path.dirname(to)) : base;
	const lines = read(from).split("\n");
	const i = lines.findIndex((l) => /\bimport\b|\bfrom\b/.test(l) && l.includes(name));
	return i >= 0 ? i + 1 : null;
}

function conceptsOf(layer) {
	if (!layer.section) return [];
	const heading = arch.split("\n").findIndex((l) => l.startsWith("### ") && slug(l.slice(4)) === layer.section);
	if (heading < 0) return [];
	const rows = [];
	let inTable = !layer.table;
	for (const line of arch.split("\n").slice(heading + 1)) {
		if (line.startsWith("### ") || line.startsWith("## ")) break;
		if (layer.table && line.startsWith("**")) inTable = line === layer.table;
		if (!inTable) continue;
		const cells = tableCells(line);
		if (cells && cells.length === 2 && cells[0] !== "Concept" && !/^-+$/.test(cells[0])) rows.push({ name: cells[0], what: cells[1] });
	}
	return rows;
}

function readFlows() {
	const lines = arch.split("\n");
	const start = lines.findIndex((l) => l === "## The five flows");
	const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
	const flows = [];
	for (const line of lines.slice(start, end)) {
		if (line.startsWith("### ")) flows.push({ title: line.slice(4), steps: [], budget: "" });
		const flow = flows.at(-1);
		if (!flow) continue;
		const cells = tableCells(line);
		if (cells && cells.length === 5 && /^\d+[a-z]?$/.test(cells[0])) {
			const [n, step, layer, check, cache] = cells;
			flow.steps.push({ n, step, layers: layer.match(/\d|main\.ts|index\.html/g) || [], layerText: layer, check, cache });
		}
		if (line.startsWith("**Budget:**")) flow.budgetOpen = true;
		if (!line.trim()) flow.budgetOpen = false;
		if (flow.budgetOpen) flow.budget = (flow.budget + " " + line.replace("**Budget:**", "")).trim();
	}
	return flows;
}

function tableCells(line) {
	if (!line.startsWith("|")) return null;
	return line.split("|").slice(1, -1).map((c) => c.trim());
}

function slug(text) {
	return text.toLowerCase().replace(/[`]/g, "").replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-");
}

function report() {
	const breaks = edges.filter((e) => e.status === "break" || e.status === "known");
	const newPairs = breaks.flatMap((e) => e.pairs.filter((p) => p.known === null));
	const gone = knownBreaks.filter((k) => !k.stillThere);
	console.log(`${boxes.length} boxes, ${edges.length} edges, ${breaks.length} breaking edges -> ${path.relative(ROOT, OUT)}`);
	for (const p of newPairs) console.log(`NEW BREAK  ${p.from}${p.line ? ":" + p.line : ""} -> ${p.to}`);
	for (const k of gone) console.log(`FIXED      ${k.from} -> ${k.to}: remove it from knownBreaks`);
	for (const f of unplaced) console.log(`NO LAYER   ${f}`);
	if (newPairs.length || unplaced.length) process.exitCode = 1;
}

function read(file) {
	return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function git(args) {
	return execFileSync("git", args.split(" "), { cwd: ROOT, encoding: "utf8" }).trim();
}

// Hand-kept for the prototype: the code has no single list of the ways to change the desk.
// Taken from the concept tables in ARCHITECTURE.md and the structure research
// (research/desk-v2-structure.md, section 5). `pair` names another row that does the same job.
function extensionPoints() {
	return [
	{ name: "record.js file script", tier: "app", layer: "9", how: "A file in the app's frontend folder, found by the build", changes: "Handlers on a doctype's record page", pair: "Stored script" },
	{ name: "Stored script", tier: "site", layer: "9", how: "A Client Script row with view = Record", changes: "Handlers on a doctype's record page", pair: "record.js file script" },
	{ name: "list.js list file", tier: "app", layer: "9", how: "A file in the app's frontend folder", changes: "A doctype's list, such as extra columns" },
	{ name: "item.js item file", tier: "app", layer: "9", how: "A file in the app's frontend folder", changes: "How one kind of navigation item draws", pair: "navigation_item_resolvers hook", pairNote: "Winner rule differs today: first app wins the renderer, last app wins the visibility hook" },
	{ name: "App page", tier: "app", layer: "8", how: "A page file the build registers", changes: "Adds a page under the app's prefix" },
	{ name: "Replacement page (pages.json)", tier: "app", layer: "8", how: "pages.json beside a doctype", changes: "Replaces the standard list or record page for a doctype" },
	{ name: "@shell import alias", tier: "app", layer: "build", how: "Vite alias", changes: "Desk names an app file may import", pair: "import_map hook", pairNote: "Two import lists; the target has one" },
	{ name: "import_map hook", tier: "app", layer: "build", how: "hooks.py", changes: "Names a stored script may import", pair: "@shell import alias", pairNote: "Two import lists; the target has one" },
	{ name: "desk.package.json", tier: "app", layer: "build", how: "A file in the app", changes: "The app's frontend packages" },
	{ name: "Tailwind preset", tier: "app", layer: "build", how: "A preset file in the app", changes: "The app's theme" },
	{ name: "app_prefix hook", tier: "app", layer: "2", how: "hooks.py", changes: "The address prefix the app claims" },
	{ name: "app_modular hook", tier: "app", layer: "2", how: "hooks.py", changes: "Whether record addresses include the module" },
	{ name: "app_permission hook", tier: "app", layer: "2", how: "hooks.py", changes: "Who may enter the app's prefix" },
	{ name: "app_boot hook", tier: "app", layer: "2", how: "hooks.py", changes: "Extra keys in the boot payload" },
	{ name: "add_to_apps_screen hook", tier: "app", layer: "2", how: "hooks.py", changes: "The app's tile on /apps" },
	{ name: "navigation_item_resolvers hook", tier: "app", layer: "2", how: "hooks.py", changes: "Who can see the app's own item type", pair: "item.js item file" },
	{ name: "Cross-app rail rows (app:key)", tier: "app", layer: "2", how: "Navigation rows shipped by another app", changes: "Adds rows to another app's rail" },
	{ name: "Base rail and sidebars", tier: "app", layer: "1", how: "Rail and Sidebar records shipped with the app", changes: "The app's navigation" },
	{ name: "Site rail and sidebar copy", tier: "site", layer: "1", how: "Rail and Sidebar site layer, or the customize dialog", changes: "Navigation for every user on the site" },
	{ name: "Form Layout", tier: "site", layer: "1", how: "A Form Layout row", changes: "Details, Side Panel or Quick Entry layout", pair: "Stored script", pairNote: "A field can be hidden three ways: the layout, a script, or the DocType" },
	{ name: "Doctype View (site)", tier: "site", layer: "1", how: "The list's column and sort panels, saved for the site", changes: "Default columns, sort and quick filters" },
	{ name: "DocType and Customize Form", tier: "site", layer: "1", how: "DocType or Property Setter rows", changes: "Fields, labels, hidden, read-only" },
	{ name: "Doctype View (user)", tier: "user", layer: "1", how: "The list's column and sort panels", changes: "The user's own columns, sort and quick filters" },
	{ name: "Arrangement (user)", tier: "user", layer: "2", how: "The customize sidebar dialog", changes: "The user's order of rail and sidebar items" },
	{ name: "Per-user rail and sidebar", tier: "user", layer: "1", how: "Rail and Sidebar user layer", changes: "Rows the user hides or adds" },
];
}
