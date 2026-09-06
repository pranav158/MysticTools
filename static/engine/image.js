// Image tools. Decoding uses the browser (handles EXIF rotation and colour
// profiles); JPEG encoding uses MuPDF (true grayscale + DPI tag); WebP uses the
// canvas encoder; PNG uses our own encoder (palette, 1-bit, DPI).
import * as mupdf from "../vendor/mupdf/mupdf.js";
import { encodePNG, quantize, readJpegInfo, readPngDpi, setJpegDpi, setPngDpi, sniff } from "./codec.js";
import { UserError, batch, bool, int, num, oneOf, out, stem } from "./util.js";

const MAX_PIXELS = 120e6;
const FORMATS = ["jpeg", "jpg", "png", "webp"];
export const extOf = (fmt) => (fmt === "jpeg" || fmt === "jpg" ? "jpg" : fmt);
const normFmt = (fmt) => (fmt === "jpg" ? "jpeg" : fmt);

function checkPixels(w, h) {
  if (w * h > MAX_PIXELS) {
    throw new UserError(`That's ${Math.round((w * h) / 1e6)} megapixels — over the ${MAX_PIXELS / 1e6} MP limit. Use a smaller size or DPI.`);
  }
}

/** Output format that matches the source file (used by "keep format" tools). */
export function sourceFmt(file) {
  const k = sniff(file.bytes);
  // photos from iPhones (HEIC) and AVIF come out as JPEG: every portal accepts it
  return k === "jpeg" || k === "heic" || k === "avif" ? "jpeg" : k === "webp" ? "webp" : "png";
}

/* ------------------------------------------------------------ load */

let heifLib = null;
/** libheif (WebAssembly) is only downloaded the first time a HEIC photo shows up. */
function loadHeif() {
  heifLib ??= (async () => {
    const { default: factory } = await import("../vendor/libheif/libheif-bundle.mjs");
    let lib = factory();
    if (lib?.then) lib = await lib;
    if (lib?.ready?.then) await lib.ready;
    return lib;
  })();
  return heifLib;
}

async function loadHeic(file) {
  const lib = await loadHeif();
  const decoder = new lib.HeifDecoder();
  const images = decoder.decode(file.bytes);
  if (!images?.length) throw new UserError(`${file.name}: unreadable HEIC photo`);
  try {
    const img = images[0];
    const w = img.get_width(), h = img.get_height();
    checkPixels(w, h);
    const data = await new Promise((resolve, reject) => {
      img.display({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }, (d) => (d ? resolve(d.data) : reject(new UserError(`${file.name}: couldn't decode this HEIC photo`))));
    });
    return { kind: "rgba", w, h, data, dpi: null };
  } finally {
    for (const im of images) im.free?.();
    decoder.free?.();
  }
}

/** Decode to an upright RGBA raster: { kind: "rgba", w, h, data, dpi }. */
export async function loadRaster(file) {
  const bytes = file.bytes;
  const kind = sniff(bytes);
  let dpi = null;
  if (kind === "jpeg") dpi = readJpegInfo(bytes).dpi;
  else if (kind === "png") dpi = readPngDpi(bytes);
  let bmp;
  try {
    bmp = await createImageBitmap(new Blob([bytes]), { imageOrientation: "from-image" });
  } catch {
    // Safari decodes HEIC natively; everywhere else libheif takes over
    if (kind === "heic") return loadHeic(file);
    return loadWithMupdf(file, kind);
  }
  try {
    checkPixels(bmp.width, bmp.height);
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = cv.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    return { kind: "rgba", w: cv.width, h: cv.height, data, dpi: dpi ? dpi[0] : null };
  } finally {
    bmp.close();
  }
}

/** Fallback for formats the browser can't decode (TIFF on most browsers). */
function loadWithMupdf(file, kind) {
  let image;
  try {
    image = new mupdf.Image(file.bytes);
  } catch {
    throw new UserError(`${file.name}: unsupported or damaged image`);
  }
  checkPixels(image.getWidth(), image.getHeight());
  const base = image.toPixmap();
  const pix = base.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, true);
  try {
    const w = pix.getWidth(), h = pix.getHeight(), stride = pix.getStride(), n = pix.getNumberOfComponents();
    const src = pix.getPixels().slice();
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = y * stride + x * n, d = (y * w + x) * 4;
        const a = n === 4 ? src[s + 3] : 255;
        const un = a === 0 ? 0 : 255 / a;        // MuPDF pixmaps are premultiplied
        data[d] = n === 4 ? src[s] * un : src[s];
        data[d + 1] = n === 4 ? src[s + 1] * un : src[s + 1];
        data[d + 2] = n === 4 ? src[s + 2] * un : src[s + 2];
        data[d + 3] = a;
      }
    }
    const dpi = kind === "tiff" ? Math.round(image.getXResolution()) || null : null;
    return { kind: "rgba", w, h, data, dpi };
  } finally {
    pix.destroy(); base.destroy(); image.destroy();
  }
}

/* ------------------------------------------------------------ pixel ops */

const hasAlpha = (r) => {
  for (let i = 3; i < r.data.length; i += 4) if (r.data[i] !== 255) return true;
  return false;
};

/** Composite onto white — transparent backgrounds become white, never black. */
function flattenWhite(r) {
  if (!hasAlpha(r)) return r;
  const d = new Uint8ClampedArray(r.data.length);
  const s = r.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3], ia = 255 - a;
    d[i] = (s[i] * a + 255 * ia + 127) / 255;
    d[i + 1] = (s[i + 1] * a + 255 * ia + 127) / 255;
    d[i + 2] = (s[i + 2] * a + 255 * ia + 127) / 255;
    d[i + 3] = 255;
  }
  return { ...r, data: d };
}

/** Luma exactly like Pillow's convert("L"). Input is flattened first. */
function toGray(r) {
  const f = flattenWhite(r).data;
  const g = new Uint8Array(r.w * r.h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (f[i] * 19595 + f[i + 1] * 38470 + f[i + 2] * 7471 + 0x8000) >> 16;
  return { kind: "gray", w: r.w, h: r.h, data: g, dpi: r.dpi };
}

/** Hard black & white: pixels brighter than t become white. */
function toBits(gray, t) {
  const rowLen = (gray.w + 7) >> 3;
  const bits = new Uint8Array(rowLen * gray.h);
  for (let y = 0; y < gray.h; y++) {
    for (let x = 0; x < gray.w; x++) if (gray.data[y * gray.w + x] > t) bits[y * rowLen + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return { kind: "bits", w: gray.w, h: gray.h, data: bits, dpi: gray.dpi };
}

function thresholdGray(gray, t) {
  const d = new Uint8Array(gray.data.length);
  for (let i = 0; i < d.length; i++) d[i] = gray.data[i] > t ? 255 : 0;
  return { ...gray, data: d };
}

function grayToRgba(g) {
  const d = new Uint8ClampedArray(g.w * g.h * 4);
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = g.data[i]; d[j + 3] = 255; }
  return { kind: "rgba", w: g.w, h: g.h, data: d, dpi: g.dpi };
}

export function toCanvas(r) {
  const rgba = r.kind === "gray" ? grayToRgba(r) : r;
  const cv = new OffscreenCanvas(r.w, r.h);
  cv.getContext("2d").putImageData(new ImageData(rgba.data, r.w, r.h), 0, 0);
  return cv;
}

async function resize(r, nw, nh) {
  nw = Math.max(1, Math.round(nw));
  nh = Math.max(1, Math.round(nh));
  checkPixels(nw, nh);
  if (nw === r.w && nh === r.h) return r;
  const bmp = await createImageBitmap(new ImageData(r.data, r.w, r.h), { resizeWidth: nw, resizeHeight: nh, resizeQuality: "high" });
  const cv = new OffscreenCanvas(nw, nh);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // browsers that ignore the resize options hand back the original size
  ctx.drawImage(bmp, 0, 0, nw, nh);
  bmp.close();
  return { ...r, w: nw, h: nh, data: ctx.getImageData(0, 0, nw, nh).data };
}

function crop(r, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) d.set(r.data.subarray(((y0 + y) * r.w + x0) * 4, ((y0 + y) * r.w + x1) * 4), y * w * 4);
  return { ...r, w, h, data: d };
}

/** Rotate clockwise by 0/90/180/270, then flip — exact pixel moves, no resampling. */
function rotateFlip(r, angle, flip) {
  const { w, h } = r;
  const src = new Uint32Array(r.data.buffer, r.data.byteOffset, w * h);
  const turned = angle === 90 || angle === 270;
  const nw = turned ? h : w, nh = turned ? w : h;
  const dst = new Uint32Array(nw * nh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx, ny;
      if (angle === 90) { nx = h - 1 - y; ny = x; }
      else if (angle === 180) { nx = w - 1 - x; ny = h - 1 - y; }
      else if (angle === 270) { nx = y; ny = w - 1 - x; }
      else { nx = x; ny = y; }
      if (flip === "h") nx = nw - 1 - nx;
      else if (flip === "v") ny = nh - 1 - ny;
      dst[ny * nw + nx] = src[y * w + x];
    }
  }
  return { ...r, w: nw, h: nh, data: new Uint8ClampedArray(dst.buffer) };
}

/* ------------------------------------------------------------ encoders */

/** Fill a MuPDF pixmap once so repeated quality probes don't redo the copy. */
function jpegEncoder(img, dpi) {
  const gray = img.kind === "gray";
  const s = gray ? img.data : flattenWhite(img).data;
  const pix = new mupdf.Pixmap(gray ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB, [0, 0, img.w, img.h], false);
  const stride = pix.getStride();
  // a view into WASM memory: fill it before any other MuPDF call can move the heap
  const view = pix.getPixels();
  if (gray) {
    for (let y = 0; y < img.h; y++) view.set(s.subarray(y * img.w, (y + 1) * img.w), y * stride);
  } else {
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * 4, o = y * stride + x * 3;
        view[o] = s[i]; view[o + 1] = s[i + 1]; view[o + 2] = s[i + 2];
      }
    }
  }
  pix.setResolution(dpi || 96, dpi || 96);
  return {
    encode: async (q) => {
      const jpg = pix.asJPEG(q, false);
      return dpi ? jpg : setJpegDpi(jpg, null);
    },
    close: () => pix.destroy(),
  };
}

function webpEncoder(img) {
  const cv = toCanvas(img);
  return {
    encode: async (q) => {
      const blob = await cv.convertToBlob({ type: "image/webp", quality: q / 100 });
      if (blob.type !== "image/webp") throw new UserError("This browser can't create WebP files — choose JPG or PNG");
      return new Uint8Array(await blob.arrayBuffer());
    },
    close: () => {},
  };
}

async function withEncoder(img, fmt, dpi, fn) {
  const enc = fmt === "jpeg" ? jpegEncoder(img, dpi) : webpEncoder(img);
  try {
    return await fn(enc.encode);
  } finally {
    enc.close();
  }
}

const encodeAt = (img, fmt, q, dpi) => withEncoder(img, fmt, dpi, (enc) => enc(q));

/** Encode in fmt; PNG is lossless unless a palette size is given. */
export async function encode(img, fmt, { q = 92, dpi = null, colors = 0 } = {}) {
  if (fmt === "png") {
    if (img.kind === "rgba" && colors) return encodePNG(quantize(img, colors), dpi);
    return encodePNG(img, dpi);
  }
  if (img.kind === "bits") img = bitsToGray(img);
  return encodeAt(img, fmt, q, dpi);
}

function bitsToGray(b) {
  const rowLen = (b.w + 7) >> 3;
  const d = new Uint8Array(b.w * b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) d[y * b.w + x] = b.data[y * rowLen + (x >> 3)] & (0x80 >> (x & 7)) ? 255 : 0;
  return { kind: "gray", w: b.w, h: b.h, data: d, dpi: b.dpi };
}

/* ------------------------------------------------------------ fit to size */

async function bestQuality(enc, target, lo, hi) {
  let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = await enc(mid);
    if (b.length <= target) { best = { q: mid, bytes: b }; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

/**
 * JPEG/WebP under target: lower quality first, shrink pixels only when even
 * quality 5 is too big (DPI tag stays, so print size is preserved).
 * prep() turns the RGBA base into what gets encoded (gray, thresholded...).
 */
async function fitLossy(base, fmt, target, dpi, prep) {
  const attempt = (r) => withEncoder(prep(r), fmt, dpi, async (enc) => {
    const floor = await enc(5);
    if (floor.length > target) return { fit: false, q: 5, bytes: floor };
    return { fit: true, ...((await bestQuality(enc, target, 6, 95)) || { q: 5, bytes: floor }) };
  });
  const first = await attempt(base);
  if (first.fit) return { ...first, scaled: false };
  let smallest = first;
  for (let f = 0.92; f >= 0.15; f *= 0.92) {
    const r = await attempt(await resize(base, Math.max(16, base.w * f), Math.max(16, base.h * f)));
    if (r.fit) return { ...r, scaled: true };
    if (r.bytes.length < smallest.bytes.length) smallest = r;
  }
  return { ...smallest, scaled: true };
}

/** PNG under target: fewer palette colours first (colour), then fewer pixels. */
async function fitPng(base, target, dpi, prep) {
  const color = prep === null;
  if (color) {
    let smallest = null;
    for (const k of [256, 128, 64, 32, 16, 8]) {
      const b = await encodePNG(quantize(base, k), dpi);
      if (b.length <= target) return { fit: true, bytes: b, label: `png-colors-${k}` };
      if (!smallest || b.length < smallest.length) smallest = b;
    }
    for (let f = 0.92; f >= 0.15; f *= 0.92) {
      const r = await resize(base, Math.max(16, base.w * f), Math.max(16, base.h * f));
      const b = await encodePNG(quantize(r, 8), dpi);
      if (b.length <= target) return { fit: true, bytes: b, label: "png-downscaled" };
      if (b.length < smallest.length) smallest = b;
    }
    return { fit: false, bytes: smallest, label: "png-best-effort" };
  }
  const first = await encodePNG(prep(base), dpi);
  if (first.length <= target) return { fit: true, bytes: first, label: "png-original" };
  let smallest = first;
  for (let f = 0.92; f >= 0.15; f *= 0.92) {
    const r = await resize(base, Math.max(16, base.w * f), Math.max(16, base.h * f));
    const b = await encodePNG(prep(r), dpi);
    if (b.length <= target) return { fit: true, bytes: b, label: "png-downscaled" };
    if (b.length < smallest.length) smallest = b;
  }
  return { fit: false, bytes: smallest, label: "png-best-effort" };
}

/* ------------------------------------------------------------ tools */

export async function compress([file], o) {
  const fmt = normFmt(oneOf(o.fmt ?? "jpeg", FORMATS, "fmt"));
  const q = int(o.quality, 80, 1, 100);
  const r = await loadRaster(file);
  let bytes = fmt === "png" ? await encodePNG(quantize(r, 256), r.dpi) : await encodeAt(r, fmt, q, r.dpi);
  let engine = fmt === "png" ? "png-256-colors" : `${fmt}-q${q}`;
  if (sourceFmt(file) === fmt && bytes.length >= file.bytes.length) {
    bytes = file.bytes;
    engine = "no-reduction";
  }
  return out(`${stem(file.name)}.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine });
}

export async function targetSize([file], o) {
  const fmt = normFmt(oneOf(o.fmt ?? "jpeg", FORMATS, "fmt"));
  const mode = oneOf(o.dpi_mode ?? "preserve", ["preserve", "force"], "dpi_mode");
  const kb = int(o.target_kb, 100, 1, 1e6);
  const target = kb * 1024;
  const r = await loadRaster(file);
  const dpi = mode === "force" ? int(o.dpi, 200, 36, 2400) : r.dpi;
  const name = `${stem(file.name)}_to_${kb}kb.${extOf(fmt)}`;
  const orig = file.bytes.length;

  // already small enough in the same format: keep every original pixel
  const src = sniff(file.bytes);
  if (src === fmt && orig <= target + 64) {
    const tagged = mode === "force" && fmt === "jpeg" ? setJpegDpi(file.bytes, dpi)
      : mode === "force" && fmt === "png" ? setPngDpi(file.bytes, dpi) : file.bytes;
    if (tagged.length <= target && (mode === "preserve" || fmt !== "webp")) {
      return out(name, tagged, { orig, engine: "already-fits" });
    }
  }

  if (fmt === "png") {
    const res = await fitPng(r, target, dpi, null);
    if (!res.fit && src === "png" && res.bytes.length >= orig) return out(name, file.bytes, { orig, engine: "no-reduction" });
    return out(name, res.bytes, { orig, engine: res.fit ? res.label : "best-effort" });
  }
  const res = await fitLossy(r, fmt, target, dpi, (x) => x);
  return out(name, res.bytes, { orig, engine: res.fit ? `${fmt}-q${res.q}${res.scaled ? "-downscaled" : ""}` : "best-effort" });
}

export async function master(files, o, progress) {
  const mode = oneOf(o.mode ?? "grayscale", ["grayscale", "true-bw", "color"], "mode");
  const fmt = normFmt(oneOf(o.fmt ?? "jpeg", FORMATS, "fmt"));
  const dpi = int(o.dpi, 200, 36, 2400);
  const t = int(o.threshold, 128, 0, 255);
  const kb = int(o.target_kb, 20, 1, 1e6);
  const target = kb * 1024;

  const one = async (file) => {
    const r = await loadRaster(file);
    const name = `${stem(file.name)}_master_${kb}kb.${extOf(fmt)}`;
    const orig = file.bytes.length;
    const base = mode === "color" ? r : flattenWhite(r);
    if (fmt === "png") {
      const prep = mode === "color" ? null : mode === "grayscale" ? toGray : (x) => toBits(toGray(x), t);
      const res = await fitPng(base, target, dpi, prep);
      return out(name, res.bytes, { orig, engine: `master-${mode}-${res.label}${res.fit ? "" : "-over-max"}` });
    }
    const prep = mode === "color" ? (x) => x : mode === "grayscale" ? toGray : (x) => thresholdGray(toGray(x), t);
    const res = await fitLossy(base, fmt, target, dpi, prep);
    return out(name, res.bytes, {
      orig, engine: `master-${mode}-${fmt}-q${res.q}${res.scaled ? "-downscaled" : ""}${res.fit ? "" : "-over-max"}`,
    });
  };
  return batch(files, one, "master_image_batch.zip",
    `options: mode=${mode} dpi=${dpi} threshold=${t} target_kb=${kb} fmt=${fmt}`, progress);
}

export async function cropTool([file], o) {
  const shape = oneOf(o.shape ?? "rect", ["rect", "circle"], "shape");
  const fill = oneOf(o.fill ?? "transparent", ["transparent", "white", "black"], "fill");
  const r = await loadRaster(file);
  const x = num(o.x, 0, 0, 0.999), y = num(o.y, 0, 0, 0.999);
  const w = num(o.w, 1, 0.01, 1 - x), h = num(o.h, 1, 0.01, 1 - y);
  const x0 = Math.max(0, Math.round(x * r.w)), y0 = Math.max(0, Math.round(y * r.h));
  const x1 = Math.min(r.w, Math.round((x + w) * r.w)), y1 = Math.min(r.h, Math.round((y + h) * r.h));
  if (x1 - x0 < 2 || y1 - y0 < 2) throw new UserError("Crop region is too small");
  let c = crop(r, x0, y0, x1, y1);
  const src = sourceFmt(file);
  let fmt = shape === "rect" ? src : "png";
  if (shape === "circle") {
    const cv = new OffscreenCanvas(c.w, c.h);
    const ctx = cv.getContext("2d");
    if (fill !== "transparent") {
      ctx.fillStyle = fill === "white" ? "#fff" : "#000";
      ctx.fillRect(0, 0, c.w, c.h);
      if (src === "jpeg") fmt = "jpeg";
    }
    ctx.beginPath();
    ctx.ellipse(c.w / 2, c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(toCanvas(c), 0, 0);
    c = { ...c, data: ctx.getImageData(0, 0, c.w, c.h).data };
  }
  const bytes = await encode(c, fmt, { q: 92, dpi: r.dpi });
  return out(`${stem(file.name)}_crop.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: `${shape}-${x1 - x0}x${y1 - y0}` });
}

export async function resizeTool([file], o) {
  const mode = oneOf(o.mode ?? "percent", ["percent", "exact"], "mode");
  const r = await loadRaster(file);
  let nw, nh;
  if (mode === "percent") {
    const f = num(o.value, 50, 1, 1000) / 100;
    nw = Math.max(1, Math.round(r.w * f));
    nh = Math.max(1, Math.round(r.h * f));
  } else {
    const W = int(o.width, 0, 0, 100000), H = int(o.height, 0, 0, 100000);
    if (W <= 0 && H <= 0) throw new UserError("Enter a width or a height");
    if (bool(o.keep_aspect, true)) {
      const s = W <= 0 ? H / r.h : H <= 0 ? W / r.w : Math.min(W / r.w, H / r.h);
      nw = Math.max(1, Math.round(r.w * s));
      nh = Math.max(1, Math.round(r.h * s));
    } else {
      nw = W || r.w;
      nh = H || r.h;
    }
  }
  const fmt = sourceFmt(file);
  const bytes = await encode(await resize(r, nw, nh), fmt, { q: 92, dpi: r.dpi });
  return out(`${stem(file.name)}_${nw}x${nh}.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: `${nw}x${nh}` });
}

export async function dpiTool([file], o) {
  const mode = oneOf(o.mode ?? "metadata", ["metadata", "resample"], "mode");
  const dpi = int(o.dpi, 300, 1, 2400);
  const kind = sniff(file.bytes);
  const orig = file.bytes.length;
  if (mode === "metadata") {
    // rewrite only the header: no re-encode, zero quality loss
    if (kind === "jpeg") return out(`${stem(file.name)}_dpi${dpi}.jpg`, setJpegDpi(file.bytes, dpi), { orig, engine: "metadata-lossless" });
    if (kind === "png") return out(`${stem(file.name)}_dpi${dpi}.png`, setPngDpi(file.bytes, dpi), { orig, engine: "metadata-lossless" });
    if (kind === "webp") throw new UserError("WebP has no DPI field — convert to JPG or PNG first");
    const r = await loadRaster(file);
    return out(`${stem(file.name)}_dpi${dpi}.png`, await encodePNG(r, dpi), { orig, engine: "converted-to-png" });
  }
  const r = await loadRaster(file);
  const cur = r.dpi || 72;
  const nw = Math.max(1, Math.round((r.w / cur) * dpi)), nh = Math.max(1, Math.round((r.h / cur) * dpi));
  const fmt = sourceFmt(file);
  const bytes = await encode(await resize(r, nw, nh), fmt, { q: 95, dpi });
  return out(`${stem(file.name)}_dpi${dpi}.${extOf(fmt)}`, bytes, { orig, engine: `resampled-${cur}to${dpi}dpi` });
}

export async function convert([file], o) {
  const fmt = normFmt(oneOf(o.fmt ?? "png", FORMATS, "fmt"));
  const q = int(o.quality, 85, 1, 100);
  const r = await loadRaster(file);
  const bytes = await encode(r, fmt, { q, dpi: r.dpi });
  return out(`${stem(file.name)}.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: fmt });
}

export async function rotateTool([file], o) {
  const angle = int(o.angle, 90, 0, 270);
  if (![0, 90, 180, 270].includes(angle)) throw new UserError("angle must be 0 | 90 | 180 | 270");
  const flip = oneOf(o.flip ?? "none", ["none", "h", "v"], "flip");
  const r = await loadRaster(file);
  const fmt = sourceFmt(file);
  const bytes = await encode(rotateFlip(r, angle, flip), fmt, { q: 92, dpi: r.dpi });
  const suffix = `rot${angle}${flip !== "none" ? flip : ""}`;
  return out(`${stem(file.name)}_${suffix}.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: suffix });
}

export async function bw([file], o) {
  const mode = oneOf(o.mode ?? "grayscale", ["grayscale", "true-bw"], "mode");
  const fmt = normFmt(oneOf(o.fmt ?? "jpeg", FORMATS, "fmt"));
  const t = int(o.threshold, 128, 0, 255);
  const r = await loadRaster(file);
  let img = toGray(r);
  if (mode === "true-bw") img = fmt === "png" ? toBits(img, t) : thresholdGray(img, t);
  const bytes = await encode(img, fmt, { q: 92, dpi: r.dpi });
  return out(`${stem(file.name)}_bw.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: mode });
}

export async function sizeCm([file], o) {
  const fmt = normFmt(oneOf(o.fmt ?? "jpeg", FORMATS, "fmt"));
  const wcm = num(o.width_cm, 3.5, 0, 500), hcm = num(o.height_cm, 2.5, 0, 500);
  if (wcm <= 0 || hcm <= 0) throw new UserError("Width and height must be more than 0 cm");
  const dpi = int(o.dpi, 200, 36, 2400);
  const r = await loadRaster(file);
  const tw = Math.max(1, Math.round((wcm / 2.54) * dpi)), th = Math.max(1, Math.round((hcm / 2.54) * dpi));
  let nw = tw, nh = th;
  if (bool(o.keep_aspect, true)) {
    const s = Math.min(tw / r.w, th / r.h);
    nw = Math.max(1, Math.round(r.w * s));
    nh = Math.max(1, Math.round(r.h * s));
  }
  const bytes = await encode(await resize(r, nw, nh), fmt, { q: 92, dpi });
  return out(`${stem(file.name)}_${nw}x${nh}_cm.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: `${nw}x${nh}@${dpi}dpi` });
}

/** Decode any supported image to a browser-friendly PNG or JPEG (used by Images → PDF). */
export async function normalizeForPdf(file) {
  const r = await loadRaster(file);
  return hasAlpha(r)
    ? { bytes: await encodePNG(r, r.dpi), w: r.w, h: r.h, dpi: r.dpi }
    : { bytes: await encodeAt(r, "jpeg", 92, r.dpi), w: r.w, h: r.h, dpi: r.dpi };
}

/**
 * A browser-displayable PNG of any supported image (HEIC, TIFF…) for previews
 * and editors, at most maxSide pixels on its longest side, plus the original size.
 */
export async function previewImage([file], o) {
  const r = await loadRaster(file);
  const max = int(o.max, 1600, 64, 4000);
  const s = Math.min(1, max / Math.max(r.w, r.h));
  const small = await resize(r, r.w * s, r.h * s);
  return { png: await encodePNG(small, null), w: r.w, h: r.h, dpi: r.dpi };
}

/**
 * Save an edited image (pixels from the editor canvas, as PNG) in the original
 * file's format and DPI — HEIC/AVIF originals become JPEG.
 */
export async function saveEdited([original, edited], o) {
  const src = await loadRaster(original);
  const r = await loadRaster(edited);
  const fmt = o.fmt ? normFmt(oneOf(o.fmt, FORMATS, "fmt")) : sourceFmt(original);
  const bytes = await encode(r, fmt, { q: int(o.quality, 92, 1, 100), dpi: src.dpi });
  return out(`${stem(original.name)}_edited.${extOf(fmt)}`, bytes, { orig: original.bytes.length, engine: "edited" });
}
