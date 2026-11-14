import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * UNUSED, DOES NOT WORK YET: dropping tables behind the server's back leaves frappe's cached
 * `db_tables` / `table_columns::*` stale, so the next DocType insert takes the alter path and fails
 * ('near FROM'). Do the drop inside the server (a helper in frappe/tests/ui_test_helpers.py that
 * drops the tables and calls frappe.client_cache.delete_value('db_tables') and
 * delete_keys('table_columns::*')) and call it from openScene.
 *
 * SQLite keeps a renamed table's index names, and a killed run leaves its tables behind, so the
 * next seed of the same DocType fails with "index ... already exists". Removes every `UI *` DocType,
 * table and customization before a scene seeds.
 */
export function dropOrphanTables(): void {
	const sites = process.env.UI_TEST_SITES ?? join(homedir(), "wt/ui-test/sites/ui-test.localhost/db");
	const script = `
import glob, sqlite3, sys
files = glob.glob(sys.argv[1] + "/*.db")
if not files:
    sys.exit(0)
con = sqlite3.connect(files[0], timeout=20)
# Every object of the stand-in DocTypes ("UI ..."), so a path whose rename or delete half-ran cannot
# poison the next seed: the rows, the tables (and their indexes) and the customizations.
for table, column in [("tabDocField", "parent"), ("tabDocPerm", "parent"), ("tabDocType Link", "parent"), ("tabDocType Action", "parent"), ("tabCustom Field", "dt"), ("tabProperty Setter", "doc_type"), ("tabDocType Layout", "document_type"), ("tabDocType", "name")]:
    try:
        con.execute('delete from "' + table + '" where "' + column + '" like \\'UI %\\'')
    except sqlite3.OperationalError:
        pass
for (name,) in con.execute("select name from sqlite_master where type = 'table' and name like 'tabUI %'").fetchall():
    con.execute('drop table "' + name + '"')
con.commit()
`;
	try {
		execFileSync("python3", ["-I", "-c", script, sites], { stdio: "ignore" });
	} catch {
		// a missing db or a locked file leaves the old behaviour: the seed reports the failure
	}
}
