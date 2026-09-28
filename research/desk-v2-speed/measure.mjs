// Drives desk v2 and the desk v1 form headless and writes each page step's cost to a JSON file.
// Usage: [CPU_SLOWDOWN=4] node measure.mjs <runs> <out.json> [flow ...]

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { installProbe } from "./pageProbe.mjs";

const PLAYWRIGHT =
  process.env.PLAYWRIGHT ||
  "/Users/shariq/crm-bench/apps/crm/node_modules/playwright/index.mjs";
const { chromium } = await import(PLAYWRIGHT);

const BASE_URL = process.env.BASE_URL || "http://crm.localhost:8019";
const RECORD = process.env.RECORD || "CRM-LEAD-2026-00002";
const CPU_SLOWDOWN = Number(process.env.CPU_SLOWDOWN || 1);
const QUIET_MS = 1500;
const CAP_MS = 30000;

const SKELETONS = [
  ".fui-skeleton",
  ".animate-pulse",
  "[data-tile-skeleton]",
  "[data-record-header-skeleton]",
  "[data-record-body-skeleton]",
  "[data-record-tabs-skeleton]",
  "[data-feed-skeleton]",
  "[data-form-skeleton]",
  "[data-record-panel-skeleton]",
  "[data-panel-sections-skeleton]",
  "[data-quick-filter-skeleton]",
  "[data-list-header-skeleton]",
  ".list-skeleton",
  ".form-skeleton",
].join(", ");

const V1_PAGE = '.page-container:not([style*="display: none"])';
const CONTENT = {
  home: 'li > a[href="/apps/crm/crm-lead"]',
  list: 'a[data-slot="list-row"][href]',
  record: "[data-record-body] [data-fieldname]",
  v1list: `${V1_PAGE} .list-row-container`,
  v1record: `${V1_PAGE} .form-layout .frappe-control[data-fieldname]`,
};

const FLOWS = {
  home: [
    { name: "home cold", page: "home", go: "/apps/crm" },
    { name: "list in-app", page: "list", click: CONTENT.home },
    { name: "home return", page: "home", back: true },
    { name: "home warm reload", page: "home", fresh: "/apps/crm" },
  ],
  list: [
    { name: "list cold", page: "list", go: "/apps/crm/crm-lead" },
    {
      name: "record in-app",
      page: "record",
      click: `a[href="/apps/crm/crm-lead/${RECORD}"]`,
    },
    { name: "list return", page: "list", back: true },
    { name: "record return", page: "record", forward: true },
    { name: "list warm reload", page: "list", fresh: "/apps/crm/crm-lead" },
  ],
  record: [
    { name: "record cold", page: "record", go: `/apps/crm/crm-lead/${RECORD}` },
    {
      name: "record warm reload",
      page: "record",
      fresh: `/apps/crm/crm-lead/${RECORD}`,
    },
  ],
  v1: [
    { name: "v1 list cold", page: "v1list", go: "/desk/crm-lead" },
    {
      name: "v1 record in-app",
      page: "v1record",
      click: `${V1_PAGE} a[data-name="${RECORD}"]`,
    },
    { name: "v1 list return", page: "v1list", back: true },
    { name: "v1 record return", page: "v1record", forward: true },
  ],
  v1record: [
    {
      name: "v1 record cold",
      page: "v1record",
      go: `/desk/crm-lead/${RECORD}`,
    },
    {
      name: "v1 record warm reload",
      page: "v1record",
      fresh: `/desk/crm-lead/${RECORD}`,
    },
  ],
};

const [runsArg = "5", outPath = "results.json", ...flowNames] =
  process.argv.slice(2);
const flows = flowNames.length ? flowNames : Object.keys(FLOWS);

const browser = await chromium.launch();
const results = [];
for (let run = 1; run <= Number(runsArg); run++) {
  for (const flow of flows) {
    const steps = await runFlow(FLOWS[flow]);
    results.push({ run, flow, steps });
    process.stdout.write(
      `run ${run} ${flow}: ${steps.map(brief).join(" | ")}\n`
    );
  }
}
await browser.close();
writeFileSync(
  outPath,
  JSON.stringify({ baseUrl: BASE_URL, record: RECORD, results }, null, 1)
);

function brief(step) {
  return `${step.name} ${step.requests.length} req, usable ${Math.round(
    step.usableAt
  )} ms`;
}

async function runFlow(steps) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(installProbe, {
    skeletons: SKELETONS,
    content: CONTENT,
  });
  const login = await context.request.post("/api/method/login", {
    form: {
      usr: process.env.USR || "Administrator",
      pwd: process.env.PWD_FRAPPE || "admin",
    },
  });
  if (!login.ok()) throw new Error(`Login failed with ${login.status()}`);

  let tab = await openTab(context);
  const measured = [];
  for (const step of steps) {
    if (step.fresh) {
      await tab.page.close();
      tab = await openTab(context);
    }
    tab.network.begin(step.name);
    if (step.go || step.fresh) {
      await tab.page.goto(step.go || step.fresh);
    } else {
      await tab.page.evaluate(() => window.__probe.reset());
      if (step.click) await tab.page.$eval(step.click, (link) => link.click());
      if (step.back) await tab.page.evaluate(() => history.back());
      if (step.forward) await tab.page.evaluate(() => history.forward());
    }
    const probe = await settle(tab, step.page);
    const requests = await tab.network.end();
    measured.push({
      name: step.name,
      page: step.page,
      ...paintMetrics(probe, !!(step.go || step.fresh)),
      requests,
    });
  }
  await context.close();
  return measured;
}

async function openTab(context) {
  const page = await context.newPage();
  await page.mouse.move(1439, 899);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (CPU_SLOWDOWN > 1)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  return { page, network: networkLog(cdp) };
}

async function settle(tab, page) {
  await tab.page.waitForFunction(() => window.__probe, null, {
    timeout: CAP_MS,
  });
  const started = Date.now();
  for (;;) {
    const probe = await tab.page.evaluate(
      (name) => window.__probe.read(name),
      page
    );
    const done =
      probe.content > 0 &&
      probe.skeletons === 0 &&
      probe.quietMs >= QUIET_MS &&
      tab.network.inFlight() === 0;
    if (done) return probe;
    if (Date.now() - started > CAP_MS) return { ...probe, timedOut: true };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function paintMetrics(probe, isLoad) {
  const frames = probe.frames.filter((frame) => frame.t >= 0);
  const ready = (frame) => frame.content > 0 && frame.skeletons === 0;
  const lastNotReady = frames.findLastIndex((frame) => !ready(frame));
  const usable = frames[lastNotReady + 1];
  return {
    timedOut: !!probe.timedOut,
    firstPaint: isLoad ? probe.fcp : frames[0]?.t ?? null,
    contentAt: frames.find((frame) => frame.content > 0)?.t ?? null,
    usableAt: usable ? usable.t : null,
    stillAt: frames.at(-1)?.t ?? null,
    paints: frames.length,
    skeletonFrames: frames.filter((frame) => frame.skeletons > 0).length,
  };
}

function networkLog(cdp) {
  const all = new Map();
  let step = null;

  cdp.on(
    "Network.requestWillBeSent",
    ({ requestId, request, type, redirectResponse, timestamp }) => {
      if (redirectResponse) return;
      all.set(requestId, {
        requestId,
        step,
        startedAt: timestamp,
        url: request.url.replace(BASE_URL, ""),
        method: request.method,
        postData: request.postData || null,
        type,
        done: false,
      });
    }
  );
  cdp.on("Network.requestServedFromCache", ({ requestId }) => {
    const entry = all.get(requestId);
    if (entry) entry.fromCache = true;
  });
  cdp.on("Network.responseReceived", ({ requestId, response }) => {
    const entry = all.get(requestId);
    if (!entry) return;
    entry.status = response.status;
    entry.fromCache =
      entry.fromCache || response.fromDiskCache || response.fromPrefetchCache;
    const timing = response.timing;
    if (timing) entry.serverMs = timing.receiveHeadersEnd - timing.sendEnd;
  });
  cdp.on(
    "Network.loadingFinished",
    ({ requestId, encodedDataLength, timestamp }) => {
      const entry = all.get(requestId);
      if (!entry) return;
      entry.done = true;
      entry.finishedAt = timestamp;
      entry.transferred = encodedDataLength;
    }
  );
  cdp.on("Network.loadingFailed", ({ requestId, errorText }) => {
    const entry = all.get(requestId);
    if (!entry) return;
    entry.done = true;
    entry.failed = errorText;
  });

  const isSocket = (entry) => entry.url.includes("/socket.io/");
  const current = () =>
    [...all.values()].filter((entry) => entry.step === step);

  return {
    begin(name) {
      step = name;
    },
    inFlight: () =>
      current().filter((entry) => !entry.done && !isSocket(entry)).length,
    async end() {
      const entries = current();
      const origin = Math.min(...entries.map((entry) => entry.startedAt));
      for (const entry of entries) {
        entry.startMs = Math.round((entry.startedAt - origin) * 1000);
        entry.endMs = entry.finishedAt
          ? Math.round((entry.finishedAt - origin) * 1000)
          : null;
        if (
          !entry.done ||
          entry.failed ||
          isSocket(entry) ||
          entry.status === 304
        )
          continue;
        try {
          const { body, base64Encoded } = await cdp.send(
            "Network.getResponseBody",
            {
              requestId: entry.requestId,
            }
          );
          const buffer = Buffer.from(body, base64Encoded ? "base64" : "utf8");
          entry.bytes = buffer.length;
          entry.gzip =
            entry.type === "Image" ? buffer.length : gzipSync(buffer).length;
        } catch {
          entry.bytes = null;
        }
      }
      return entries.map(
        ({ requestId, step: _step, done, startedAt, finishedAt, ...rest }) =>
          rest
      );
    },
  };
}
