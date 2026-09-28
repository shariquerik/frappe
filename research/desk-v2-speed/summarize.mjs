// Turns the JSON from measure.mjs into Markdown tables of medians per step.
// Usage: node summarize.mjs results/runs.json[.gz]

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const raw = readFileSync(process.argv[2]);
const { results } = JSON.parse(
  process.argv[2].endsWith(".gz") ? gunzipSync(raw) : raw
);
const byStep = groupSteps(results);

printTimes();
printRequests();
printBytes();
printApiCalls();
printServerTimes();
printChunks("record cold");
printChunks("list cold");

function groupSteps(allRuns) {
  const groups = new Map();
  for (const { steps } of allRuns)
    for (const step of steps) {
      const requests = step.requests.filter(
        (request) => !request.url.startsWith("data:")
      );
      if (!groups.has(step.name)) groups.set(step.name, []);
      groups.get(step.name).push({ ...step, requests });
    }
  return groups;
}

function median(values) {
  const sorted = values
    .filter((value) => value !== null && value !== undefined)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value) {
  return value === null ? "-" : String(Math.round(value));
}

function kb(bytes) {
  return bytes === null ? "-" : (bytes / 1024).toFixed(1);
}

function table(header, rows) {
  process.stdout.write(
    `| ${header.join(" | ")} |\n|${header.map(() => " --- ").join("|")}|\n`
  );
  for (const row of rows) process.stdout.write(`| ${row.join(" | ")} |\n`);
  process.stdout.write("\n");
}

function stepRows(render) {
  return [...byStep].map(([name, runs]) => [name, ...render(runs)]);
}

function kind(request) {
  if (request.url.includes("/socket.io/")) return "socket";
  if (request.url.includes("/api/")) return "api";
  if (request.type === "Document") return "document";
  if (
    request.url.includes("/assets/") &&
    request.url.split("?")[0].endsWith(".js")
  )
    return "js";
  if (
    request.url.includes("/assets/") &&
    request.url.split("?")[0].endsWith(".css")
  )
    return "css";
  if (request.type === "Font") return "font";
  if (request.type === "Image") return "image";
  return "other";
}

function printTimes() {
  process.stdout.write("### Times (ms, median)\n\n");
  table(
    [
      "step",
      "runs",
      "timed out",
      "first paint",
      "content",
      "usable",
      "still",
      "paints",
      "skeleton frames",
    ],
    stepRows((runs) => [
      runs.length,
      runs.filter((run) => run.timedOut).length,
      ...[
        "firstPaint",
        "contentAt",
        "usableAt",
        "stillAt",
        "paints",
        "skeletonFrames",
      ].map((key) => round(median(runs.map((run) => run[key])))),
    ])
  );
}

function printRequests() {
  process.stdout.write("### Requests (median count)\n\n");
  const kinds = [
    "document",
    "api",
    "js",
    "css",
    "font",
    "image",
    "socket",
    "other",
  ];
  table(
    [
      "step",
      "all",
      "from HTTP cache",
      ...kinds,
      "sent twice",
      "repeated from cache",
    ],
    stepRows((runs) => [
      median(runs.map((run) => run.requests.length)),
      median(
        runs.map(
          (run) => run.requests.filter((request) => request.fromCache).length
        )
      ),
      ...kinds.map((name) =>
        median(
          runs.map(
            (run) =>
              run.requests.filter((request) => kind(request) === name).length
          )
        )
      ),
      median(
        runs.map(
          (run) =>
            duplicates(run.requests.filter((request) => !request.fromCache))
              .length
        )
      ),
      median(
        runs.map(
          (run) =>
            duplicates(run.requests).length -
            duplicates(run.requests.filter((request) => !request.fromCache))
              .length
        )
      ),
    ])
  );
}

function duplicates(requests) {
  const seen = new Map();
  for (const request of requests) {
    if (kind(request) === "socket" || request.url.startsWith("data:")) continue;
    const key = `${request.method} ${request.url.replace(/[&?]_=\d+/, "")} ${
      request.postData ?? ""
    }`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([key]) => key);
}

function downloaded(run, name) {
  const requests = run.requests.filter(
    (request) => kind(request) === name && !request.fromCache
  );
  return {
    raw: requests.reduce((sum, request) => sum + (request.bytes ?? 0), 0),
    gzip: requests.reduce((sum, request) => sum + (request.gzip ?? 0), 0),
  };
}

function printBytes() {
  process.stdout.write(
    "### Bytes downloaded (KB, median; raw / gzip; HTTP-cache hits excluded)\n\n"
  );
  const kinds = ["document", "api", "js", "css", "font", "image", "other"];
  table(
    [
      "step",
      ...kinds.map((name) => `${name} raw / gz`),
      "boot payload raw / gz",
    ],
    stepRows((runs) => [
      ...kinds.map((name) => {
        const raw = median(runs.map((run) => downloaded(run, name).raw));
        const gzip = median(runs.map((run) => downloaded(run, name).gzip));
        return `${kb(raw)} / ${kb(gzip)}`;
      }),
      bootPayload(runs),
    ])
  );
}

function bootPayload(runs) {
  const boot = (run) =>
    run.requests.filter(
      (request) =>
        kind(request) === "document" ||
        /get_boot\b|get_boot_translations|get_addresses/.test(request.url)
    );
  const raw = median(
    runs.map((run) =>
      boot(run).reduce((sum, request) => sum + (request.bytes ?? 0), 0)
    )
  );
  const gzip = median(
    runs.map((run) =>
      boot(run).reduce((sum, request) => sum + (request.gzip ?? 0), 0)
    )
  );
  return raw ? `${kb(raw)} / ${kb(gzip)}` : "-";
}

function apiName(request) {
  const [path] = request.url.split("?");
  const method = path.match(/\/api\/(?:v2\/)?method\/(.+)$/);
  if (method) return method[1].split(".").slice(-2).join(".");
  return path.replace("/api/v2/", "").replace(/%20/g, " ");
}

function printApiCalls() {
  process.stdout.write(
    "### API calls per step (run 1 order; x2 marks a call sent twice)\n\n"
  );
  table(
    ["step", "calls"],
    [...byStep].map(([name, runs]) => {
      const repeated = duplicates(
        runs[0].requests.filter((request) => !request.fromCache)
      );
      const calls = runs[0].requests.filter(
        (request) => kind(request) === "api"
      );
      const labels = calls.map((request) => {
        const twice = repeated.some((key) =>
          key.includes(request.url.replace(/[&?]_=\d+/, ""))
        );
        return `${request.method} ${apiName(request)}${twice ? " x2" : ""}`;
      });
      return [name, labels.join("; ") || "-"];
    })
  );
}

function printServerTimes() {
  process.stdout.write(
    "### Server wait in the browser (ms, median time to first byte)\n\n"
  );
  const names = new Set();
  for (const runs of byStep.values())
    for (const run of runs)
      for (const request of run.requests)
        if (kind(request) === "api") names.add(apiName(request));
  const rows = [...names].map((name) => {
    const waits = [];
    for (const runs of byStep.values())
      for (const run of runs)
        for (const request of run.requests)
          if (kind(request) === "api" && apiName(request) === name)
            waits.push(request.serverMs);
    return [name, waits.length, round(median(waits))];
  });
  table(["call", "samples", "median wait"], rows);
}

function printChunks(stepName) {
  const run = byStep.get(stepName)?.[0];
  if (!run) return;
  process.stdout.write(
    `### Files downloaded on ${stepName} (run 1, KB raw / gzip)\n\n`
  );
  const files = run.requests
    .filter((request) => !request.fromCache)
    .filter((request) =>
      ["js", "css", "font", "image", "document", "other"].includes(
        kind(request)
      )
    )
    .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
  table(
    ["file", "kind", "raw", "gzip"],
    files.map((request) => [
      request.url.split("?")[0].split("/").pop(),
      kind(request),
      kb(request.bytes ?? 0),
      kb(request.gzip ?? 0),
    ])
  );
}
