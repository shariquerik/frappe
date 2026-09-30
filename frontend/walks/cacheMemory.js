// Cache memory walk: fills each desk v2 cache store to its limit and reads the JS heap after
// each step. How to run it and what it found: see CACHE_MEMORY.md.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, request as requestApi } from "playwright";
import { splitStores } from "./cacheStores.js";
import { MemoryPage } from "./memoryPage.js";
import { MARKERS } from "./paintCounters.js";
import { BASE_URL, deskBoot, listPathOf, logIn } from "./setup.js";

const RUNS = Number(process.env.RUNS || 1);
const CASE = process.env.CASE;
const SHOW_FEED = process.env.FEED !== "0";
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || "/tmp/cache-memory";
const COMPLETE_LIMIT = 50;
const LIST_LIMIT = 20;
const FIELD_READ_LIMIT = 50;
const SAMPLE_RECORDS = 5;
// A snapshot of a heap this big crashed the headless renderer.
const SNAPSHOT_MAX_BYTES = 1024 ** 3;
const MARKER = "cache-memory-research";
const RECORD_TAB = '[data-record-tabs] [role="tab"]';
const FEED = '[data-record-tab="activity"]';

// The rows cacheMemoryData.py makes: whole records, one list page per group, field reads.
const CASES = [
	{
		doctype: "Sales Invoice",
		field: "currency",
		records: { filters: [["po_no", "like", "cmr-record-%"]], order_by: "po_no asc" },
		fieldReads: { filters: [["po_no", "like", "cmr-field-%"]], order_by: "po_no asc" },
		group: (index) => ({ po_no: `cmr-list-${pad(index)}` }),
	},
	{
		doctype: "ToDo",
		field: "status",
		records: {
			filters: [["description", "like", `%${MARKER} record %`]],
			order_by: "description asc",
		},
		fieldReads: { filters: [["date", "=", "2002-01-01"]], order_by: "description asc" },
		group: (index) => ({ date: `2001-01-${pad(index)}` }),
	},
];

async function main() {
	const jsonPath = argument("--json");
	const desk = await readDesk();
	const browser = await chromium.launch();
	const results = { chromium: browser.version(), shell: desk.shell, feed: SHOW_FEED, runs: [] };
	mkdirSync(SNAPSHOT_DIR, { recursive: true });
	try {
		for (let run = 1; run <= RUNS; run++) {
			for (const spec of CASES.filter(({ doctype }) => !CASE || doctype === CASE)) {
				const result = await new CacheMemoryWalk(browser, desk, spec).run();
				printCase(run, result);
				results.runs.push({ run, ...result });
			}
		}
	} finally {
		await browser.close();
	}
	if (jsonPath) writeFileSync(jsonPath, JSON.stringify(results, null, 2));
}

class CacheMemoryWalk {
	constructor(browser, desk, spec) {
		Object.assign(this, { browser, desk, spec, steps: [], payloads: {} });
		this.listPath = listPathOf(desk, spec.doctype);
	}

	async run() {
		const context = await this.browser.newContext();
		try {
			await logIn(context.request);
			this.names = await this.readNames(context.request);
			this.page = await MemoryPage.open(context);
			await this.walk();
			const stores = this.steps.at(-1).heap < SNAPSHOT_MAX_BYTES ? await this.split() : null;
			const { doctype } = this.spec;
			const { payloads, steps, sample } = this;
			return { doctype, payloads, steps, sample, stores };
		} finally {
			await context.close();
		}
	}

	async walk() {
		const { records, fieldReads } = this.names;
		await this.page.goto(new URL(this.desk.route, BASE_URL).href);
		await this.measure("baseline", 0);
		this.watchPayloads();
		await this.openList(1);
		await this.openRecord(records[0]);
		this.page.page.removeAllListeners("response");
		await this.measure("first list and first record", 1, () => this.page.findExports());
		for (const name of records.slice(1, SAMPLE_RECORDS)) await this.openRecord(name);
		await this.measure(`records 2-${SAMPLE_RECORDS}`, SAMPLE_RECORDS - 1);
		if (SHOW_FEED) await this.takeSample();
		for (const name of records.slice(SAMPLE_RECORDS, COMPLETE_LIMIT))
			await this.openRecord(name);
		await this.measure(`records ${SAMPLE_RECORDS + 1}-50`, COMPLETE_LIMIT - SAMPLE_RECORDS);
		for (let group = 2; group <= LIST_LIMIT; group++) await this.openList(group);
		await this.measure("lists 2-20", LIST_LIMIT - 1);
		await this.readFields(fieldReads.slice(0, FIELD_READ_LIMIT));
		await this.measure("field reads 1-50", FIELD_READ_LIMIT);
		await this.openRecord(records[COMPLETE_LIMIT]);
		await this.measure("record 51 (past limit)", 1);
		await this.openList(LIST_LIMIT + 1);
		await this.measure("list 21 (past limit)", 1);
		await this.readFields(fieldReads.slice(FIELD_READ_LIMIT, FIELD_READ_LIMIT + 1));
		await this.measure("field read 51 (past limit)", 1);
		// Only a return to a list paints from the cache, which is what fills the rows memo.
		for (let group = 2; group <= LIST_LIMIT + 1; group++) await this.openList(group);
		await this.measure("return to lists 2-21", LIST_LIMIT);
	}

	/** Each visit starts from the home page, so the page mounts afresh as from a link. */
	async openRecord(name) {
		await this.page.navigate(this.desk.route);
		await this.page.navigate(`${this.listPath}/${encodeURIComponent(name)}`, RECORD_TAB);
		await this.page.showTab(RECORD_TAB, "Details", MARKERS.field);
		if (SHOW_FEED) await this.page.showTab(RECORD_TAB, "Activity", FEED);
	}

	/** A split while the heap is still small enough to snapshot; the heap is read again after. */
	async takeSample() {
		this.sample = await this.split();
		await this.measure("after the sample snapshot", 0);
	}

	async openList(group) {
		const query = new URLSearchParams(this.spec.group(group));
		await this.page.navigate(this.desk.route);
		await this.page.navigate(`${this.listPath}?${query}`);
		await this.page.waitForRows(MARKERS.row, this.names.groups[group - 1]);
	}

	readFields(names) {
		return this.page.readFields(this.spec.doctype, names, this.spec.field);
	}

	/** Reads the heap on the home page, so no list or record is on screen. */
	async measure(step, filled, beforeRead) {
		if (step !== "baseline") await this.page.navigate(this.desk.route);
		if (beforeRead) await beforeRead();
		const heap = await this.page.usedHeap();
		const previous = this.steps.at(-1)?.heap ?? heap;
		const cached = step === "baseline" ? null : await this.readCached();
		this.steps.push({ step, filled, heap, delta: heap - previous, cached });
		console.log(
			`${this.spec.doctype}: ${step}: heap ${mb(heap)} MB, delta ${mb(heap - previous)} MB`
		);
	}

	async readCached() {
		const { doctype } = this.spec;
		const tally = async (names) => countBy(await this.page.readCached(doctype, names));
		const { records, lists, fieldReads } = this.names;
		return {
			records: await tally(records),
			lists: await tally(lists),
			fieldReads: await tally(fieldReads),
		};
	}

	async split() {
		const path = join(SNAPSHOT_DIR, `${this.spec.doctype.replace(/\W/g, "-")}.heapsnapshot`);
		await this.page.writeSnapshot(path);
		try {
			return splitStores(path, this.names);
		} finally {
			if (!process.env.KEEP_SNAPSHOTS) rmSync(path);
		}
	}

	watchPayloads() {
		const prefix = `/api/v2/document/${encodeURIComponent(this.spec.doctype)}`;
		this.page.page.on("response", async (response) => {
			const { pathname } = new URL(response.url());
			if (!pathname.startsWith(prefix) || response.request().method() !== "GET") return;
			const kind = pathname === prefix ? "listPage" : "record";
			const bytes = (await response.body().catch(() => "")).length;
			this.payloads[kind] = Math.max(this.payloads[kind] ?? 0, bytes);
		});
	}

	async readNames(request) {
		const { doctype, records, fieldReads, group } = this.spec;
		const groups = [];
		for (let index = 1; index <= LIST_LIMIT + 1; index++) {
			const filters = Object.entries(group(index)).map(([field, value]) => [
				field,
				"=",
				value,
			]);
			groups.push(await names(request, doctype, { filters }));
		}
		return {
			records: await names(request, doctype, records),
			groups,
			lists: groups.flat(),
			fieldReads: await names(request, doctype, fieldReads),
		};
	}
}

async function readDesk() {
	const request = await requestApi.newContext();
	try {
		await logIn(request);
		const desk = await deskBoot(request);
		const html = await (await request.get(new URL(desk.route, BASE_URL).href)).text();
		const shell = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1] ?? "unknown";
		return { ...desk, shell };
	} finally {
		await request.dispose();
	}
}

async function names(request, doctype, query) {
	const url = `${BASE_URL}/api/v2/document/${encodeURIComponent(doctype)}`;
	const params = {
		fields: '["name"]',
		limit: 1000,
		...query,
		filters: JSON.stringify(query.filters),
	};
	const response = await request.get(url, { params });
	if (!response.ok())
		throw new Error(`Reading ${doctype} names failed with ${response.status()}`);
	return (await response.json()).data.map((row) => row.name);
}

function printCase(run, { doctype, payloads, steps, sample, stores }) {
	console.log(`\nRun ${run}: ${doctype}; reply bytes ${JSON.stringify(payloads)}`);
	console.table(
		steps.map(({ step, filled, heap, delta, cached }) => ({
			step,
			filled,
			heapMB: mb(heap),
			deltaMB: mb(delta),
			perEntryKB: filled ? Math.round(delta / filled / 1024) : "",
			cached: cached && JSON.stringify(cached),
		}))
	);
	if (sample) console.table(sample);
	if (stores) console.table(stores);
}

function countBy(values) {
	const counts = {};
	for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
	return counts;
}

function argument(flag) {
	const index = process.argv.indexOf(flag);
	return index === -1 ? null : process.argv[index + 1];
}

const pad = (number) => String(number).padStart(2, "0");
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
