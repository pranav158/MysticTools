// Shared helpers for the in-browser engine.
import { makeZip } from "./codec.js";

/** An error caused by the input or options — shown to the user as-is. */
export class UserError extends Error {}

export const stem = (name) => (name || "file").replace(/\.[^.]*$/, "") || "file";

/** Parse a form value as a number clamped to [lo, hi]. */
export function num(v, def, lo = -Infinity, hi = Infinity) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : def));
}
export const int = (v, def, lo, hi) => Math.round(num(v, def, lo, hi));
export const bool = (v, def) => (v === undefined ? def : v === true || v === "true" || v === "on");

export function oneOf(v, allowed, label) {
  const s = String(v ?? "").toLowerCase();
  if (!allowed.includes(s)) throw new UserError(`${label} must be ${allowed.join(" | ")}`);
  return s;
}

const MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  zip: "application/zip", jp2: "image/jp2", txt: "text/plain;charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** A tool result. orig = input bytes (for the savings bar), engine = what happened. */
export function out(name, bytes, extra = {}) {
  const ext = name.split(".").pop().toLowerCase();
  return { name, bytes, mime: MIME[ext] || "application/octet-stream", ...extra };
}

/**
 * Run one() on every file. A single file returns its result directly; several
 * come back as one zip with a summary.txt. A file that fails is included
 * unchanged and flagged, so nothing is ever lost.
 */
export async function batch(files, one, zipName, header, progress) {
  if (files.length === 1) return one(files[0], progress);
  const rows = [], entries = [];
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    progress?.(i, files.length, files[i].name);
    try {
      const r = await one(files[i]);
      rows.push(`${files[i].name}, ${r.bytes.length}, ${r.engine}`);
      entries.push({ name: r.name, bytes: r.bytes });
    } catch (e) {
      failed++;
      rows.push(`${files[i].name}, ERROR, ERROR: ${e.message} — original included`);
      entries.push({ name: files[i].name, bytes: files[i].bytes });
    }
  }
  progress?.(files.length, files.length, "zipping");
  const summary = ["MysticTools batch report", "=".repeat(32), header, "", "input, result_bytes, engine", ...rows].join("\n") + "\n";
  const zip = await makeZip([{ name: "summary.txt", bytes: new TextEncoder().encode(summary) }, ...entries]);
  return out(zipName, zip, {
    orig: files.reduce((n, f) => n + f.bytes.length, 0),
    engine: "batch", processed: files.length - failed, failed,
  });
}

/** Parse "1-3, 5, 8-" (1-based) into sorted 0-based page indexes. */
export function parsePages(spec, n) {
  const s = String(spec ?? "").trim().toLowerCase();
  if (!s || s === "all") return [...Array(n).keys()];
  const set = new Set();
  for (const raw of s.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part) || /^(\d+)$/.exec(part);
    if (!m) throw new UserError(`"${part}" isn't a page number or range (try 2-5 or 1,3,8)`);
    let a, b;
    if (part.includes("-")) {
      a = m[1] ? +m[1] : 1;
      b = m[2] ? +m[2] : n;
    } else {
      a = b = +m[1];
    }
    for (let p = a; p <= b; p++) if (p >= 1 && p <= n) set.add(p - 1);
  }
  if (!set.size) throw new UserError(`No pages in "${spec}" — this document has ${n} page${n === 1 ? "" : "s"}`);
  return [...set].sort((x, y) => x - y);
}
