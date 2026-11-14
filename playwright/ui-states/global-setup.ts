import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { request, type FullConfig } from "@playwright/test";

/**
 * SQLite keeps a renamed table's index names, and a killed run leaves its tables behind, so the
 * next seed of the same DocType fails with "index ... already exists". Drops the `tabUI *` tables
 * that no DocType row owns (and with them their indexes) before any scene seeds.
 */
function dropOrphanTables(): void {
	const sites = process.env.UI_TEST_SITES ?? join(homedir(), "wt/ui-test/sites/ui-test.localhost/db");
	const script = `
import glob, sqlite3, sys
files = glob.glob(sys.argv[1] + "/*.db")
if not files:
    sys.exit(0)
con = sqlite3.connect(files[0])
owned = {row[0] for row in con.execute("select name from tabDocType")}
for (name,) in con.execute("select name from sqlite_master where type = 'table' and name like 'tabUI %'").fetchall():
    if name[3:] not in owned:
        con.execute('drop table "' + name + '"')
con.commit()
`;
	try {
		execFileSync("python3", ["-I", "-c", script, sites], { stdio: "ignore" });
	} catch {
		// a missing db or a locked file leaves the old behaviour: the seed reports the failure
	}
}

/** Turns desk v2 on for the site, as the desk v2 specs do in `beforeAll`. */
export default async function globalSetup(config: FullConfig): Promise<void> {
	dropOrphanTables();
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
