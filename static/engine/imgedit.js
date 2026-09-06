// Image editing tools: text watermark, metadata removal (lossless), hiding
// regions (pixelate / blur / black box) and colour adjustments.
import { concat, readJpegInfo, sniff } from "./codec.js";
import { encode, extOf, loadRaster, sourceFmt } from "./image.js";
import { UserError, batch, bool, num, oneOf, out, stem } from "./util.js";

/* ------------------------------------------------------------ watermark */

let fontReady = null;
/** Load Figtree for canvas text inside the worker; fall back to the system font. */
function loadFont() {
  fontReady ??= (async () => {
    try {
      const face = new FontFace("MTFigtree", "url(../vendor/fonts/figtree-latin-wght-normal.woff2)", { weight: "300 900" });
      self.fonts.add(await face.load());
      return "MTFigtree";
    } catch {
      return "sans-serif";
    }
  })();
  return fontReady;
}

export async function watermark([file], o) {
  const text = String(o.text ?? "").trim();
  if (!text) throw new UserError("Enter the watermark text");
  const layout = oneOf(o.layout ?? "center", ["center", "tiled", "bottom-right"], "layout");
  const sizePct = num(o.size, 8, 1, 50);
  const alpha = num(o.opacity, 35, 1, 100) / 100;
  const deg = num(o.angle, layout === "bottom-right" ? 0 : -30, -360, 360);
  const color = /^#[0-9a-f]{6}$/i.test(o.color || "") ? o.color : "#ffffff";
  const r = await loadRaster(file);
  const family = await loadFont();
  const cv = new OffscreenCanvas(r.w, r.h);
  const ctx = cv.getContext("2d");
  ctx.putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
  const px = Math.max(8, Math.round((Math.min(r.w, r.h) * sizePct) / 100));
  ctx.font = `700 ${px}px ${family}`;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // a soft outline keeps light text readable on light photos (and vice versa)
  ctx.shadowColor = color.toLowerCase() === "#ffffff" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
  ctx.shadowBlur = Math.max(2, px / 12);
  const draw = (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const tw = ctx.measureText(text).width;
  if (layout === "center") {
    draw(r.w / 2, r.h / 2);
  } else if (layout === "bottom-right") {
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    const pad = px * 0.8;
    draw(r.w - pad, r.h - pad);
  } else {
    const stepX = tw + px * 2, stepY = px * 4, reach = Math.hypot(r.w, r.h);
    ctx.translate(r.w / 2, r.h / 2);
    ctx.rotate((deg * Math.PI) / 180);
    for (let y = -reach; y <= reach; y += stepY) {
      const shift = (Math.round(y / stepY) % 2) * (stepX / 2);   // brick pattern
      for (let x = -reach - shift; x <= reach; x += stepX) ctx.fillText(text, x, y);
    }
  }
  const img = { ...r, data: ctx.getImageData(0, 0, r.w, r.h).data };
  const fmt = sourceFmt(file);
  const bytes = await encode(img, fmt, { q: 92, dpi: r.dpi });
  return out(`${stem(file.name)}_watermarked.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: layout });
}

/* ------------------------------------------------------------ metadata */

/** What an EXIF block reveals, in plain words. */
function describeExif(b, tiff) {
  const found = new Set();
  const le = b[tiff] === 0x49;
  const view = new DataView(b.buffer, b.byteOffset);
  const u16 = (o) => view.getUint16(o, le), u32 = (o) => view.getUint32(o, le);
  const walk = (ifd, depth) => {
    if (depth > 2 || ifd + 2 > b.length) return;
    const n = u16(ifd);
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      if (e + 12 > b.length) return;
      const tag = u16(e);
      if (tag === 0x8825) found.add("GPS location");
      else if (tag === 0x010f || tag === 0x0110 || tag === 0xa431 || tag === 0xa434) found.add("camera details");
      else if (tag === 0x0132 || tag === 0x9003 || tag === 0x9004) found.add("date taken");
      else if (tag === 0x0131) found.add("editing software");
      else if (tag === 0x013b || tag === 0x8298) found.add("author / copyright");
      else if (tag === 0x8769) walk(tiff + u32(e + 8), depth + 1);   // Exif sub-IFD
    }
  };
  try {
    if (u16(tiff + 2) === 42) walk(tiff + u32(tiff + 4), 0);
  } catch { /* truncated EXIF: we strip it regardless */ }
  return found;
}

/** Minimal EXIF segment carrying only the orientation, so the photo stays upright. */
function orientationSegment(orientation) {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return new Uint8Array([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload]);
}

const isTag = (b, at, s) => [...s].every((ch, k) => b[at + k] === ch.charCodeAt(0));

function stripJpeg(b) {
  const found = new Set();
  const { orientation } = readJpegInfo(b);
  const parts = [b.subarray(0, 2)];
  let i = 2, insertedOrientation = false;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m === 0xda) break;                                  // image data starts: copy the rest verbatim
    const len = (b[i + 2] << 8) | b[i + 3];
    const seg = b.subarray(i, i + 2 + len), data = i + 4;
    let keep = true;
    if (m === 0xe1) {
      keep = false;
      if (isTag(b, data, "Exif\0\0")) describeExif(b, data + 6).forEach((f) => found.add(f));
      else found.add("XMP data");
    } else if (m === 0xed) {
      keep = false;
      found.add("IPTC / Photoshop data");
    } else if (m === 0xfe) {
      keep = false;
      found.add("comments");
    } else if (m >= 0xe3 && m <= 0xef && m !== 0xee) {
      keep = false;                                         // vendor blocks (Ducky, maker notes…)
      found.add("vendor data");
    }
    // APP0 (JFIF), APP2 (ICC colour profile) and APP14 (Adobe colour transform) are kept
    if (keep) parts.push(seg);
    if (!insertedOrientation && orientation !== 1 && (m !== 0xe0 || !keep)) {
      parts.push(orientationSegment(orientation));
      insertedOrientation = true;
    }
    i += 2 + len;
  }
  parts.push(b.subarray(i));
  return { bytes: concat(parts), found };
}

function stripPng(b) {
  const found = new Set();
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const type = String.fromCharCode(...b.subarray(i + 4, i + 8));
    const end = i + 12 + len;
    if (type === "eXIf") found.add("EXIF data");
    else if (type === "tEXt" || type === "zTXt" || type === "iTXt") found.add("text notes (author, software…)");
    else if (type === "tIME") found.add("date modified");
    else parts.push(b.subarray(i, end));
    if (type === "IEND") break;
    i = end;
  }
  return { bytes: concat(parts), found };
}

function stripWebp(b) {
  const found = new Set();
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = String.fromCharCode(...b.subarray(i, i + 4));
    const size = view.getUint32(i + 4, true);
    const end = Math.min(b.length, i + 8 + size + (size & 1));
    if (type === "EXIF") found.add("EXIF data (camera, date, maybe GPS)");
    else if (type === "XMP ") found.add("XMP data");
    else chunks.push(b.slice(i, end));
    i = end;
  }
  for (const c of chunks) {
    if (String.fromCharCode(...c.subarray(0, 4)) === "VP8X") c[8] &= ~(0x08 | 0x04);   // clear EXIF / XMP flags
  }
  const body = concat(chunks);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 4));
  new DataView(head.buffer).setUint32(4, body.length + 4, true);
  head.set(b.subarray(8, 12), 8);
  return { bytes: concat([head, body]), found };
}

/** Remove EXIF/GPS/XMP/comments without re-encoding: the pixels stay bit-for-bit identical. */
export async function stripMetadata(files, o, progress) {
  const one = async (file) => {
    const kind = sniff(file.bytes);
    let res;
    if (kind === "jpeg") res = stripJpeg(file.bytes);
    else if (kind === "png") res = stripPng(file.bytes);
    else if (kind === "webp") res = stripWebp(file.bytes);
    else {
      // other formats: a lossless PNG re-encode carries no metadata at all
      const r = await loadRaster(file);
      res = { bytes: await encode(r, "png", { dpi: r.dpi }), found: new Set(["all embedded metadata (converted to PNG)"]) };
    }
    const ext = kind === "jpeg" ? "jpg" : kind === "png" || kind === "webp" ? kind : "png";
    const what = [...res.found];
    return out(`${stem(file.name)}_clean.${ext}`, res.bytes, {
      orig: file.bytes.length, engine: what.length ? `removed ${what.join(", ")}` : "no-metadata-found",
    });
  };
  if (files.length === 1) return one(files[0]);
  return batch(files, one, "clean_images.zip", "options: strip all metadata", progress);
}

/* ------------------------------------------------------------ hide regions */

function boxBlur(src, w, h, radius) {
  // three passes of a box blur ≈ a Gaussian; channels interleaved RGBA
  let a = src, b = new Uint8ClampedArray(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (const horizontal of [true, false]) {
      const len = horizontal ? w : h, lines = horizontal ? h : w;
      for (let line = 0; line < lines; line++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          const at = (k) => (horizontal ? (line * w + k) : (k * w + line)) * 4 + c;
          for (let k = -radius; k <= radius; k++) sum += a[at(Math.min(len - 1, Math.max(0, k)))];
          for (let k = 0; k < len; k++) {
            b[at(k)] = sum / (2 * radius + 1);
            sum += a[at(Math.min(len - 1, k + radius + 1))] - a[at(Math.max(0, k - radius))];
          }
        }
      }
      [a, b] = [b, a];
    }
  }
  return a;
}

/**
 * Hide parts of an image. regions = JSON [{x, y, w, h}] as fractions of the
 * image. "black" is irreversible; strong pixelation is safe for text; blur is
 * the softest (and least safe for small text).
 */
export async function hideRegions([file], o) {
  let regions;
  try {
    regions = JSON.parse(o.regions || "[]");
  } catch {
    throw new UserError("The selected areas are unreadable");
  }
  if (!Array.isArray(regions) || !regions.length) throw new UserError("Draw at least one box over the area to hide");
  const mode = oneOf(o.mode ?? "pixelate", ["pixelate", "blur", "black"], "mode");
  const strength = num(o.strength, 6, 1, 10);
  const r = await loadRaster(file);
  const d = new Uint8ClampedArray(r.data);
  for (const reg of regions) {
    const x0 = Math.max(0, Math.round(num(reg.x, 0, 0, 1) * r.w)), y0 = Math.max(0, Math.round(num(reg.y, 0, 0, 1) * r.h));
    const x1 = Math.min(r.w, Math.round((num(reg.x, 0, 0, 1) + num(reg.w, 0, 0, 1)) * r.w));
    const y1 = Math.min(r.h, Math.round((num(reg.y, 0, 0, 1) + num(reg.h, 0, 0, 1)) * r.h));
    const rw = x1 - x0, rh = y1 - y0;
    if (rw < 1 || rh < 1) continue;
    if (mode === "black") {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * r.w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 255; }
    } else if (mode === "pixelate") {
      const block = Math.max(3, Math.round((Math.min(r.w, r.h) * strength) / 160));
      for (let by = y0; by < y1; by += block) {
        for (let bx = x0; bx < x1; bx += block) {
          const ex = Math.min(x1, bx + block), ey = Math.min(y1, by + block);
          const acc = [0, 0, 0, 0];
          for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * r.w + x) * 4; for (let c = 0; c < 4; c++) acc[c] += d[i + c]; }
          const n = (ex - bx) * (ey - by);
          for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * r.w + x) * 4; for (let c = 0; c < 4; c++) d[i + c] = acc[c] / n; }
        }
      }
    } else {
      const region = new Uint8ClampedArray(rw * rh * 4);
      for (let y = 0; y < rh; y++) region.set(d.subarray(((y0 + y) * r.w + x0) * 4, ((y0 + y) * r.w + x1) * 4), y * rw * 4);
      const radius = Math.max(2, Math.round((Math.min(r.w, r.h) * strength) / 250));
      const blurred = boxBlur(region, rw, rh, radius);
      for (let y = 0; y < rh; y++) d.set(blurred.subarray(y * rw * 4, (y + 1) * rw * 4), ((y0 + y) * r.w + x0) * 4);
    }
  }
  const fmt = sourceFmt(file);
  const bytes = await encode({ ...r, data: d }, fmt, { q: 92, dpi: r.dpi });
  return out(`${stem(file.name)}_hidden.${extOf(fmt)}`, bytes, {
    orig: file.bytes.length, engine: `${mode} ${regions.length} area${regions.length === 1 ? "" : "s"}`,
  });
}

/* ------------------------------------------------------------ adjust */

/**
 * Brightness / contrast / saturation (−100…100), plus "document" mode for
 * phone photos of paper: auto-levels that push the page background to white
 * and the ink to black, optionally in grayscale.
 */
export async function adjust([file], o) {
  const mode = oneOf(o.mode ?? "custom", ["custom", "document"], "mode");
  const bright = num(o.brightness, 0, -100, 100) / 100;
  const contrast = num(o.contrast, 0, -100, 100) / 100;
  const sat = num(o.saturation, 0, -100, 100) / 100;
  const gray = bool(o.grayscale, false);
  const r = await loadRaster(file);
  const d = new Uint8ClampedArray(r.data);
  let lo = 0, hi = 255;
  if (mode === "document") {
    // levels from the luminance histogram: ink at the 1st percentile, paper just below its peak
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
    const total = d.length / 4, pick = (p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * p) return v; } return 255; };
    lo = pick(0.01);
    hi = Math.max(lo + 32, pick(0.6) - 6);
  }
  const k = contrast >= 0 ? 1 + contrast * 2 : 1 + contrast;   // −100 → flat, +100 → 3×
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = ((v - lo) * 255) / (hi - lo);
    x = (x - 128) * k + 128 + bright * 128;
    lut[v] = x;
  }
  for (let i = 0; i < d.length; i += 4) {
    let R = lut[d[i]], G = lut[d[i + 1]], B = lut[d[i + 2]];
    const L = R * 0.299 + G * 0.587 + B * 0.114;
    if (gray) {
      R = G = B = L;
    } else if (sat) {
      const s = 1 + sat;
      R = L + (R - L) * s; G = L + (G - L) * s; B = L + (B - L) * s;
    }
    d[i] = R; d[i + 1] = G; d[i + 2] = B;
  }
  const fmt = sourceFmt(file);
  const bytes = await encode({ ...r, data: d }, fmt, { q: 92, dpi: r.dpi });
  return out(`${stem(file.name)}_adjusted.${extOf(fmt)}`, bytes, { orig: file.bytes.length, engine: mode === "document" ? "document-cleanup" : "adjusted" });
}

