// Static server for the browser page. `?csp=` picks the Content-Security-Policy header:
//   none         no header (what desk v2 sends today)
//   strict       script-src 'self' blob: plus the inline import map's hash; no eval, no wasm
//   strict-wasm  strict plus 'wasm-unsafe-eval', which compiling a WebAssembly module needs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".wasm": "application/wasm", ".json": "application/json", ".jsx": "text/plain", ".vue": "text/plain" };

/** CSP hash source for each inline <script> of a page, so the import map itself is allowed. */
function inlineHashes(html) {
  return [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`).join(" ");
}

function policy(csp, html) {
  const base = `script-src 'self' blob: ${inlineHashes(html)}`;
  if (csp === "strict") return base;
  if (csp === "strict-wasm") return `${base} 'wasm-unsafe-eval'`;
  return null;
}

export function serve(port = 0) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    const body = readFileSync(path);
    const headers = { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" };
    const csp = extname(path) === ".html" && policy(url.searchParams.get("csp"), body.toString());
    if (csp) headers["content-security-policy"] = csp;
    res.writeHead(200, headers).end(body);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
