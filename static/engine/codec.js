// Byte-level codecs that browsers don't provide: PNG writing (gray, 1-bit,
// palette, with DPI), colour quantisation, JPEG/PNG DPI read & patch, ZIP.
// Everything here is pure JS over Uint8Arrays — no DOM, safe in a worker.

/* ------------------------------------------------------------ checksums */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf, crc = 0) {
  crc = ~crc;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}

/* ------------------------------------------------------------ deflate */

async function compress(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ------------------------------------------------------------ sniffing */

export function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  if ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)) return "tiff";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // ISO-BMFF "ftyp": iPhone photos (HEIC/HEIF); AVIF shares the container
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

/* ------------------------------------------------------------ JPEG metadata */

function* jpegSegments(b) {
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) return;              // start of scan / end
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { i += marker === 0xff ? 1 : 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    yield { marker, start: i, data: i + 4, end: i + 2 + len };
    i += 2 + len;
  }
}

function isTag(b, at, ascii) {
  for (let k = 0; k < ascii.length; k++) if (b[at + k] !== ascii.charCodeAt(k)) return false;
  return true;
}

/** Walk IFD0 of an EXIF block. Calls fn(tag, type, valueOffset, view, le) per entry. */
function walkExif(b, tiff, fn) {
  const le = b[tiff] === 0x49;
  const view = new DataView(b.buffer, b.byteOffset);
  const u16 = (o) => view.getUint16(o, le);
  const u32 = (o) => view.getUint32(o, le);
  if (u16(tiff + 2) !== 42) return;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > b.length) return;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > b.length) return;
    const tag = u16(e), type = u16(e + 2);
    // RATIONAL values live at an offset from the TIFF header; SHORTs are inline
    const valueAt = type === 5 ? tiff + u32(e + 8) : e + 8;
    fn(tag, type, valueAt, view, le);
  }
}

/** DPI ([x, y] or null) and EXIF orientation (1-8) of a JPEG. */
export function readJpegInfo(b) {
  let jfif = null, exifRes = null, exifUnit = 2, orientation = 1;
  for (const s of jpegSegments(b)) {
    if (s.marker === 0xe0 && isTag(b, s.data, "JFIF\0") && !jfif) {
      const units = b[s.data + 7];
      const x = (b[s.data + 8] << 8) | b[s.data + 9];
      const y = (b[s.data + 10] << 8) | b[s.data + 11];
      if (units === 1) jfif = [x, y];
      else if (units === 2) jfif = [Math.round(x * 2.54), Math.round(y * 2.54)];
    } else if (s.marker === 0xe1 && isTag(b, s.data, "Exif\0\0")) {
      const res = [0, 0];
      walkExif(b, s.data + 6, (tag, type, at, view, le) => {
        if (tag === 0x0112) orientation = view.getUint16(at, le) || 1;
        else if (tag === 0x0128) exifUnit = view.getUint16(at, le);
        else if ((tag === 0x011a || tag === 0x011b) && type === 5 && at + 8 <= b.length) {
          const den = view.getUint32(at + 4, le);
          res[tag === 0x011a ? 0 : 1] = den ? view.getUint32(at, le) / den : 0;
        }
      });
      if (res[0] > 0) exifRes = res[1] > 0 ? res : [res[0], res[0]];
    }
  }
  let dpi = jfif;
  if (!dpi && exifRes && exifUnit !== 1) {
    const f = exifUnit === 3 ? 2.54 : 1;
    dpi = [Math.round(exifRes[0] * f), Math.round(exifRes[1] * f)];
  }
  if (dpi && (dpi[0] <= 0 || dpi[1] <= 0)) dpi = null;
  return { dpi, orientation: orientation >= 1 && orientation <= 8 ? orientation : 1 };
}

/** Return a copy of a JPEG tagged with dpi (null = no physical size), losslessly.
 *  Patches the JFIF header (inserting one if missing) and any EXIF resolution. */
export function setJpegDpi(src, dpi) {
  let b = src.slice();
  const units = dpi ? 1 : 0, d = dpi || 1;
  let patched = false;
  for (const s of jpegSegments(b)) {
    if (s.marker === 0xe0 && isTag(b, s.data, "JFIF\0") && !patched) {
      b[s.data + 7] = units;
      b[s.data + 8] = d >> 8; b[s.data + 9] = d & 0xff;
      b[s.data + 10] = d >> 8; b[s.data + 11] = d & 0xff;
      patched = true;
    } else if (s.marker === 0xe1 && isTag(b, s.data, "Exif\0\0") && dpi) {
      walkExif(b, s.data + 6, (tag, type, at, view, le) => {
        if ((tag === 0x011a || tag === 0x011b) && type === 5 && at + 8 <= b.length) {
          view.setUint32(at, dpi, le);
          view.setUint32(at + 4, 1, le);
        } else if (tag === 0x0128 && type === 3) {
          view.setUint16(at, 2, le);
        }
      });
    }
  }
  if (!patched) {
    const app0 = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
      units, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00]);
    const out = new Uint8Array(b.length + app0.length);
    out.set(b.subarray(0, 2), 0);
    out.set(app0, 2);
    out.set(b.subarray(2), 2 + app0.length);
    b = out;
  }
  return b;
}

/* ------------------------------------------------------------ PNG metadata */

function* pngChunks(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 8;
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    yield { type, start: i, data: i + 8, len, end: i + 12 + len };
    if (type === "IEND") return;
    i += 12 + len;
  }
}

export function readPngDpi(b) {
  for (const c of pngChunks(b)) {
    if (c.type === "pHYs" && c.len >= 9) {
      const view = new DataView(b.buffer, b.byteOffset + c.data, 9);
      if (view.getUint8(8) !== 1) return null;       // unit 0 = aspect ratio only
      const x = Math.round(view.getUint32(0) * 0.0254), y = Math.round(view.getUint32(4) * 0.0254);
      return x > 0 && y > 0 ? [x, y] : null;
    }
    if (c.type === "IDAT") return null;
  }
  return null;
}

function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let k = 0; k < 4; k++) out[4 + k] = type.charCodeAt(k);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function physChunk(dpi) {
  const d = new Uint8Array(9);
  const view = new DataView(d.buffer);
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(0, ppm); view.setUint32(4, ppm); d[8] = 1;
  return pngChunk("pHYs", d);
}

/** Copy of a PNG with its pHYs replaced (dpi null removes it), losslessly. */
export function setPngDpi(b, dpi) {
  const parts = [b.subarray(0, 8)];
  for (const c of pngChunks(b)) {
    if (c.type === "pHYs") continue;
    parts.push(b.subarray(c.start, c.end));
    if (c.type === "IHDR" && dpi) parts.push(physChunk(dpi));
  }
  return concat(parts);
}

export function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* ------------------------------------------------------------ PNG encoder */

function filterAdaptive(raw, rowLen, h, bpp) {
  const out = new Uint8Array(h * (rowLen + 1));
  const zero = new Uint8Array(rowLen);
  const cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(rowLen));
  const [c0, c1, c2, c3, c4] = cand;
  const cost = (v) => (v < 128 ? v : 256 - v);
  for (let y = 0; y < h; y++) {
    const row = raw.subarray(y * rowLen, (y + 1) * rowLen);
    const up = y ? raw.subarray((y - 1) * rowLen, y * rowLen) : zero;
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0;
    for (let x = 0; x < rowLen; x++) {
      const r = row[x];
      const a = x >= bpp ? row[x - bpp] : 0, b = up[x], c = x >= bpp ? up[x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const v1 = (r - a) & 255, v2 = (r - b) & 255, v3 = (r - ((a + b) >> 1)) & 255, v4 = (r - paeth) & 255;
      c0[x] = r; c1[x] = v1; c2[x] = v2; c3[x] = v3; c4[x] = v4;
      s0 += cost(r); s1 += cost(v1); s2 += cost(v2); s3 += cost(v3); s4 += cost(v4);
    }
    const sums = [s0, s1, s2, s3, s4];
    let best = 0;
    for (let f = 1; f < 5; f++) if (sums[f] < sums[best]) best = f;
    out[y * (rowLen + 1)] = best;
    out.set(cand[best], y * (rowLen + 1) + 1);
  }
  return out;
}

function filterNone(raw, rowLen, h) {
  const out = new Uint8Array(h * (rowLen + 1));
  for (let y = 0; y < h; y++) out.set(raw.subarray(y * rowLen, (y + 1) * rowLen), y * (rowLen + 1) + 1);
  return out;
}

function packBits(indices, w, h, depth) {
  const rowLen = Math.ceil((w * depth) / 8);
  const out = new Uint8Array(rowLen * h);
  const perByte = 8 / depth;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const shift = 8 - depth * ((x % perByte) + 1);
      out[y * rowLen + Math.floor(x / perByte)] |= indices[y * w + x] << shift;
    }
  }
  return { raw: out, rowLen };
}

/**
 * Encode a PNG. img is one of:
 *   { kind: "rgba", w, h, data }               (alpha dropped when fully opaque)
 *   { kind: "gray", w, h, data }               8-bit gray
 *   { kind: "bits", w, h, data }               packed 1-bit rows, 1 = white
 *   { kind: "indexed", w, h, data, palette }   palette = RGBA bytes
 */
export async function encodePNG(img, dpi) {
  const { w, h } = img;
  let colorType, depth = 8, filtered, extra = [];
  if (img.kind === "bits") {
    colorType = 0; depth = 1;
    filtered = filterNone(img.data, (w + 7) >> 3, h);
  } else if (img.kind === "gray") {
    colorType = 0;
    filtered = filterAdaptive(img.data, w, h, 1);
  } else if (img.kind === "indexed") {
    colorType = 3;
    const n = img.palette.length / 4;
    depth = n <= 2 ? 1 : n <= 4 ? 2 : n <= 16 ? 4 : 8;
    const plte = new Uint8Array(n * 3), trns = new Uint8Array(n);
    let anyAlpha = false;
    for (let k = 0; k < n; k++) {
      plte[k * 3] = img.palette[k * 4]; plte[k * 3 + 1] = img.palette[k * 4 + 1]; plte[k * 3 + 2] = img.palette[k * 4 + 2];
      trns[k] = img.palette[k * 4 + 3];
      if (trns[k] < 255) anyAlpha = true;
    }
    extra.push(pngChunk("PLTE", plte));
    if (anyAlpha) extra.push(pngChunk("tRNS", trns));
    const { raw, rowLen } = depth === 8 ? { raw: img.data, rowLen: w } : packBits(img.data, w, h, depth);
    filtered = filterNone(raw, rowLen, h);
  } else {
    const d = img.data;
    let opaque = true;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { opaque = false; break; }
    if (opaque) {
      colorType = 2;
      const rgb = new Uint8Array(w * h * 3);
      for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2]; }
      filtered = filterAdaptive(rgb, w * 3, h, 3);
    } else {
      colorType = 6;
      filtered = filterAdaptive(new Uint8Array(d.buffer, d.byteOffset, d.length), w * 4, h, 4);
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, w); view.setUint32(4, h);
  ihdr[8] = depth; ihdr[9] = colorType;
  const idat = await compress(filtered, "deflate");
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    ...(dpi ? [physChunk(dpi)] : []),
    ...extra,
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

/* ------------------------------------------------------------ quantiser */

/** Reduce RGBA pixels to at most k colours (median cut). Returns an "indexed" image. */
export function quantize({ w, h, data }, k) {
  const n = w * h;
  // exact palette when the image already has <= k colours
  const exact = new Map();
  const px32 = new Uint32Array(data.buffer, data.byteOffset, n);
  for (let i = 0; i < n && exact.size <= k; i++) {
    const v = data[i * 4 + 3] === 0 ? 0 : px32[i];
    if (!exact.has(v)) exact.set(v, exact.size);
  }
  if (exact.size <= k) {
    const palette = new Uint8Array(exact.size * 4);
    for (const [v, idx] of exact) palette.set(new Uint8Array(new Uint32Array([v]).buffer), idx * 4);
    const idx = new Uint8Array(n);
    for (let i = 0; i < n; i++) idx[i] = exact.get(data[i * 4 + 3] === 0 ? 0 : px32[i]);
    return { kind: "indexed", w, h, data: idx, palette };
  }

  // histogram on 5-bit RGB + 4-bit alpha
  const SIZE = 1 << 19;
  const keyOf = (i) => {
    const a = data[i + 3];
    if (a === 0) return 0;
    return ((data[i] >> 3) << 14) | ((data[i + 1] >> 3) << 9) | ((data[i + 2] >> 3) << 4) | (a >> 4);
  };
  const count = new Uint32Array(SIZE);
  const sum = [0, 1, 2, 3].map(() => new Float64Array(SIZE));
  for (let i = 0; i < n * 4; i += 4) {
    const key = keyOf(i);
    count[key]++;
    sum[0][key] += data[i]; sum[1][key] += data[i + 1]; sum[2][key] += data[i + 2]; sum[3][key] += data[i + 3];
  }
  const keys = [];
  for (let key = 0; key < SIZE; key++) if (count[key]) keys.push(key);
  const arr = Uint32Array.from(keys);
  const chan = [(x) => x >> 14, (x) => (x >> 9) & 31, (x) => (x >> 4) & 31, (x) => (x & 15) * 2];

  const boxes = [{ s: 0, e: arr.length }];
  const measure = (box) => {
    let best = 0, bestRange = -1, total = 0;
    for (let c = 0; c < 4; c++) {
      let lo = 99, hi = -1;
      for (let i = box.s; i < box.e; i++) { const v = chan[c](arr[i]); if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > bestRange) { bestRange = hi - lo; best = c; }
    }
    for (let i = box.s; i < box.e; i++) total += count[arr[i]];
    box.chan = best; box.range = bestRange; box.total = total;
  };
  measure(boxes[0]);
  while (boxes.length < k) {
    let pick = -1, score = 0;
    for (let b = 0; b < boxes.length; b++) {
      const s = boxes[b].range * Math.sqrt(boxes[b].total);
      if (boxes[b].e - boxes[b].s > 1 && s > score) { score = s; pick = b; }
    }
    if (pick < 0) break;
    const box = boxes[pick];
    const f = chan[box.chan];
    arr.subarray(box.s, box.e).sort((a, b) => f(a) - f(b));
    let acc = 0, mid = box.s + 1;
    for (let i = box.s; i < box.e - 1; i++) {
      acc += count[arr[i]];
      if (acc >= box.total / 2) { mid = i + 1; break; }
    }
    const a = { s: box.s, e: mid }, b = { s: mid, e: box.e };
    measure(a); measure(b);
    boxes.splice(pick, 1, a, b);
  }

  const palette = new Uint8Array(boxes.length * 4);
  boxes.forEach((box, p) => {
    let c = 0; const acc = [0, 0, 0, 0];
    for (let i = box.s; i < box.e; i++) {
      const key = arr[i];
      c += count[key];
      for (let ch = 0; ch < 4; ch++) acc[ch] += sum[ch][key];
    }
    for (let ch = 0; ch < 4; ch++) palette[p * 4 + ch] = Math.round(acc[ch] / c);
  });

  const cache = new Int16Array(SIZE).fill(-1);
  const idx = new Uint8Array(n);
  const P = boxes.length;
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const key = keyOf(i);
    let best = cache[key];
    if (best < 0) {
      let bd = Infinity;
      const r = data[i], g = data[i + 1], bl = data[i + 2], al = data[i + 3];
      for (let p = 0; p < P; p++) {
        const dr = palette[p * 4] - r, dg = palette[p * 4 + 1] - g, db = palette[p * 4 + 2] - bl, da = palette[p * 4 + 3] - al;
        const dist = dr * dr + dg * dg + db * db + 2 * da * da;
        if (dist < bd) { bd = dist; best = p; }
      }
      cache[key] = best;
    }
    idx[j] = best;
  }
  return { kind: "indexed", w, h, data: idx, palette };
}

/* ------------------------------------------------------------ ZIP */

/** Build a ZIP from [{ name, bytes }]. Entries are deflated unless that doesn't help. */
export async function makeZip(entries) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [], central = [];
  let offset = 0;
  const used = new Set();
  for (const e of entries) {
    let name = e.name;
    for (let k = 2; used.has(name); k++) name = e.name.replace(/(\.[^.]*)?$/, `_${k}$1`);
    used.add(name);
    const nameBytes = enc.encode(name);
    const crc = crc32(e.bytes);
    let data = await compress(e.bytes, "deflate-raw"), method = 8;
    if (data.length >= e.bytes.length) { data = e.bytes; method = 0; }
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, method, true); lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, e.bytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lh.set(nameBytes, 30);
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true); cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true);
    cv.setUint32(24, e.bytes.length, true); cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    locals.push(lh, data);
    central.push(ch);
    offset += lh.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return concat([...locals, ...central, end]);
}
