// The desk page the memory walk drives: in-app navigation, settling, heap reads and snapshots.

import { createWriteStream } from "node:fs";
import { once } from "node:events";

const QUIET_MS = 500;
const CAP_MS = 30000;
const ASSETS = "/assets/frappe/frontend/assets/";

// Minified shapes of two exports the walk calls: the API's `getDocumentFields` and the
// cache's `readCachedDocument`. Found by shape because a build renames them.
const EXPORT_SHAPES = {
	getDocumentFields:
		"async function ([\\w$]+)\\([\\w$]+,[\\w$]+,[\\w$]+,\\{signal:[\\w$]+\\}=\\{\\}\\)\\{let [\\w$]+=\\{fields:\\[\\.\\.\\.new Set\\(\\[\\.\\.\\.[\\w$]+,`name`,`modified`\\]",
	readCachedDocument:
		"function ([\\w$]+)\\(([\\w$]+),([\\w$]+)\\)\\{return [\\w$]+\\(\\),[\\w$]+\\.document\\(\\2,\\3\\)\\}",
};

export class MemoryPage {
	constructor(page, cdp) {
		this.page = page;
		this.cdp = cdp;
		this.inFlight = 0;
		this.lastRequestAt = 0;
		this.crashed = new Promise((_, reject) =>
			page.on("crash", () => reject(new Error("The page crashed")))
		);
		this.crashed.catch(() => {});
		this.trackRequests();
	}

	static async open(context) {
		await context.addInitScript(installQuietClock);
		const page = await context.newPage();
		const cdp = await context.newCDPSession(page);
		return new MemoryPage(page, cdp);
	}

	async goto(url) {
		await this.page.goto(url, { waitUntil: "load" });
		await this.settle();
	}

	/** Moves inside the app, so the cache survives; `ready` is a selector the page must show. */
	async navigate(path, ready) {
		await this.page.evaluate((to) => {
			const router =
				document.querySelector("#app").__vue_app__.config.globalProperties.$router;
			const base = router.options.history.base;
			return router.push(to.startsWith(base) ? to.slice(base.length) || "/" : to);
		}, path);
		// A locator, since the handle `waitForSelector` returns keeps its DOM tree alive.
		if (ready)
			await this.page.locator(ready).first().waitFor({ state: "attached", timeout: CAP_MS });
		await this.settle();
	}

	/** Selects the record tab named `label` unless it is selected, then waits for `ready`. */
	async showTab(tabs, label, ready) {
		const tab = this.page
			.locator(tabs)
			.filter({ hasText: new RegExp(`^${label}$`) })
			.first();
		if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
		await this.page.locator(ready).first().waitFor({ state: "attached", timeout: CAP_MS });
		await this.settle();
	}

	/** Waits until the list shows a row for each of `names`. */
	async waitForRows(selector, names) {
		await this.page.waitForFunction(
			({ selector, names }) => {
				const hrefs = [...document.querySelectorAll(selector)].map((row) =>
					decodeURIComponent(row.getAttribute("href"))
				);
				return names.every((name) => hrefs.some((href) => href.endsWith(`/${name}`)));
			},
			{ selector, names },
			{ timeout: CAP_MS, polling: 100 }
		);
		await this.settle();
	}

	async settle() {
		const started = Date.now();
		while (Date.now() - started < CAP_MS) {
			const domQuietMs = await this.page.evaluate(
				() => performance.now() - window.__quietAt
			);
			const networkQuiet = !this.inFlight && Date.now() - this.lastRequestAt >= QUIET_MS;
			if (networkQuiet && domQuietMs >= QUIET_MS) return;
			await this.page.waitForTimeout(100);
		}
		throw new Error(`Page did not settle in ${CAP_MS} ms at ${this.page.url()}`);
	}

	async usedHeap() {
		await this.cdp.send("HeapProfiler.collectGarbage");
		await this.cdp.send("HeapProfiler.collectGarbage");
		const { usedSize } = await this.cdp.send("Runtime.getHeapUsage");
		return usedSize;
	}

	async writeSnapshot(path) {
		const file = createWriteStream(path);
		const write = ({ chunk }) => file.write(chunk);
		this.cdp.on("HeapProfiler.addHeapSnapshotChunk", write);
		const taking = this.cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
		await Promise.race([taking, this.crashed]);
		this.cdp.off("HeapProfiler.addHeapSnapshotChunk", write);
		file.end();
		await once(file, "finish");
	}

	/** Puts the named app exports on `window.__exports`, from the chunks the page loaded. */
	async findExports() {
		await this.page.evaluate(findExportsInPage, { shapes: EXPORT_SHAPES, assets: ASSETS });
	}

	readCached(doctype, names) {
		return this.page.evaluate(
			({ doctype, names }) =>
				names.map((name) => {
					const entry = window.__exports.readCachedDocument(doctype, name);
					return entry ? (entry.complete ? "complete" : "partial") : "none";
				}),
			{ doctype, names }
		);
	}

	readFields(doctype, names, field) {
		return this.page.evaluate(
			async ({ doctype, names, field }) => {
				for (const name of names)
					await window.__exports.getDocumentFields(doctype, name, [field]);
			},
			{ doctype, names, field }
		);
	}

	trackRequests() {
		const counted = (request) => !request.url().includes("/socket.io/");
		const finish = (request) => {
			if (!counted(request)) return;
			this.inFlight -= 1;
			this.lastRequestAt = Date.now();
		};
		this.page.on("request", (request) => {
			if (counted(request)) this.inFlight += 1;
		});
		this.page.on("requestfinished", finish);
		this.page.on("requestfailed", finish);
	}
}

// Runs in the page before any app code; serialized, so it may not close over anything.
function installQuietClock() {
	performance.setResourceTimingBufferSize(100000);
	window.__quietAt = 0;
	const observer = new MutationObserver(() => (window.__quietAt = performance.now()));
	observer.observe(document, { childList: true, subtree: true, characterData: true });
}

async function findExportsInPage({ shapes, assets }) {
	const urls = new Set(
		performance
			.getEntriesByType("resource")
			.map((entry) => entry.name)
			.filter((url) => url.includes(assets) && url.endsWith(".js"))
	);
	window.__exports = {};
	for (const url of urls) {
		const text = await (await fetch(url)).text();
		for (const [name, shape] of Object.entries(shapes)) {
			const local = text.match(new RegExp(shape))?.[1];
			if (!local) continue;
			const exported = text.match(/export\{([^}]*)\}/)[1].split(",");
			const pair = exported
				.map((part) => part.split(" as "))
				.find(([from]) => from === local);
			window.__exports[name] = (await import(url))[pair[1] ?? pair[0]];
		}
	}
	const missing = Object.keys(shapes).filter((name) => !window.__exports[name]);
	if (missing.length) throw new Error(`No loaded chunk exports ${missing.join(", ")}`);
}
