// PROTOTYPE: writes index.html, the four scripts side by side, from scripts/ and .out/results.json.
import { readFileSync, writeFileSync } from "node:fs";

const { same, sizes } = JSON.parse(readFileSync(".out/results.json", "utf8"));

const COLUMNS = [
	{
		file: "1-h.js",
		title: "1. h(), as today",
		notes: [
			"Runs today. Nothing new to ship, compile or cache.",
			"Every element is a call. Nesting is shown by brackets, not by tags.",
			"Two-way binding is written out: modelValue plus onUpdate:modelValue.",
		],
	},
	{
		file: "2-jsx.jsx",
		title: "2. JSX, automatic runtime",
		notes: [
			"A stored script needs a compile step: sucrase in the browser, 48.5 kB, or esbuild on the server at save.",
			"No v-model, v-if or v-for. Plain props and JavaScript, as in column 1.",
			"A lone {x && <b/>} child renders the text \"false\". Use x ? <b/> : null.",
			"The Code field marks JSX as a syntax error today.",
		],
	},
	{
		file: "3-htm.js",
		title: "3. htm tagged templates",
		notes: [
			"No compile step. 0.65 kB, added once to the import map.",
			"A component is written <${Badge}>, a value is written ${x}.",
			"No v-model, v-if or v-for. Plain props, as in column 1.",
			"The markup is a string to the editor: no highlighting, no lint, no error at save for a bad tag.",
		],
	},
	{
		file: "4-template.js",
		title: "4. Vue template string",
		notes: [
			"v-model, v-if, v-for and @click work as in a .vue file.",
			"Needs the full Vue build, 21.3 kB on every load, and unsafe-eval under a CSP.",
			"Each component must be listed in components, and each value returned from setup.",
			"The markup is a string to the editor: no highlighting, no lint, no error at save.",
		],
	},
];

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const columns = COLUMNS.map(({ file, title, notes }) => {
	const size = sizes.find((s) => s.file === file);
	return `<section>
	<h2>${escape(title)}</h2>
	<p class="size">${size.lines} lines, ${size.characters} characters without spaces</p>
	<ul>${notes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul>
	<pre><code class="language-javascript">${escape(readFileSync(`scripts/${file}`, "utf8"))}</code></pre>
</section>`;
}).join("\n");

writeFileSync(
	"index.html",
	`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>PROTOTYPE: one script, four syntaxes</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
	body { font: 14px system-ui, sans-serif; margin: 16px; color: #222; }
	.banner { background: #fff4d6; padding: 8px 12px; border-radius: 6px; }
	main { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
	section { border: 1px solid #ddd; border-radius: 6px; padding: 8px; min-width: 0; }
	h2 { font-size: 15px; margin: 4px 0; }
	.size { color: #666; margin: 0 0 4px; }
	ul { padding-left: 18px; margin: 4px 0 8px; min-height: 9em; }
	pre { font-size: 11.5px; overflow-x: auto; margin: 0; tab-size: 2; }
</style>
</head>
<body>
<p class="banner"><b>PROTOTYPE, throwaway.</b> One Record-page script for a Sales Order, written four ways:
a panel section with a status Badge, the item rows, one "late" line, and a button that opens a note dialog.
${same ? "The check rendered all four for three orders and clicked through the dialog: same HTML, same behaviour." : "The check found a difference. Run node check.mjs."}
Rank them by how they read and how you would write them. The costs are in the research tickets.</p>
<main>
${columns}
</main>
<script>hljs.highlightAll()</script>
</body>
</html>
`,
);
console.log(`Wrote ${new URL("index.html", import.meta.url).pathname}`);
