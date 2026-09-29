// Breaks the record page's JS down by chunk and by source, from the build `yarn test:page-js` measures.
// Run from frontend/, as CI runs the check: node ../research/desk-v2-record-speed-breakdown/measure-record-js.mjs [out.json]
// Needs frontend/manifest.json and frontend/node_modules, the same as `yarn test:page-js`.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const REPO = resolve(import.meta.dirname, "../..");
const FRONTEND = join(REPO, "frontend");
const require = createRequire(join(FRONTEND, "package.json"));
const { decode } = require("@jridgewell/sourcemap-codec");
const { PAGE_CHUNKS, pageJsKb } = await import(join(FRONTEND, "check-page-js.mjs"));

const outDir = mkdtempSync(join(tmpdir(), "desk-record-js-"));
try {
	const { build } = await import(require.resolve("vite"));
	// The same call as check-page-js.mjs; vite.config.js already turns source maps on.
	await build({
		root: FRONTEND,
		logLevel: "error",
		build: { outDir, emptyOutDir: true, manifest: true },
	});
	const manifest = JSON.parse(readFileSync(join(outDir, ".vite/manifest.json"), "utf8"));
	const read = (file) => readFileSync(join(outDir, file));
	const report = {
		pageJsKb: pageJsKb(manifest, read),
		pages: Object.fromEntries(
			Object.keys(PAGE_CHUNKS).map((page) => [page, [...pageFiles(manifest, page)]])
		),
		chunks: {},
		dynamicFromRecord: dynamicImports(manifest, pageFiles(manifest, "record")),
		manifest,
	};
	for (const file of new Set(Object.values(report.pages).flat()))
		report.chunks[file] = chunkReport(file, read(file));
	for (const file of report.dynamicFromRecord)
		report.chunks[file] ??= chunkReport(file, read(file));
	writeFileSync(process.argv[2] ?? "record-js.json", JSON.stringify(report, null, 1));
	console.log(report.pageJsKb);
} finally {
	rmSync(outDir, { recursive: true });
}

function pageFiles(manifest, page) {
	return new Set([
		...closure(manifest, "index.html"),
		...closure(manifest, PAGE_CHUNKS[page]),
	]);
}

function closure(manifest, key, files = new Set()) {
	const chunk = manifest[key];
	if (files.has(chunk.file)) return files;
	files.add(chunk.file);
	for (const imported of chunk.imports ?? []) closure(manifest, imported, files);
	return files;
}

// Chunks the record page's files import only on demand; not counted by the check.
function dynamicImports(manifest, loaded) {
	const byFile = Object.fromEntries(Object.values(manifest).map((c) => [c.file, c]));
	const found = new Set();
	for (const file of loaded)
		for (const key of byFile[file].dynamicImports ?? [])
			for (const f of closure(manifest, key)) if (!loaded.has(f)) found.add(f);
	return [...found];
}

function chunkReport(file, code) {
	const gzip = gzipSync(code).length;
	const raw = code.length;
	const sources = sourceBytes(file, code.toString("utf8"));
	return {
		raw,
		gzip,
		sources: Object.fromEntries(
			Object.entries(sources)
				.sort((a, b) => b[1] - a[1])
				.map(([source, bytes]) => [source, { raw: bytes, gzipShare: (gzip * bytes) / raw }])
		),
	};
}

// Bytes of generated code each source maps to; a segment runs to the next one on its line.
function sourceBytes(file, code) {
	const bytes = {};
	const add = (source, n) => (bytes[source] = (bytes[source] ?? 0) + n);
	let map;
	try {
		map = JSON.parse(readFileSync(join(outDir, file + ".map"), "utf8"));
	} catch {
		add("(no source map)", Buffer.byteLength(code));
		return bytes;
	}
	const base = dirname(join(outDir, file + ".map"));
	const names = map.sources.map((s) => relative(REPO, resolve(base, map.sourceRoot ?? "", s)));
	const lines = code.split("\n");
	decode(map.mappings).forEach((segments, i) => {
		const line = lines[i] ?? "";
		let covered = 0;
		segments.forEach((seg, j) => {
			const end = j + 1 < segments.length ? segments[j + 1][0] : line.length;
			const n = Buffer.byteLength(line.slice(seg[0], end));
			covered += n;
			add(seg.length > 1 ? names[seg[1]] : "(unmapped)", n);
		});
		add("(unmapped)", Buffer.byteLength(line) - covered + 1);
	});
	return bytes;
}
