#!/usr/bin/env node
// Build every installed app's Frappe OS applet(s) into that app's public/os-applets.
//
// `bench build` runs each app's root `build` script, but an app's applet lives in a
// nested Vite project (apps/<app>/<app>/os-applets/<name>) that the per-app build never
// reaches — so on a fresh deploy the applet asset (e.g. /assets/raven/os-applets/chat.js)
// is missing and the OS window's dynamic import() 404s.
//
// Frappe OS owns the applet build toolchain (the Vite preset and Vite itself live here),
// so it builds every applet in one place. Apps ship applet SOURCE only: no per-app build
// wiring, and no app ever depends on frappe-os (which keeps them installable on stock
// frappe). This runs inside frappe-os's own build, after frappe-os's node_modules are
// installed, so applet build ordering is never in question.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frappeOsDir = path.resolve(scriptDir, "..");
const appsDir = path.resolve(frappeOsDir, "..", "..");
const viteBin = path.resolve(frappeOsDir, "node_modules", ".bin", "vite");

function isDirectory(target) {
	return fs.existsSync(target) && fs.statSync(target).isDirectory();
}

// An applet is apps/<app>/<module>/os-applets/<name>/vite.config.js. The module folder is
// conventionally the app name, but scan every module folder so it holds regardless.
function discoverAppletConfigs() {
	const configs = [];
	for (const app of fs.readdirSync(appsDir)) {
		const appDir = path.join(appsDir, app);
		if (!isDirectory(appDir)) continue;
		for (const moduleName of fs.readdirSync(appDir)) {
			const appletsDir = path.join(appDir, moduleName, "os-applets");
			if (!isDirectory(appletsDir)) continue;
			for (const applet of fs.readdirSync(appletsDir)) {
				const config = path.join(appletsDir, applet, "vite.config.js");
				if (fs.existsSync(config)) configs.push(config);
			}
		}
	}
	return configs;
}

function buildApplet(config) {
	const result = spawnSync(viteBin, ["build", "--config", config], {
		cwd: frappeOsDir,
		stdio: "inherit",
	});
	return result.status === 0;
}

const configs = discoverAppletConfigs();
if (!configs.length) {
	console.log("No app applets found — nothing to build.");
	process.exit(0);
}

const failed = [];
for (const config of configs) {
	console.log(`Building applet: ${path.relative(appsDir, config)}`);
	if (!buildApplet(config)) failed.push(config);
}

if (failed.length) {
	console.error(`\nApplet build failed for ${failed.length} applet(s):`);
	for (const config of failed) console.error(`  ${path.relative(appsDir, config)}`);
	process.exit(1);
}
