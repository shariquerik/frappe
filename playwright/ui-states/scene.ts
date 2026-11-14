import type { APIRequestContext, Browser, BrowserContext, Page, Route } from "@playwright/test";

const VIEWPORT = { width: 1440, height: 900 };
/** Enough for frappe-ui transitions and the editor's own settle to finish. */
const SETTLE_MS = 450;

/**
 * A request hold: traffic matching the pattern waits until the hold ends.
 * `abort` fails the held requests and every later match, since the transport
 * retries server errors, until `release` lets traffic through again.
 */
export interface Hold {
	release(): Promise<void>;
	abort(status?: number): Promise<void>;
}

export type Scheme = "light" | "dark";

/** A document to insert, as `/api/resource/<doctype>` takes it. */
export type Doc = Record<string, unknown>;

/**
 * One browser session in one capture path: signed in as Administrator on the
 * test site. Everything the path seeds through `insert` or `track` is deleted
 * when the scene closes, so paths never see each other's rows.
 */
export interface Scene {
	page: Page;
	context: BrowserContext;
	api: APIRequestContext;
	baseURL: string;
	/** A name unique to this path. */
	name(label: string): string;
	goto(path: string): Promise<void>;
	/** Holds requests whose URL matches until released or aborted. */
	hold(url: string | RegExp): Promise<Hold>;
	/** Waits for transitions. */
	settle(ms?: number): Promise<void>;
	/** Paints the page in a colour scheme, as the owner's theme setting does. */
	theme(scheme: Scheme): Promise<void>;
	/** Calls a whitelisted method as Administrator and returns its `message`. */
	call<T = unknown>(method: string, args?: Record<string, unknown>): Promise<T>;
	/** Inserts a document; it is deleted when the scene closes (children of a DocType go first). */
	insert(doctype: string, doc: Doc): Promise<Doc>;
	/** Deletes `doctype/name` when the scene closes, whatever the path did with it. */
	track(doctype: string, name: string): void;
	/** Runs when the scene closes, after the tracked documents are gone. Use it to undo a Customize Form save. */
	onClose(cleanup: () => Promise<void>): void;
	close(): Promise<void>;
}

export async function openScene(
	browser: Browser,
	baseURL: string,
	label: string,
): Promise<Scene> {
	const context = await browser.newContext({
		baseURL,
		viewport: VIEWPORT,
		colorScheme: "light",
		// A session-cookie POST passes the CSRF check on a same-origin Referer.
		extraHTTPHeaders: { Referer: `${baseURL}/` },
	});
	// frappe-ui reads the scheme from localStorage before the first paint.
	await context.addInitScript(() => {
		try {
			if (!localStorage.getItem("theme")) localStorage.setItem("theme", "light");
		} catch {
			// no storage on about:blank
		}
	});
	const api = context.request;
	const login = await api.post("/api/method/login", {
		data: { usr: "Administrator", pwd: process.env.ADMIN_PASSWORD ?? "admin" },
	});
	if (!login.ok()) throw new Error(`login failed: ${await login.text()}`);
	const page = await context.newPage();
	const stamp = Date.now().toString(36);
	const tracked: Array<[string, string]> = [];
	const cleanups: Array<() => Promise<void>> = [];

	const scene: Scene = {
		page,
		context,
		api,
		baseURL,
		name: (suffix) => `${suffix} ${stamp}`,
		async goto(path) {
			await page.goto(path);
		},
		async hold(url) {
			// The handler stays routed for the scene's life: unrouting lets a held request through.
			const held: Route[] = [];
			let status: number | null = null;
			let passing = false;
			const fail = (route: Route) =>
				route.fulfill({
					status: status ?? 500,
					contentType: "application/json",
					body: JSON.stringify({ exc_type: "ServerError", exception: "frappe.exceptions.ServerError", _server_messages: JSON.stringify([JSON.stringify({ message: "Something went wrong" })]) }),
				});
			await page.route(url, async (route) => {
				if (passing) await route.continue();
				else if (status === null) held.push(route);
				else await fail(route);
			});
			return {
				async release() {
					passing = true;
					status = null;
					await Promise.all(held.splice(0).map((route) => route.continue().catch(() => undefined)));
				},
				async abort(next = 500) {
					status = next;
					passing = false;
					await Promise.all(held.splice(0).map((route) => fail(route).catch(() => undefined)));
				},
			};
		},
		async settle(ms = SETTLE_MS) {
			await page.waitForTimeout(ms);
		},
		async theme(scheme) {
			await page.evaluate((value) => {
				localStorage.setItem("theme", value);
				document.documentElement.setAttribute("data-theme", value);
			}, scheme);
			await page.waitForTimeout(120);
		},
		async call(method, args = {}) {
			const res = await api.post(`/api/method/${method}`, { data: args });
			if (!res.ok()) throw new Error(`${method}: ${await res.text()}`);
			return ((await res.json()) as { message: never }).message;
		},
		async insert(doctype, doc) {
			const res = await api.post(`/api/resource/${doctype}`, { data: { doctype, ...doc } });
			if (!res.ok()) throw new Error(`insert ${doctype}: ${await res.text()}`);
			const data = ((await res.json()) as { data: Doc }).data;
			tracked.push([doctype, String(data.name)]);
			return data;
		},
		track(doctype, name) {
			tracked.push([doctype, name]);
		},
		onClose(cleanup) {
			cleanups.push(cleanup);
		},
		async close() {
			// Newest first: a record before the DocType it belongs to.
			for (const [doctype, name] of tracked.reverse()) {
				await api
					.delete(`/api/resource/${doctype}/${encodeURIComponent(name)}`, { failOnStatusCode: false })
					.catch(() => undefined);
			}
			for (const cleanup of cleanups) await cleanup().catch(() => undefined);
			await context.close();
		},
	};
	void label;
	return scene;
}
