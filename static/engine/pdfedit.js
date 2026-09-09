// PDF editing tools: watermark, page numbers, sign, redact, crop, unlock,
// repair, metadata, flatten, and export to text / Word.
//
// Positions are given in *display space* — the page as you see it (top-left
// origin, y down, page rotation applied) — and mapped into PDF user space
// with the page's own transform, so rotated pages come out right.
import * as mupdf from "../vendor/mupdf/mupdf.js";
import { makeZip } from "./codec.js";
import { openPdf, openUnlocked, save } from "./pdf.js";
import { UserError, bool, int, num, oneOf, out, parsePages, stem } from "./util.js";

const f4 = (v) => +v.toFixed(4);
const mat = (m) => m.map(f4).join(" ");

/** Matrix taking display-space coordinates to this page's user space. */
function displayToUser(page, m) {
  return mupdf.Matrix.concat(m, mupdf.Matrix.invert(page.getTransform()));
}

/** Width and height of the page as displayed. */
function pageSize(page) {
  const [x0, y0, x1, y1] = page.getBounds();
  return [x1 - x0, y1 - y0];
}

/**
 * Draw on top of a page: the existing content is wrapped in q … Q so its
 * graphics state can't leak into ours, then ops run with extra resources
 * ({ Font: {name: ref}, XObject: {…}, ExtGState: {…} }).
 */
function overlay(doc, page, ops, resources) {
  const obj = page.getObject();
  let res = obj.getInheritable("Resources");
  if (!res.isDictionary()) res = doc.newDictionary();
  obj.put("Resources", res);
  for (const [cat, entries] of Object.entries(resources)) {
    let sub = res.get(cat);
    if (!sub.isDictionary()) {
      sub = doc.newDictionary();
      res.put(cat, sub);
    }
    for (const [name, ref] of Object.entries(entries)) sub.put(name, ref);
  }
  const contents = obj.get("Contents");
  const list = doc.newArray();
  list.push(doc.addStream("q\n", {}));
  if (contents.isArray()) contents.forEach((c) => list.push(c));
  else if (!contents.isNull()) list.push(contents);
  list.push(doc.addStream(`\nQ\n${ops}\n`, {}));
  obj.put("Contents", list);
}

/** A standard PDF font (no embedding needed) plus its metrics for measuring text. */
function stdFont(doc, name = "Helvetica-Bold") {
  const font = new mupdf.Font(name);
  return { font, ref: doc.addSimpleFont(font, "Latin") };
}

function textWidth(font, text, size) {
  let w = 0;
  for (const ch of text) w += font.advanceGlyph(font.encodeCharacter(ch));
  return w * size;
}

/** PDF string literal for a simple Latin font (characters outside Latin-1 become "?"). */
function pdfString(text) {
  let s = "";
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") s += "\\" + ch;
    else if (c >= 32 && c < 127) s += ch;
    else if (c >= 160 && c < 256) s += "\\" + c.toString(8).padStart(3, "0");
    else s += "?";
  }
  return `(${s})`;
}

function opacityState(doc, alpha) {
  return doc.addObject({ Type: "ExtGState", ca: f4(alpha), CA: f4(alpha) });
}

function rgb(hex, fallback = [0, 0, 0]) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/**
 * Operators that draw one line of text with its baseline starting at display
 * point (x, y), turned counter-clockwise by deg as seen on screen.
 */
function textOps(page, fontName, size, text, x, y, deg = 0) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const m = displayToUser(page, [c, -s, -s, -c, x, y]);
  return `q ${mat(m)} cm BT /${fontName} ${f4(size)} Tf 0 0 Td ${pdfString(text)} Tj ET Q`;
}

const MM = 72 / 25.4;

/* ------------------------------------------------------------ watermark */

export async function watermark([file], o, progress) {
  const text = String(o.text ?? "").trim();
  if (!text) throw new UserError("Enter the watermark text");
  const size = num(o.size, 60, 6, 400);
  const alpha = num(o.opacity, 25, 1, 100) / 100;
  const deg = num(o.angle, 45, -360, 360);
  const layout = oneOf(o.layout ?? "center", ["center", "tiled"], "layout");
  const color = rgb(o.color, [0.6, 0.1, 0.15]);
  const doc = openUnlocked(file);
  try {
    const { font, ref } = stdFont(doc);
    const gs = opacityState(doc, alpha);
    const tw = textWidth(font, text, size);
    const pages = parsePages(o.pages, doc.countPages());
    const t = (deg * Math.PI) / 180;
    const u = [Math.cos(t), -Math.sin(t)];        // along the text, on screen
    const up = [-Math.sin(t), -Math.cos(t)];      // towards the top of the letters
    pages.forEach((i, k) => {
      progress?.(k, pages.length, `page ${i + 1}`);
      const page = doc.loadPage(i);
      const [W, H] = pageSize(page);
      // baseline start that centres the text (cap height ≈ 0.7 × size) on (cx, cy)
      const at = (cx, cy) => [cx - (tw / 2) * u[0] - 0.35 * size * up[0], cy - (tw / 2) * u[1] - 0.35 * size * up[1]];
      let ops = `/MTGs gs ${color.map(f4).join(" ")} rg\n`;
      if (layout === "center") {
        ops += textOps(page, "MTWm", size, text, ...at(W / 2, H / 2), deg);
      } else {
        // tile along the text direction and across it, covering the page diagonal
        const stepU = tw + size * 2, stepV = size * 4, reach = Math.hypot(W, H);
        for (let a = -reach; a <= reach; a += stepV) {
          for (let b = -reach; b <= reach; b += stepU) {
            const cx = W / 2 + b * u[0] + a * up[0], cy = H / 2 + b * u[1] + a * up[1];
            if (cx < -tw || cx > W + tw || cy < -tw || cy > H + tw) continue;
            ops += textOps(page, "MTWm", size, text, ...at(cx, cy), deg) + "\n";
          }
        }
      }
      overlay(doc, page, ops, { Font: { MTWm: ref }, ExtGState: { MTGs: gs } });
    });
    return out(`${stem(file.name)}_watermarked.pdf`, save(doc), { orig: file.bytes.length, engine: `${pages.length} pages` });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ page numbers */

export async function pageNumbers([file], o) {
  const position = oneOf(o.position ?? "bc", ["tl", "tc", "tr", "bl", "bc", "br"], "position");
  const format = oneOf(o.format ?? "n", ["n", "page-n", "n-of-total", "page-n-of-total"], "format");
  const size = num(o.size, 11, 5, 72);
  const margin = num(o.margin_mm, 10, 0, 100) * MM;
  const start = int(o.start, 1, -1e6, 1e6);
  const doc = openUnlocked(file);
  try {
    const { font, ref } = stdFont(doc, "Helvetica");
    const pages = parsePages(o.pages, doc.countPages());
    const last = start + pages.length - 1;
    pages.forEach((i, k) => {
      const page = doc.loadPage(i);
      const [W, H] = pageSize(page);
      const n = start + k;
      const label = { n: `${n}`, "page-n": `Page ${n}`, "n-of-total": `${n} / ${last}`, "page-n-of-total": `Page ${n} of ${last}` }[format];
      const tw = textWidth(font, label, size);
      const x = position[1] === "l" ? margin : position[1] === "r" ? W - margin - tw : (W - tw) / 2;
      const y = position[0] === "t" ? margin + size * 0.75 : H - margin;
      overlay(doc, page, `0.25 g ${textOps(page, "MTPn", size, label, x, y)}`, { Font: { MTPn: ref } });
    });
    return out(`${stem(file.name)}_numbered.pdf`, save(doc), { orig: file.bytes.length, engine: `numbered ${pages.length} pages` });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ sign */

/**
 * files = [pdf, signature image]. x, y, w, h are fractions of the displayed
 * page, so the same placement works on pages of any size or rotation.
 */
export async function sign([file, sig], o) {
  if (!sig) throw new UserError("Create or upload a signature first");
  const x = num(o.x, 0.6, 0, 1), y = num(o.y, 0.8, 0, 1), w = num(o.w, 0.3, 0.01, 1), h = num(o.h, 0.1, 0.005, 1);
  const doc = openUnlocked(file);
  try {
    let image;
    try {
      image = new mupdf.Image(sig.bytes);
    } catch {
      throw new UserError("The signature image couldn't be read");
    }
    const ref = doc.addImage(image);
    image.destroy();
    const n = doc.countPages();
    const which = String(o.pages ?? "1").trim().toLowerCase();
    const pages = which === "last" ? [n - 1] : parsePages(which, n);
    for (const i of pages) {
      const page = doc.loadPage(i);
      const [W, H] = pageSize(page);
      const rx = x * W, ry = y * H, rw = w * W, rh = h * H;
      // the image's unit square, top row first, onto the display rectangle
      const m = displayToUser(page, [rw, 0, 0, -rh, rx, ry + rh]);
      overlay(doc, page, `q ${mat(m)} cm /MTSig Do Q`, { XObject: { MTSig: ref } });
    }
    return out(`${stem(file.name)}_signed.pdf`, save(doc), {
      orig: file.bytes.length, engine: `signed ${pages.length} page${pages.length === 1 ? "" : "s"}`,
    });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ redact */

// MuPDF's regex dialect: no \d or \+, so classes are spelled out.
const REDACT_PRESETS = {
  email: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}",
  phone: "[+]?[0-9][0-9 -]{8,14}[0-9]",
  aadhaar: "[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}",
  pan: "[A-Z]{5}[0-9]{4}[A-Z]",
  card: "[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}",
};

/**
 * Find text and remove it for real: MuPDF deletes the matching glyphs (and
 * image pixels underneath) and paints black boxes, so nothing can be copied
 * or recovered from the output.
 */
export async function redact([file], o, progress) {
  const terms = String(o.terms ?? "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  const presets = Object.keys(REDACT_PRESETS).filter((k) => bool(o[k], false));
  if (!terms.length && !presets.length) throw new UserError("Enter text to redact or tick a pattern");
  const caseOpt = bool(o.match_case, false) ? "" : "ignore-case";
  const searches = [
    ...terms.map((t) => [t, caseOpt]),
    ...presets.map((k) => [REDACT_PRESETS[k], ["regexp", caseOpt].filter(Boolean).join(",")]),
  ];
  const doc = openUnlocked(file);
  try {
    let hits = 0, pagesHit = 0;
    const n = doc.countPages();
    for (let i = 0; i < n; i++) {
      progress?.(i, n, `page ${i + 1} of ${n}`);
      const page = doc.loadPage(i);
      let here = 0;
      for (const [needle, opts] of searches) {
        for (const quads of page.search(needle, opts)) {
          page.createAnnotation("Redact").setQuadPoints(quads);
          here++;
        }
      }
      if (here) {
        page.applyRedactions(true);
        hits += here;
        pagesHit++;
      }
    }
    if (!hits) return out(`${stem(file.name)}_redacted.pdf`, file.bytes, { orig: file.bytes.length, engine: "no-matches" });
    return out(`${stem(file.name)}_redacted.pdf`, save(doc), {
      orig: file.bytes.length, engine: `${hits} match${hits === 1 ? "" : "es"} removed on ${pagesHit} page${pagesHit === 1 ? "" : "s"}`,
    });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ crop */

/** Crop to a rectangle given as fractions of the displayed page (from the crop editor). */
export async function crop([file], o) {
  const x = num(o.x, 0, 0, 0.99), y = num(o.y, 0, 0, 0.99);
  const w = num(o.w, 1, 0.01, 1 - x), h = num(o.h, 1, 0.01, 1 - y);
  const doc = openUnlocked(file);
  try {
    const pages = parsePages(o.pages, doc.countPages());
    for (const i of pages) {
      const page = doc.loadPage(i);
      const [W, H] = pageSize(page);
      // setPageBox takes display coordinates and maps them through the page rotation itself
      page.setPageBox("CropBox", [x * W, y * H, (x + w) * W, (y + h) * H].map(f4));
    }
    return out(`${stem(file.name)}_cropped.pdf`, save(doc), { orig: file.bytes.length, engine: `cropped ${pages.length} pages` });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ unlock / repair / flatten */

export async function unlock([file], o) {
  const doc = openPdf(file);
  try {
    if (doc.needsPassword()) {
      const pw = String(o.password ?? "");
      if (!pw) throw new UserError("Enter the PDF's password");
      if (!doc.authenticatePassword(pw)) throw new UserError("That password is wrong");
    } else if ((doc.getMetaData("encryption") || "None") === "None") {
      throw new UserError("This PDF isn't password-protected");
    }
    // encrypt=none writes the file without any encryption or permission limits
    return out(`${stem(file.name)}_unlocked.pdf`, save(doc, "encrypt=none,garbage=4,compress,objstms"), {
      orig: file.bytes.length, engine: doc.needsPassword() ? "password-removed" : "restrictions-removed",
    });
  } finally {
    doc.destroy();
  }
}

export async function repair([file]) {
  const doc = openPdf(file);
  try {
    if (doc.needsPassword()) throw new UserError(`${file.name} is password-protected — unlock it first`);
    const repaired = doc.wasRepaired();
    // a fresh save also rebuilds the cross-reference table and drops broken objects
    return out(`${stem(file.name)}_repaired.pdf`, save(doc), {
      orig: file.bytes.length, engine: repaired ? "damage-repaired" : "no-damage-found",
    });
  } finally {
    doc.destroy();
  }
}

export async function flatten([file]) {
  const doc = openUnlocked(file);
  try {
    doc.bake(true, true);   // form fields and annotations become plain page content
    return out(`${stem(file.name)}_flattened.pdf`, save(doc), { orig: file.bytes.length, engine: "flattened" });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ metadata */

const META = ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"];

export async function info([file]) {
  const doc = openPdf(file);
  try {
    const locked = doc.needsPassword();
    const meta = {};
    for (const k of META) meta[k.toLowerCase()] = locked ? "" : doc.getMetaData(`info:${k}`) || "";
    return { locked, pages: locked ? 0 : doc.countPages(), encryption: doc.getMetaData("encryption") || "None", meta };
  } finally {
    doc.destroy();
  }
}

export async function metadata([file], o) {
  const mode = oneOf(o.mode ?? "remove", ["remove", "edit"], "mode");
  const doc = openUnlocked(file);
  try {
    const root = doc.getTrailer().get("Root");
    if (mode === "remove") {
      doc.getTrailer().delete("Info");
      root.delete("Metadata");                     // XMP packet
      for (let i = 0; i < doc.countPages(); i++) doc.loadPage(i).getObject().delete("Metadata");
    } else {
      for (const k of META) {
        const v = String(o[k.toLowerCase()] ?? "").trim();
        doc.setMetaData(`info:${k}`, v);         // an empty value removes the field
      }
      root.delete("Metadata");                     // stale XMP would contradict the new values
    }
    return out(`${stem(file.name)}_${mode === "remove" ? "clean" : "edited"}.pdf`, save(doc), {
      orig: file.bytes.length, engine: mode === "remove" ? "metadata-removed" : "metadata-updated",
    });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ export text / Word */

function noText() {
  return new UserError("No text found — this PDF looks scanned (images of pages). It would need OCR first.");
}

export async function toText([file]) {
  const doc = openUnlocked(file);
  try {
    const n = doc.countPages(), parts = [];
    for (let i = 0; i < n; i++) {
      const text = doc.loadPage(i).toStructuredText("preserve-whitespace").asText().replace(/\s+$/, "");
      parts.push(n > 1 ? `--- Page ${i + 1} ---\n\n${text}` : text);
    }
    const all = parts.join("\n\n");
    if (!all.replace(/--- Page \d+ ---/g, "").trim()) throw noText();
    return out(`${stem(file.name)}.txt`, new TextEncoder().encode(all + "\n"), { orig: file.bytes.length, engine: `${n} pages` });
  } finally {
    doc.destroy();
  }
}

const xml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
  // characters XML 1.0 forbids (control codes from broken text layers)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");

const WORD_FONTS = { "sans-serif": "Arial", serif: "Times New Roman", monospace: "Courier New" };

function run(text, font) {
  const face = WORD_FONTS[font.family] || "Arial";
  const props = [
    `<w:rFonts w:ascii="${face}" w:hAnsi="${face}" w:cs="${face}"/>`,
    font.weight === "bold" ? "<w:b/>" : "",
    font.style === "italic" ? "<w:i/>" : "",
    `<w:sz w:val="${Math.max(2, Math.round(font.size * 2))}"/>`,
  ].join("");
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

/**
 * Editable Word document from the text layer: each text block becomes a
 * paragraph keeping font size, bold and italic; pages are separated by page
 * breaks. Complex layouts (columns, tables, images) are simplified.
 */
export async function toWord([file], o, progress) {
  const doc = openUnlocked(file);
  try {
    const n = doc.countPages();
    const body = [];
    let words = 0, pageW = 595.28, pageH = 841.89;
    for (let i = 0; i < n; i++) {
      progress?.(i, n, `page ${i + 1} of ${n}`);
      const page = doc.loadPage(i);
      if (i === 0) [pageW, pageH] = pageSize(page);
      const { blocks } = JSON.parse(page.toStructuredText("preserve-whitespace").asJSON());
      for (const b of blocks) {
        if (b.type !== "text" || !b.lines?.length) continue;
        const runs = [];
        b.lines.forEach((line, k) => {
          let text = line.text.replace(/\s+$/, "");
          if (!text) return;
          const prev = runs.length ? runs[runs.length - 1] : null;
          // join wrapped lines with a space, or glue hyphenated words back together
          if (prev && k > 0) {
            if (/[a-z]-$/i.test(prev.text)) prev.text = prev.text.slice(0, -1);
            else text = " " + text;
          }
          runs.push({ text, font: line.font });
          words += text.split(/\s+/).filter(Boolean).length;
        });
        if (runs.length) body.push(`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs.map((r) => run(r.text, r.font)).join("")}</w:p>`);
      }
      if (i < n - 1) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
    if (!words) throw noText();
    const twips = (pt) => Math.round(pt * 20);
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="${twips(pageW)}" w:h="${twips(pageH)}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const enc = new TextEncoder();
    const docx = await makeZip([
      { name: "[Content_Types].xml", bytes: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
      { name: "_rels/.rels", bytes: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
      { name: "word/document.xml", bytes: enc.encode(documentXml) },
    ]);
    return out(`${stem(file.name)}.docx`, docx, { orig: file.bytes.length, engine: `${words} words from ${n} pages` });
  } finally {
    doc.destroy();
  }
}

/** Render one page (for the sign / crop editors), with the page count. */
export async function renderPage([file], o) {
  const doc = openUnlocked(file);
  try {
    const n = doc.countPages();
    const i = Math.min(n - 1, int(o.page, 0, 0, 1e6));
    const page = doc.loadPage(i);
    const [W, H] = pageSize(page);
    // either a target pixel width (editors) or a DPI (OCR wants ~300)
    const z = o.dpi ? num(o.dpi, 150, 36, 600) / 72 : num(o.width, 900, 100, 3000) / W;
    const cs = bool(o.gray, false) ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB;
    const pix = page.toPixmap(mupdf.Matrix.scale(z, z), cs, false);
    try {
      return { pages: n, page: i, w: W, h: H, png: pix.asPNG() };
    } finally {
      pix.destroy();
    }
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ text runs (for click-to-edit) */

const cleanFontName = (name) => (name || "").replace(/^[A-Z]{6}\+/, "");

/**
 * Lines of a page split into runs of one style (font, size, colour) and
 * without big gaps, so "Name:  Ravi Kumar" in two styles gives two click
 * targets. Coordinates are display space; fonts are live MuPDF objects.
 */
function textRuns(page) {
  const st = page.toStructuredText("preserve-whitespace");
  const runs = [];
  let cur = null;
  const close = () => {
    if (cur && cur.text.trim()) {
      const lead = cur.text.length - cur.text.trimStart().length;
      const first = cur.chars[lead];
      cur.text = cur.text.trim();
      cur.origin = first.origin;
      runs.push(cur);
    }
    cur = null;
  };
  st.walk({
    beginLine() { close(); },
    onChar(c, origin, font, size, quad, color) {
      const xs = [quad[0], quad[2], quad[4], quad[6]], ys = [quad[1], quad[3], quad[5], quad[7]];
      const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const same = cur && cur.font.getName() === font.getName() && Math.abs(cur.size - size) < 0.6
        && cur.color.join() === color.join() && box[0] - cur.bbox[2] < size * 1.2;
      if (!same) {
        close();
        cur = { text: "", chars: [], font, size, color, bbox: box };
      }
      cur.text += c;
      cur.chars.push({ c, origin });
      cur.bbox = [Math.min(cur.bbox[0], box[0]), Math.min(cur.bbox[1], box[1]), Math.max(cur.bbox[2], box[2]), Math.max(cur.bbox[3], box[3])];
    },
    endLine() { close(); },
  });
  close();
  return runs;
}

const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");

/** The editable text runs of one page, as fractions of the displayed page. */
export async function pageText([file], o) {
  const doc = openUnlocked(file);
  try {
    const n = doc.countPages();
    const i = Math.min(n - 1, int(o.page, 0, 0, 1e6));
    const page = doc.loadPage(i);
    const [W, H] = pageSize(page);
    const runs = textRuns(page).map((r) => ({
      text: r.text,
      x: r.bbox[0] / W, y: r.bbox[1] / H, w: (r.bbox[2] - r.bbox[0]) / W, h: (r.bbox[3] - r.bbox[1]) / H,
      baseline: r.origin[1] / H, left: r.origin[0] / W, size: r.size / H,
      color: r.color.length >= 3 ? hex(r.color) : "#000000",
      font: {
        name: cleanFontName(r.font.getName()),
        bold: r.font.isBold() || /bold|black|heavy|semibold/i.test(r.font.getName()),
        italic: r.font.isItalic() || /italic|oblique/i.test(r.font.getName()),
        serif: r.font.isSerif(), mono: r.font.isMono(),
      },
    }));
    return { page: i, pages: n, w: W, h: H, runs };
  } finally {
    doc.destroy();
  }
}

/** Characters per page — tells OCR which pages are scans (no text layer). */
export async function textStats([file]) {
  const doc = openUnlocked(file);
  try {
    const chars = [];
    for (let i = 0; i < doc.countPages(); i++) chars.push(doc.loadPage(i).toStructuredText("").asText().replace(/\s+/g, "").length);
    return { pages: chars.length, chars };
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ editing */

/** The closest standard PDF font for a family/weight/style. */
function standardFont(family, bold, italic) {
  if (family === "courier" || family === "mono") return ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"][(bold ? 1 : 0) + (italic ? 2 : 0)];
  if (family === "times" || family === "serif") return ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"][(bold ? 1 : 0) + (italic ? 2 : 0)];
  return ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"][(bold ? 1 : 0) + (italic ? 2 : 0)];
}

const KAPPA = 0.5523;
const n4 = (v) => f4(v);

function ellipsePath(x, y, w, h) {
  const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry, kx = rx * KAPPA, ky = ry * KAPPA;
  return [
    `${n4(cx + rx)} ${n4(cy)} m`,
    `${n4(cx + rx)} ${n4(cy + ky)} ${n4(cx + kx)} ${n4(cy + ry)} ${n4(cx)} ${n4(cy + ry)} c`,
    `${n4(cx - kx)} ${n4(cy + ry)} ${n4(cx - rx)} ${n4(cy + ky)} ${n4(cx - rx)} ${n4(cy)} c`,
    `${n4(cx - rx)} ${n4(cy - ky)} ${n4(cx - kx)} ${n4(cy - ry)} ${n4(cx)} ${n4(cy - ry)} c`,
    `${n4(cx + kx)} ${n4(cy - ry)} ${n4(cx + rx)} ${n4(cy - ky)} ${n4(cx + rx)} ${n4(cy)} c`,
  ].join("\n");
}

const rgbOp = (hexColor, stroke) => `${rgb(hexColor).map(f4).join(" ")} ${stroke ? "RG" : "rg"}`;

/**
 * Apply editor objects to a PDF. files = [pdf, ...images]; o.edits = JSON
 * [{ page, type, … }] with coordinates as fractions of the displayed page.
 * Types: text, rect, ellipse, line, arrow, pen, highlight, whiteout, image,
 * replace (change existing text, matching its font).
 */
export async function applyEdits([file, ...images], o, progress) {
  let edits;
  try {
    edits = JSON.parse(o.edits || "[]");
  } catch {
    throw new UserError("The edits are unreadable");
  }
  if (!Array.isArray(edits) || !edits.length) throw new UserError("Nothing to save — add some edits first");
  const doc = openUnlocked(file);
  try {
    const byPage = new Map();
    for (const e of edits) {
      const i = int(e.page, 0, 0, doc.countPages() - 1);
      if (!byPage.has(i)) byPage.set(i, []);
      byPage.get(i).push(e);
    }
    const imageRefs = new Map();
    const fontRefs = new Map();   // key → resource name
    let k = 0;
    for (const [i, list] of byPage) {
      progress?.(k++, byPage.size, `page ${i + 1}`);
      const page = doc.loadPage(i);
      const [W, H] = pageSize(page);
      const toUser = mat(mupdf.Matrix.invert(page.getTransform()));
      const res = { Font: {}, XObject: {}, ExtGState: {} };
      const ops = [];

      // 1) replaced text: find each run's original font, then remove its glyphs (no black box)
      const replaces = list.filter((e) => e.type === "replace");
      const runs = replaces.length ? textRuns(page) : [];
      const plans = replaces.map((e) => {
        const box = [e.x * W, e.y * H, (e.x + e.w) * W, (e.y + e.h) * H];
        const overlap = (r) => Math.max(0, Math.min(box[2], r.bbox[2]) - Math.max(box[0], r.bbox[0])) * Math.max(0, Math.min(box[3], r.bbox[3]) - Math.max(box[1], r.bbox[1]));
        const run = runs.reduce((best, r) => (overlap(r) > (best ? overlap(best) : 0) ? r : best), null);
        return { e, box, run };
      });
      for (const p of plans) {
        // shrink a hair so neighbouring lines' glyphs are never caught
        const [x0, y0, x1, y1] = p.box, dy = (y1 - y0) * 0.12;
        page.createAnnotation("Redact").setRect([x0, y0 + dy, x1, y1 - dy]);
      }
      if (plans.length) page.applyRedactions(false, 0, 0, 0);   // text only: images and drawings stay

      for (const p of plans) {
        const { e, run } = p;
        const text = String(e.text ?? "");
        if (!text.trim()) continue;
        const size = e.size ? e.size * H : run ? run.size : (p.box[3] - p.box[1]) * 0.8;
        const color = e.color || (run ? hex(run.color) : "#000000");
        const x = e.left !== undefined ? e.left * W : run ? run.origin[0] : p.box[0];
        const y = e.baseline !== undefined ? e.baseline * H : run ? run.origin[1] : p.box[3] - size * 0.2;
        // same font as the original when it contains every character we need
        let drawn = false;
        if (run && !e.fontOverride) {
          const f = run.font;
          const gids = [...text].map((ch) => (ch === " " ? (f.encodeCharacter(" ") || -1) : f.encodeCharacter(ch)));
          if (gids.every((g) => g !== 0)) {
            try {
              const key = cleanFontName(f.getName()) + "#" + f.pointer;
              if (!fontRefs.has(key)) fontRefs.set(key, { name: `MTE${fontRefs.size}`, ref: doc.addFont(f) });
              const { name, ref } = fontRefs.get(key);
              res.Font[name] = ref;
              // spaces missing from a subset font become a gap of a quarter em
              const tj = gids.map((g) => (g === -1 ? "> -250 <" : g.toString(16).padStart(4, "0"))).join("");
              const m = displayToUser(page, [1, 0, 0, -1, x, y]);
              ops.push(`q ${rgbOp(color)} ${mat(m)} cm BT /${name} ${f4(size)} Tf 0 0 Td [<${tj}>] TJ ET Q`);
              drawn = true;
            } catch { /* fonts MuPDF can't re-embed (e.g. Type 3) fall through to a standard font */ }
          }
        }
        if (!drawn) {
          const fam = e.font?.family || (run?.font.isMono() ? "mono" : run?.font.isSerif() ? "serif" : "sans");
          const bold = e.font?.bold ?? (run ? run.font.isBold() || /bold|black|heavy/i.test(run.font.getName()) : false);
          const italic = e.font?.italic ?? (run ? run.font.isItalic() || /italic|oblique/i.test(run.font.getName()) : false);
          const fname = standardFont(fam, bold, italic);
          if (!fontRefs.has(fname)) fontRefs.set(fname, { name: `MTE${fontRefs.size}`, ref: doc.addSimpleFont(new mupdf.Font(fname), "Latin") });
          const { name, ref } = fontRefs.get(fname);
          res.Font[name] = ref;
          ops.push(`${rgbOp(color)} ${textOps(page, name, size, text, x, y)}`);
        }
      }

      // 2) everything else, in the order it was added (later objects on top)
      for (const e of list) {
        if (e.type === "replace") continue;
        const [x, y, w, h] = [e.x * W, e.y * H, e.w * W, e.h * H];
        const lw = (e.width ?? 0.003) * H;
        if (e.type === "text") {
          const size = (e.size ?? 0.02) * H;
          const fname = standardFont(e.font || "sans", !!e.bold, !!e.italic);
          if (!fontRefs.has(fname)) fontRefs.set(fname, { name: `MTE${fontRefs.size}`, ref: doc.addSimpleFont(new mupdf.Font(fname), "Latin") });
          const { name, ref } = fontRefs.get(fname);
          res.Font[name] = ref;
          String(e.text ?? "").split("\n").forEach((line, n) => {
            if (line) ops.push(`${rgbOp(e.color || "#000000")} ${textOps(page, name, size, line, x, y + size * (0.8 + n * 1.25))}`);
          });
        } else if (e.type === "rect" || e.type === "ellipse" || e.type === "whiteout" || e.type === "highlight") {
          let pre = "";
          if (e.type === "highlight" || (e.opacity ?? 1) < 1) {
            const gsName = `MTG${Object.keys(res.ExtGState).length}`;
            res.ExtGState[gsName] = doc.addObject({ Type: "ExtGState", ca: f4(e.type === "highlight" ? 0.4 : e.opacity), CA: f4(e.opacity ?? 1), ...(e.type === "highlight" ? { BM: "Multiply" } : {}) });
            pre = `/${gsName} gs `;
          }
          const path = e.type === "ellipse" ? ellipsePath(x, y, w, h) : `${n4(x)} ${n4(y)} ${n4(w)} ${n4(h)} re`;
          const fill = e.type === "whiteout" ? e.color || "#ffffff" : e.type === "highlight" ? e.color || "#ffe14d" : e.fill;
          const stroke = e.type === "rect" || e.type === "ellipse" ? e.stroke : null;
          const paint = fill && stroke ? "B" : fill ? "f" : "S";
          ops.push(`q ${toUser} cm ${pre}${fill ? rgbOp(fill) + " " : ""}${stroke ? rgbOp(stroke, true) + " " : ""}${n4(lw)} w ${path} ${paint} Q`);
        } else if (e.type === "line" || e.type === "arrow") {
          const [x1, y1, x2, y2] = [e.x1 * W, e.y1 * H, e.x2 * W, e.y2 * H];
          let path = `${n4(x1)} ${n4(y1)} m ${n4(x2)} ${n4(y2)} l S`;
          if (e.type === "arrow") {
            const a = Math.atan2(y2 - y1, x2 - x1), len = Math.max(lw * 4, 8);
            const p1 = [x2 - len * Math.cos(a - 0.45), y2 - len * Math.sin(a - 0.45)], p2 = [x2 - len * Math.cos(a + 0.45), y2 - len * Math.sin(a + 0.45)];
            path += ` ${n4(x2)} ${n4(y2)} m ${n4(p1[0])} ${n4(p1[1])} l ${n4(p2[0])} ${n4(p2[1])} l h f`;
          }
          ops.push(`q ${toUser} cm 1 J 1 j ${rgbOp(e.stroke || "#d14a5a", true)} ${rgbOp(e.stroke || "#d14a5a")} ${n4(lw)} w ${path} Q`);
        } else if (e.type === "pen" && Array.isArray(e.points) && e.points.length > 1) {
          const pts = e.points.map(([px, py]) => `${n4(px * W)} ${n4(py * H)}`);
          ops.push(`q ${toUser} cm 1 J 1 j ${rgbOp(e.stroke || "#1b3a8f", true)} ${n4(lw)} w ${pts[0]} m ${pts.slice(1).map((p) => `${p} l`).join(" ")} S Q`);
        } else if (e.type === "image") {
          const src = images[int(e.image, 0, 0, 1000)];
          if (!src) continue;
          if (!imageRefs.has(e.image)) {
            let im;
            try {
              im = new mupdf.Image(src.bytes);
            } catch {
              throw new UserError("An inserted picture couldn't be read");
            }
            imageRefs.set(e.image, doc.addImage(im));
            im.destroy();
          }
          const name = `MTI${e.image}`;
          res.XObject[name] = imageRefs.get(e.image);
          ops.push(`q ${mat(displayToUser(page, [w, 0, 0, -h, x, y + h]))} cm /${name} Do Q`);
        }
      }
      if (ops.length) overlay(doc, page, ops.join("\n"), res);
    }
    return out(`${stem(file.name)}_edited.pdf`, save(doc), { orig: file.bytes.length, engine: `${edits.length} edit${edits.length === 1 ? "" : "s"}` });
  } finally {
    doc.destroy();
  }
}

/* ------------------------------------------------------------ OCR text layer */

/** A Type 3 font with empty glyphs whose ToUnicode maps codes to the given characters. */
function glyphlessFont(doc, chars) {
  const enc = [1], procs = {};
  const empty = doc.addStream("500 0 d0", {});
  chars.forEach((_, k) => {
    enc.push(`g${k + 1}`);
    procs[`g${k + 1}`] = empty;
  });
  const utf16 = (ch) => [...ch].map((c) => {
    const cp = c.codePointAt(0);
    if (cp < 0x10000) return cp.toString(16).padStart(4, "0");
    const v = cp - 0x10000;
    return ((0xd800 + (v >> 10)).toString(16) + (0xdc00 + (v & 0x3ff)).toString(16)).padStart(8, "0");
  }).join("");
  const entries = chars.map((ch, k) => `<${(k + 1).toString(16).padStart(2, "0")}> <${utf16(ch)}>`);
  let cmap = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n";
  for (let s = 0; s < entries.length; s += 100) {
    const part = entries.slice(s, s + 100);
    cmap += `${part.length} beginbfchar\n${part.join("\n")}\nendbfchar\n`;
  }
  cmap += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n";
  const encoding = doc.newDictionary();
  encoding.put("Type", "Encoding");
  const diffs = doc.newArray();
  diffs.push(1);
  enc.slice(1).forEach((n) => diffs.push(doc.newName(n)));
  encoding.put("Differences", diffs);
  return doc.addObject({
    Type: "Font", Subtype: "Type3", FontBBox: [0, 0, 500, 1000], FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
    CharProcs: procs, Encoding: encoding, FirstChar: 1, LastChar: chars.length,
    Widths: chars.map(() => 500), Resources: {}, ToUnicode: doc.addStream(cmap, {}),
  });
}

/**
 * Make scanned pages searchable: add OCR'd words as invisible text exactly
 * over where they appear. o.pages = JSON [{ page, lines: [[{ text, x, y, w, h }]] }]
 * (fractions of the displayed page). Works for any script, with no font file.
 */
export async function textLayer([file], o, progress) {
  let pages;
  try {
    pages = JSON.parse(o.pages || "[]");
  } catch {
    throw new UserError("The OCR result is unreadable");
  }
  const doc = openUnlocked(file);
  try {
    // one code per distinct character; a new font every 255 characters
    const chars = [...new Set(pages.flatMap((p) => p.lines.flatMap((l) => l.flatMap((w) => [...w.text, " "]))))];
    const fonts = [];
    for (let s = 0; s < chars.length; s += 255) fonts.push({ chars: chars.slice(s, s + 255), ref: glyphlessFont(doc, chars.slice(s, s + 255)) });
    const code = new Map();
    fonts.forEach((f, fi) => f.chars.forEach((ch, k) => code.set(ch, [fi, k + 1])));
    let words = 0;
    pages.forEach((p, k) => {
      progress?.(k, pages.length, `page ${p.page + 1}`);
      const page = doc.loadPage(int(p.page, 0, 0, doc.countPages() - 1));
      const [W, H] = pageSize(page);
      const ops = [];
      for (const line of p.lines) {
        line.forEach((w, wi) => {
          const text = w.text + (wi < line.length - 1 ? " " : "");
          if (!w.text.trim()) return;
          const size = Math.max(1, w.h * H);
          const width = w.w * W * (text.length / Math.max(1, w.text.length));
          // invisible text (mode 3) stretched to the word's real width
          const tz = (100 * width) / (text.length * 0.5 * size);
          const m = displayToUser(page, [1, 0, 0, -1, w.x * W, (w.y + w.h * 0.82) * H]);
          // split into runs per font (scripts beyond 255 distinct characters span fonts)
          let cur = -1, hexs = "";
          const flush = () => { if (hexs) ops.push(`/MTO${cur} ${f4(size)} Tf <${hexs}> Tj`); hexs = ""; };
          ops.push(`q ${mat(m)} cm BT 3 Tr ${f4(tz)} Tz `);
          for (const ch of text) {
            const [fi, c] = code.get(ch);
            if (fi !== cur) { flush(); cur = fi; }
            hexs += c.toString(16).padStart(2, "0");
          }
          flush();
          ops.push("ET Q");
          words++;
        });
      }
      if (ops.length) overlay(doc, page, ops.join("\n"), { Font: Object.fromEntries(fonts.map((f, fi) => [`MTO${fi}`, f.ref])) });
    });
    return out(`${stem(file.name)}_searchable.pdf`, save(doc), { orig: file.bytes.length, engine: `${words} words recognised` });
  } finally {
    doc.destroy();
  }
}
