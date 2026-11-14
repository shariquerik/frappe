import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Captures every state of the DocType editor as a screenshot, walking the
 * machines under `flows/`. Not a test suite: one run per flow, no retries,
 * one browser. Run it on the test site through `~/wt/ui-test/run.sh`:
 *
 *   UI_TEST_NO_BUILD=1 UI_STATES_FLOWS=design ~/wt/ui-test/run.sh <worktree> \
 *     playwright/ui-states/capture.spec.ts -c playwright/ui-states/playwright.config.ts
 */
const baseURL = process.env.BASE_URL ?? "http://ui-test.localhost:8098";

export const OUT_DIR = resolve(__dirname, "out");

export default defineConfig({
	testDir: __dirname,
	testMatch: /capture\.spec\.ts/,
	outputDir: resolve(__dirname, ".runs"),
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 20 * 60_000,
	expect: { timeout: 15_000 },
	reporter: [["list"]],
	use: {
		baseURL,
		viewport: { width: 1440, height: 900 },
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	globalSetup: "./global-setup.ts",
	globalTeardown: "./global-teardown.ts",
});
