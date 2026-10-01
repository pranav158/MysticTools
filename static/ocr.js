"use strict";
// OCR in the browser with Tesseract (WebAssembly). The engine and language
// data are self-hosted under vendor/tesseract and only downloaded the first
// time OCR is used; after that the browser caches them.

const ocr = (() => {
  let worker = null, workerLangs = "", loading = null;
  const base = new URL("vendor/tesseract/", location.href).href;

  async function get(langs, onStatus) {
    if (worker && workerLangs === langs) return worker;
    if (loading && workerLangs === langs) return loading;
    if (worker) {
      await worker.terminate();
      worker = null;
    }
    workerLangs = langs;
    loading = (async () => {
      onStatus?.("Loading the OCR engine…");
      const mod = await import("./vendor/tesseract/tesseract.esm.min.js");
      const T = mod.default || mod;
      worker = await T.createWorker(langs.split("+"), 1, {
        workerPath: base + "worker.min.js",
        corePath: base + "core",
        langPath: base + "lang",
        workerBlobURL: false,   // our CSP allows only same-origin worker scripts
        gzip: true,
      });
      return worker;
    })();
    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  /**
   * Recognise text in an image (a Blob or a canvas).
   * Returns { text, lines: [{ text, bbox, words: [{ text, bbox, conf }] }], width, height }
   * with bbox = { x0, y0, x1, y1 } in image pixels.
   */
  async function recognize(image, langs = "eng", onStatus) {
    const w = await get(langs, onStatus);
    onStatus?.("Reading text…");
    const { data } = await w.recognize(image, {}, { text: true, blocks: true });
    const lines = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({
      text: l.text.trim(),
      bbox: l.bbox,
      words: l.words.filter((x) => x.text.trim() && x.confidence > 20).map((x) => ({ text: x.text, bbox: x.bbox, conf: x.confidence })),
    })).filter((l) => l.words.length);
    const dims = await imageSize(image);
    return { text: data.text.trim(), lines, ...dims };
  }

  // Blobs and canvases only: fetching blob: URLs is (rightly) blocked by our CSP
  async function imageSize(image) {
    if (image instanceof HTMLCanvasElement) return { width: image.width, height: image.height };
    if (!(image instanceof Blob)) throw new Error("OCR needs an image file or canvas");
    const bmp = await createImageBitmap(image);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  }

  return { recognize, get };
})();

/* ================================================================ font matching for images */

// Families worth trying on screenshots and documents; whichever renders the
// detected word closest to the original pixels wins.
const MATCH_FONTS = [
  ["Segoe UI", "sans"], ["Arial", "sans"], ["Helvetica", "sans"], ["Roboto", "sans"], ["Verdana", "sans"], ["Tahoma", "sans"],
  ["Calibri", "sans"], ["Figtree", "sans"], ["Times New Roman", "serif"], ["Georgia", "serif"], ["Cambria", "serif"],
  ["Courier New", "mono"], ["Consolas", "mono"],
];

/** Is a font really installed (rather than silently falling back)? */
function fontAvailable(family) {
  const c = document.createElement("canvas").getContext("2d");
  const probe = "mmmmmmmmmlli10WQ";
  return ["monospace", "serif", "sans-serif"].some((fallback) => {
    c.font = `40px ${fallback}`;
    const a = c.measureText(probe).width;
    c.font = `40px "${family}", ${fallback}`;
    return c.measureText(probe).width !== a;
  });
}

/**
 * Estimate how a word/line was drawn in an image: colours, size, weight and the
 * closest installed font, by rendering candidates and comparing ink coverage.
 * src = canvas holding the image; box = { x0, y0, x1, y1 } in its pixels.
 */
function matchTextStyle(src, box, text) {
  const pad = 2;
  const x0 = Math.max(0, Math.floor(box.x0) - pad), y0 = Math.max(0, Math.floor(box.y0) - pad);
  const x1 = Math.min(src.width, Math.ceil(box.x1) + pad), y1 = Math.min(src.height, Math.ceil(box.y1) + pad);
  const w = x1 - x0, h = y1 - y0;
  const px = src.getContext("2d").getImageData(x0, y0, w, h).data;
  // background = the most common colour around the edge; ink = the pixels furthest from it
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y++) edge.push(y * w * 4, (y * w + w - 1) * 4);
  const med = (arr) => arr.sort((a, b) => a - b)[arr.length >> 1];
  const bg = [0, 1, 2].map((c) => med(edge.map((i) => px[i + c])));
  const dist = (i) => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
  let maxD = 0;
  for (let i = 0; i < px.length; i += 4) maxD = Math.max(maxD, dist(i));
  const inkMask = new Uint8Array(w * h);
  const ink = [0, 0, 0];
  let inkN = 0;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    if (dist(i) > maxD * 0.5) {
      inkMask[j] = 1;
      if (dist(i) > maxD * 0.8) { ink[0] += px[i]; ink[1] += px[i + 1]; ink[2] += px[i + 2]; inkN++; }
    }
  }
  const color = inkN ? ink.map((v) => Math.round(v / inkN)) : [0, 0, 0];
  const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

  // try each installed family, normal and bold, sized so the word's width matches
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true });
  let best = { score: -1 };
  for (const [family, kind] of MATCH_FONTS.filter(([f]) => fontAvailable(f))) {
    for (const weight of [400, 700]) {
      g.font = `${weight} 100px "${family}"`;
      const m = g.measureText(text);
      const size = Math.max(4, (100 * (box.x1 - box.x0)) / Math.max(1, m.width));
      g.font = `${weight} ${size}px "${family}"`;
      const mm = g.measureText(text);
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#000";
      // align the drawn ink box with the original's (OCR boxes hug the ink)
      g.fillText(text, box.x0 - x0 - mm.actualBoundingBoxLeft, box.y0 - y0 + mm.actualBoundingBoxAscent);
      const d = g.getImageData(0, 0, w, h).data;
      let both = 0, either = 0;
      for (let j = 0; j < inkMask.length; j++) {
        const a = inkMask[j], b = d[j * 4 + 3] > 100 ? 1 : 0;
        both += a & b;
        either += a | b;
      }
      const score = either ? both / either : 0;
      if (score > best.score) best = { score, family, kind, weight, size, ascent: mm.actualBoundingBoxAscent };
    }
  }
  return {
    family: best.family || "Arial", kind: best.kind || "sans", bold: best.weight === 700,
    size: best.size || (box.y1 - box.y0), ascent: best.ascent ?? (box.y1 - box.y0) * 0.8,
    color: toHex(color), background: toHex(bg), score: best.score,
  };
}
