// End-to-end tests: drives the real app in headless Chrome (or Edge) and
// checks every tool's output independently with MuPDF in Node.
// Run: npm test
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as mupdf from "mupdf";
import { chromium } from "playwright-core";
import { serve } from "../scripts/serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, "tests", "samples");

/* ------------------------------------------------------------ fixtures (Node) */

function pdfWithImages(specs) {
  // specs: [{ px, rect: [x0, y0, x1, y1] }] gray squares → known effective DPI
  const doc = new mupdf.PDFDocument();
  const res = { XObject: {} };
  let content = "";
  specs.forEach(({ px, rect }, i) => {
    const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceGray, [0, 0, px, px], false);
    pix.clear(128);
    res.XObject["Im" + i] = doc.addImage(new mupdf.Image(pix));
    const [x0, y0, x1, y1] = rect;
    content += `q ${x1 - x0} 0 0 ${y1 - y0} ${x0} ${842 - y1} cm /Im${i} Do Q\n`;
  });
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, content));
  return doc.saveToBuffer("compress").asUint8Array().slice();
}

function gradientPdf() {
  // asymmetric colour image (red grows left→right, green top→bottom) at 144 DPI:
  // any flip or mirror during recompression shows up as a large pixel difference
  const W = 600, H = 400;
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, W, H], false);
  const px = pix.getPixels(), stride = pix.getStride();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * stride + x * 3;
      px[o] = (x * 255) / W; px[o + 1] = (y * 255) / H; px[o + 2] = x < 100 && y < 100 ? 255 : 40;
    }
  }
  const doc = new mupdf.PDFDocument();
  const im = doc.addImage(new mupdf.Image(pix));
  doc.insertPage(-1, doc.addPage([0, 0, 400, 300], 0, { XObject: { Im0: im } }, "q 300 0 0 200 50 50 cm /Im0 Do Q"));
  return doc.saveToBuffer("compress").asUint8Array().slice();
}

/** Mean absolute RGB difference between page 1 of two PDFs, rendered small. */
function renderDiff(a, b, cs = mupdf.ColorSpace.DeviceRGB) {
  const draw = (bytes) => {
    const pix = new mupdf.PDFDocument(bytes).loadPage(0).toPixmap(mupdf.Matrix.scale(0.5, 0.5), cs, false);
    return { w: pix.getWidth(), h: pix.getHeight(), px: pix.getPixels().slice() };
  };
  const A = draw(a), B = draw(b);
  if (A.w !== B.w || A.h !== B.h) return Infinity;
  let sum = 0;
  for (let i = 0; i < A.px.length; i++) sum += Math.abs(A.px[i] - B.px[i]);
  return sum / A.px.length;
}

/** Minimal uncompressed RGB TIFF at 300 DPI, red pixel top-left (browsers can't decode TIFF). */
function tiffRGB(w, h) {
  const tags = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 3, "bps"], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, "px"],
    [277, 3, 1, 3], [278, 4, 1, h], [279, 4, 1, w * h * 3], [282, 5, 1, "res"], [283, 5, 1, "res"], [296, 3, 1, 2]];
  const ifdLen = 2 + tags.length * 12 + 4;
  const off = { bps: 8 + ifdLen, res: 8 + ifdLen + 6, px: 8 + ifdLen + 14 };
  const b = Buffer.alloc(off.px + w * h * 3, 255);
  b.write("II", 0); b.writeUInt16LE(42, 2); b.writeUInt32LE(8, 4); b.writeUInt16LE(tags.length, 8);
  tags.forEach(([tag, type, count, val], i) => {
    const e = 10 + i * 12;
    b.writeUInt16LE(tag, e); b.writeUInt16LE(type, e + 2); b.writeUInt32LE(count, e + 4);
    if (typeof val === "string") b.writeUInt32LE(off[val], e + 8);
    else if (type === 3) b.writeUInt16LE(val, e + 8);
    else b.writeUInt32LE(val, e + 8);
  });
  b.writeUInt32LE(0, 10 + tags.length * 12);
  [8, 8, 8].forEach((v, i) => b.writeUInt16LE(v, off.bps + i * 2));
  b.writeUInt32LE(300, off.res); b.writeUInt32LE(1, off.res + 4);
  b[off.px] = 255; b[off.px + 1] = 0; b[off.px + 2] = 0;
  return new Uint8Array(b);
}

/** One page of text lines (Helvetica 12pt), optionally rotated. */
function textPdf(lines, rotate = 0) {
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font("Helvetica"), "Latin");
  const ops = lines.map((t, i) => `BT /F1 12 Tf 50 ${780 - i * 20} Td (${t}) Tj ET`).join("\n");
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], rotate, { Font: { F1: font } }, ops));
  return doc.saveToBuffer("compress").asUint8Array().slice();
}

/** big.pdf with an annotation and metadata, for flatten / metadata tests. */
function annotatedPdf() {
  const doc = new mupdf.PDFDocument(fs.readFileSync(path.join(SAMPLES, "big.pdf")));
  const a = doc.loadPage(0).createAnnotation("Square");
  a.setRect([100, 100, 300, 200]);
  a.setColor([1, 0, 0]);
  a.update();
  doc.setMetaData("info:Title", "Secret plan");
  doc.setMetaData("info:Author", "Ravi Kumar");
  return doc.saveToBuffer("compress").asUint8Array().slice();
}

/** A PDF whose cross-reference table is destroyed (MuPDF must rebuild it). */
function brokenPdf() {
  const b = Buffer.from(fs.readFileSync(path.join(SAMPLES, "tiny.pdf")));
  const at = b.lastIndexOf("startxref");
  return new Uint8Array(Buffer.concat([b.subarray(0, at), Buffer.from("startxref\n999999\n%%EOF\n")]));
}

/** Bounding box (display space) of every image drawn on a page. */
function imageBoxes(bytes, pageIndex) {
  const doc = new mupdf.PDFDocument(bytes);
  const boxes = [];
  const dev = new mupdf.Device({
    fillImage(image, m) {
      const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]], ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
      boxes.push({ w: image.getWidth(), box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Math.round) });
    },
  });
  const page = doc.loadPage(pageIndex);
  page.run(dev, mupdf.Matrix.identity);
  dev.close();
  return { boxes, bounds: page.getBounds().map(Math.round) };
}

/** Lines of text with their display-space boxes. */
function textLines(bytes, pageIndex) {
  const page = new mupdf.PDFDocument(bytes).loadPage(pageIndex);
  return JSON.parse(page.toStructuredText("preserve-whitespace").asJSON()).blocks
    .flatMap((b) => (b.lines || []).map((l) => ({ text: l.text, x: l.bbox.x, y: l.bbox.y, w: l.bbox.w, h: l.bbox.h })));
}

/** A "scanned" PDF: text lines rendered to a 200 DPI image, with no text layer at all. */
function scannedPdf(lines) {
  const page = new mupdf.PDFDocument(textPdf(lines)).loadPage(0);
  const pix = page.toPixmap(mupdf.Matrix.scale(200 / 72, 200 / 72), mupdf.ColorSpace.DeviceGray, false);
  const doc = new mupdf.PDFDocument();
  const im = doc.addImage(new mupdf.Image(pix));
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, { XObject: { Im0: im } }, "q 595 0 0 842 0 0 cm /Im0 Do Q"));
  return doc.saveToBuffer("compress").asUint8Array().slice();
}

function encryptedPdf() {
  const doc = new mupdf.PDFDocument(fs.readFileSync(path.join(SAMPLES, "tiny.pdf")));
  return doc.saveToBuffer("encrypt=aes-256,user-password=secret,owner-password=secret").asUint8Array().slice();
}

/* ------------------------------------------------------------ inspection (Node) */

function pdfInfo(bytes) {
  const doc = new mupdf.PDFDocument(bytes);
  if (doc.needsPassword()) return { locked: true, doc };
  const pages = doc.countPages();
  const placements = [];
  const dev = new mupdf.Device({
    fillImage(image, ctm) {
      const wpt = Math.hypot(ctm[0], ctm[1]), hpt = Math.hypot(ctm[2], ctm[3]);
      placements.push({
        w: image.getWidth(), h: image.getHeight(), bpc: image.getBitsPerComponent(), n: image.getNumberOfComponents(),
        dpi: Math.round(Math.min(image.getWidth() / (wpt / 72), image.getHeight() / (hpt / 72))),
      });
    },
  });
  const sizes = [];
  for (let i = 0; i < pages; i++) {
    const p = doc.loadPage(i);
    sizes.push(p.getBounds());
    p.run(dev, mupdf.Matrix.identity);
    // must render without throwing
    p.toPixmap(mupdf.Matrix.scale(0.2, 0.2), mupdf.ColorSpace.DeviceRGB, false).destroy();
  }
  dev.close();
  return { locked: false, pages, placements, sizes, doc };
}

function imgInfo(bytes) {
  const im = new mupdf.Image(bytes);
  return { w: im.getWidth(), h: im.getHeight(), xres: im.getXResolution(), n: im.getNumberOfComponents(), bpc: im.getBitsPerComponent() };
}

function jfif(bytes) {
  // [units, xdensity] from a JFIF APP0 right after SOI
  if (bytes[2] !== 0xff || bytes[3] !== 0xe0) return null;
  return [bytes[13], (bytes[14] << 8) | bytes[15]];
}

function unzip(bytes) {
  // list of { name, data } — enough to check our own stored/deflated zips
  const zlib = globalThis.__zlib;
  const out = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  let i = 0;
  while (view.getUint32(i, true) === 0x04034b50) {
    const method = view.getUint16(i + 8, true), size = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true), extra = view.getUint16(i + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const raw = bytes.subarray(i + 30 + nameLen + extra, i + 30 + nameLen + extra + size);
    out.push({ name, data: method === 8 ? new Uint8Array(zlib.inflateRawSync(raw)) : raw });
    i += 30 + nameLen + extra + size;
  }
  return out;
}

/* ------------------------------------------------------------ harness */

const results = [];
let page;

async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push([true, name]);
    console.log(`  PASS  ${name}  (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push([false, name]);
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Run a tool in the page. inputs: sample file names, or { name, bytes } (Node buffers), or { fixture }. */
async function run(tool, inputs, opts = {}) {
  const payload = inputs.map((i) => typeof i === "string" ? { sample: i }
    : i.fixture ? i : { name: i.name, b64: Buffer.from(i.bytes).toString("base64") });
  const r = await page.evaluate(async ({ tool, payload, opts }) => {
    const files = [];
    for (const i of payload) {
      if (i.sample) {
        const res = await fetch("/__samples/" + i.sample);
        files.push(new File([await res.arrayBuffer()], i.sample));
      } else if (i.fixture) {
        files.push(await window.__fixtures[i.fixture]());
      } else {
        files.push(new File([Uint8Array.from(atob(i.b64), (c) => c.charCodeAt(0))], i.name));
      }
    }
    try {
      const r = await window.mystic.run(tool, files, opts);
      let dims = null;
      if (/\.(jpe?g|png|webp)$/i.test(r.name)) {
        const bmp = await createImageBitmap(new Blob([r.bytes]));
        dims = [bmp.width, bmp.height];
        // top-left / top-right pixels, for orientation & background checks
        const cv = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = cv.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
        dims.push(px(0, 0), px(bmp.width - 1, 0));
        bmp.close();
      }
      let s = "";
      for (let k = 0; k < r.bytes.length; k += 0x8000) s += String.fromCharCode(...r.bytes.subarray(k, k + 0x8000));
      return { ok: true, name: r.name, engine: r.engine, orig: r.orig, processed: r.processed, failed: r.failed, dims, b64: btoa(s) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, { tool, payload, opts });
  if (r.ok) {
    r.bytes = new Uint8Array(Buffer.from(r.b64, "base64"));
    delete r.b64;
  }
  return r;
}

async function ok(tool, inputs, opts) {
  const r = await run(tool, inputs, opts);
  if (!r.ok) throw new Error(`${tool} failed: ${r.error}`);
  return r;
}

/* ------------------------------------------------------------ main */

globalThis.__zlib = await import("node:zlib");
const server = await serve({ port: 0, extra: { "/__samples/": SAMPLES } });
const base = `http://127.0.0.1:${server.address().port}`;

let browser;
for (const channel of ["chrome", "msedge"]) {
  try { browser = await chromium.launch({ channel, headless: true }); break; } catch { /* try next */ }
}
if (!browser) throw new Error("Need Google Chrome or Microsoft Edge installed to run the tests");

const problems = [];
page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
page.on("pageerror", (e) => problems.push(e.message));
page.on("worker", (w) => w.on("console", (m) => { if (m.type() === "error") problems.push("[worker] " + m.text()); }));
await page.goto(base + "/");
await page.evaluate(() => window.mystic.ready);

// browser-side fixtures
await page.evaluate(() => {
  const canvasFile = async (w, h, draw, type, name) => {
    const cv = new OffscreenCanvas(w, h);
    draw(cv.getContext("2d"));
    return new File([await cv.convertToBlob({ type, quality: 0.9 })], name);
  };
  window.__fixtures = {
    // transparent background, blue stroke — the classic signature PNG
    sig: () => canvasFile(200, 80, (c) => { c.strokeStyle = "#1030c0"; c.lineWidth = 6; c.beginPath(); c.moveTo(20, 60); c.lineTo(180, 20); c.stroke(); }, "image/png", "sig.png"),
    // stored landscape 400x200 (red left half), EXIF orientation 6 → displays as 200x400 portrait
    phone: async () => {
      const f = await canvasFile(400, 200, (c) => { c.fillStyle = "#e00"; c.fillRect(0, 0, 200, 200); c.fillStyle = "#00e"; c.fillRect(200, 0, 200, 200); }, "image/jpeg", "phone.jpg");
      const b = new Uint8Array(await f.arrayBuffer());
      const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
      const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
      const seg = [0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255, ...exif];
      return new File([b.subarray(0, 2), new Uint8Array(seg), b.subarray(2)], "phone.jpg");
    },
    // 3x2, red pixel top-left — orientation probe
    probe: () => canvasFile(3, 2, (c) => { c.fillStyle = "#fff"; c.fillRect(0, 0, 3, 2); c.fillStyle = "#f00"; c.fillRect(0, 0, 1, 1); }, "image/png", "probe.png"),
    sigpng: () => canvasFile(300, 100, (c) => { c.strokeStyle = "#102a80"; c.lineWidth = 5; c.beginPath(); c.moveTo(10, 80); c.bezierCurveTo(80, 0, 160, 120, 290, 20); c.stroke(); }, "image/png", "sig.png"),
    // EXIF with camera make, orientation 6 and a GPS block: what a phone photo leaks
    geo: async () => {
      const f = await canvasFile(400, 200, (c) => { c.fillStyle = "#e00"; c.fillRect(0, 0, 200, 200); c.fillStyle = "#00e"; c.fillRect(200, 0, 200, 200); }, "image/jpeg", "geo.jpg");
      const b = new Uint8Array(await f.arrayBuffer());
      const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 3,
        0x01, 0x0f, 0, 2, 0, 0, 0, 6, 0, 0, 0, 50,
        0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0,
        0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 56,
        0, 0, 0, 0,
        0x43, 0x61, 0x6e, 0x6f, 0x6e, 0,
        0, 1, 0, 0, 0, 1, 0, 0, 0, 4, 2, 2, 0, 0, 0, 0, 0, 0];
      const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
      const seg = [0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255, ...exif];
      return new File([b.subarray(0, 2), new Uint8Array(seg), b.subarray(2)], "geo.jpg");
    },
    // a dim, grey phone photo of a printed page
    docphoto: () => canvasFile(600, 400, (c) => { c.fillStyle = "#a8a39a"; c.fillRect(0, 0, 600, 400); c.fillStyle = "#3a3734"; c.font = "bold 40px sans-serif"; c.fillText("Document text", 60, 200); }, "image/jpeg", "doc.jpg"),
    bigphoto: () => canvasFile(2400, 1600, (c) => {
      for (let i = 0; i < 4000; i++) { c.fillStyle = `hsl(${i % 360},70%,${30 + (i % 40)}%)`; c.fillRect((i * 37) % 2400, (i * 53) % 1600, 60, 40); }
    }, "image/jpeg", "bigphoto.jpg"),
  };
});

const SIG = { fixture: "sig" }, PHONE = { fixture: "phone" }, PROBE = { fixture: "probe" }, BIGPHOTO = { fixture: "bigphoto" };
const bigPdf = fs.readFileSync(path.join(SAMPLES, "big.pdf"));
const cin = { name: "cin.pdf", bytes: pdfWithImages([{ px: 400, rect: [50, 50, 250, 250] }, { px: 290, rect: [50, 300, 150, 400] }, { px: 200, rect: [50, 450, 150, 550] }]) };
const locked = { name: "locked.pdf", bytes: encryptedPdf() };

console.log(`\nMysticTools browser tests  (${base})\n`);

/* ---------------- PDF */

await test("pdf-compress ebook shrinks big.pdf and keeps 5 renderable pages", async () => {
  const r = await ok("pdf-compress", ["big.pdf"], { quality: "ebook" });
  const info = pdfInfo(r.bytes);
  assert(r.bytes.length < bigPdf.length * 0.6, `only ${r.bytes.length} of ${bigPdf.length}`);
  assert(info.pages === 5, `pages ${info.pages}`);
  assert(info.placements.every((p) => p.dpi <= 152), `dpi ${info.placements.map((p) => p.dpi)}`);
});

await test("pdf-compress keeps images upright and faithful (no flip / colour shift)", async () => {
  const src = { name: "gradient.pdf", bytes: gradientPdf() };
  for (const quality of ["screen", "printer"]) {
    const r = await ok("pdf-compress", [src], { quality });
    const diff = renderDiff(src.bytes, r.bytes);
    assert(diff < 6, `${quality}: mean pixel difference ${diff.toFixed(1)} (${r.engine})`);
  }
  const gray = await ok("pdf-master", [src], { mode: "grayscale", dpi: 150, per_page_kb: 300 });
  const diff = renderDiff(src.bytes, gray.bytes, mupdf.ColorSpace.DeviceGray);
  assert(diff < 6, `master gray: mean pixel difference ${diff.toFixed(1)}`);
});

await test("pdf-compress on a locked PDF returns it unchanged", async () => {
  const r = await ok("pdf-compress", [locked], { quality: "screen" });
  assert(r.engine === "passthrough-locked", r.engine);
  assert(Buffer.compare(Buffer.from(r.bytes), Buffer.from(locked.bytes)) === 0, "bytes changed");
});

await test("pdf-target 400 KB (keep DPI) fits and keeps all pages", async () => {
  const r = await ok("pdf-target", ["big.pdf"], { target_kb: 400, dpi_mode: "preserve" });
  assert(r.bytes.length <= 400 * 1024, `${r.bytes.length} > 400 KB (${r.engine})`);
  assert(pdfInfo(r.bytes).pages === 5, "page count");
});

await test("pdf-target custom 120 DPI caps every image", async () => {
  const r = await ok("pdf-target", ["big.pdf"], { target_kb: 2000, dpi_mode: "force", dpi: 120 });
  const info = pdfInfo(r.bytes);
  assert(r.bytes.length <= 2000 * 1024, `${r.bytes.length}`);
  assert(info.placements.every((p) => p.dpi <= 121), `dpi ${info.placements.map((p) => p.dpi)}`);
});

await test("pdf-target impossible 1 KB returns smallest file, no error", async () => {
  const r = await ok("pdf-target", ["big.pdf"], { target_kb: 1 });
  assert(r.engine === "best-effort", r.engine);
  assert(r.bytes.length < bigPdf.length, "not smaller");
});

await test("pdf-master grayscale: every page exactly 200 DPI, under 300 KB/page", async () => {
  const r = await ok("pdf-master", [cin], { mode: "grayscale", dpi: 200, per_page_kb: 300, target_kb: 0 });
  const info = pdfInfo(r.bytes);
  assert(r.bytes.length <= 300 * 1024, `${r.bytes.length}`);
  assert(info.placements.length === 1 && Math.abs(info.placements[0].dpi - 200) <= 1, `dpi ${info.placements.map((p) => p.dpi)}`);
  assert(info.placements[0].n === 1, "not grayscale");
});

await test("pdf-master grayscale on big.pdf with a 600 KB total cap", async () => {
  const r = await ok("pdf-master", ["big.pdf"], { mode: "grayscale", dpi: 200, target_kb: 600 });
  const info = pdfInfo(r.bytes);
  assert(r.bytes.length <= 600 * 1024, `${r.bytes.length} (${r.engine})`);
  assert(info.pages === 5 && info.placements.every((p) => Math.abs(p.dpi - 200) <= 1), `dpi ${info.placements.map((p) => p.dpi)}`);
});

await test("pdf-master true-bw makes 1-bit pages", async () => {
  const r = await ok("pdf-master", ["big.pdf"], { mode: "true-bw", dpi: 200, per_page_kb: 300 });
  const info = pdfInfo(r.bytes);
  assert(info.placements.every((p) => p.bpc === 1), `bpc ${info.placements.map((p) => p.bpc)}`);
});

await test("pdf-master color fits a 1500 KB cap", async () => {
  const r = await ok("pdf-master", ["big.pdf"], { mode: "color", dpi: 200, target_kb: 1500 });
  assert(r.bytes.length <= 1500 * 1024, `${r.bytes.length} (${r.engine})`);
  assert(pdfInfo(r.bytes).placements.every((p) => p.n === 3), "lost colour");
});

await test("pdf-master batch → zip with summary, locked file passed through", async () => {
  const r = await ok("pdf-master", [cin, locked], { mode: "grayscale", dpi: 200, per_page_kb: 300 });
  const entries = unzip(r.bytes);
  const summary = new TextDecoder().decode(entries.find((e) => e.name === "summary.txt").data);
  assert(entries.length === 3, `entries ${entries.map((e) => e.name)}`);
  assert(/master-encrypted-passthrough/.test(summary), summary);
});

await test("pdf-merge tiny + big", async () => {
  const tinyPages = pdfInfo(fs.readFileSync(path.join(SAMPLES, "tiny.pdf"))).pages;
  const r = await ok("pdf-merge", ["tiny.pdf", "big.pdf"]);
  assert(pdfInfo(r.bytes).pages === tinyPages + 5, "page count");
});

await test("pdf-merge rejects a locked PDF with a clear message", async () => {
  const r = await run("pdf-merge", ["tiny.pdf", locked]);
  assert(!r.ok && /password-protected/.test(r.error), JSON.stringify(r));
});

await test("pdf-split range 2-3 and open-ended 4-", async () => {
  const a = await ok("pdf-split", ["big.pdf"], { mode: "range", page_range: "2-3" });
  const b = await ok("pdf-split", ["big.pdf"], { mode: "range", page_range: "4-" });
  assert(pdfInfo(a.bytes).pages === 2 && pdfInfo(b.bytes).pages === 2, "pages");
});

await test("pdf-split bad range gives a friendly error (was a 500)", async () => {
  const r = await run("pdf-split", ["big.pdf"], { mode: "range", page_range: "1-abc" });
  assert(!r.ok && /isn't a page number/.test(r.error), JSON.stringify(r));
});

await test("pdf-split chunks of 2 → zip of 3", async () => {
  const r = await ok("pdf-split", ["big.pdf"], { mode: "every", every: 2 });
  assert(unzip(r.bytes).length === 3, "chunks");
});

await test("pdf-rotate page 1 by 90", async () => {
  const r = await ok("pdf-rotate", ["big.pdf"], { angle: 90, pages: "1" });
  const { doc } = pdfInfo(r.bytes);
  assert(String(doc.loadPage(0).getObject().getInheritable("Rotate")) === "90", "page 1");
  assert(!doc.loadPage(1).getObject().getInheritable("Rotate").isNumber() || String(doc.loadPage(1).getObject().getInheritable("Rotate")) === "0", "page 2 changed");
});

await test("pdf-to-images 100 DPI → 5 JPEGs tagged 100 DPI", async () => {
  const r = await ok("pdf-to-images", ["big.pdf"], { fmt: "jpg", dpi: 100, quality: 80 });
  const files = unzip(r.bytes);
  assert(files.length === 5, `${files.length}`);
  assert(files.every((f) => jfif(f.data)?.[0] === 1 && jfif(f.data)[1] === 100), "dpi tag");
});

await test("pdf-extract-images copies the JPEG out bit-for-bit", async () => {
  const r = await ok("pdf-extract-images", ["big.pdf"]);
  const files = r.name.endsWith(".zip") ? unzip(r.bytes) : [{ name: r.name, data: r.bytes }];
  assert(files.length >= 1 && files.every((f) => f.data[0] === 0xff && f.data[1] === 0xd8), files.map((f) => f.name).join());
});

await test("pdf-from-images with JPG + PNG + WebP (WebP was a 500)", async () => {
  const r = await ok("pdf-from-images", ["photo.jpg", "logo.png", "photo.webp"], { page_size: "a4", orientation: "portrait", margin_mm: 10 });
  const info = pdfInfo(r.bytes);
  assert(info.pages === 3, `${info.pages}`);
  assert(Math.round(info.sizes[0][2]) === 595, `width ${info.sizes[0]}`);
});

await test("pdf-from-images honours EXIF rotation", async () => {
  const r = await ok("pdf-from-images", [PHONE], { page_size: "auto" });
  const [x0, y0, x1, y1] = pdfInfo(r.bytes).sizes[0];
  assert(y1 - y0 > x1 - x0, `page is landscape ${x1 - x0}x${y1 - y0}`);
});

await test("pdf-encrypt AES-256 → password required, password opens it", async () => {
  const r = await ok("pdf-encrypt", ["tiny.pdf"], { password: "hunter2", method: "aes-256" });
  const doc = new mupdf.PDFDocument(r.bytes);
  assert(doc.needsPassword() && !doc.authenticatePassword("wrong") && doc.authenticatePassword("hunter2"), "encryption");
});

await test("pdf-encrypt rejects commas instead of corrupting the password", async () => {
  const r = await run("pdf-encrypt", ["tiny.pdf"], { password: "a,b", method: "aes-256" });
  assert(!r.ok && /comma/.test(r.error), JSON.stringify(r));
});

await test("pdf-bw grayscale and true-bw", async () => {
  const g = await ok("pdf-bw", ["big.pdf"], { mode: "grayscale", dpi: 150 });
  const b = await ok("pdf-bw", ["big.pdf"], { mode: "true-bw", dpi: 150, threshold: 128 });
  assert(pdfInfo(g.bytes).placements.every((p) => p.n === 1 && Math.abs(p.dpi - 150) <= 1), "gray");
  assert(pdfInfo(b.bytes).placements.every((p) => p.bpc === 1), "bw");
  assert(b.bytes.length < g.bytes.length, "true-bw should be smaller");
});

await test("pdf-extract-images turns a Flate image into a PNG", async () => {
  const r = await ok("pdf-extract-images", [{ name: "gradient.pdf", bytes: gradientPdf() }]);
  const info = imgInfo(r.bytes);
  assert(r.name.endsWith(".png") && info.w === 600 && info.h === 400, `${r.name} ${JSON.stringify(info)}`);
});

await test("pdf-bw keeps a rotated page's landscape shape", async () => {
  const rotated = await ok("pdf-rotate", ["big.pdf"], { angle: 90, pages: "1" });
  const r = await ok("pdf-bw", [{ name: "rot.pdf", bytes: rotated.bytes }], { mode: "grayscale", dpi: 100 });
  const [x0, y0, x1, y1] = pdfInfo(r.bytes).sizes[0];
  assert(x1 - x0 > y1 - y0, `page 1 is ${x1 - x0}x${y1 - y0}`);
});

/** First line of text and the effective rotation of every page. */
function pageSummary(bytes) {
  const doc = new mupdf.PDFDocument(bytes);
  return [...Array(doc.countPages()).keys()].map((i) => {
    const p = doc.loadPage(i);
    const rot = p.getObject().getInheritable("Rotate");
    return { text: p.toStructuredText().asText().trim().split("\n")[0], rot: rot.isNumber() ? rot.asNumber() : 0 };
  });
}

await test("pdf-thumbs streams one thumbnail per page", async () => {
  const r = await page.evaluate(async () => {
    const f = new File([await (await fetch("/__samples/big.pdf")).arrayBuffer()], "big.pdf");
    const got = [];
    const res = await window.mystic.run("pdf-thumbs", [f], { size: 200 }, (p) => p.thumb && got.push([p.page, p.thumb.length, p.thumb[0], p.thumb[1]]));
    return { pages: res.pages, got };
  });
  assert(r.pages === 5 && r.got.length === 5, JSON.stringify(r));
  assert(r.got.every(([page, len, a, b], i) => page === i && len > 500 && a === 0xff && b === 0xd8), "not JPEGs in page order");
});

await test("pdf-organize mixes two PDFs and an image with rotations and duplicates", async () => {
  const plan = [
    { src: 0, page: 2, rotate: 0 },     // big p3
    { src: 1, page: 0, rotate: 90 },    // tiny p1, turned
    { src: 2, page: -1, rotate: 0 },    // the photo as a page
    { src: 0, page: 0, rotate: 0 },     // big p1
    { src: 0, page: 0, rotate: 270 },   // big p1 again, turned the other way
  ];
  const r = await ok("pdf-organize", ["big.pdf", "tiny.pdf", "photo.jpg"], { pages: JSON.stringify(plan), image_page: "a4" });
  const s = pageSummary(r.bytes);
  const info = pdfInfo(r.bytes);
  assert(s.length === 5, `${s.length} pages`);
  assert(/page 3/.test(s[0].text) && /Small page 1/.test(s[1].text) && /page 1/.test(s[3].text) && /page 1/.test(s[4].text), JSON.stringify(s));
  assert(s.map((p) => p.rot).join() === "0,90,0,0,270", `rotations ${s.map((p) => p.rot)}`);
  const [x0, y0, x1, y1] = info.sizes[2];
  assert(x1 - x0 > y1 - y0 && Math.round(x1 - x0) === 842, `photo page should be landscape A4: ${info.sizes[2]}`);
  // 2 of big.pdf's 5 page images + the photo ≈ 5 MB; copying page 1's image twice would push it past 6 MB
  assert(r.bytes.length < bigPdf.length * 0.6, `shared resources copied more than once? ${r.bytes.length}`);
});

await test("pdf-organize rejects a locked source and an empty plan", async () => {
  const a = await run("pdf-organize", ["big.pdf", locked], { pages: JSON.stringify([{ src: 1, page: 0, rotate: 0 }]) });
  const b = await run("pdf-organize", ["big.pdf"], { pages: "[]" });
  assert(!a.ok && /password-protected/.test(a.error), JSON.stringify(a));
  assert(!b.ok && /no pages/.test(b.error), JSON.stringify(b));
});

await test("preview-pdf returns a thumbnail and page count", async () => {
  const r = await page.evaluate(async () => {
    const f = new File([await (await fetch("/__samples/big.pdf")).arrayBuffer()], "big.pdf");
    const p = await window.mystic.run("preview-pdf", [f]);
    return { pages: p.pages, png: p.png?.length };
  });
  assert(r.pages === 5 && r.png > 1000, JSON.stringify(r));
});

/* ---------------- images */

await test("img-compress JPEG q60 keeps DPI", async () => {
  const r = await ok("img-compress", ["photo.jpg"], { fmt: "jpeg", quality: 60 });
  const src = imgInfo(fs.readFileSync(path.join(SAMPLES, "photo.jpg")));
  assert(r.bytes.length < fs.statSync(path.join(SAMPLES, "photo.jpg")).size, "not smaller");
  assert(imgInfo(r.bytes).xres === src.xres, `dpi ${imgInfo(r.bytes).xres} vs ${src.xres}`);
});

await test("img-target 30 KB JPEG / WebP / PNG all fit", async () => {
  for (const fmt of ["jpeg", "webp", "png"]) {
    const r = await ok("img-target", ["photo.jpg"], { target_kb: 30, fmt, dpi_mode: "preserve" });
    assert(r.bytes.length <= 30 * 1024, `${fmt}: ${r.bytes.length} (${r.engine})`);
  }
});

await test("img-target force 300 DPI tags the JPEG", async () => {
  const r = await ok("img-target", ["photo.jpg"], { target_kb: 80, fmt: "jpeg", dpi_mode: "force", dpi: 300 });
  assert(jfif(r.bytes)?.join() === "1,300", `jfif ${jfif(r.bytes)}`);
});

await test("img-target phone photo stays upright (EXIF bug)", async () => {
  const r = await ok("img-target", [PHONE], { target_kb: 50, fmt: "jpeg" });
  assert(r.dims[0] === 200 && r.dims[1] === 400, `dims ${r.dims.slice(0, 2)}`);
});

await test("img-master grayscale 20 KB @ 200 DPI on a big photo", async () => {
  const r = await ok("img-master", [BIGPHOTO], { mode: "grayscale", dpi: 200, target_kb: 20, fmt: "jpeg" });
  const info = imgInfo(r.bytes);
  assert(r.bytes.length <= 20 * 1024, `${r.bytes.length}`);
  assert(info.n === 1, "not a 1-channel JPEG");
  assert(jfif(r.bytes)?.join() === "1,200", `jfif ${jfif(r.bytes)}`);
});

await test("img-master true-bw PNG is 1-bit", async () => {
  const r = await ok("img-master", ["photo.jpg"], { mode: "true-bw", dpi: 200, target_kb: 200, fmt: "png" });
  assert(r.bytes[24] === 1 && r.bytes[25] === 0, `bit depth ${r.bytes[24]} type ${r.bytes[25]}`);
});

await test("img-master batch of 2 → zip with summary", async () => {
  const r = await ok("img-master", ["photo.jpg", "logo.png"], { mode: "color", dpi: 200, target_kb: 40, fmt: "jpeg" });
  assert(r.processed === 2 && unzip(r.bytes).length === 3, `${r.processed} / ${unzip(r.bytes).map((e) => e.name)}`);
});

await test("img-bw transparent signature gets a WHITE background (was black)", async () => {
  const r = await ok("img-bw", [SIG], { mode: "grayscale", fmt: "jpeg" });
  assert(r.dims[2][0] > 240, `corner pixel ${r.dims[2]}`);
  const m = await ok("img-master", [SIG], { mode: "grayscale", fmt: "jpeg", target_kb: 20, dpi: 200 });
  assert(m.dims[2][0] > 240, `master corner pixel ${m.dims[2]}`);
});

await test("img-crop WebP rectangle works (was a 500) and keeps WebP", async () => {
  const r = await ok("img-crop", ["photo.webp"], { x: 0.1, y: 0.1, w: 0.5, h: 0.5, shape: "rect", fill: "transparent" });
  assert(r.name.endsWith(".webp"), r.name);
});

await test("img-crop circle: transparent corners, round", async () => {
  const r = await ok("img-crop", ["photo.jpg"], { x: 0.2, y: 0.1, w: 0.3, h: 0.3 * 1920 / 1080, shape: "circle", fill: "transparent" });
  assert(r.name.endsWith(".png") && r.dims[2][3] === 0, `corner ${r.dims[2]}`);
  assert(Math.abs(r.dims[0] - r.dims[1]) <= 1, `not square ${r.dims}`);
});

await test("img-resize 50% keeps the DPI tag (was dropped)", async () => {
  const src = await ok("img-dpi", ["photo.jpg"], { dpi: 300, mode: "metadata" });
  const r = await ok("img-resize", [{ name: "p300.jpg", bytes: src.bytes }], { mode: "percent", value: 50 });
  assert(r.dims[0] === 960, `dims ${r.dims}`);
  assert(jfif(r.bytes)?.join() === "1,300", `jfif ${jfif(r.bytes)}`);
});

await test("img-dpi metadata is lossless (only the header changes)", async () => {
  const orig = fs.readFileSync(path.join(SAMPLES, "photo.jpg"));
  const r = await ok("img-dpi", ["photo.jpg"], { dpi: 300, mode: "metadata" });
  assert(r.bytes.length === orig.length || r.bytes.length === orig.length + 18, `size ${r.bytes.length} vs ${orig.length}`);
  assert(jfif(r.bytes)?.join() === "1,300", `jfif ${jfif(r.bytes)}`);
  const tail = (b) => Buffer.from(b.subarray(b.length - 50000));
  assert(Buffer.compare(tail(r.bytes), tail(orig)) === 0, "image data changed");
});

await test("img-dpi on PNG writes pHYs", async () => {
  const r = await ok("img-dpi", ["logo.png"], { dpi: 300, mode: "metadata" });
  assert(Math.round(imgInfo(r.bytes).xres) === 300, `${imgInfo(r.bytes).xres}`);
});

await test("img-convert WebP → PNG (lossless) and → JPEG", async () => {
  const p = await ok("img-convert", ["photo.webp"], { fmt: "png" });
  const j = await ok("img-convert", ["photo.webp"], { fmt: "jpeg", quality: 85 });
  assert(p.name.endsWith(".png") && j.name.endsWith(".jpg"), `${p.name} ${j.name}`);
});

await test("img-rotate 90 is clockwise and exact", async () => {
  const r = await ok("img-rotate", [PROBE], { angle: 90, flip: "none" });
  assert(r.dims[0] === 2 && r.dims[1] === 3, `dims ${r.dims}`);
  assert(r.dims[3][0] === 255 && r.dims[3][1] === 0, `top-right should be red: ${r.dims[3]}`);
});

await test("TIFF input (MuPDF fallback) keeps pixels and its 300 DPI", async () => {
  const r = await ok("img-convert", [{ name: "scan.tif", bytes: tiffRGB(40, 30) }], { fmt: "png" });
  assert(r.dims[0] === 40 && r.dims[1] === 30, `dims ${r.dims}`);
  assert(r.dims[2].join() === "255,0,0,255" && r.dims[3].join() === "255,255,255,255", `pixels ${r.dims[2]} ${r.dims[3]}`);
  assert(Math.round(imgInfo(r.bytes).xres) === 300, `dpi ${imgInfo(r.bytes).xres}`);
});

await test("img-compress PNG with 2 colours → exact 1-bit palette", async () => {
  const r = await ok("img-compress", [PROBE], { fmt: "png", quality: 80 });
  const out = await ok("img-convert", [{ name: "p.png", bytes: r.bytes }], { fmt: "png" });
  assert(out.dims[2].join() === "255,0,0,255" && out.dims[3].join() === "255,255,255,255", `pixels ${out.dims[2]} ${out.dims[3]}`);
});

await test("img-sizecm 3.5 x 2.5 cm @ 200 DPI", async () => {
  const r = await ok("img-sizecm", ["photo.jpg"], { width_cm: 3.5, height_cm: 2.5, dpi: 200, keep_aspect: "false", fmt: "jpeg" });
  assert(r.dims[0] === 276 && r.dims[1] === 197, `dims ${r.dims}`);
  assert(jfif(r.bytes)?.join() === "1,200", `jfif ${jfif(r.bytes)}`);
});

await test("img-sizecm 100 x 100 cm @ 2400 DPI is refused, not a crash", async () => {
  const r = await run("img-sizecm", ["photo.jpg"], { width_cm: 100, height_cm: 100, dpi: 2400, keep_aspect: "false" });
  assert(!r.ok && /megapixels/.test(r.error), JSON.stringify(r));
});

/* ---------------- PDF editing */

const SENSITIVE = { name: "kyc.pdf", bytes: textPdf(["Name: Ravi Kumar  Email: ravi.k@example.co.in", "Aadhaar: 1234 5678 9012   PAN: ABCDE1234F", "Notes: nothing secret here"]) };

await test("pdf-watermark centre + tiled put the text on the chosen pages", async () => {
  const c = await ok("pdf-watermark", ["big.pdf"], { text: "CONFIDENTIAL", size: 60, opacity: 25, angle: 45, layout: "center", pages: "1-2" });
  const s = pageSummary(c.bytes);
  const all = (i) => textLines(c.bytes, i).map((l) => l.text).join(" ");
  assert(/CONFIDENTIAL/.test(all(0)) && /CONFIDENTIAL/.test(all(1)) && !/CONFIDENTIAL/.test(all(2)), "pages 1-2 only");
  assert(s.length === 5, "page count");
  const t = await ok("pdf-watermark", ["big.pdf"], { text: "DRAFT", size: 40, opacity: 20, angle: 30, layout: "tiled" });
  assert(textLines(t.bytes, 0).filter((l) => /DRAFT/.test(l.text)).length >= 6, "tiled should repeat");
});

await test("pdf-numbers: 'Page n of N' bottom-centre, custom start and range", async () => {
  const r = await ok("pdf-numbers", ["big.pdf"], { position: "bc", format: "page-n-of-total", size: 11, margin_mm: 10 });
  const line = textLines(r.bytes, 4).find((l) => /Page 5 of 5/.test(l.text));
  assert(line, "page 5 label missing");
  assert(Math.abs(line.x + line.w / 2 - 297.6) < 4 && line.y > 780, `label at ${JSON.stringify(line)}`);
  const s = await ok("pdf-numbers", ["big.pdf"], { position: "tr", format: "n", start: 3, pages: "2-" });
  assert(!textLines(s.bytes, 0).some((l) => /^3$/.test(l.text.trim())) && textLines(s.bytes, 1).some((l) => l.text.trim() === "3"), "start/range");
});

await test("pdf-sign places the signature at the same spot on upright and rotated pages", async () => {
  for (const rotate of [0, 90]) {
    const src = { name: `r${rotate}.pdf`, bytes: textPdf(["Sign below"], rotate) };
    const r = await ok("pdf-sign", [src, { fixture: "sigpng" }], { x: 0.6, y: 0.8, w: 0.3, h: 0.1, pages: "last" });
    const { boxes, bounds } = imageBoxes(r.bytes, 0);
    const [W, H] = [bounds[2], bounds[3]];
    const want = [0.6 * W, 0.8 * H, 0.9 * W, 0.9 * H].map(Math.round);
    assert(boxes.length === 1 && boxes[0].box.every((v, i) => Math.abs(v - want[i]) <= 2), `rotate ${rotate}: ${JSON.stringify(boxes)} want ${want}`);
  }
});

await test("pdf-redact really removes terms and ID patterns from the text layer", async () => {
  const r = await ok("pdf-redact", [SENSITIVE], { terms: "ravi kumar", email: "true", aadhaar: "true", pan: "true" });
  const text = textLines(r.bytes, 0).map((l) => l.text).join(" ");
  assert(!/Ravi|example|1234 5678|ABCDE1234F/i.test(text), `still visible: ${text}`);
  assert(/nothing secret here/.test(text), "unrelated text was removed");
  assert(/4 matches/.test(r.engine), r.engine);
  const none = await ok("pdf-redact", [SENSITIVE], { terms: "zebra" });
  assert(none.engine === "no-matches", none.engine);
});

await test("pdf-crop trims every page to the drawn box (rotated pages too)", async () => {
  const a = await ok("pdf-crop", ["big.pdf"], { x: 0.1, y: 0.1, w: 0.5, h: 0.4 });
  const info = pdfInfo(a.bytes);
  assert(info.sizes.every(([x0, y0, x1, y1]) => Math.abs(x1 - x0 - 297.6) < 1 && Math.abs(y1 - y0 - 336.8) < 1), JSON.stringify(info.sizes[0]));
  const rot = { name: "rot.pdf", bytes: textPdf(["x"], 90) };
  const b = await ok("pdf-crop", [rot], { x: 0, y: 0, w: 0.5, h: 1 });
  const [x0, y0, x1, y1] = pdfInfo(b.bytes).sizes[0];
  assert(Math.abs(x1 - x0 - 421) < 1 && Math.abs(y1 - y0 - 595) < 1, `rotated crop ${x1 - x0}x${y1 - y0}`);
});

await test("pdf-unlock: wrong password refused, right one removes protection", async () => {
  const bad = await run("pdf-unlock", [locked], { password: "nope" });
  assert(!bad.ok && /wrong/.test(bad.error), JSON.stringify(bad));
  const good = await ok("pdf-unlock", [locked], { password: "secret" });
  assert(!new mupdf.PDFDocument(good.bytes).needsPassword(), "still locked");
  const plain = await run("pdf-unlock", ["tiny.pdf"], { password: "x" });
  assert(!plain.ok && /isn't password-protected/.test(plain.error), JSON.stringify(plain));
});

await test("pdf-repair rebuilds a PDF with a broken cross-reference table", async () => {
  const r = await ok("pdf-repair", [{ name: "broken.pdf", bytes: brokenPdf() }]);
  assert(r.engine === "damage-repaired" && pdfInfo(r.bytes).pages === 2, r.engine);
});

await test("pdf-flatten bakes annotations into the page", async () => {
  const src = annotatedPdf();
  assert(new mupdf.PDFDocument(src).loadPage(0).getAnnotations().length === 1, "fixture");
  const r = await ok("pdf-flatten", [{ name: "a.pdf", bytes: src }]);
  assert(new mupdf.PDFDocument(r.bytes).loadPage(0).getAnnotations().length === 0, "annotation still live");
  assert(renderDiff(src, r.bytes) < 3, "appearance changed");
});

await test("pdf-metadata removes or edits document properties", async () => {
  const src = { name: "a.pdf", bytes: annotatedPdf() };
  const info = await page.evaluate(async (b64) => {
    const f = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "a.pdf");
    return window.mystic.run("pdf-info", [f]);
  }, Buffer.from(src.bytes).toString("base64"));
  assert(info.meta.title === "Secret plan" && info.meta.author === "Ravi Kumar", JSON.stringify(info));
  const clean = new mupdf.PDFDocument((await ok("pdf-metadata", [src], { mode: "remove" })).bytes);
  assert(!clean.getMetaData("info:Title") && !clean.getMetaData("info:Author"), "metadata left");
  const edited = new mupdf.PDFDocument((await ok("pdf-metadata", [src], { mode: "edit", title: "Form 16", author: "" })).bytes);
  assert(edited.getMetaData("info:Title") === "Form 16" && !edited.getMetaData("info:Author"), "edit");
});

await test("pdf-to-text and pdf-to-word export the text; scans get a clear message", async () => {
  const t = await ok("pdf-to-text", ["big.pdf"]);
  assert(/sample document - page 3/.test(new TextDecoder().decode(t.bytes)), "txt");
  const w = await ok("pdf-to-word", ["big.pdf"]);
  const parts = Object.fromEntries(unzip(w.bytes).map((e) => [e.name, new TextDecoder().decode(e.data)]));
  assert(parts["[Content_Types].xml"] && /sample document - page 5/.test(parts["word/document.xml"]) && /w:br w:type="page"/.test(parts["word/document.xml"]), Object.keys(parts).join());
  const scan = await run("pdf-to-word", [cin]);
  assert(!scan.ok && /scanned/.test(scan.error), JSON.stringify(scan));
});

/* ---------------- image editing */

await test("img-watermark changes pixels, keeps size and DPI", async () => {
  const src = await ok("img-dpi", ["photo.jpg"], { dpi: 300, mode: "metadata" });
  const r = await ok("img-watermark", [{ name: "p.jpg", bytes: src.bytes }], { text: "SAMPLE", layout: "tiled", size: 8, opacity: 40, angle: -30, color: "#ffffff" });
  assert(r.dims[0] === 1920 && r.dims[1] === 1080 && jfif(r.bytes)?.join() === "1,300", `${r.dims} ${jfif(r.bytes)}`);
  assert(r.bytes.length !== src.bytes.length, "unchanged?");
});

await test("img-strip removes GPS/camera data losslessly and keeps the photo upright", async () => {
  const r = await ok("img-strip", [{ fixture: "geo" }]);
  assert(/GPS location/.test(r.engine) && /camera details/.test(r.engine), r.engine);
  const bytes = Buffer.from(r.bytes);
  assert(!bytes.includes(Buffer.from("Canon")), "camera make survived");
  assert(r.dims[0] === 200 && r.dims[1] === 400, `orientation lost: ${r.dims}`);
  const png = await ok("img-strip", ["logo.png"]);
  assert(png.engine === "no-metadata-found" || /notes|EXIF|date/.test(png.engine), png.engine);
});

await test("img-hide blacks out exactly the drawn box", async () => {
  const r = await ok("img-hide", ["photo.jpg"], { regions: JSON.stringify([{ x: 0, y: 0, w: 0.25, h: 0.25 }]), mode: "black" });
  assert(r.dims[2].slice(0, 3).every((v) => v < 20), `top-left ${r.dims[2]}`);
  assert(r.dims[3].slice(0, 3).some((v) => v > 40), `top-right should be untouched ${r.dims[3]}`);
  const none = await run("img-hide", ["photo.jpg"], { regions: "[]" });
  assert(!none.ok && /Draw at least one box/.test(none.error), JSON.stringify(none));
});

await test("img-adjust document mode turns a grey paper photo white", async () => {
  const r = await ok("img-adjust", [{ fixture: "docphoto" }], { mode: "document", grayscale: "true" });
  assert(r.dims[2][0] > 245 && r.dims[2][1] > 245, `paper ${r.dims[2]}`);
});

/* ---------------- HEIC, OCR layer, editing engine */

await test("HEIC photos decode everywhere (convert, preview, Images → PDF)", async () => {
  const r = await ok("img-convert", ["photo.heic"], { fmt: "jpeg", quality: 90 });
  assert(r.name.endsWith(".jpg") && r.dims[0] === 640 && r.dims[1] === 480, `${r.name} ${r.dims}`);
  assert(r.dims[2][0] > 180 && r.dims[2][2] < 90 && r.dims[3][2] > 150, `colours ${r.dims[2]} / ${r.dims[3]}`);
  const t = await ok("img-target", ["photo.heic"], { target_kb: 20, fmt: "jpeg" });
  assert(t.bytes.length <= 20 * 1024, `${t.bytes.length}`);
  const p = await ok("pdf-from-images", ["photo.heic"], { page_size: "a4" });
  assert(pdfInfo(p.bytes).placements.some((x) => x.w === 640), "heic page");
});

await test("pdf-text returns styled runs with font, size and colour", async () => {
  const r = await page.evaluate(async (b64) => {
    const f = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "kyc.pdf");
    return window.mystic.run("pdf-text", [f], { page: 0 });
  }, Buffer.from(SENSITIVE.bytes).toString("base64"));
  const run = r.runs.find((x) => /nothing secret/.test(x.text));
  assert(run && /Helvetica/.test(run.font.name) && Math.abs(run.size * r.h - 12) < 0.5 && run.color === "#000000", JSON.stringify(run));
});

await test("pdf-edit: replace text in its own font, plus shapes, highlight, image, new text", async () => {
  const runs = await page.evaluate(async (b64) => {
    const f = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "kyc.pdf");
    return (await window.mystic.run("pdf-text", [f], { page: 0 })).runs;
  }, Buffer.from(SENSITIVE.bytes).toString("base64"));
  const target = runs.find((x) => /nothing secret/.test(x.text));
  const edits = [
    { page: 0, type: "replace", x: target.x, y: target.y, w: target.w, h: target.h, left: target.left, baseline: target.baseline, text: "Notes: updated value" },
    { page: 0, type: "text", x: 0.1, y: 0.3, text: "Added line one\nAdded line two", size: 0.02, color: "#1b3a8f", font: "serif", bold: true },
    { page: 0, type: "rect", x: 0.1, y: 0.4, w: 0.3, h: 0.1, stroke: "#d14a5a", width: 0.003 },
    { page: 0, type: "ellipse", x: 0.5, y: 0.4, w: 0.3, h: 0.1, fill: "#2a6b8c" },
    { page: 0, type: "arrow", x1: 0.1, y1: 0.6, x2: 0.4, y2: 0.65, stroke: "#d14a5a", width: 0.004 },
    { page: 0, type: "pen", points: [[0.5, 0.6], [0.55, 0.62], [0.6, 0.6]], stroke: "#000000", width: 0.003 },
    { page: 0, type: "highlight", x: 0.08, y: 0.06, w: 0.4, h: 0.03 },
    { page: 0, type: "whiteout", x: 0.7, y: 0.9, w: 0.2, h: 0.05 },
    { page: 0, type: "image", x: 0.6, y: 0.75, w: 0.3, h: 0.1, image: 0 },
  ];
  const r = await ok("pdf-edit", [SENSITIVE, { fixture: "sigpng" }], { edits: JSON.stringify(edits) });
  const lines = textLines(r.bytes, 0);
  const all = lines.map((l) => l.text).join(" | ");
  assert(/Notes: updated value/.test(all) && !/nothing secret/.test(all), all);
  assert(/Added line one/.test(all) && /Added line two/.test(all), all);
  const replaced = lines.find((l) => /updated value/.test(l.text));
  assert(Math.abs(replaced.y - target.y * 842) < 3, `moved: ${replaced.y} vs ${target.y * 842}`);
  assert(/Ravi Kumar/.test(all), "neighbouring line was damaged");
  assert(imageBoxes(r.bytes, 0).boxes.length === 1, "image");
});

await test("pdf-textlayer makes a scan searchable in English and Hindi without changing its look", async () => {
  const layer = [{ page: 0, lines: [[{ text: "Hello", x: 0.1, y: 0.1, w: 0.12, h: 0.025 }, { text: "world", x: 0.24, y: 0.1, w: 0.12, h: 0.025 }], [{ text: "नमस्ते", x: 0.1, y: 0.2, w: 0.15, h: 0.03 }]] }];
  const r = await ok("pdf-textlayer", [cin], { pages: JSON.stringify(layer) });
  const text = new mupdf.PDFDocument(r.bytes).loadPage(0).toStructuredText("").asText();
  assert(/Hello world/.test(text) && /नमस्ते/.test(text), JSON.stringify(text));
  assert(renderDiff(cin.bytes, r.bytes) < 0.5, "visible change");
  const hits = new mupdf.PDFDocument(r.bytes).loadPage(0).search("world");
  assert(hits.length === 1, "not searchable");
});

await test("img-save-edit keeps the original format and DPI", async () => {
  const src = await ok("img-dpi", ["photo.jpg"], { dpi: 300, mode: "metadata" });
  const r = await ok("img-save-edit", [{ name: "p.jpg", bytes: src.bytes }, "logo.png"], {});
  assert(r.name.endsWith(".jpg") && jfif(r.bytes)?.join() === "1,300", `${r.name} ${jfif(r.bytes)}`);
});

/* ---------------- UI */

await test("UI: crop box drags, handles resize, circle switch works", async () => {
  await page.click("#nav-image");
  await page.click("#grid .card:has-text('Crop Image')");
  await page.setInputFiles("#fileInput", path.join(SAMPLES, "photo.jpg"));
  await page.waitForSelector("#cropCanvas");
  await page.waitForFunction(() => state.crop?.img.complete);
  // opening a tool smooth-scrolls to the top and slides the view in: measure only once it is still
  await page.waitForFunction(() => window.scrollY === 0 && document.getAnimations().every((a) => a.playState !== "running"));
  const box = await page.locator("#cropCanvas").boundingBox();
  const before = await page.evaluate(() => ({ ...state.crop.rect, cw: state.crop.cw }));
  const k = box.width / before.cw;
  // drag from the middle of the selection
  const cx = box.x + (before.x + before.w / 2) * k, cy = box.y + (before.y + before.h / 2) * k;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 20, cy - 15, { steps: 4 });
  await page.mouse.up();
  const moved = await page.evaluate(() => ({ ...state.crop.rect }));
  assert(moved.x < before.x && Math.abs(moved.w - before.w) < 0.01, `move: ${JSON.stringify(before)} → ${JSON.stringify(moved)}`);
  // drag the north-west handle inwards: right/bottom edges must stay put
  const hx = box.x + moved.x * k, hy = box.y + moved.y * k;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 30, hy + 20, { steps: 4 });
  await page.mouse.up();
  const resized = await page.evaluate(() => ({ ...state.crop.rect }));
  assert(Math.abs(resized.x + resized.w - (moved.x + moved.w)) < 0.5, `right edge moved: ${JSON.stringify(moved)} → ${JSON.stringify(resized)}`);
  assert(resized.w < moved.w, "did not shrink");
  await page.click("[data-opt='shape'] button[data-v='circle']");
  assert(await page.evaluate(() => state.crop.shape) === "circle", "shape switch");
  await page.click("#processBtn");
  await page.waitForSelector("#downloadBtn:not(.hidden)");
  await page.click("#backBtn");
});

await test("UI: Compress Image end to end → download", async () => {
  await page.click("#grid .card:has-text('Compress Image')");
  await page.setInputFiles("#fileInput", path.join(SAMPLES, "photo.jpg"));
  await page.click("#processBtn");
  await page.waitForSelector("#downloadBtn:not(.hidden)");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
  const saved = fs.readFileSync(await dl.path());
  assert(dl.suggestedFilename() === "photo.jpg" && saved.length > 1000, `${dl.suggestedFilename()} ${saved.length}`);
  assert((await page.textContent("#statPct")).includes("%"), "stats bar");
  await page.click("#backBtn");
});

await test("UI: PDF preview renders the first page", async () => {
  await page.click("#nav-pdf");
  await page.click("#grid .card:has-text('Split PDF')");
  await page.setInputFiles("#fileInput", path.join(SAMPLES, "big.pdf"));
  await page.waitForSelector(".preview-fig figcaption:has-text('5 pages')");
  await page.click("#backBtn");
});

await test("UI: Organize & Merge — drag, rotate, duplicate, remove, build", async () => {
  await page.click("#nav-pdf");
  await page.click("#grid .card:has-text('Organize & Merge')");
  await page.setInputFiles("#fileInput", [path.join(SAMPLES, "big.pdf"), path.join(SAMPLES, "photo.jpg")]);
  await page.waitForFunction(() => document.querySelectorAll(".page-card").length === 6 && !$("#processBtn").disabled);
  await page.waitForFunction(() => window.scrollY === 0 && document.getAnimations().every((a) => a.playState !== "running"));
  const tags = () => page.$$eval(".page-card .page-tag", (n) => n.map((x) => x.textContent));
  assert((await tags()).join() === "A1,A2,A3,A4,A5,B · image", `initial ${await tags()}`);

  // drag the photo (last) onto the first page's left half — with the board in view, as a user would
  const cards = page.locator(".page-card");
  await page.evaluate(() => document.querySelector(".board").scrollIntoView({ block: "center" }));
  const from = await cards.nth(5).boundingBox(), to = await cards.nth(0).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 12, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  assert((await tags()).join() === "B · image,A1,A2,A3,A4,A5", `after drag ${await tags()}`);
  assert((await page.$$eval(".page-num", (n) => n.map((x) => x.textContent))).join() === "1,2,3,4,5,6", "numbering");

  // rotate A1 right, remove A2, duplicate A3 — via the hover actions
  await cards.nth(1).hover();
  await cards.nth(1).locator("[data-act='rotr']").click();
  await cards.nth(2).hover();
  await cards.nth(2).locator("[data-act='del']").click();
  await cards.nth(2).hover();
  await cards.nth(2).locator("[data-act='dup']").click();
  assert((await tags()).join() === "B · image,A1,A3,A3,A4,A5", `after edits ${await tags()}`);

  await page.click("#processBtn");
  await page.waitForSelector("#downloadBtn:not(.hidden)");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
  const out = fs.readFileSync(await dl.path());
  const s = pageSummary(out);
  assert(s.length === 6, `${s.length} pages`);
  assert(pdfInfo(out).placements.some((p) => p.w === 1920), "photo page missing");
  assert(/page 1/.test(s[1].text) && s[1].rot === 90 && /page 3/.test(s[2].text) && /page 3/.test(s[3].text), JSON.stringify(s));
  assert(await page.locator(".page-card").count() === 6, "board should stay after building");
  await page.click("#backBtn");
});

await test("UI: Sign PDF — draw, place, sign", async () => {
  await page.click("#nav-pdf");
  await page.click("#grid .card:has-text('Sign PDF')");
  await page.setInputFiles("#fileInput", path.join(SAMPLES, "big.pdf"));
  await page.waitForSelector(".sign-img[src^='blob:']");
  // draw a squiggle on the pad
  const pad = await page.locator(".sig-pad").boundingBox();
  await page.mouse.move(pad.x + 30, pad.y + pad.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(pad.x + 30 + i * 30, pad.y + pad.height * (0.6 + 0.15 * Math.sin(i)), { steps: 2 });
  await page.mouse.up();
  await page.waitForSelector(".sig-box:not(.hidden)");
  await page.waitForFunction(() => !document.querySelector("#processBtn").disabled);
  // go to page 2 and drag the signature towards the top-left
  await page.click(".pager [data-go='1']");
  await page.waitForFunction(() => /Page 2 of 5/.test(document.querySelector(".pager-label").textContent));
  const box = await page.locator(".sig-box").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y - 200, { steps: 6 });
  await page.mouse.up();
  const rect = await page.evaluate(() => ({ ...state.sign.rect }));
  await page.click("#processBtn");
  await page.waitForSelector("#downloadBtn:not(.hidden)");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
  const out = fs.readFileSync(await dl.path());
  const p1 = imageBoxes(out, 1), p0 = imageBoxes(out, 0);
  const sig = p1.boxes.filter((b) => b.w !== 1600);
  const [W, H] = [p1.bounds[2], p1.bounds[3]];
  assert(sig.length === 1 && p0.boxes.every((b) => b.w === 1600), `signature on wrong page: ${JSON.stringify([p0.boxes, p1.boxes])}`);
  assert(Math.abs(sig[0].box[0] - rect.x * W) < 3 && Math.abs(sig[0].box[1] - rect.y * H) < 3, `placed ${sig[0].box} vs ${JSON.stringify(rect)}`);
  await page.click("#backBtn");
});

await test("UI: Blur & Hide — draw a box, black it out", async () => {
  await page.click("#nav-image");
  await page.click("#grid .card:has-text('Blur & Hide')");
  await page.setInputFiles("#fileInput", path.join(SAMPLES, "photo.jpg"));
  await page.waitForFunction(() => state.regions?.img.complete);
  await page.waitForFunction(() => window.scrollY === 0 && document.getAnimations().every((a) => a.playState !== "running"));
  const cv = await page.locator("#cropCanvas").boundingBox();
  await page.mouse.move(cv.x + 2, cv.y + 2);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width / 3, cv.y + cv.height / 3, { steps: 5 });
  await page.mouse.up();
  assert(await page.evaluate(() => state.regions.value().length) === 1, "box not drawn");
  await page.click("[data-opt='mode'] button[data-v='black']");
  await page.click("#processBtn");
  await page.waitForSelector("#downloadBtn:not(.hidden)");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
  const im = imgInfo(fs.readFileSync(await dl.path()));
  assert(im.w === 1920 && im.h === 1080, `${im.w}x${im.h}`);
  await page.click("#backBtn");
});

await test("UI: PDF Metadata shows what the file contains", async () => {
  await page.click("#nav-pdf");
  await page.click("#grid .card:has-text('PDF Metadata')");
  const tmp = path.join(ROOT, "tests", "tmp_meta.pdf");
  fs.writeFileSync(tmp, annotatedPdf());
  try {
    await page.setInputFiles("#fileInput", tmp);
    await page.waitForFunction(() => /Secret plan/.test(document.querySelector("#metaFound")?.textContent || ""));
    await page.click("[data-opt='mode'] button[data-v='edit']");
    assert(await page.inputValue("[data-opt='title']") === "Secret plan", "title not prefilled");
  } finally {
    fs.unlinkSync(tmp);
  }
  await page.click("#backBtn");
});

await test("UI: Edit PDF — click existing text, retype it, add a box, save", async () => {
  const tmp = path.join(ROOT, "tests", "tmp_edit.pdf");
  fs.writeFileSync(tmp, SENSITIVE.bytes);
  try {
    await page.goto(base + "/#/tool/pdf-edit");
    await page.evaluate(() => window.mystic.ready);
    await page.setInputFiles("#fileInput", tmp);
    await page.waitForFunction(() => state.markup?.W > 0);
    await page.click(".tool-btn[data-tool='edittext']");
    await page.waitForFunction(() => (state.markup.runs.get(0) || []).some((r) => /nothing secret/.test(r.text)));
    const run = await page.evaluate(() => state.markup.runs.get(0).find((r) => /nothing secret/.test(r.text)));
    // bring the target line to the middle of the screen (clear of the sticky toolbar)
    await page.evaluate((y) => {
      const r = document.querySelector(".sheet-overlay").getBoundingClientRect();
      window.scrollBy(0, r.top + y * r.height - innerHeight / 2);
    }, run.y + run.h / 2);
    const sheet = await page.locator(".sheet-overlay").boundingBox();
    await page.mouse.click(sheet.x + (run.x + run.w / 2) * sheet.width, sheet.y + (run.y + run.h / 2) * sheet.height);
    await page.waitForSelector(".inline-edit:not(.hidden)");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Notes: edited in the browser");
    await page.keyboard.press("Control+Enter");
    // draw a rectangle
    await page.click(".tool-btn[data-tool='rect']");
    await page.mouse.move(sheet.x + sheet.width * 0.2, sheet.y + sheet.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(sheet.x + sheet.width * 0.5, sheet.y + sheet.height * 0.6, { steps: 4 });
    await page.mouse.up();
    assert(await page.evaluate(() => state.markup.count()) === 2, "edits");
    await page.waitForFunction(() => !document.querySelector("#processBtn").disabled);
    await page.click("#processBtn");
    await page.waitForSelector("#downloadBtn:not(.hidden)");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
    const all = textLines(fs.readFileSync(await dl.path()), 0).map((l) => l.text).join(" | ");
    assert(/edited in the browser/.test(all) && !/nothing secret/.test(all) && /Ravi Kumar/.test(all), all);
  } finally {
    fs.unlinkSync(tmp);
  }
  await page.click("#backBtn");
});

await test("UI: Edit Image — OCR finds a line, retype it in a matched font, OCR confirms", async () => {
  await page.goto(base + "/#/tool/img-edit");
  await page.evaluate(() => window.mystic.ready);
  const png = await page.evaluate(async () => {
    const c = new OffscreenCanvas(1000, 260), g = c.getContext("2d");
    g.fillStyle = "#f4f6f8"; g.fillRect(0, 0, 1000, 260); g.fillStyle = "#1f2933"; g.font = "bold 56px Arial"; g.fillText("Total due 450 INR", 60, 150);
    const b = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const tmp = path.join(ROOT, "tests", "tmp_shot.png");
  fs.writeFileSync(tmp, Buffer.from(png, "base64"));
  try {
    await page.setInputFiles("#fileInput", tmp);
    await page.waitForFunction(() => state.markup?.W > 0);
    await page.click(".tool-btn[data-tool='edittext']");
    await page.waitForFunction(() => (state.markup.runs.get(0) || []).length > 0, null, { timeout: 60000 });
    const run = await page.evaluate(() => state.markup.runs.get(0)[0]);
    assert(/450/.test(run.text) && run.font.bold && Math.abs(parseInt(run.color.slice(1, 3), 16) - 0x1f) < 40, JSON.stringify(run));
    await page.evaluate((y) => {
      const r = document.querySelector(".sheet-overlay").getBoundingClientRect();
      window.scrollBy(0, r.top + y * r.height - innerHeight / 2);
    }, run.y + run.h / 2);
    const sheet = await page.locator(".sheet-overlay").boundingBox();
    await page.mouse.click(sheet.x + (run.x + run.w / 2) * sheet.width, sheet.y + (run.y + run.h / 2) * sheet.height);
    await page.waitForSelector(".inline-edit:not(.hidden)");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Total due 999 INR");
    await page.keyboard.press("Control+Enter");
    await page.click("#processBtn");
    await page.waitForSelector("#downloadBtn:not(.hidden)");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
    const edited = fs.readFileSync(await dl.path());
    const text = await page.evaluate(async (b64) => {
      const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/png" });
      return (await ocr.recognize(blob, "eng")).text;
    }, edited.toString("base64"));
    assert(/999/.test(text) && !/450/.test(text), JSON.stringify(text));
  } finally {
    fs.unlinkSync(tmp);
  }
});

await test("UI: HEIC photos get a preview", async () => {
  await page.goto(base + "/#/tool/img-convert");
  await page.evaluate(() => window.mystic.ready);
  await page.setInputFiles("#fileInput", path.join(SAMPLES, "photo.heic"));
  await page.waitForSelector(".preview-fig img[src^='blob:']");
});

await test("UI: OCR PDF makes a scanned page searchable (real Tesseract run)", async () => {
  const tmp = path.join(ROOT, "tests", "tmp_scan.pdf");
  fs.writeFileSync(tmp, scannedPdf(["Invoice number 4821", "Delivered to Ravi Kumar in Pune"]));
  try {
    await page.goto(base + "/#/tool/pdf-ocr");
    await page.evaluate(() => window.mystic.ready);
    await page.setInputFiles("#fileInput", tmp);
    await page.click("#processBtn");
    await page.waitForSelector("#downloadBtn:not(.hidden)", { timeout: 90000 });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
    const doc = new mupdf.PDFDocument(fs.readFileSync(await dl.path()));
    const text = doc.loadPage(0).toStructuredText("").asText();
    assert(/Invoice/.test(text) && /4821/.test(text) && /Pune/.test(text), JSON.stringify(text));
    assert(doc.loadPage(0).search("Ravi Kumar").length === 1, "not searchable");
  } finally {
    fs.unlinkSync(tmp);
  }
});

await test("UI: Image → Text reads a photo of text and offers Copy", async () => {
  await page.goto(base + "/#/tool/img-ocr");
  await page.evaluate(() => window.mystic.ready);
  const png = await page.evaluate(async () => {
    const c = new OffscreenCanvas(900, 220), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 900, 220); g.fillStyle = "#222"; g.font = "52px Arial"; g.fillText("Hello from MysticTools", 40, 130);
    const b = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const tmp = path.join(ROOT, "tests", "tmp_text.png");
  fs.writeFileSync(tmp, Buffer.from(png, "base64"));
  try {
    await page.setInputFiles("#fileInput", tmp);
    await page.click("#processBtn");
    await page.waitForSelector(".text-result pre", { timeout: 60000 });
    const text = await page.textContent(".text-result pre");
    assert(/Hello from MysticTools/i.test(text), JSON.stringify(text));
  } finally {
    fs.unlinkSync(tmp);
  }
});

await test("UI: run the 'Application photo' workflow end to end", async () => {
  await page.goto(base + "/#/workflows/photo");
  await page.evaluate(() => window.mystic.ready);
  await page.waitForSelector(".wf-card.on:has-text('Application photo')");
  await page.setInputFiles(".wf-drop input", path.join(SAMPLES, "photo.jpg"));
  await page.click('[data-wf="run"]');
  await page.waitForSelector('[data-wf="download"]:not(.hidden)', { timeout: 60000 });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-wf="download"]')]);
  const out = fs.readFileSync(await dl.path());
  const info = imgInfo(out);
  assert(out.length <= 20 * 1024 && info.w === 276 && jfif(out)?.join() === "1,200", `${out.length} B, ${info.w}x${info.h}, ${jfif(out)}`);
  assert(await page.locator(".wf-state.ok").count() === 2, "step ticks");
});

await test("UI: legal pages load cleanly and link back", async () => {
  for (const p of ["privacy.html", "terms.html", "licenses.html"]) {
    await page.goto(`${base}/${p}`);
    assert(await page.locator("main.legal h1").count() === 1, p);
    assert(await page.locator("a[href='./']").count() >= 1, `${p} has no way back`);
  }
  await page.goto(base + "/");
  await page.evaluate(() => window.mystic.ready);
});

await test("UI: catalog sections, command palette and theme toggle", async () => {
  await page.click("#nav-pdf");
  const heads = () => page.$$eval(".section-head", (n) => n.map((x) => x.textContent.trim()));
  assert((await heads()).join() === "Compress & optimize,Organize,Edit & sign,Convert,Security & privacy", `pdf ${await heads()}`);
  assert(await page.locator("#grid .card").count() === 24, `pdf tools ${await page.locator("#grid .card").count()}`);
  await page.click("#nav-image");
  assert((await heads()).join() === "Compress & size,Edit & enhance,Convert,Privacy", `image ${await heads()}`);
  // "/" opens the palette; results span both categories; Enter opens the first
  await page.keyboard.press("/");
  await page.keyboard.type("jpg");
  const found = await page.$$eval(".palette-name", (n) => n.map((x) => x.textContent));
  assert(found.includes("Images → PDF") && found.includes("Compress Image"), `search ${found}`);
  await page.fill("#toolSearch", "redact");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#toolName")?.textContent === "Redact PDF");
  // favourite it, then find it in the sidebar
  await page.click("#favBtn");
  assert(await page.locator("#navFavs a:has-text('Redact PDF')").count() === 1, "favourite");
  await page.click("#favBtn");
  await page.click("#backBtn");
  await page.click("#nav-dashboard");
  assert(await page.locator(".recent-list a:has-text('Redact PDF')").count() === 1, "recent");
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click("#themeBtn");
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  await page.evaluate(() => window.mystic.ready);
  const after = await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]);
  assert(after[0] === theme && after[1] !== before, `theme ${theme} → ${after}`);
  await page.click("#themeBtn");   // restore
});

await test("no console errors or security-policy violations", async () => {
  // MuPDF reports recoverable issues (e.g. the deliberately broken PDF) as "warning:" / "format error:" lines
  const real = problems.filter((p) => !/Failed to load resource.*404/.test(p) && !/^(\[worker\] )?(warning|format error): /.test(p));
  assert(!real.length, real.join("\n"));
});

await browser.close();
server.close();
const failed = results.filter(([pass]) => !pass);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed\n`);
process.exit(failed.length ? 1 : 0);
