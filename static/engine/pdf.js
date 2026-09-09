// PDF tools on MuPDF (WebAssembly). Replaces Ghostscript: images are
// re-encoded in place, so text and vectors stay untouched and sharp.
import * as mupdf from "../vendor/mupdf/mupdf.js";
import { makeZip, readJpegInfo, sniff } from "./codec.js";
import { normalizeForPdf } from "./image.js";
import { UserError, batch, int, num, oneOf, out, parsePages, stem } from "./util.js";

const SAVE = "garbage=4,compress,objstms";
const MAX_RENDER_PIXELS = 150e6;
const LADDER = [300, 250, 200, 180, 150, 120, 100, 90, 80, 72, 60, 50, 40, 30];

/* ------------------------------------------------------------ basics */

export function openPdf(file) {
  try {
    return new mupdf.PDFDocument(file.bytes);
  } catch {
    throw new UserError(`${file.name} isn't a readable PDF`);
  }
}

export function openUnlocked(file) {
  const doc = openPdf(file);
  if (doc.needsPassword()) {
    doc.destroy();
    throw new UserError(`${file.name} is password-protected — remove the password first`);
  }
  return doc;
}

export function save(doc, opts = SAVE) {
  const buf = doc.saveToBuffer(opts);
  try {
    return buf.asUint8Array().slice();   // the view lives in WASM memory; copy it out
  } finally {
    buf.destroy();
  }
}

const pt = (v) => +v.toFixed(4);

function checkRender(w, h) {
  if (w * h > MAX_RENDER_PIXELS) {
    throw new UserError(`A page would be ${Math.round((w * h) / 1e6)} megapixels at this DPI — lower the DPI`);
  }
}

/* ------------------------------------------------------------ image rewriting */

/**
 * Every image XObject with the lowest DPI it is drawn at. A device run over
 * all pages sees each placement; MuPDF hands back the same image object for
 * the same PDF stream, so pointers match placements to xrefs.
 */
function scanImages(doc) {
  const keep = [];
  const minDpi = new Map();
  const dev = new mupdf.Device({
    fillImage(image, ctm) {
      keep.push(image);
      const wpt = Math.hypot(ctm[0], ctm[1]), hpt = Math.hypot(ctm[2], ctm[3]);
      if (wpt < 0.01 || hpt < 0.01) return;
      const dpi = Math.min(image.getWidth() / (wpt / 72), image.getHeight() / (hpt / 72));
      const prev = minDpi.get(image.pointer);
      if (prev === undefined || dpi < prev) minDpi.set(image.pointer, dpi);
    },
  });
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    try { page.run(dev, mupdf.Matrix.identity); } catch { /* a broken page shouldn't stop the scan */ }
  }
  dev.close();

  const masks = new Set(), candidates = [];
  for (let x = 1; x < doc.countObjects(); x++) {
    const obj = doc.newIndirect(x);
    try {
      if (!obj.isStream() || String(obj.get("Subtype")) !== "/Image") continue;
    } catch { continue; }
    for (const key of ["SMask", "Mask"]) {
      const m = obj.get(key);
      if (m.isIndirect()) masks.add(m.asIndirect());
    }
    if (obj.get("ImageMask").isBoolean() && obj.get("ImageMask").asBoolean()) continue;
    candidates.push(x);
  }
  const images = [];
  for (const x of candidates) {
    if (masks.has(x)) continue;
    let image;
    try { image = doc.loadImage(doc.newIndirect(x)); } catch { continue; }
    keep.push(image);
    images.push({
      xref: x, dpi: minDpi.get(image.pointer) ?? null,
      w: image.getWidth(), h: image.getHeight(), bpc: image.getBitsPerComponent(), n: image.getNumberOfComponents(),
    });
  }
  for (const im of keep) im.destroy();
  return images;
}

/**
 * Re-encode images as JPEG at quality, downsampling any drawn above maxDpi
 * (0 = keep resolution). gray converts them to grayscale. An image is only
 * replaced when that makes it smaller (or a gray conversion was asked for).
 */
function recompress(doc, images, { maxDpi = 0, quality = 75, gray = false }) {
  for (const im of images) {
    if (im.bpc === 1 || Math.min(im.w, im.h) < 16) continue;
    const obj = doc.newIndirect(im.xref);
    if (/JBIG2|CCITT/.test(String(obj.get("Filter")))) continue;   // bilevel codecs beat JPEG
    const scale = maxDpi && im.dpi && im.dpi > maxDpi * 1.01 ? maxDpi / im.dpi : 1;
    const nw = Math.max(1, Math.round(im.w * scale)), nh = Math.max(1, Math.round(im.h * scale));
    const toGray = gray || im.n === 1;
    let jpg;
    const image = doc.loadImage(obj);
    const pix = new mupdf.Pixmap(toGray ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB, [0, 0, nw, nh], false);
    try {
      pix.clear(255);
      const dd = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
      dd.fillImage(image, [nw, 0, 0, nh, 0, 0], 1);
      dd.close();
      dd.destroy();
      jpg = pix.asJPEG(quality, false);
    } catch {
      continue;
    } finally {
      pix.destroy();
      image.destroy();
    }
    const raw = obj.readRawStream();
    const oldLen = raw.getLength();
    raw.destroy();
    if (jpg.length >= oldLen && !(gray && im.n !== 1)) continue;
    obj.writeRawStream(jpg);
    obj.put("Filter", "DCTDecode");
    obj.delete("DecodeParms");
    obj.delete("Decode");
    if (obj.get("Mask").isArray()) obj.delete("Mask");   // colour-key masks don't survive lossy coding
    obj.put("ColorSpace", toGray ? "DeviceGray" : "DeviceRGB");
    obj.put("BitsPerComponent", 8);
    obj.put("Width", nw);
    obj.put("Height", nh);
  }
}

/**
 * Smallest-change search for a size target. 1) lower JPEG quality at
 * startDpi (0 = original resolution); 2) if that can't fit, find the highest
 * DPI cap that fits, then raise quality again. Returns the best fit, or the
 * smallest file seen when nothing fits.
 */
function searchTarget(file, images, target, startDpi, progress) {
  let smallest = null, tries = 0;
  const run = (dpi, q) => {
    progress?.(++tries, 16, `trying ${dpi ? dpi + " DPI" : "original DPI"}, quality ${q}`);
    const doc = openPdf(file);
    try {
      recompress(doc, images, { maxDpi: dpi, quality: q });
      const bytes = save(doc);
      if (!smallest || bytes.length < smallest.bytes.length) smallest = { bytes, dpi, q };
      return bytes;
    } finally {
      doc.destroy();
    }
  };
  const qSearch = (dpi, lo, hi) => {
    let best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = run(dpi, mid);
      if (b.length <= target) { best = { bytes: b, dpi, q: mid }; lo = mid + 1; } else hi = mid - 1;
    }
    return best;
  };
  let hit = qSearch(startDpi, 25, 90);
  if (hit) return { ...hit, fit: true };
  const steps = LADDER.filter((d) => !startDpi || d < startDpi);
  let lo = 0, hi = steps.length - 1, found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = run(steps[mid], 40);
    if (b.length <= target) { found = { bytes: b, dpi: steps[mid], q: 40 }; hi = mid - 1; } else lo = mid + 1;
  }
  if (!found) return { ...smallest, fit: false };
  hit = qSearch(found.dpi, 41, 85) || found;
  return { ...hit, fit: true };
}

/* ------------------------------------------------------------ raster rebuild */

function packBits(pix, t) {
  const w = pix.getWidth(), h = pix.getHeight(), stride = pix.getStride();
  const px = pix.getPixels();
  const rowLen = (w + 7) >> 3;
  const bits = new Uint8Array(rowLen * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (px[y * stride + x] > t) bits[y * rowLen + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return bits;
}

/**
 * Render every page in grayscale at exactly dpi and rebuild the PDF from
 * those images. This is the only way to guarantee an exact DPI (scans below
 * it get raised too). threshold → 1-bit pages. target → JPEG quality is
 * picked per page so the whole file stays under target; pages that need
 * less leave their unused budget to the pages after them.
 */
function rasterRebuild(doc, { dpi, threshold = null, target = 0, quality = 90 }, progress) {
  const n = doc.countPages();
  const dst = new mupdf.PDFDocument();
  const z = dpi / 72;
  let remaining = target ? Math.max(target - 1500 - 600 * n, n * 1024) : 0;
  try {
    for (let i = 0; i < n; i++) {
      progress?.(i, n, `page ${i + 1} of ${n}`);
      const page = doc.loadPage(i);
      const [x0, y0, x1, y1] = page.getBounds();
      const pw = x1 - x0, ph = y1 - y0;
      checkRender(pw * z, ph * z);
      const pix = page.toPixmap(mupdf.Matrix.scale(z, z), mupdf.ColorSpace.DeviceGray, false);
      let ref;
      try {
        pix.setResolution(dpi, dpi);
        const W = pix.getWidth(), H = pix.getHeight();
        if (threshold !== null) {
          const bits = packBits(pix, threshold);
          ref = dst.addStream(bits, { Type: "XObject", Subtype: "Image", Width: W, Height: H, ColorSpace: "DeviceGray", BitsPerComponent: 1 });
        } else {
          let jpg;
          if (target) {
            const budget = remaining / (n - i);
            let lo = 1, hi = 95;
            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              const b = pix.asJPEG(mid, false);
              if (b.length <= budget) { jpg = b; lo = mid + 1; } else hi = mid - 1;
            }
            jpg ??= pix.asJPEG(1, false);
            remaining -= jpg.length;
          } else {
            jpg = pix.asJPEG(quality, false);
          }
          ref = dst.addRawStream(jpg, { Type: "XObject", Subtype: "Image", Width: W, Height: H, ColorSpace: "DeviceGray", BitsPerComponent: 8, Filter: "DCTDecode" });
        }
      } finally {
        pix.destroy();
      }
      const pageObj = dst.addPage([0, 0, pt(pw), pt(ph)], 0, { XObject: { Im0: ref } }, `q ${pt(pw)} 0 0 ${pt(ph)} 0 0 cm /Im0 Do Q`);
      dst.insertPage(-1, pageObj);
    }
    const bytes = save(dst, "garbage=4,compress");
    return { bytes, fit: !target || bytes.length <= target };
  } finally {
    dst.destroy();
  }
}

/* ------------------------------------------------------------ tools */

const PRESETS = { screen: [72, 40], ebook: [150, 60], printer: [300, 80], prepress: [300, 92] };

export async function compress([file], o) {
  const preset = oneOf(o.quality ?? "ebook", Object.keys(PRESETS), "quality");
  const orig = file.bytes.length;
  const name = `${stem(file.name)}_compressed.pdf`;
  const doc = openPdf(file);
  try {
    if (doc.needsPassword()) return out(name, file.bytes, { orig, engine: "passthrough-locked" });
    const [dpi, q] = PRESETS[preset];
    recompress(doc, scanImages(doc), { maxDpi: dpi, quality: q });
    const bytes = save(doc);
    if (bytes.length >= orig) return out(name, file.bytes, { orig, engine: "no-reduction" });
    return out(name, bytes, { orig, engine: `mupdf-${preset}` });
  } finally {
    doc.destroy();
  }
}

export async function targetSize([file], o, progress) {
  const kb = int(o.target_kb, 100, 1, 1e6);
  const target = kb * 1024;
  const mode = oneOf(o.dpi_mode ?? "preserve", ["preserve", "force"], "dpi_mode");
  const dpi = int(o.dpi, 200, 36, 600);
  const orig = file.bytes.length;
  const name = `${stem(file.name)}_to_${kb}kb.pdf`;
  if (orig <= target) return out(name, file.bytes, { orig, engine: "already-fits" });
  const doc = openPdf(file);
  let images;
  try {
    if (doc.needsPassword()) return out(name, file.bytes, { orig, engine: "passthrough-locked" });
    images = scanImages(doc);
    if (!images.length) {
      const bytes = save(doc);
      if (bytes.length >= orig) return out(name, file.bytes, { orig, engine: "no-reduction" });
      return out(name, bytes, { orig, engine: bytes.length <= target ? "mupdf-cleanup" : "best-effort" });
    }
  } finally {
    doc.destroy();
  }
  const res = searchTarget(file, images, target, mode === "force" ? dpi : 0, progress);
  if (!res.fit && res.bytes.length >= orig) return out(name, file.bytes, { orig, engine: "no-reduction" });
  return out(name, res.bytes, {
    orig, engine: res.fit ? `mupdf-q${res.q}-${res.dpi ? res.dpi + "dpi" : "original-dpi"}` : "best-effort",
  });
}

export async function master(files, o, progress) {
  const mode = oneOf(o.mode ?? "grayscale", ["grayscale", "true-bw", "color"], "mode");
  const dpi = int(o.dpi, 200, 36, 600);
  const t = int(o.threshold, 128, 0, 255);
  const perPage = int(o.per_page_kb, 300, 1, 1e6);
  const totalKb = int(o.target_kb, 0, 0, 1e7);

  const one = async (file, prog) => {
    const orig = file.bytes.length;
    const doc = openPdf(file);
    try {
      const pages = doc.needsPassword() ? 0 : doc.countPages();
      const target = totalKb > 0 ? totalKb * 1024 : perPage * 1024 * Math.max(1, pages);
      const name = `${stem(file.name)}_master_${Math.floor(target / 1024)}kb.pdf`;
      // locked or damaged files are passed through untouched, never faked as converted
      if (doc.needsPassword()) return out(name, file.bytes, { orig, engine: "master-encrypted-passthrough" });
      if (pages === 0 || doc.wasRepaired()) return out(name, file.bytes, { orig, engine: "master-corrupt-passthrough" });

      if (mode === "color") {
        if (orig <= target) return out(name, file.bytes, { orig, engine: "already-fits" });
        const images = scanImages(doc);
        if (!images.length) {
          const bytes = save(doc);
          return out(name, bytes.length < orig ? bytes : file.bytes, { orig, engine: bytes.length <= target ? "master-color-cleanup" : "master-color-over-max" });
        }
        const res = searchTarget(file, images, target, dpi, prog);
        return out(name, res.bytes, { orig, engine: res.fit ? `master-color-q${res.q}-${res.dpi}dpi` : "master-color-over-max" });
      }
      const res = rasterRebuild(doc, { dpi, threshold: mode === "true-bw" ? t : null, target }, prog);
      const tag = mode === "true-bw" ? "true-bw" : "gray";
      return out(name, res.bytes, { orig, engine: `master-${tag}-raster-${dpi}dpi${res.fit ? "" : "-over-max"}` });
    } finally {
      doc.destroy();
    }
  };
  return batch(files, one, "master_pdf_batch.zip",
    `options: mode=${mode} dpi=${dpi} threshold=${t} per_page_kb=${perPage} target_kb=${totalKb}`, progress);
}

export async function merge(files) {
  if (files.length < 2) throw new UserError("Add at least 2 PDFs to merge");
  const dst = new mupdf.PDFDocument();
  try {
    for (const f of files) {
      const src = openUnlocked(f);
      const map = dst.newGraftMap();   // one map per source shares its fonts across pages
      for (let i = 0; i < src.countPages(); i++) map.graftPage(-1, src, i);
      map.destroy();
      src.destroy();
    }
    return out("merged.pdf", save(dst), { orig: files.reduce((n, f) => n + f.bytes.length, 0) });
  } finally {
    dst.destroy();
  }
}

function extractPages(src, indexes) {
  const dst = new mupdf.PDFDocument();
  try {
    const map = dst.newGraftMap();
    for (const i of indexes) map.graftPage(-1, src, i);
    map.destroy();
    return save(dst);
  } finally {
    dst.destroy();
  }
}

export async function split([file], o) {
  const mode = oneOf(o.mode ?? "range", ["range", "every"], "mode");
  const doc = openUnlocked(file);
  const base = stem(file.name), orig = file.bytes.length;
  try {
    const n = doc.countPages();
    if (mode === "range") {
      return out(`${base}_pages.pdf`, extractPages(doc, parsePages(o.page_range, n)), { orig });
    }
    const every = int(o.every, 1, 1, 100000);
    const chunks = [];
    for (let s = 0; s < n; s += every) {
      const e = Math.min(s + every, n);
      chunks.push({ name: `${base}_p${s + 1}-${e}.pdf`, bytes: extractPages(doc, [...Array(e - s).keys()].map((k) => s + k)) });
    }
    if (chunks.length === 1) return out(chunks[0].name, chunks[0].bytes, { orig });
    return out(`${base}_split.zip`, await makeZip(chunks), { orig });
  } finally {
    doc.destroy();
  }
}

export async function rotate([file], o) {
  const angle = int(o.angle, 90, 0, 270);
  if (![90, 180, 270].includes(angle)) throw new UserError("angle must be 90 | 180 | 270");
  const doc = openUnlocked(file);
  try {
    for (const i of parsePages(o.pages, doc.countPages())) {
      const page = doc.loadPage(i).getObject();
      const cur = page.getInheritable("Rotate");
      page.put("Rotate", ((cur.isNumber() ? cur.asNumber() : 0) + angle) % 360);
    }
    return out(`${stem(file.name)}_rotated.pdf`, save(doc), { orig: file.bytes.length });
  } finally {
    doc.destroy();
  }
}

export async function toImages([file], o, progress) {
  const fmt = oneOf(o.fmt ?? "jpg", ["jpg", "jpeg", "png"], "fmt") === "png" ? "png" : "jpg";
  const dpi = int(o.dpi, 150, 36, 1200);
  const q = int(o.quality, 85, 10, 100);
  const doc = openUnlocked(file);
  const base = stem(file.name);
  try {
    const n = doc.countPages(), z = dpi / 72, files = [];
    for (let i = 0; i < n; i++) {
      progress?.(i, n, `page ${i + 1} of ${n}`);
      const page = doc.loadPage(i);
      const [x0, y0, x1, y1] = page.getBounds();
      checkRender((x1 - x0) * z, (y1 - y0) * z);
      const pix = page.toPixmap(mupdf.Matrix.scale(z, z), mupdf.ColorSpace.DeviceRGB, false);
      try {
        pix.setResolution(dpi, dpi);
        files.push({ name: `${base}_page_${String(i + 1).padStart(3, "0")}.${fmt}`, bytes: fmt === "png" ? pix.asPNG() : pix.asJPEG(q, false) });
      } finally {
        pix.destroy();
      }
    }
    if (files.length === 1) return out(files[0].name, files[0].bytes, { orig: file.bytes.length });
    return out(`${base}_pages.zip`, await makeZip(files), { orig: file.bytes.length });
  } finally {
    doc.destroy();
  }
}

export async function extractImages([file]) {
  const doc = openUnlocked(file);
  const base = stem(file.name), found = [];
  try {
    const masks = new Set(), xrefs = [];
    for (let x = 1; x < doc.countObjects(); x++) {
      const obj = doc.newIndirect(x);
      try {
        if (!obj.isStream() || String(obj.get("Subtype")) !== "/Image") continue;
      } catch { continue; }
      for (const key of ["SMask", "Mask"]) if (obj.get(key).isIndirect()) masks.add(obj.get(key).asIndirect());
      xrefs.push(x);
    }
    for (const x of xrefs) {
      if (masks.has(x)) continue;
      const obj = doc.newIndirect(x);
      const filter = String(obj.get("Filter"));
      try {
        if (filter === "/DCTDecode" || filter === "/JPXDecode") {
          // already a JPEG / JPEG 2000 file inside: copy it out bit-for-bit
          const raw = obj.readRawStream();
          found.push({ name: `${base}_img_${x}.${filter === "/DCTDecode" ? "jpg" : "jp2"}`, bytes: raw.asUint8Array().slice() });
          raw.destroy();
          continue;
        }
        const image = doc.loadImage(obj);
        const pix = image.toPixmap();
        const cs = pix.getColorSpace();
        const ok = cs && (cs.isGray() || cs.isRGB());
        const rgb = ok ? pix : pix.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, true);
        found.push({ name: `${base}_img_${x}.png`, bytes: rgb.asPNG() });
        if (rgb !== pix) rgb.destroy();
        pix.destroy();
        image.destroy();
      } catch { /* skip images MuPDF can't decode */ }
    }
  } finally {
    doc.destroy();
  }
  if (!found.length) throw new UserError("No images found in this PDF");
  if (found.length === 1) return out(found[0].name, found[0].bytes, { orig: file.bytes.length });
  return out(`${base}_images.zip`, await makeZip(found), { orig: file.bytes.length });
}

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

/**
 * Append one image as a page of dst. size "auto" makes the page the image's
 * physical size (from its DPI); "a4"/"letter" fit it centred inside margins.
 * orientation "match" turns the paper to follow the image's own shape.
 */
async function addImagePage(dst, f, { size = "a4", orientation = "portrait", margin = 0 } = {}) {
  const kind = sniff(f.bytes);
  let bytes = f.bytes, dpi = null;
  if (kind === "jpeg") {
    const info = readJpegInfo(f.bytes);
    dpi = info.dpi?.[0] ?? null;
    // MuPDF embeds JPEGs as-is (no quality loss) but ignores EXIF rotation
    if (info.orientation !== 1) ({ bytes, dpi } = await normalizeForPdf(f));
  } else if (!["png", "gif", "bmp", "tiff"].includes(kind)) {
    ({ bytes, dpi } = await normalizeForPdf(f));   // WebP and friends: decode in the browser
  }
  let image;
  try {
    image = new mupdf.Image(bytes);
  } catch {
    throw new UserError(`${f.name}: unsupported or damaged image`);
  }
  const iw = image.getWidth(), ih = image.getHeight();
  let W, H;
  if (size === "auto") {
    W = (iw * 72) / (dpi || 72) + 2 * margin;
    H = (ih * 72) / (dpi || 72) + 2 * margin;
  } else {
    [W, H] = PAGE_SIZES[size];
    const landscape = orientation === "match" ? iw > ih : orientation === "landscape";
    if (landscape !== W > H) [W, H] = [H, W];
  }
  const aw = Math.max(1, W - 2 * margin), ah = Math.max(1, H - 2 * margin);
  const s = Math.min(aw / iw, ah / ih);
  const dw = iw * s, dh = ih * s;
  const dx = margin + (aw - dw) / 2, dy = margin + (ah - dh) / 2;
  const ref = dst.addImage(image);
  image.destroy();
  const page = dst.addPage([0, 0, pt(W), pt(H)], 0, { XObject: { Im0: ref } },
    `q ${pt(dw)} 0 0 ${pt(dh)} ${pt(dx)} ${pt(dy)} cm /Im0 Do Q`);
  dst.insertPage(-1, page);
}

export async function fromImages(files, o, progress) {
  const size = oneOf(o.page_size ?? "a4", ["a4", "letter", "auto"], "page_size");
  const orientation = oneOf(o.orientation ?? "portrait", ["portrait", "landscape"], "orientation");
  const margin = (num(o.margin_mm, 0, 0, 100) * 72) / 25.4;
  const dst = new mupdf.PDFDocument();
  try {
    for (let i = 0; i < files.length; i++) {
      progress?.(i, files.length, files[i].name);
      await addImagePage(dst, files[i], { size, orientation, margin });
    }
    return out("images.pdf", save(dst), { orig: files.reduce((n, f) => n + f.bytes.length, 0) });
  } finally {
    dst.destroy();
  }
}

/**
 * Stream small JPEG thumbnails of every page through progress(), so the
 * organiser board fills in as pages render instead of all at the end.
 */
export async function thumbs([file], o, progress) {
  const doc = openUnlocked(file);
  const size = int(o.size, 220, 64, 600);
  try {
    const n = doc.countPages();
    for (let i = 0; i < n; i++) {
      const page = doc.loadPage(i);
      const [x0, y0, x1, y1] = page.getBounds();
      const z = size / Math.max(1, x1 - x0, y1 - y0);
      const pix = page.toPixmap(mupdf.Matrix.scale(z, z), mupdf.ColorSpace.DeviceRGB, false);
      let thumb;
      try {
        thumb = pix.asJPEG(72, false);
      } finally {
        pix.destroy();
      }
      progress?.(i + 1, n, `page ${i + 1} of ${n}`, { page: i, thumb });
      await new Promise((r) => setTimeout(r, 0));   // let other jobs run between pages
    }
    return { pages: n };
  } finally {
    doc.destroy();
  }
}

/**
 * Build a new PDF from a page plan mixing several sources:
 * o.pages = JSON [{ src: file index, page: page index (-1 = the image itself), rotate: 0|90|180|270 }].
 * Pages may repeat (duplicates). Each PDF source shares one graft map, so its
 * fonts and images are copied once however many of its pages are used.
 */
export async function organize(files, o, progress) {
  let plan;
  try {
    plan = JSON.parse(o.pages || "[]");
  } catch {
    throw new UserError("The page plan is unreadable");
  }
  if (!Array.isArray(plan) || !plan.length) throw new UserError("There are no pages to build — add a file");
  const size = oneOf(o.image_page ?? "a4", ["a4", "letter", "auto"], "image_page");
  const dst = new mupdf.PDFDocument();
  const docs = new Map(), maps = new Map();
  try {
    for (let i = 0; i < plan.length; i++) {
      progress?.(i, plan.length, `page ${i + 1} of ${plan.length}`);
      const { src, page, rotate = 0 } = plan[i];
      const f = files[src];
      if (!f) throw new UserError("The page plan refers to a missing file");
      if (![0, 90, 180, 270].includes(rotate)) throw new UserError("rotate must be 0 | 90 | 180 | 270");
      if (page === -1) {
        await addImagePage(dst, f, { size, orientation: "match" });
      } else {
        if (!docs.has(src)) {
          docs.set(src, openUnlocked(f));
          maps.set(src, dst.newGraftMap());
        }
        const doc = docs.get(src);
        if (!Number.isInteger(page) || page < 0 || page >= doc.countPages()) throw new UserError(`${f.name} has no page ${page + 1}`);
        maps.get(src).graftPage(-1, doc, page);
      }
      if (rotate) {
        const obj = dst.loadPage(dst.countPages() - 1).getObject();
        const cur = obj.getInheritable("Rotate");
        obj.put("Rotate", ((cur.isNumber() ? cur.asNumber() : 0) + rotate) % 360);
      }
    }
    const used = new Set(plan.map((p) => p.src));
    return out(files.length === 1 ? `${stem(files[0].name)}_organized.pdf` : "organized.pdf", save(dst), {
      orig: [...used].reduce((n, s) => n + files[s].bytes.length, 0),
      engine: `${plan.length} pages from ${used.size} file${used.size === 1 ? "" : "s"}`,
    });
  } finally {
    for (const m of maps.values()) m.destroy();
    for (const d of docs.values()) d.destroy();
    dst.destroy();
  }
}

export async function encrypt([file], o) {
  const password = String(o.password ?? "");
  if (!password) throw new UserError("Enter a password");
  if (password.includes(",")) throw new UserError("Passwords can't contain a comma (MuPDF limitation)");
  const method = { "aes-256": "aes-256", "aes-128": "aes-128", rc4: "rc4-128" }[oneOf(o.method ?? "aes-256", ["aes-256", "aes-128", "rc4"], "method")];
  const doc = openUnlocked(file);
  try {
    const bytes = save(doc, `garbage=4,compress,encrypt=${method},user-password=${password},owner-password=${password}`);
    return out(`${stem(file.name)}_protected.pdf`, bytes, { orig: file.bytes.length });
  } finally {
    doc.destroy();
  }
}

export async function bw([file], o, progress) {
  const mode = oneOf(o.mode ?? "grayscale", ["grayscale", "true-bw"], "mode");
  const dpi = int(o.dpi, 200, 36, 600);
  const t = int(o.threshold, 128, 0, 255);
  const doc = openUnlocked(file);
  try {
    const res = rasterRebuild(doc, { dpi, threshold: mode === "true-bw" ? t : null }, progress);
    return out(`${stem(file.name)}_bw.pdf`, res.bytes, {
      orig: file.bytes.length, engine: `render-${mode === "true-bw" ? "true-bw" : "gray"}-${dpi}dpi`,
    });
  } finally {
    doc.destroy();
  }
}

/** First-page thumbnail + page count for the preview panel. */
export async function preview([file]) {
  const doc = openPdf(file);
  try {
    if (doc.needsPassword()) return { locked: true, pages: 0 };
    const pages = doc.countPages();
    const page = doc.loadPage(0);
    const [x0, y0, x1, y1] = page.getBounds();
    const z = Math.min(2, 900 / Math.max(1, x1 - x0, y1 - y0));
    const pix = page.toPixmap(mupdf.Matrix.scale(z, z), mupdf.ColorSpace.DeviceRGB, false);
    try {
      return { pages, png: pix.asPNG() };
    } finally {
      pix.destroy();
    }
  } finally {
    doc.destroy();
  }
}
