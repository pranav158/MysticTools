// Offline support. Network first (so a new deploy is picked up immediately),
// falling back to the copy saved on this device when there's no connection.
// Only this site's own files are ever cached — never your documents.
const CACHE = "mystic-app";
const CORE = [
  "./", "index.html", "styles.css", "theme.js", "app.js", "editors.js", "markup.js", "ocr.js", "workflows.js",
  "engine/worker.js", "engine/pdf.js", "engine/pdfedit.js", "engine/image.js", "engine/imgedit.js", "engine/codec.js", "engine/util.js",
  "vendor/mupdf/mupdf.js", "vendor/mupdf/mupdf-wasm.js", "vendor/mupdf/mupdf-wasm.wasm",
  "vendor/fonts/figtree-latin-wght-normal.woff2", "vendor/fonts/fraunces-latin-soft-normal.woff2", "vendor/fonts/caveat-latin-wght-normal.woff2",
  "icons/icon.svg", "icons/icon-192.png", "manifest.webmanifest", "privacy.html", "terms.html", "licenses.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/__")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") {
        // skip rewriting big files (the 10 MB PDF engine) when they haven't changed
        const old = await cache.match(req, { ignoreSearch: true });
        const tag = res.headers.get("etag");
        if (!old || !tag || old.headers.get("etag") !== tag) await cache.put(req, res.clone());
      }
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? cache.match("index.html") : Response.error());
    }
  })());
});
