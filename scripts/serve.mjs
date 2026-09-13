// Tiny local static server for MysticTools. Applies static/_headers the way
// Cloudflare does, so the security policy behaves the same as in production.
// Usage: node scripts/serve.mjs [--port 8765] [--open]
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "static");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".wasm": "application/wasm", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
};

function siteHeaders() {
  const headers = {};
  try {
    let active = false;
    for (const line of fs.readFileSync(path.join(ROOT, "_headers"), "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!/^\s/.test(line)) { active = line.trim() === "/*"; continue; }
      const i = line.indexOf(":");
      if (active && i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  } catch { /* no _headers file */ }
  return headers;
}

/** extra: { "/__prefix/": "/abs/dir" } mounts (used by the test suite). */
export function serve({ port = 8765, host = "127.0.0.1", extra = {} } = {}) {
  const headers = siteHeaders();
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let base = ROOT;
    for (const [prefix, dir] of Object.entries(extra)) {
      if (url.startsWith(prefix)) { base = dir; url = "/" + url.slice(prefix.length); }
    }
    if (url.endsWith("/")) url += "index.html";
    const file = path.join(base, path.normalize(url));
    if (!file.startsWith(base) || path.basename(file) === "_headers" || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, {
      ...headers,
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const port = Number(args[args.indexOf("--port") + 1]) || 8765;
  await serve({ port });
  const url = `http://localhost:${port}`;
  console.log(`\n  MysticTools  ->  ${url}   (files never leave your browser)\n  Press Ctrl+C to stop.\n`);
  if (args.includes("--open")) exec(process.platform === "win32" ? `start "" ${url}` : `xdg-open ${url}`);
}
