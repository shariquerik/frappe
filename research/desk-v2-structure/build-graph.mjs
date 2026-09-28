#!/usr/bin/env node
// Builds the desk v2 import graph between folders and writes graph.json beside this file.
//
// Usage: node research/desk-v2-structure/build-graph.mjs [repo-root] [out-file]
// No dependencies beyond Node 18+. Reads the working tree, so check out the commit to measure.
//
// A node is a folder. Files that sit directly in frontend/src, ui/src or frappe/shell are
// each their own node, because those folders hold unrelated modules side by side.
// Tests, stories and type declaration files are left out of nodes and counts.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(here, "..", ".."));
const OUT = path.resolve(process.argv[3] || path.join(here, "graph.json"));

const JS_EXT = [".ts", ".vue", ".js", ".mjs"];
const FLAT_FOLDERS = ["frontend/src", "ui/src", "frappe/shell"];

main();

function main() {
	const uiExports = readUiExports();
	const jsFiles = collectJsFiles(uiExports);
	const pyFiles = collectPyFiles();

	const nodes = new Map();
	const edges = new Map();
	const fileEdges = [];

	for (const [file, info] of jsFiles) addFileToNode(nodes, file, info.lines);
	for (const [file, info] of pyFiles) addFileToNode(nodes, file, info.lines);

	for (const [file, info] of jsFiles) {
		const from = nodeOf(file);
		for (const imp of info.imports) {
			if (imp.external) {
				const ext = nodes.get(from).externals;
				ext[imp.external] = (ext[imp.external] || 0) + 1;
				continue;
			}
			if (!imp.target) continue;
			addEdge(edges, from, nodeOf(imp.target), imp.kind, imp.typeOnly, file, imp.target, imp.dynamic);
			if (imp.kind === "import") fileEdges.push([file, imp.target]);
		}
		for (const call of info.apiCalls) {
			const target = resolvePythonMethod(call);
			if (!target) continue;
			ensureServerNode(nodes, target);
			addEdge(edges, from, nodeOf(target), "api", false, file, target);
		}
	}

	for (const [file, info] of pyFiles) {
		const from = nodeOf(file);
		for (const target of info.imports) {
			ensureServerNode(nodes, target);
			addEdge(edges, from, nodeOf(target), "import", false, file, target);
			fileEdges.push([file, target]);
		}
	}

	for (const ref of pythonCallersOfShell()) {
		ensureServerNode(nodes, ref.from);
		addEdge(edges, nodeOf(ref.from), nodeOf(ref.to), ref.kind, false, ref.from, ref.to);
	}

	const edgeList = [...edges.values()].sort((a, b) => b.count - a.count);
	const importGraph = adjacency(edgeList.filter((e) => e.kind === "import" && e.from !== e.to));
	const folderSccs = stronglyConnected(importGraph).filter((c) => c.length > 1);
	const cycles = elementaryCycles(importGraph, 2000);
	const fileSccs = stronglyConnected(adjacency(fileEdges.map(([from, to]) => ({ from, to })))).filter(
		(c) => c.length > 1
	);

	const graph = {
		commit: git("rev-parse HEAD"),
		generatedBy: "research/desk-v2-structure/build-graph.mjs",
		rules: {
			node: "a folder; files directly in frontend/src, ui/src and frappe/shell are one node each",
			counted: "non-test .ts/.vue/.js/.mjs/.py files; tests/, stories/, *.test.*, *.spec.*, *.stories.*, *.d.ts left out",
			uiScope: "ui/src files reached from frontend/src or frontend/plugin through imports",
			edgeKinds: {
				import: "a static or dynamic import, or a Python import",
				virtual: "an import of a module the vite plugin generates",
				api: "a client string naming a whitelisted Python method",
				hook: "a frappe.shell path named in hooks.py",
			},
			count: "import statements (or method strings) from one folder into the other; typeOnly and dynamic count the `import type` and `import()` ones among them",
		},
		nodes: [...nodes.values()]
			.map((n) => ({ ...n, files: n.fileList.length }))
			.sort((a, b) => a.id.localeCompare(b.id)),
		edges: edgeList,
		folderCycles: folderSccs,
		elementaryCycles: cycles,
		fileCycles: fileSccs,
	};
	fs.writeFileSync(OUT, JSON.stringify(graph, null, "\t") + "\n");
	console.log(
		`${graph.nodes.length} nodes, ${edgeList.length} edges, ${folderSccs.length} folder cycles, ` +
			`${cycles.length} elementary cycles, ${fileSccs.length} file cycles -> ${path.relative(ROOT, OUT)}`
	);
}

// ---------- JS side ----------

function collectJsFiles(uiExports) {
	const files = new Map();
	const queue = [...walk("frontend/src"), ...walk("frontend/plugin")].filter(isCountedJs);
	while (queue.length) {
		const file = queue.pop();
		if (files.has(file)) continue;
		const text = read(file);
		const info = { lines: countLines(text), imports: parseJsImports(file, text, uiExports), apiCalls: [] };
		info.apiCalls = parseApiCalls(text);
		files.set(file, info);
		for (const imp of info.imports) {
			if (imp.target && !files.has(imp.target) && isCountedJs(imp.target)) queue.push(imp.target);
		}
		// An import of a test helper or a declaration file is not an edge.
		info.imports = info.imports.filter((imp) => !imp.target || isCountedJs(imp.target));
	}
	return files;
}

function parseJsImports(file, text, uiExports) {
	const code = stripComments(text);
	const found = [];
	const patterns = [
		/\b(import|export)\s+(type\s+)?[^'";]*?\bfrom\s*['"]([^'"\n]+)['"]/g,
		/\bimport\s*['"]([^'"\n]+)['"]/g,
		/\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
	];
	for (const [index, re] of patterns.entries()) {
		for (const m of code.matchAll(re)) {
			const spec = index === 0 ? m[3] : m[1];
			const typeOnly = index === 0 && Boolean(m[2]);
			const dynamic = index === 2;
			found.push({ spec, typeOnly, dynamic });
		}
	}
	return found.map(({ spec, typeOnly, dynamic }) => {
		const clean = spec.split("?")[0];
		if (clean.startsWith("virtual:frappe/")) {
			return { kind: "virtual", target: "frontend/plugin/contributions.js", typeOnly, dynamic };
		}
		const resolved = resolveJs(file, clean, uiExports);
		if (resolved) return { kind: "import", target: resolved, typeOnly, dynamic };
		const pkg = packageName(clean);
		return pkg ? { kind: "import", external: pkg, typeOnly, dynamic } : { kind: "import" };
	});
}

function resolveJs(fromFile, spec, uiExports) {
	let base = null;
	if (spec.startsWith(".")) base = path.join(path.dirname(fromFile), spec);
	else if (spec.startsWith("@/")) base = path.join("frontend/src", spec.slice(2));
	else if (spec === "@shell") base = "frontend/src/public.ts";
	else if (spec === "@framework/ui" || spec.startsWith("@framework/ui/")) {
		const sub = "." + spec.slice("@framework/ui".length);
		base = path.join("ui", uiExports[sub] || (sub === "." ? "src/index.ts" : path.join("src", sub.slice(2))));
	} else return null;
	return firstExisting([
		base,
		...JS_EXT.map((e) => base + e),
		...JS_EXT.map((e) => path.join(base, "index" + e)),
	]);
}

function readUiExports() {
	const pkg = JSON.parse(read("ui/package.json"));
	const map = {};
	for (const [key, value] of Object.entries(pkg.exports || {})) {
		if (key.includes("*")) continue;
		map[key] = (typeof value === "string" ? value : value.import).replace(/^\.\//, "");
	}
	return map;
}

function parseApiCalls(text) {
	const code = stripComments(text);
	const calls = [];
	for (const m of code.matchAll(/['"`](frappe(?:\.[a-z0-9_]+){2,})['"`]/g)) calls.push(m[1]);
	return calls;
}

// ---------- Python side ----------

function collectPyFiles() {
	const files = new Map();
	for (const file of walk("frappe/shell").filter(isCountedPy)) {
		const text = read(file);
		files.set(file, { lines: countLines(text), imports: parsePyImports(file, text) });
	}
	return files;
}

function parsePyImports(file, text) {
	const targets = [];
	const pkg = path.dirname(file);
	for (const m of text.matchAll(/^\s*from\s+(\.+)([\w.]*)\s+import\s+([\w, ()]+)/gm)) {
		const up = m[1].length - 1;
		const dir = path.join(pkg, ...Array(up).fill(".."));
		const mod = m[2] ? path.join(dir, ...m[2].split(".")) : dir;
		const target = m[2] ? pyFile(mod) : pyFile(path.join(mod, "__init__"));
		if (target && target !== file) targets.push(target);
	}
	for (const m of text.matchAll(/^\s*from\s+(frappe(?:\.\w+)+)\s+import\s+/gm)) {
		const target = pyFile(m[1].replace(/\./g, "/"));
		if (target) targets.push(target);
	}
	for (const m of text.matchAll(/^\s*import\s+(frappe(?:\.\w+)+)/gm)) {
		const target = pyFile(m[1].replace(/\./g, "/"));
		if (target) targets.push(target);
	}
	return targets;
}

function pyFile(modPath) {
	return firstExisting([modPath + ".py", path.join(modPath, "__init__.py")]);
}

function resolvePythonMethod(dotted) {
	const parts = dotted.split(".");
	for (let i = parts.length; i > 1; i--) {
		const target = pyFile(parts.slice(0, i).join("/"));
		if (target) return target;
	}
	return null;
}

// Python outside frappe/shell that names a frappe.shell module: imports and hooks.py strings.
function pythonCallersOfShell() {
	let out = "";
	try {
		out = execSync(`git grep -n -E "frappe\\.shell\\.[a-z_]+" -- "frappe/*.py" ":!frappe/shell/*"`, {
			cwd: ROOT,
			encoding: "utf8",
		});
	} catch {
		return [];
	}
	const refs = [];
	for (const line of out.split("\n").filter(Boolean)) {
		const [file] = line.split(":");
		if (!isCountedPy(file)) continue;
		for (const m of line.matchAll(/frappe\.shell\.([a-z_]+)/g)) {
			const to = pyFile(`frappe/shell/${m[1]}`);
			if (!to) continue;
			const kind = file === "frappe/hooks.py" ? "hook" : "import";
			refs.push({ from: file, to, kind });
		}
	}
	return refs;
}

// ---------- nodes and edges ----------

function nodeOf(file) {
	const dir = path.dirname(file);
	if (FLAT_FOLDERS.includes(dir)) return file;
	return dir;
}

function layerOf(id) {
	if (id.startsWith("ui/")) return "ui";
	if (id.startsWith("frontend/plugin")) return "build";
	if (id.startsWith("frontend/src/pages") || id.startsWith("frontend/src/recordPage")) return "page";
	if (id.startsWith("frontend/")) return "desk";
	if (id.startsWith("frappe/shell")) return "server";
	return "server-other";
}

function groupOf(id) {
	if (id.startsWith("frontend/src/pages/record") || id.startsWith("frontend/src/recordPage")) return "record page";
	if (id.startsWith("frontend/src/pages/list") || id.startsWith("frontend/src/list")) return "list page";
	if (id.startsWith("frontend/src/pages")) return "pages";
	const m = id.match(/^frontend\/src\/([^/.]+)/);
	if (m && fs.existsSync(path.join(ROOT, "frontend/src", m[1])) && !id.endsWith(".ts")) return m[1];
	if (id.startsWith("frontend/src/")) return "root modules";
	if (id.startsWith("frontend/plugin")) return "build plugin";
	if (id.startsWith("ui/src/components/")) return "ui components";
	if (id.startsWith("ui/")) return "ui " + (id.split("/")[2] || "root").replace(/\.ts$/, "");
	if (id.startsWith("frappe/shell")) return "python shell";
	return "python other";
}

function addFileToNode(nodes, file, lines) {
	const id = nodeOf(file);
	if (!nodes.has(id)) {
		nodes.set(id, { id, layer: layerOf(id), group: groupOf(id), lines: 0, fileList: [], externals: {} });
	}
	const node = nodes.get(id);
	if (node.fileList.some((f) => f.path === file)) return;
	node.fileList.push({ path: file, lines });
	node.lines += lines;
}

function ensureServerNode(nodes, file) {
	if (!fs.existsSync(path.join(ROOT, file))) return;
	addFileToNode(nodes, file, countLines(read(file)));
}

function addEdge(edges, from, to, kind, typeOnly, fromFile, toFile, dynamic = false) {
	if (from === to) return;
	const key = `${from}|${to}|${kind}`;
	if (!edges.has(key)) edges.set(key, { from, to, kind, count: 0, typeOnly: 0, dynamic: 0, pairs: [] });
	const edge = edges.get(key);
	edge.count += 1;
	if (typeOnly) edge.typeOnly += 1;
	if (dynamic) edge.dynamic += 1;
	if (!edge.pairs.some(([a, b]) => a === fromFile && b === toFile)) edge.pairs.push([fromFile, toFile]);
}

// ---------- graph algorithms ----------

function adjacency(edgeList) {
	const adj = new Map();
	for (const { from, to } of edgeList) {
		if (from === to) continue;
		if (!adj.has(from)) adj.set(from, new Set());
		if (!adj.has(to)) adj.set(to, new Set());
		adj.get(from).add(to);
	}
	return adj;
}

// Tarjan's algorithm.
function stronglyConnected(adj) {
	let index = 0;
	const stack = [];
	const meta = new Map();
	const out = [];
	const visit = (v) => {
		meta.set(v, { index, low: index, onStack: true });
		index += 1;
		stack.push(v);
		for (const w of adj.get(v) || []) {
			if (!meta.has(w)) {
				visit(w);
				meta.get(v).low = Math.min(meta.get(v).low, meta.get(w).low);
			} else if (meta.get(w).onStack) {
				meta.get(v).low = Math.min(meta.get(v).low, meta.get(w).index);
			}
		}
		if (meta.get(v).low === meta.get(v).index) {
			const comp = [];
			let w;
			do {
				w = stack.pop();
				meta.get(w).onStack = false;
				comp.push(w);
			} while (w !== v);
			out.push(comp.sort());
		}
	};
	for (const v of adj.keys()) if (!meta.has(v)) visit(v);
	return out;
}

// Every simple cycle, found by a depth-first search from each node in sorted order,
// visiting only nodes that sort after the start. Stops at `limit`.
function elementaryCycles(adj, limit) {
	const order = [...adj.keys()].sort();
	const rank = new Map(order.map((v, i) => [v, i]));
	const cycles = [];
	for (const start of order) {
		const pathStack = [start];
		const onPath = new Set([start]);
		const step = (v) => {
			for (const w of [...(adj.get(v) || [])].sort()) {
				if (cycles.length >= limit) return;
				if (w === start) cycles.push([...pathStack]);
				else if (rank.get(w) > rank.get(start) && !onPath.has(w)) {
					pathStack.push(w);
					onPath.add(w);
					step(w);
					onPath.delete(w);
					pathStack.pop();
				}
			}
		};
		step(start);
	}
	return cycles.sort((a, b) => a.length - b.length);
}

// ---------- files ----------

function walk(dir) {
	const abs = path.join(ROOT, dir);
	if (!fs.existsSync(abs)) return [];
	const out = [];
	for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (["node_modules", "tests", "stories", "__pycache__"].includes(entry.name)) continue;
			out.push(...walk(rel));
		} else out.push(rel);
	}
	return out;
}

function isCountedJs(file) {
	if (!JS_EXT.some((e) => file.endsWith(e)) || file.endsWith(".d.ts")) return false;
	return !/(^|\/)(tests|stories|node_modules)\//.test(file) && !/\.(test|spec|stories)\./.test(file);
}

function isCountedPy(file) {
	return file.endsWith(".py") && !/(^|\/)tests?\//.test(file) && !/(^|\/)test_[^/]*\.py$/.test(file);
}

function firstExisting(candidates) {
	for (const c of candidates) {
		const abs = path.join(ROOT, c);
		if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return path.normalize(c);
	}
	return null;
}

function packageName(spec) {
	if (/\s/.test(spec) || spec.startsWith("/")) return null;
	if (spec.startsWith("~icons/")) return "~icons";
	if (spec.startsWith("node:")) return spec;
	const parts = spec.split("/");
	return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function stripComments(text) {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function countLines(text) {
	if (!text) return 0;
	return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function read(file) {
	return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function git(cmd) {
	return execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8" }).trim();
}
