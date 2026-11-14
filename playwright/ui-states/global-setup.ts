import { request, type FullConfig } from "@playwright/test";

/** Turns desk v2 on for the site, as the desk v2 specs do in `beforeAll`. */
export default async function globalSetup(config: FullConfig): Promise<void> {
	await setDeskV2(config.projects[0]?.use.baseURL as string, 1);
}

export async function setDeskV2(baseURL: string, enabled: 0 | 1): Promise<void> {
	const api = await request.newContext({ baseURL, extraHTTPHeaders: { Referer: `${baseURL}/` } });
	const login = await api.post("/api/method/login", {
		data: { usr: "Administrator", pwd: process.env.ADMIN_PASSWORD ?? "admin" },
	});
	if (!login.ok()) throw new Error(`login failed: ${await login.text()}`);
	const res = await api.post("/api/method/frappe.tests.ui_test_helpers.set_desk_v2", {
		data: { enabled },
	});
	if (!res.ok()) throw new Error(`set_desk_v2 failed: ${await res.text()}`);
	await api.dispose();
}
