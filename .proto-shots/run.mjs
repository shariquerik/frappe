// PROTOTYPE (#45867) screenshot runner: node run.mjs <steps.json> <outdir>
// Steps run in one page (state is in memory). Each step: {go}, {click}, {clicktext}, {fill:[sel,text]},
// {type}, {press}, {wait}, {scroll}, {waitfor}, {eval}, {mdrag:[from,to]}, {shot:name}, {hover}, {resize:[w,h]}.
import { chromium } from "/home/shariq/wt/ui-test/runner/node_modules/playwright/index.mjs";
import fs from "node:fs";
const [, , stepsFile, outdir] = process.argv;
const steps = JSON.parse(fs.readFileSync(stepsFile, "utf8"));
const sid = fs.readFileSync("/tmp/proto-45867/sid", "utf8").trim();
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: "sid", value: sid, domain: "desk.localhost", path: "/" }]);
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
page.on("dialog", async (d) => { console.log("dialog:", d.type(), d.message()); await (d.type() === "beforeunload" ? d.accept() : d.dismiss()); });
const base = "http://desk.localhost:8094/apps/desk";
for (const s of steps) {
	try {
		if (s.go) { await page.goto(base + s.go); await page.waitForLoadState("networkidle"); }
		if (s.click) await page.locator(s.click).first().click({ timeout: 8000 });
		if (s.clicktext) await page.getByText(s.clicktext, { exact: true }).first().click({ timeout: 8000 });
		if (s.role) await page.getByRole(s.role[0], { name: s.role[1], exact: true }).first().click({ timeout: 8000 });
		if (s.fill) await page.locator(s.fill[0]).first().fill(s.fill[1], { timeout: 8000 });
		if (s.select) await page.locator(s.select[0]).first().selectOption(s.select[1]);
		if (s.type) await page.keyboard.type(s.type, { delay: 30 });
		if (s.press) await page.keyboard.press(s.press);
		if (s.resize) await page.setViewportSize({ width: s.resize[0], height: s.resize[1] });
		// {scroll: sel, by?}: scrolls the element to the top of its scroller, then by px more.
		if (s.scroll) await page.locator(s.scroll).first().evaluate((el, by) => { el.scrollIntoView({ block: "start" }); el.closest(".overflow-y-auto")?.scrollBy(0, by); }, s.by ?? -24);
		if (s.mouse) await page.mouse.move(s.mouse[0], s.mouse[1]);
		if (s.hover) await page.locator(s.hover).first().hover();
		if (s.waitfor) await page.getByText(s.waitfor).first().waitFor({ timeout: 20000 });
		if (s.wait) await page.waitForTimeout(s.wait);
		if (s.eval) console.log("eval:", JSON.stringify(await page.evaluate(s.eval)));
		if (s.mdrag) {
			const a = await page.locator(s.mdrag[0]).first().boundingBox();
			const b = await page.locator(s.mdrag[1]).first().boundingBox();
			await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
			await page.mouse.down();
			for (let i = 1; i <= 20; i++) await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2) - (a.x + a.width / 2)) * i / 20, a.y + a.height / 2 + ((b.y + b.height / 2 + (s.dy ?? 0)) - (a.y + a.height / 2)) * i / 20);
			await page.waitForTimeout(200);
			await page.mouse.up();
		}
		// A held drag, to shoot it mid-way: {mdown: sel}, then {mmove: sel, dy?, dx?}, then {mup: true}.
		if (s.mdown) {
			const a = await page.locator(s.mdown).first().boundingBox();
			globalThis.at = { x: a.x + (s.dx ?? a.width / 2), y: a.y + a.height / 2 };
			await page.mouse.move(at.x, at.y);
			await page.mouse.down();
		}
		if (s.mmove) {
			const b = await page.locator(s.mmove).first().boundingBox();
			const to = { x: b.x + (s.dx ?? b.width / 2), y: b.y + b.height / 2 + (s.dy ?? 0) };
			for (let i = 1; i <= 20; i++) await page.mouse.move(at.x + (to.x - at.x) * i / 20, at.y + (to.y - at.y) * i / 20);
			globalThis.at = to;
			await page.waitForTimeout(250);
		}
		if (s.mup) { await page.mouse.up(); await page.waitForTimeout(300); }
		if (s.shot) { await page.waitForTimeout(400); await page.screenshot({ path: `${outdir}/${s.shot}.png` }); console.log("shot", s.shot, page.url()); }
	} catch (e) { console.log("step failed", JSON.stringify(s), e.message.split("\n")[0]); }
}
await browser.close();
