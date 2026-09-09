// Copy third-party runtime files from node_modules into static/vendor so the
// site is fully self-contained (no CDN or font-service requests). Run after
// upgrading any of these packages.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => path.join(root, "node_modules", ...p);

function copy(src, dstDir, name = path.basename(src)) {
  fs.mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, name);
  fs.copyFileSync(src, dst);
  console.log("vendored", path.relative(root, dst), fs.statSync(dst).size, "bytes");
}

// MuPDF WebAssembly build
const mupdfDir = path.join(root, "static", "vendor", "mupdf");
for (const f of ["mupdf.js", "mupdf-wasm.js", "mupdf-wasm.wasm"]) copy(nm("mupdf", "dist", f), mupdfDir);
const version = JSON.parse(fs.readFileSync(nm("mupdf", "package.json"), "utf8")).version;
fs.writeFileSync(path.join(mupdfDir, "VERSION"), version + "\n");

// Fonts (SIL Open Font License — the licence travels with the files)
const fontDir = path.join(root, "static", "vendor", "fonts");
copy(nm("@fontsource-variable", "figtree", "files", "figtree-latin-wght-normal.woff2"), fontDir);
copy(nm("@fontsource-variable", "figtree", "LICENSE"), fontDir, "OFL-Figtree.txt");
copy(nm("@fontsource-variable", "fraunces", "files", "fraunces-latin-soft-normal.woff2"), fontDir);
copy(nm("@fontsource-variable", "fraunces", "LICENSE"), fontDir, "OFL-Fraunces.txt");
copy(nm("@fontsource-variable", "caveat", "files", "caveat-latin-wght-normal.woff2"), fontDir);
copy(nm("@fontsource-variable", "caveat", "LICENSE"), fontDir, "OFL-Caveat.txt");

// OCR: tesseract.js (Apache-2.0). The worker picks one engine build per browser.
const tessDir = path.join(root, "static", "vendor", "tesseract");
copy(nm("tesseract.js", "dist", "tesseract.esm.min.js"), tessDir);
copy(nm("tesseract.js", "dist", "worker.min.js"), tessDir);
copy(nm("tesseract.js", "LICENSE.md"), tessDir, "LICENSE-tesseract.js.md");
for (const v of ["", "simd-", "relaxedsimd-"]) copy(nm("tesseract.js-core", `tesseract-core-${v}lstm.wasm.js`), path.join(tessDir, "core"));
copy(nm("tesseract.js-core", "LICENSE"), path.join(tessDir, "core"), "LICENSE-tesseract-core.txt");
for (const lang of ["eng", "hin"]) copy(nm("@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`), path.join(tessDir, "lang"));

// HEIC decoding: libheif (LGPL-3.0), loaded only when a HEIC file shows up
const heifDir = path.join(root, "static", "vendor", "libheif");
copy(nm("libheif-js", "libheif-wasm", "libheif-bundle.mjs"), heifDir);
copy(nm("libheif-js", "LICENSE"), heifDir, "LICENSE-libheif-js.txt");
copy(nm("libheif-js", "libheif-wasm", "LICENSE"), heifDir, "LICENSE-libheif.txt");
