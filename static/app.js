"use strict";

/* ================================================================ icons */

const ICONS = {
  gauge: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4.5-4.5"/><path d="M4.5 19a9 9 0 1 1 15 0"/><path d="M3 21h18"/></svg>',
  merge: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v9a6 6 0 0 0 6 6h5"/><path d="M14.5 21.5l4.5-3.5-4.5-3.5"/><path d="M17 3v6h-4"/></svg>',
  split: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8.6 7.6L21 18"/><path d="M8.6 16.4L21 6"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v5h-5"/></svg>',
  docImage: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><circle cx="10" cy="12.5" r="1.5"/><path d="M7 18l3-3.5 2.5 2.5 2-2 2.5 3"/></svg>',
  imageDoc: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 18l4-4.5 3 3 3.5-3.5 3.5 3.5"/></svg>',
  images: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M16 8h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  compressImg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 8v5m0 0l-2-2m2 2l2-2"/></svg>',
  target: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/></svg>',
  crop: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/></svg>',
  resize: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-8 8"/><path d="M3 21l8-8"/></svg>',
  dpi: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="20" height="6" rx="1.5"/><path d="M6.5 9v3M10 9v3M13.5 9v3M17 9v3"/></svg>',
  swap: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13m0 0l-3-3m3 3l-3 3"/><path d="M20 17H7m0 0l3 3m-3-3l3-3"/></svg>',
  flip: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M17 8l4 4-4 4"/><path d="M7 8l-4 4 4 4"/></svg>',
  bw: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
  cm: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
  sign: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-1 4.5-7 6.5-7s1 5 3 5 2.5-3.5 4-3.5 1.5 2 3.5 2"/><path d="M3 21h18"/></svg>',
  stamp: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3.5h5l-1 7h-3z"/><path d="M5 14.5h14a1 1 0 0 1 1 1V18H4v-2.5a1 1 0 0 1 1-1z"/><path d="M6 21h12"/></svg>',
  hash: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14.5 3v4.5H19"/><path d="M9.5 18h6"/><path d="M11 14.5l1-2.5v4"/></svg>',
  layers: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0 5 5L21 13a6 6 0 0 1-7.7 3.3L7 22.5 3.5 19l6.2-6.3A6 6 0 0 1 13 5z"/></svg>',
  word: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14.5 3v4.5H19"/><path d="M8.5 11l1.5 6 2-4.5 2 4.5 1.5-6"/></svg>',
  text: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14.5 3v4.5H19"/><path d="M9 11.5h7M9 14.5h7M9 17.5h4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
  redact: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14.5 3v4.5H19"/><rect x="8.5" y="11" width="8" height="2.6" rx="1" fill="currentColor"/><rect x="8.5" y="15.5" width="5" height="2.6" rx="1" fill="currentColor"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 5 9 7a8 8 0 0 1-2.2 3.4M6.3 6.3C4 7.8 3 10.6 3 12c0 2 4 7 9 7a9 9 0 0 0 4.4-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  editDoc: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3H6v18h12v-8"/><path d="M13 3v5h5"/><path d="M14.5 15.5L21 9l-2-2-6.5 6.5-.5 2.5z"/></svg>',
  editImg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M4 17l4-4 3 3 2-2"/><path d="M14 11l7-7-2-2-7 7-.5 2.5z"/></svg>',
  scan: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/></svg>',
  flow: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="5" rx="1.5"/><rect x="15" y="4" width="6" height="5" rx="1.5"/><rect x="9" y="15" width="6" height="5" rx="1.5"/><path d="M9 6.5h6M18 9v3a2 2 0 0 1-2 2h-1M6 9v3a2 2 0 0 0 2 2h1"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  organize: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="9" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.8"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.8"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.8"/></svg>',
  wand: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L15 9"/><path d="M15 4l6 6L9 22H2v-7z"/><path d="M18 2l.9 2.1L21 5l-2.1.9L18 8l-.9-2.1L15 5l2.1-.9z" fill="currentColor" stroke="none"/></svg>',
};

/* ================================================================ tool definitions */

const PDF_EXT = [".pdf"];
const IMG_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".avif"];

const TOOLS = [
  /* ---------- PDF ---------- */
  {
    id: "pdf-master", cat: "pdf", group: "prep", icon: "wand", tag: "One-Click",
    name: "Master Prep PDF", verb: "Prepare",
    desc: "B/W + DPI cap + target size in one pass — ready for govt upload.",
    single: false, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Color mode", "mode", [["grayscale", "Grayscale"], ["true-bw", "True B/W"], ["color", "Keep color"]], "grayscale"),
      slider("Max DPI", "dpi", 36, 600, 1, 200, " DPI"),
      slider("Threshold (B/W)", "threshold", 0, 255, 1, 128, ""),
      num("Max KB per page", "per_page_kb", 300, 5120),
      num("Max KB total (0 = per page × pages)", "target_kb", 0, 51200),
      note("Grayscale / True B/W re-render every page at your exact DPI (never lowered — govt portals reject anything under 200 DPI), then compress page by page to stay under the size cap. Keep color recompresses only the images, capped at the DPI. DPI is exact, size is a max. Locked (password-protected) PDFs are passed through unchanged and flagged in the summary. Drop multiple PDFs for batch — one zip with a per-file summary."),
    ],
    init(container) {
      const show = (mode) => {
        const isBw = mode === "true-bw";
        container.querySelector('[data-opt="threshold"]').closest(".opt").style.display = isBw ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },
  {
    id: "pdf-compress", cat: "pdf", group: "compress", icon: "gauge", tag: "PDF",
    name: "Compress PDF", verb: "Compress",
    desc: "Shrink the images inside a PDF — text stays sharp.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Preset", "quality", [
        ["screen", "Screen"], ["ebook", "eBook"], ["printer", "Printer"], ["prepress", "Prepress"],
      ], "ebook"),
      note("Screen = smallest (images capped at 72 DPI), eBook = 150 DPI, Printer / Prepress = 300 DPI at high quality. If nothing can be saved you get the original back."),
    ],
  },
  {
    id: "pdf-target", cat: "pdf", group: "compress", icon: "target", tag: "PDF",
    name: "Compress to Size", verb: "Compress",
    desc: "Hit an exact size like 100 KB, keeping DPI where possible.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      num("Target size (KB)", "target_kb", 100, 5120),
      seg("DPI", "dpi_mode", [["preserve", "Keep original"], ["force", "Custom"]], "preserve"),
      slider("Custom DPI cap", "dpi", 36, 600, 1, 200, " DPI"),
      note("Keeps the document's original resolution by default — embedded images are only downscaled when quality alone can't hit the target. Custom DPI caps them at that resolution. Impossible targets return the smallest possible file, never an error."),
    ],
    init(container) {
      const show = (mode) => {
        const el = container.querySelector('[data-opt="dpi"]').closest(".opt");
        el.style.display = mode === "force" ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="dpi_mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },
  {
    id: "pdf-organize", cat: "pdf", group: "organize", icon: "organize", tag: "PDF",
    name: "Organize & Merge", verb: "Build PDF",
    desc: "Mix, reorder, rotate and remove pages from many files.",
    single: false, accept: [...PDF_EXT, ...IMG_EXT], reorder: false, board: true,
    options: () => [
      seg("Image pages", "image_page", [["a4", "A4"], ["letter", "Letter"], ["auto", "Original size"]], "a4"),
      note("Drag pages to reorder (on a phone, press and hold first). Hover a page to rotate, duplicate or remove it. With the keyboard: focus a page, then Alt+←/→ to move, R to rotate, Delete to remove. Colours show which file each page came from."),
    ],
  },
  {
    id: "pdf-split", cat: "pdf", group: "organize", icon: "split", tag: "PDF",
    name: "Split PDF", verb: "Split",
    desc: "Pull out a page range, or break a PDF into chunks.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Mode", "mode", [["range", "Page range"], ["every", "Chunks of N"]], "range"),
      text("Pages (1-based, e.g. 2-5 or 1,3,8)", "page_range", "", "all"),
      num("Pages per chunk", "every", 1, 2),
    ],
    init(container) {
      const show = (mode) => {
        const hasRange = mode === "range";
        container.querySelector('[data-opt="page_range"]').closest(".opt").style.display = hasRange ? "" : "none";
        container.querySelector('[data-opt="every"]').closest(".opt").style.display = hasRange ? "none" : "";
      };
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },
  {
    id: "pdf-rotate", cat: "pdf", group: "organize", icon: "rotate", tag: "PDF",
    name: "Rotate PDF", verb: "Rotate",
    desc: "Turn every page, or just the ones you pick.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Angle", "angle", [["90", "90°"], ["180", "180°"], ["270", "270°"]], "90"),
      text("Pages (e.g. 1,3,5 or 2-4 — leave empty for all)", "pages", "", "all"),
    ],
  },
  {
    id: "pdf-to-images", cat: "pdf", group: "convert", icon: "docImage", tag: "PDF",
    name: "PDF → Images", verb: "Convert",
    desc: "Every page as a JPG or PNG at the DPI you choose.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Format", "fmt", [["jpg", "JPG"], ["png", "PNG"]], "jpg"),
      slider("Resolution", "dpi", 72, 600, 1, 150, " DPI"),
      slider("Quality (JPG)", "quality", 10, 100, 1, 85, "%"),
      note("Single-page PDFs download directly — multi-page files come as a .zip."),
    ],
  },
  {
    id: "pdf-from-images", cat: "pdf", group: "convert", icon: "imageDoc", tag: "PDF",
    name: "Images → PDF", verb: "Create",
    desc: "Turn photos and scans into one neat PDF.",
    single: false, accept: IMG_EXT, reorder: true,
    options: () => [
      seg("Page size", "page_size", [["a4", "A4"], ["letter", "Letter"], ["auto", "Image size"]], "a4"),
      seg("Orientation", "orientation", [["portrait", "Portrait"], ["landscape", "Landscape"]], "portrait"),
      num("Margin (mm)", "margin_mm", 0, 20),
    ],
  },
  {
    id: "pdf-extract-images", cat: "pdf", group: "convert", icon: "images", tag: "PDF",
    name: "Extract Images", verb: "Extract",
    desc: "Save every picture inside a PDF as its own file.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [note("All unique images are exported in their original format — one file each, or a .zip.")],
  },
  {
    id: "pdf-encrypt", cat: "pdf", group: "security", icon: "lock", tag: "PDF",
    name: "Protect PDF", verb: "Protect",
    desc: "Lock a PDF with a password (AES-256).",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      text("Password", "password", "", "choose a strong password", "password"),
      seg("Method", "method", [["aes-256", "AES-256"], ["aes-128", "AES-128"], ["rc4", "RC4"]], "aes-256"),
      note("AES-256 is the strongest and most widely supported. Keep your password safe — no one can recover it."),
    ],
  },
  {
    id: "pdf-bw", cat: "pdf", group: "compress", icon: "bw", tag: "PDF",
    name: "Black & White PDF", verb: "Convert",
    desc: "Grayscale or pure black & white, as many portals require.",
    single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Mode", "mode", [["grayscale", "Grayscale"], ["true-bw", "True B/W"]], "grayscale"),
      slider("Render DPI", "dpi", 36, 600, 1, 200, " DPI"),
      slider("Threshold (B/W)", "threshold", 0, 255, 1, 128, ""),
      note("Every page is re-rendered at the chosen DPI. Grayscale keeps all shades; True B/W makes each pixel pure black or white (the threshold sets the cut-off) and gives the smallest files. Text is no longer selectable afterwards."),
    ],
    init(container) {
      const show = (mode) => {
        container.querySelector('[data-opt="threshold"]').closest(".opt").style.display = mode === "true-bw" ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },

  {
    id: "pdf-repair", cat: "pdf", group: "compress", icon: "wrench", tag: "PDF",
    name: "Repair PDF", verb: "Repair",
    desc: "Fix PDFs that won't open or get rejected on upload.",
    single: true, accept: PDF_EXT,
    options: () => [note("Rebuilds the file's internal index and drops broken pieces. Whatever can still be read is kept.")],
  },
  {
    id: "pdf-crop", cat: "pdf", group: "organize", icon: "crop", tag: "PDF", editor: "pdfcrop",
    name: "Crop PDF", verb: "Crop",
    desc: "Trim margins — drag a box on the page.",
    single: true, accept: PDF_EXT,
    options: () => [
      text("Pages (empty = all)", "pages", "", "all"),
      note("Drag the box on the preview. The same crop is applied to every chosen page."),
    ],
  },
  {
    id: "pdf-sign", cat: "pdf", group: "edit", icon: "sign", tag: "PDF", editor: "sign",
    name: "Sign PDF", verb: "Sign",
    desc: "Draw, type or upload a signature and place it.",
    single: true, accept: PDF_EXT,
    options: () => [signatureOptions()],
    init: (c) => initSignatureOptions(c),
  },
  {
    id: "pdf-watermark", cat: "pdf", group: "edit", icon: "stamp", tag: "PDF",
    name: "Watermark PDF", verb: "Add watermark",
    desc: "Stamp CONFIDENTIAL, COPY or any text across pages.",
    single: true, accept: PDF_EXT,
    options: () => [
      text("Text", "text", "CONFIDENTIAL", "watermark text"),
      seg("Layout", "layout", [["center", "Centre"], ["tiled", "Tiled"]], "center"),
      slider("Size", "size", 12, 200, 1, 60, " pt"),
      slider("Opacity", "opacity", 5, 100, 1, 25, "%"),
      slider("Angle", "angle", -90, 90, 1, 45, "°"),
      color("Colour", "color", "#b03050"),
      text("Pages (empty = all)", "pages", "", "all"),
    ],
  },
  {
    id: "pdf-numbers", cat: "pdf", group: "edit", icon: "hash", tag: "PDF",
    name: "Page Numbers", verb: "Add numbers",
    desc: "Number pages in any position, style and start.",
    single: true, accept: PDF_EXT,
    options: () => [
      seg("Position", "position", [["tl", "Top left"], ["tc", "Top"], ["tr", "Top right"], ["bl", "Bottom left"], ["bc", "Bottom"], ["br", "Bottom right"]], "bc", "grid3"),
      seg("Format", "format", [["n", "1"], ["page-n", "Page 1"], ["n-of-total", "1 / 9"], ["page-n-of-total", "Page 1 of 9"]], "n"),
      row(num("Start at", "start", 1, 99999, 1, -9999), num("Margin (mm)", "margin_mm", 10, 100, 1, 0)),
      slider("Size", "size", 6, 36, 1, 11, " pt"),
      text("Pages (empty = all)", "pages", "", "all"),
    ],
  },
  {
    id: "pdf-flatten", cat: "pdf", group: "edit", icon: "layers", tag: "PDF",
    name: "Flatten PDF", verb: "Flatten",
    desc: "Lock filled forms and comments into the page.",
    single: true, accept: PDF_EXT,
    options: () => [note("Form fields, highlights, comments and stamps become part of the page itself — portals that drop form data will still show them.")],
  },
  {
    id: "pdf-edit", cat: "pdf", group: "edit", icon: "editDoc", tag: "PDF", editor: "markup", studio: true,
    name: "Edit PDF", verb: "Save PDF",
    desc: "Add text, shapes, highlights and pictures — or retype existing text.",
    single: true, accept: PDF_EXT,
    options: () => [
      seg("Language of scanned pages", "ocr_lang", [["eng", "English"], ["hin", "Hindi"], ["eng+hin", "Both"]], "eng"),
      note("Choose a tool above the page. <b>Edit text</b> lets you click any text and retype it — the PDF's own font is reused when it has the letters you need, otherwise the closest standard font. Scanned pages are read with OCR first. Shortcuts: V select, T text, R box, A arrow, H highlight, W white-out, Ctrl+Z undo."),
    ],
  },
  {
    id: "pdf-ocr", cat: "pdf", group: "convert", icon: "scan", tag: "PDF", run: "ocr-pdf",
    name: "OCR PDF", verb: "Make searchable",
    desc: "Turn scanned pages into searchable, copyable text.",
    single: true, accept: PDF_EXT,
    options: () => [
      seg("Language", "lang", [["eng", "English"], ["hin", "Hindi"], ["eng+hin", "English + Hindi"]], "eng"),
      seg("Download", "output", [["pdf", "Searchable PDF"], ["txt", "Text file"], ["both", "Both"]], "pdf"),
      check("Skip pages that already have text", "skip_text", true),
      note("Each scanned page is read on your device and an invisible text layer is added exactly over the words, so the PDF looks the same but you can search, select and copy. The first run downloads the OCR engine (about 7 MB) once."),
    ],
  },
  {
    id: "pdf-to-word", cat: "pdf", group: "convert", icon: "word", tag: "PDF",
    name: "PDF → Word", verb: "Convert",
    desc: "Make an editable Word document (.docx) from a PDF.",
    single: true, accept: PDF_EXT,
    options: () => [note("Keeps the text with its size, bold and italics, page by page. Columns, tables and pictures are simplified, so it suits letters, forms and reports best. Scanned PDFs have no text to export.")],
  },
  {
    id: "pdf-to-text", cat: "pdf", group: "convert", icon: "text", tag: "PDF",
    name: "PDF → Text", verb: "Extract",
    desc: "All the text of a PDF in a plain .txt file.",
    single: true, accept: PDF_EXT,
    options: () => [note("Each page's text in reading order, separated by page markers.")],
  },
  {
    id: "pdf-unlock", cat: "pdf", group: "security", icon: "unlock", tag: "PDF",
    name: "Unlock PDF", verb: "Unlock",
    desc: "Remove a password or print/copy restrictions.",
    single: true, accept: PDF_EXT,
    options: () => [
      text("Password", "password", "", "the PDF's current password", "password"),
      note("Leave it empty if the PDF opens freely but blocks printing or copying."),
    ],
  },
  {
    id: "pdf-redact", cat: "pdf", group: "security", icon: "redact", tag: "PDF",
    name: "Redact PDF", verb: "Redact",
    desc: "Truly remove names, numbers and emails.",
    single: true, accept: PDF_EXT,
    options: () => [
      area("Words or phrases (one per line)", "terms", "e.g. your name\naccount number", 3),
      checks("Also find", [["email", "Email addresses"], ["phone", "Phone numbers"], ["aadhaar", "Aadhaar numbers"], ["pan", "PAN numbers"], ["card", "Card numbers"]]),
      check("Match case", "match_case", false),
      note("Matches are deleted from the PDF and drawn as black boxes, so they can't be copied, searched or recovered."),
    ],
  },
  {
    id: "pdf-metadata", cat: "pdf", group: "security", icon: "tag", tag: "PDF",
    name: "PDF Metadata", verb: "Save",
    desc: "See, edit or wipe the author, software and title.",
    single: true, accept: PDF_EXT,
    options: () => [
      seg("Action", "mode", [["remove", "Remove all"], ["edit", "Edit"]], "remove"),
      row(text("Title", "title", "", ""), text("Author", "author", "", "")),
      row(text("Subject", "subject", "", ""), text("Keywords", "keywords", "", "")),
      row(text("Creator app", "creator", "", ""), text("Producer", "producer", "", "")),
      note('<span id="metaFound">Add a PDF to see what it contains.</span>'),
    ],
    init(container) {
      const fields = ["title", "author", "subject", "keywords", "creator", "producer"].map((n) => container.querySelector(`[data-opt="${n}"]`));
      const show = (mode) => fields.forEach((f) => (f.closest(".opt").style.display = mode === "edit" ? "" : "none"));
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.v); });
    },
    async onFiles([file]) {
      const info = await engine.run("pdf-info", [file]);
      const found = $("#metaFound");
      if (info.locked) { found.textContent = "This PDF is password-protected — unlock it first."; return; }
      const filled = Object.entries(info.meta).filter(([, v]) => v);
      for (const [k, v] of Object.entries(info.meta)) {
        const input = optionsBox.querySelector(`[data-opt="${k}"]`);
        if (input && !input.dataset.touched) input.value = v;
      }
      found.textContent = filled.length
        ? `Found: ${filled.map(([k, v]) => `${k} “${v.length > 40 ? v.slice(0, 40) + "…" : v}”`).join(", ")}.`
        : "No document properties found.";
    },
  },

  /* ---------- Image ---------- */
  {
    id: "img-master", cat: "image", group: "prep", icon: "wand", tag: "One-Click",
    name: "Master Prep Image", verb: "Prepare",
    desc: "B/W + 200 DPI + exact KB target in one pass — photo or signature ready.",
    single: false, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Color mode", "mode", [["grayscale", "Grayscale"], ["true-bw", "True B/W"], ["color", "Keep color"]], "grayscale"),
      slider("DPI", "dpi", 36, 2400, 1, 200, ""),
      slider("Threshold (B/W)", "threshold", 0, 255, 1, 128, ""),
      num("Target size (KB)", "target_kb", 20, 5120),
      seg("Output", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "jpeg"),
      note("Photo: 3.5×2.5 cm → Size in CM, then Master (color, 20 KB). Signature: 2×4.5 cm → Master (color, 10 KB). Documents: Master (grayscale, 300 KB/page PDF). Drop multiple images for batch — you get one zip with a per-file summary. Unreadable files are passed through unchanged and flagged in the summary."),
    ],
    init(container) {
      const show = (mode) => {
        container.querySelector('[data-opt="threshold"]').closest(".opt").style.display =
          mode === "true-bw" ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },
  {
    id: "img-compress", cat: "image", group: "compress", icon: "compressImg", tag: "Image",
    name: "Compress Image", verb: "Compress",
    desc: "Shrink JPG, PNG or WebP with a quality slider.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Output format", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "jpeg"),
      slider("Quality", "quality", 1, 100, 1, 80, "%"),
      note("PNG stays lossless — quality is traded for palette colors instead."),
    ],
  },
  {
    id: "img-target", cat: "image", group: "compress", icon: "target", tag: "Image",
    name: "Compress to Size", verb: "Compress",
    desc: "Fit under a size like 20 KB, keeping the DPI.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      num("Target size (KB)", "target_kb", 100, 5120),
      seg("Output format", "fmt", [["jpeg", "JPG"], ["webp", "WebP"], ["png", "PNG"]], "jpeg"),
      seg("DPI", "dpi_mode", [["preserve", "Keep original"], ["force", "Custom"]], "preserve"),
      slider("Custom DPI", "dpi", 36, 2400, 1, 200, ""),
      note("Keeps the original DPI by default — a 400 DPI image stays 400 DPI. Pixels are only downscaled when quality alone can't reach the target. Custom DPI retags the output for print. Impossible targets return the smallest possible file."),
    ],
    init(container) {
      const show = (mode) => {
        const el = container.querySelector('[data-opt="dpi"]').closest(".opt");
        el.style.display = mode === "force" ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="dpi_mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },
  {
    id: "img-crop", cat: "image", group: "edit", icon: "crop", tag: "Image",
    name: "Crop Image", verb: "Crop",
    desc: "Rectangle or circle crop, with a transparent option.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Shape", "shape", [["rect", "Rectangle"], ["circle", "Circle"]], "rect"),
      seg("Circle background", "fill", [["transparent", "Transparent"], ["white", "White"], ["black", "Black"]], "transparent"),
      note("Drag the handles on the preview to size the crop. Transparent output is saved as PNG."),
    ],
    init(container) {
      const apply = (shape) => {
        container.querySelector('[data-opt="fill"]').closest(".opt").style.display =
          shape === "circle" ? "" : "none";
        state.crop?.setShape(shape);
      };
      const seg = container.querySelector('[data-opt="shape"]');
      apply(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) apply(b.dataset.v);
      });
    },
  },
  {
    id: "img-resize", cat: "image", group: "compress", icon: "resize", tag: "Image",
    name: "Resize Image", verb: "Resize",
    desc: "Scale by percent or to exact pixels.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Mode", "mode", [["percent", "Percent"], ["exact", "Exact size"]], "percent"),
      slider("Scale", "value", 1, 400, 1, 50, "%"),
      row(num("Width (px)", "width", 0, 1920), num("Height (px)", "height", 0, 1080)),
      check("Keep aspect ratio", "keep_aspect", true),
    ],
    init(container) {
      const show = (mode) => {
        container.querySelector('[data-opt="value"]').closest(".opt").style.display =
          mode === "percent" ? "" : "none";
        container.querySelector('[data-opt="width"]').closest(".opt").style.display =
          mode === "exact" ? "" : "none";
        container.querySelector('[data-opt="height"]').closest(".opt").style.display =
          mode === "exact" ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },
  {
    id: "img-dpi", cat: "image", group: "convert", icon: "dpi", tag: "Image",
    name: "Change DPI", verb: "Set DPI",
    desc: "Set the DPI tag, or resample the pixels for print.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      slider("DPI", "dpi", 72, 2400, 1, 300, ""),
      seg("Mode", "mode", [["metadata", "Metadata only"], ["resample", "Resample pixels"]], "metadata"),
      note("Metadata only rewrites the DPI tag of a JPG or PNG — pixels are untouched, zero quality loss. Resample actually changes the pixel dimensions for print."),
    ],
  },
  {
    id: "img-convert", cat: "image", group: "convert", icon: "swap", tag: "Image",
    name: "Convert Image", verb: "Convert",
    desc: "Switch between JPG, PNG and WebP.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Target format", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "png"),
      slider("Quality", "quality", 1, 100, 1, 85, "%"),
      note("WebP is usually the smallest at equal quality. PNG is lossless and keeps transparency (quality doesn't apply)."),
    ],
  },
  {
    id: "img-rotate", cat: "image", group: "edit", icon: "flip", tag: "Image",
    name: "Rotate / Flip", verb: "Apply",
    desc: "Rotate in 90° steps and flip either way.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Angle (clockwise)", "angle", [["0", "0°"], ["90", "90°"], ["180", "180°"], ["270", "270°"]], "90"),
      seg("Flip", "flip", [["none", "None"], ["h", "Horizontal"], ["v", "Vertical"]], "none"),
    ],
  },
  {
    id: "img-bw", cat: "image", group: "convert", icon: "bw", tag: "Image",
    name: "Convert to B/W", verb: "Convert",
    desc: "Grayscale or pure black & white.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Mode", "mode", [["grayscale", "Grayscale"], ["true-bw", "True B/W"]], "grayscale"),
      slider("Threshold", "threshold", 0, 255, 1, 128, ""),
      seg("Output", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "jpeg"),
    ],
    init(container) {
      const seg = container.querySelector('[data-opt="mode"]');
      const vis = (mode) => {
        container.querySelector('[data-opt="threshold"]').closest(".opt").style.display =
          mode === "true-bw" ? "" : "none";
      };
      vis(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) vis(b.dataset.v);
      });
    },
  },
  {
    id: "img-sizecm", cat: "image", group: "compress", icon: "cm", tag: "Image",
    name: "Size in CM", verb: "Resize",
    desc: "Exact print size in cm at a DPI — photos, signatures.",
    single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      row(num("Width (cm)", "width_cm", 3.5, 100, 0.1, 0.1), num("Height (cm)", "height_cm", 2.5, 100, 0.1, 0.1)),
      slider("DPI", "dpi", 36, 2400, 1, 200, ""),
      check("Keep aspect ratio", "keep_aspect", true),
      seg("Output", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "jpeg"),
      note('Live size: <b id="pxNote">—</b>'),
    ],
    init(container) {
      const note = container.querySelector("#pxNote");
      const upd = () => {
        const w = +container.querySelector('[data-opt="width_cm"]').value;
        const h = +container.querySelector('[data-opt="height_cm"]').value;
        const d = +container.querySelector('[data-opt="dpi"]').value;
        note.textContent = `${Math.max(1, Math.round(w / 2.54 * d))} × ${Math.max(1, Math.round(h / 2.54 * d))} px @ ${d} DPI`;
      };
      container.querySelectorAll('[data-opt="width_cm"],[data-opt="height_cm"],[data-opt="dpi"]')
        .forEach((el) => el.addEventListener("input", upd));
      upd();
    },
  },
  {
    id: "img-adjust", cat: "image", group: "edit", icon: "sliders", tag: "Image",
    name: "Adjust & Enhance", verb: "Apply",
    desc: "Brightness and contrast — or clean up document photos.",
    single: true, accept: IMG_EXT,
    options: () => [
      seg("Mode", "mode", [["custom", "Custom"], ["document", "Document cleanup"]], "custom"),
      slider("Brightness", "brightness", -100, 100, 1, 0, ""),
      slider("Contrast", "contrast", -100, 100, 1, 0, ""),
      slider("Saturation", "saturation", -100, 100, 1, 0, ""),
      check("Grayscale", "grayscale", false),
      note("Document cleanup turns a dim phone photo of paper into a clean white page with dark text. The sliders still apply on top."),
    ],
  },
  {
    id: "img-edit", cat: "image", group: "edit", icon: "editImg", tag: "Image", editor: "markup", studio: true, engineOp: "img-save-edit",
    name: "Edit Image", verb: "Save image",
    desc: "Mark up screenshots — arrows, boxes, text, blur — or retype text.",
    single: true, accept: IMG_EXT,
    options: () => [
      seg("Text language (for Edit text)", "ocr_lang", [["eng", "English"], ["hin", "Hindi"], ["eng+hin", "Both"]], "eng"),
      note("Choose a tool above the image. <b>Edit text</b> reads the image with OCR; click a line to retype it — the background, colour, size and the closest font are matched automatically. Saved in the original format and DPI."),
    ],
  },
  {
    id: "img-ocr", cat: "image", group: "convert", icon: "scan", tag: "Image", run: "ocr-image",
    name: "Image → Text", verb: "Read text",
    desc: "Copy the text out of photos, scans and screenshots.",
    single: false, accept: IMG_EXT,
    options: () => [
      seg("Language", "lang", [["eng", "English"], ["hin", "Hindi"], ["eng+hin", "English + Hindi"]], "eng"),
      note("Works best on straight, sharp photos of printed text. Several images give one text file. The first run downloads the OCR engine (about 7 MB) once."),
    ],
  },
  {
    id: "img-watermark", cat: "image", group: "edit", icon: "stamp", tag: "Image",
    name: "Watermark Image", verb: "Add watermark",
    desc: "Add your name or © — centred, in a corner or tiled.",
    single: true, accept: IMG_EXT,
    options: () => [
      text("Text", "text", "© Your name", "watermark text"),
      seg("Layout", "layout", [["center", "Centre"], ["tiled", "Tiled"], ["bottom-right", "Corner"]], "tiled"),
      slider("Size", "size", 2, 30, 1, 6, "%"),
      slider("Opacity", "opacity", 5, 100, 1, 35, "%"),
      slider("Angle", "angle", -90, 90, 1, -30, "°"),
      color("Colour", "color", "#ffffff"),
    ],
  },
  {
    id: "img-hide", cat: "image", group: "security", icon: "eyeOff", tag: "Image", editor: "regions",
    name: "Blur & Hide", verb: "Hide areas",
    desc: "Pixelate, blur or black out private details.",
    single: true, accept: IMG_EXT,
    options: () => [
      seg("Style", "mode", [["pixelate", "Pixelate"], ["blur", "Blur"], ["black", "Black box"]], "pixelate"),
      slider("Strength", "strength", 1, 10, 1, 6, ""),
      note("Drag on the image to draw boxes. Drag a box to move it, its corner to resize it, × to delete it. For ID numbers use Black box or strong Pixelate — a light blur can sometimes be undone."),
    ],
  },
  {
    id: "img-strip", cat: "image", group: "security", icon: "shield", tag: "Image",
    name: "Remove Metadata", verb: "Clean",
    desc: "Remove GPS, camera and date info — losslessly.",
    single: false, accept: IMG_EXT,
    options: () => [note("Removes EXIF (including GPS), XMP, IPTC and comments. The pixels are untouched and phone photos stay the right way up. Drop several photos at once.")],
  },
];

// Home-page sections, in display order.
const GROUPS = {
  pdf: [["compress", "Compress & optimize"], ["organize", "Organize"], ["edit", "Edit & sign"], ["convert", "Convert"], ["security", "Security & privacy"]],
  image: [["compress", "Compress & size"], ["edit", "Edit & enhance"], ["convert", "Convert"], ["security", "Privacy"]],
};

/* ================================================================ state */

const state = {
  cat: "pdf",
  tool: null,
  files: [],
  crop: null,
  result: null,
  busy: false,
  previewSeq: 0,
  urls: [],
  board: null,   // Organize & Merge: { sources, items, loading }
};

/* ================================================================ engine */

// All processing happens in a Web Worker inside this tab (MuPDF compiled to
// WebAssembly + the browser's own image codecs). Files never leave the device.
const engine = (() => {
  let worker, ready, loaded = false, seq = 0;
  const jobs = new Map();

  function start() {
    loaded = false;
    worker = new Worker("engine/worker.js", { type: "module" });
    ready = new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.ready) { loaded = true; resolve(); return; }
        const job = jobs.get(m.id);
        if (!job) return;
        if (m.progress) { job.onProgress?.(m.progress); return; }
        jobs.delete(m.id);
        if (m.ok) {
          job.resolve(m.result);
        } else {
          job.reject(new Error(m.error));
          if (m.fatal) restart();   // a WebAssembly crash can leave the engine unusable
        }
      };
      worker.onerror = (e) => {
        e.preventDefault();
        if (!loaded) { reject(new Error("The processing engine failed to load — reload the page")); return; }
        for (const job of jobs.values()) job.reject(new Error("The engine crashed — try a smaller file or a lower DPI"));
        jobs.clear();
        restart();
      };
    });
    ready.catch(() => {});
  }

  function restart() {
    worker.terminate();
    start();
  }

  start();
  return {
    get ready() { return ready; },
    get loaded() { return loaded; },
    async run(tool, files, opts = {}, onProgress) {
      await ready;
      const payload = await Promise.all(files.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })));
      const id = ++seq;
      return new Promise((resolve, reject) => {
        jobs.set(id, { resolve, reject, onProgress });
        worker.postMessage({ id, tool, files: payload, opts }, payload.map((p) => p.buffer));
      });
    },
  };
})();

// handy for scripting / automated tests: mystic.run("img-bw", [file], { mode: "grayscale" })
window.mystic = engine;

/* ================================================================ dom helpers */

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const toolView = $("#toolView");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Object URL that is revoked when the preview changes. */
function previewUrl(blob) {
  const url = URL.createObjectURL(blob);
  state.urls.push(url);
  return url;
}

function clearPreviewUrls() {
  state.urls.forEach((u) => URL.revokeObjectURL(u));
  state.urls = [];
}

function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 100 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

function toast(msg, type = "ok", detail = "") {
  const t = el(`<div class="toast ${type}"><span></span><small></small></div>`);
  t.querySelector("span").textContent = msg;
  t.querySelector("small").textContent = detail;
  $("#toasts").appendChild(t);
  setTimeout(() => {
    t.classList.add("bye");
    setTimeout(() => t.remove(), 320);
  }, type === "error" ? 6000 : 3600);
}

function isImageFile(name) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
}

/* ================================================================ option builders */

function seg(label, name, opts, def, cls = "") {
  return `<div class="opt">
    <span class="opt-label">${label}</span>
    <div class="seg ${cls}" data-opt="${name}" role="radiogroup" aria-label="${label}">
      ${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === def}" data-v="${v}" class="${v === def ? "on" : ""}">${l}</button>`).join("")}
    </div>
  </div>`;
}

function slider(label, name, min, max, step, def, suffix) {
  return `<div class="opt">
    <label class="opt-label" for="opt-${name}">${label}<output class="val" id="val-${name}" data-suffix="${suffix}">${def}${suffix}</output></label>
    <input type="range" id="opt-${name}" data-opt="${name}" min="${min}" max="${max}" step="${step}" value="${def}">
  </div>`;
}

function num(label, name, def, max, step = 1, min = 1) {
  return `<div class="opt">
    <label class="opt-label" for="opt-${name}">${label}</label>
    <input type="number" id="opt-${name}" data-opt="${name}" value="${def}" min="${min}" max="${max || 99999}" step="${step}" inputmode="decimal">
  </div>`;
}

function text(label, name, def, placeholder, type = "text") {
  return `<div class="opt">
    <label class="opt-label" for="opt-${name}">${label}</label>
    <input type="${type}" id="opt-${name}" data-opt="${name}" value="${def}" placeholder="${placeholder}" autocomplete="off">
  </div>`;
}

function check(label, name, def) {
  return `<div class="opt"><label class="toggle-row">
    <input type="checkbox" data-opt="${name}" ${def ? "checked" : ""}><span class="toggle" aria-hidden="true"></span>${label}
  </label></div>`;
}

function area(label, name, placeholder, rows = 3) {
  return `<div class="opt">
    <label class="opt-label" for="opt-${name}">${label}</label>
    <textarea id="opt-${name}" data-opt="${name}" rows="${rows}" placeholder="${placeholder}" spellcheck="false"></textarea>
  </div>`;
}

function checks(label, items) {
  return `<div class="opt">
    <span class="opt-label">${label}</span>
    <div class="check-grid">${items.map(([name, text]) => `<label class="check-pill">
      <input type="checkbox" data-opt="${name}"><span>${text}</span></label>`).join("")}</div>
  </div>`;
}

function color(label, name, def) {
  return `<div class="opt opt-inline">
    <label class="opt-label" for="opt-${name}">${label}</label>
    <input type="color" id="opt-${name}" data-opt="${name}" value="${def}">
  </div>`;
}

function row(html1, html2) {
  return `<div class="row">${html1}${html2}</div>`;
}

/** Short notes stay visible; long explanations fold away under "How this works". */
function note(html) {
  if (html.replace(/<[^>]+>/g, "").length <= 160) return `<div class="note">${html}</div>`;
  return `<details class="note"><summary>How this works</summary>${html}</details>`;
}

/* ================================================================ navigation */

const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m0 0l-5-5m5 5l-5 5"/></svg>';

// Typical government-portal specs, shown on the one-click banners.
const BANNER_SPECS = {
  pdf: ["Exact DPI", "Grayscale or true B/W", "KB cap per page"],
  image: ["Photo · 3.5 × 2.5 cm · 20 KB", "Signature · 2 × 4.5 cm · 10 KB", "Exact DPI"],
};

// Extra words people search with, beyond each tool's name and description.
const KEYWORDS = {
  "pdf-master": "govt portal upload exam form application",
  "img-master": "govt portal upload exam form passport photo signature",
  "pdf-compress": "reduce shrink smaller size mb",
  "pdf-target": "kb reduce shrink size limit",
  "pdf-bw": "grayscale greyscale black white monochrome",
  "pdf-organize": "merge combine join reorder delete remove pages mix",
  "pdf-split": "extract pages separate cut",
  "pdf-crop": "margin trim cut",
  "pdf-sign": "signature esign autograph",
  "pdf-watermark": "stamp confidential draft copy",
  "pdf-numbers": "page number footer header",
  "pdf-flatten": "form fields annotations lock",
  "pdf-to-images": "jpg jpeg png picture convert export",
  "pdf-from-images": "jpg jpeg png photo scan convert combine",
  "pdf-extract-images": "jpg png pictures photos save",
  "pdf-to-word": "docx doc word convert edit",
  "pdf-to-text": "txt copy text extract",
  "pdf-encrypt": "password protect lock secure",
  "pdf-unlock": "password remove decrypt restrictions",
  "pdf-redact": "hide blackout censor aadhaar pan email phone private",
  "pdf-metadata": "author properties privacy clean",
  "pdf-repair": "fix broken corrupt damaged error",
  "img-compress": "jpg jpeg png webp reduce shrink",
  "img-target": "kb reduce shrink size limit jpg",
  "img-resize": "scale pixels width height smaller bigger",
  "img-sizecm": "passport photo signature cm mm print",
  "img-crop": "cut trim circle round",
  "img-rotate": "flip mirror turn",
  "img-adjust": "brightness contrast enhance scan document clean",
  "img-watermark": "copyright name text stamp",
  "img-dpi": "resolution print ppi",
  "img-convert": "jpg jpeg png webp format change",
  "img-bw": "grayscale greyscale black white",
  "img-hide": "blur pixelate censor face number redact",
  "img-strip": "exif gps location privacy metadata clean",
  "pdf-edit": "edit text change typo annotate add text shapes highlight whiteout",
  "img-edit": "screenshot annotate markup arrow edit text change",
  "pdf-ocr": "ocr scan searchable recognise text copy hindi",
  "img-ocr": "ocr text extract copy read scan hindi",
};

/* ---------------------------------------------- favourites & recent (stored in this browser only) */

const store = {
  get(key, def) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? def;
    } catch {
      return def;
    }
  },
  set(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: not remembered */ }
  },
};
const toolById = (id) => TOOLS.find((t) => t.id === id);
const favs = () => store.get("mystic.favs", ["pdf-master", "img-master", "pdf-organize", "pdf-edit"]).filter(toolById);

function toggleFav(id) {
  const list = favs();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.unshift(id);
  store.set("mystic.favs", list);
  renderNavFavs();
  syncFavBtn();
}

function recordRecent(key) {
  const list = store.get("mystic.recent", []).filter((x) => x.k !== key);
  list.unshift({ k: key, t: Date.now() });
  store.set("mystic.recent", list.slice(0, 12));
}

function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/* ---------------------------------------------- cards */

function toolCard(t, { banner = false } = {}) {
  const card = el(`<a class="card${banner ? " featured" : ""}" href="#/tool/${t.id}">
    <span class="card-icon">${ICONS[t.icon]}</span>
    <span class="card-body">
      ${banner ? '<span class="eyebrow">One-click prep</span>' : ""}
      <span class="card-title">${t.name}</span>
      <span class="card-desc">${t.desc}</span>
      ${banner ? `<span class="spec-chips">${BANNER_SPECS[t.cat].map((s) => `<span>${s}</span>`).join("")}</span>` : ""}
    </span>
    <span class="card-go" aria-hidden="true">${ARROW}</span>
  </a>`);
  card.dataset.cat = t.cat;
  return card;
}

function section(title, cards, extra = "") {
  const s = el(`<section class="tool-section">${title ? `<h2 class="section-head"><span>${title}</span>${extra}</h2>` : ""}<div class="cards"></div></section>`);
  s.querySelector(".cards").append(...cards);
  return s;
}

/* ---------------------------------------------- dashboard */

const QUICK = ["pdf-compress", "pdf-organize", "pdf-edit", "pdf-sign", "pdf-ocr", "img-target", "img-edit", "img-convert"];

function miniRow(t, meta) {
  const a = el(`<a class="mini-row" href="#/tool/${t.id}"><span class="mini-icon">${ICONS[t.icon]}</span><span class="mini-name"></span><span class="mini-meta"></span></a>`);
  a.dataset.cat = t.cat;
  a.querySelector(".mini-name").textContent = t.name;
  a.querySelector(".mini-meta").textContent = meta;
  return a;
}

function renderDashboard() {
  const fav = favs().map(toolById);
  const recent = store.get("mystic.recent", []).filter((r) => toolById(r.k)).slice(0, 6);
  const home = $("#home");
  home.replaceChildren(el(`<div class="dash">
    <section class="hero">
      <div class="hero-text">
        <span class="eyebrow">Private by design</span>
        <h1>Every PDF &amp; image tool, <span class="accent">right in your browser.</span></h1>
        <p>Compress, convert, sign, edit and read text from documents — your files never leave this device.</p>
        <div class="hero-stats">
          <span><b>${TOOLS.length}</b> tools</span><span><b>0</b> uploads</span><span><b>${navigator.serviceWorker ? "Works" : "Runs"}</b> ${navigator.serviceWorker ? "offline" : "locally"}</span>
        </div>
      </div>
      <div class="hero-quick"></div>
    </section>
    <section class="dash-block">
      <div class="block-head"><h2>Quick tools</h2><a href="#/pdf">All PDF tools →</a></div>
      <div class="cards quick"></div>
    </section>
    <div class="dash-cols">
      <section class="dash-block">
        <div class="block-head"><h2>Favourites</h2><span class="block-hint">★ any tool to pin it</span></div>
        <div class="mini-list fav-list"></div>
      </section>
      <section class="dash-block">
        <div class="block-head"><h2>Recent</h2></div>
        <div class="mini-list recent-list"></div>
      </section>
    </div>
    <section class="dash-block">
      <div class="block-head"><h2>Workflows</h2><a href="#/workflows">Build your own →</a></div>
      <div class="wf-strip"></div>
    </section>
  </div>`));
  home.querySelector(".hero-quick").append(toolCard(toolById("pdf-master"), { banner: true }), toolCard(toolById("img-master"), { banner: true }));
  home.querySelector(".cards.quick").append(...QUICK.map(toolById).filter(Boolean).map((t) => toolCard(t)));
  const favList = home.querySelector(".fav-list");
  if (fav.length) fav.forEach((t) => favList.appendChild(miniRow(t, t.cat === "pdf" ? "PDF" : "Image")));
  else favList.appendChild(el(`<p class="mini-empty">No favourites yet.</p>`));
  const recList = home.querySelector(".recent-list");
  if (recent.length) recent.forEach((r) => recList.appendChild(miniRow(toolById(r.k), ago(r.t))));
  else recList.appendChild(el(`<p class="mini-empty">Tools you use show up here.</p>`));
  const strip = home.querySelector(".wf-strip");
  for (const w of WF_PRESETS.slice(0, 4)) {
    const c = el(`<a class="wf-mini" href="#/workflows/${w.id}"><span class="wf-mini-name"></span><span class="wf-mini-desc"></span><span class="wf-mini-steps">${w.steps.length} steps</span></a>`);
    c.querySelector(".wf-mini-name").textContent = w.name;
    c.querySelector(".wf-mini-desc").textContent = w.desc;
    strip.appendChild(c);
  }
}

/* ---------------------------------------------- catalog (all PDF / image tools) */

function renderCatalog(cat) {
  state.cat = cat;
  grid.dataset.cat = cat;
  const tools = TOOLS.filter((t) => t.cat === cat);
  $("#catalogTitle").textContent = cat === "pdf" ? "PDF tools" : "Image tools";
  $("#catalogSub").textContent = cat === "pdf"
    ? `${tools.length} tools to compress, organise, edit, sign, convert and protect PDFs.`
    : `${tools.length} tools to resize, compress, edit, convert and clean up photos and screenshots.`;
  const parts = tools.filter((t) => t.group === "prep").map((t) => toolCard(t, { banner: true }));
  for (const [g, title] of GROUPS[cat]) {
    const list = tools.filter((t) => t.group === g);
    if (list.length) parts.push(section(title, list.map((t) => toolCard(t))));
  }
  grid.replaceChildren(...parts);
}

/* ---------------------------------------------- sidebar */

function renderNavFavs() {
  const box = $("#navFavs");
  const list = favs().slice(0, 8).map(toolById);
  box.replaceChildren(...list.map((t) => {
    const a = el(`<a class="nav-item nav-fav" href="#/tool/${t.id}"><span class="nav-dot"></span><span></span></a>`);
    a.dataset.cat = t.cat;
    a.lastElementChild.textContent = t.name;
    return a;
  }));
  if (!list.length) box.appendChild(el(`<p class="nav-empty">Pin tools with ★</p>`));
}

function syncFavBtn() {
  const on = !!state.tool && favs().includes(state.tool.id);
  const b = $("#favBtn");
  b.classList.toggle("on", on);
  b.setAttribute("aria-pressed", String(on));
  b.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites");
}

$("#favBtn").addEventListener("click", () => state.tool && toggleFav(state.tool.id));

const drawer = (open) => {
  document.body.classList.toggle("drawer-open", open);
  $("#scrim").hidden = !open;
};
$("#menuBtn").addEventListener("click", () => drawer(!document.body.classList.contains("drawer-open")));
$("#scrim").addEventListener("click", () => drawer(false));

/* ---------------------------------------------- command palette (Ctrl+K or /) */

const palette = (() => {
  const box = $("#palette"), input = $("#toolSearch"), list = $("#paletteList");
  let items = [], active = 0;
  const pages = [
    { name: "Dashboard", desc: "Overview, favourites and recent tools", href: "#/", kind: "Page" },
    { name: "Workflows", desc: "Chain tools together", href: "#/workflows", kind: "Page" },
    { name: "Privacy policy", desc: "How your data is handled", href: "privacy.html", kind: "Page" },
    { name: "Terms of use", desc: "The rules for using MysticTools", href: "terms.html", kind: "Page" },
  ];

  function render() {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const match = (hay) => words.every((w) => hay.toLowerCase().includes(w));
    const tools = TOOLS.filter((t) => match(`${t.name} ${t.desc} ${KEYWORDS[t.id] || ""} ${t.cat === "pdf" ? "pdf document" : "image photo picture"}`))
      .map((t) => ({ name: t.name, desc: t.desc, href: `#/tool/${t.id}`, kind: t.cat === "pdf" ? "PDF" : "Image", icon: ICONS[t.icon], cat: t.cat }));
    const flows = (typeof WF_PRESETS === "undefined" ? [] : [...WF_PRESETS, ...loadMine()])
      .filter((w) => match(`${w.name} ${w.desc || ""} workflow`))
      .map((w) => ({ name: w.name, desc: w.desc || `${w.steps.length} steps`, href: `#/workflows/${w.id}`, kind: "Workflow", icon: ICONS.flow }));
    items = [...tools, ...flows, ...pages.filter((p) => q && match(`${p.name} ${p.desc}`))].slice(0, 30);
    active = 0;
    list.replaceChildren(...items.map((it, k) => {
      const li = el(`<li role="option" class="palette-item${k === 0 ? " on" : ""}" aria-selected="${k === 0}">
        <span class="mini-icon">${it.icon || ICONS.text}</span>
        <span class="palette-text"><span class="palette-name"></span><span class="palette-desc"></span></span>
        <span class="palette-kind">${it.kind}</span>
      </li>`);
      if (it.cat) li.dataset.cat = it.cat;
      li.querySelector(".palette-name").textContent = it.name;
      li.querySelector(".palette-desc").textContent = it.desc;
      li.addEventListener("click", () => go(k));
      li.addEventListener("mousemove", () => setActive(k));
      return li;
    }));
    if (!items.length) list.appendChild(el(`<li class="palette-empty">No match — try “compress”, “sign”, “jpg” or “ocr”.</li>`));
  }

  function setActive(k) {
    active = k;
    list.querySelectorAll(".palette-item").forEach((li, i) => {
      li.classList.toggle("on", i === k);
      li.setAttribute("aria-selected", String(i === k));
      if (i === k) li.scrollIntoView({ block: "nearest" });
    });
  }

  function go(k) {
    const it = items[k];
    if (!it) return;
    close();
    if (it.href.startsWith("#")) location.hash = it.href;
    else location.href = it.href;
  }

  function open() {
    box.hidden = false;
    document.body.classList.add("palette-open");
    input.value = "";
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    box.hidden = true;
    document.body.classList.remove("palette-open");
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, active - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(active); }
    else if (e.key === "Escape") close();
  });
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  $("#searchBtn").addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); box.hidden ? open() : close(); }
    else if (e.key === "/" && !typing && box.hidden && !state.markup) { e.preventDefault(); open(); }
  });
  return { open, close };
})();

/* ---------------------------------------------- router */

const VIEWS = { dashboard: "#home", catalog: "#catalog", workflows: "#workflowsView", tool: "#toolView" };

function setView(name, navKey = name) {
  for (const [k, sel] of Object.entries(VIEWS)) $(sel).classList.toggle("hidden", k !== name);
  document.querySelectorAll(".side-nav > .nav-item").forEach((a) => a.classList.toggle("on", a.dataset.view === navKey));
  document.body.dataset.view = name;
  drawer(false);
}

/** Leave the open tool: forget its files and editors. */
function leaveTool() {
  if (!state.tool) return;
  state.tool = null;
  state.files = [];
  state.result = null;
  state.previewSeq++;
  clearPreviewUrls();
  closeEditors();
  closeBoard();
}

function route() {
  const [view, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (view === "tool" && toolById(arg)) {
    if (state.tool?.id !== arg) openTool(arg);
    setView("tool", state.tool.cat);
    return;
  }
  leaveTool();
  if (view === "pdf" || view === "image") {
    renderCatalog(view);
    setView("catalog", view);
  } else if (view === "workflows") {
    if (arg) wf.current = null, wf.preselect = arg;
    renderWorkflows($("#workflowsView"));
    setView("workflows");
  } else {
    renderDashboard();
    setView("dashboard");
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

$("#backBtn").addEventListener("click", () => {
  location.hash = state.from && !state.from.startsWith("#/tool/") ? state.from : `#/${state.tool?.cat || "pdf"}`;
});

$("#themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch { /* private mode: not remembered */ }
  state.crop?.draw();
  state.regions?.draw();
  state.markup?.draw();
});

/* ================================================================ tool view */

const dz = $("#dropzone");
const fileInput = $("#fileInput");
const fileList = $("#fileList");
const optionsBox = $("#options");
const previewBox = $("#previewBox");

// user edits win over values filled in automatically (e.g. metadata prefill)
optionsBox.addEventListener("input", (e) => (e.target.dataset.touched = "1"));

/** Fill the left part of a range track (a CSS variable set via CSSOM, which the CSP allows). */
function paintRange(r) {
  r.style.setProperty("--p", `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
}

function emptyState() {
  previewBox.replaceChildren(el(`<div class="empty">
    <svg viewBox="0 0 96 96" width="88" height="88" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="20" y="16" width="44" height="58" rx="10" transform="rotate(-9 42 45)" opacity=".55"/>
      <rect x="30" y="22" width="44" height="58" rx="10"/>
      <path d="M41 40h22M41 50h22M41 60h12"/>
    </svg>
    <div><b>Your preview appears here</b><span>Add ${state.tool.single ? "a file" : "files"} — ${state.tool.single ? "it stays" : "they stay"} on this device.</span></div>
  </div>`));
}

function openTool(id) {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) return;
  state.tool = t;
  state.files = [];
  state.result = null;
  state.republishSignature = null;
  closeEditors();
  closeBoard();
  if (t.board) state.board = { sources: [], items: [], queue: Promise.resolve(), loading: 0 };
  $(".workspace").classList.toggle("board-mode", !!t.board);
  $(".workspace").classList.toggle("studio-mode", !!t.studio);

  $("#toolView").dataset.cat = t.cat;
  $("#toolIcon").innerHTML = ICONS[t.icon];
  $("#toolName").textContent = t.name;
  $("#toolDesc").textContent = t.desc;
  $("#processLabel").textContent = t.verb;
  fileInput.accept = t.accept.join(",");
  fileInput.multiple = !t.single;
  $("#dzTitle").textContent = t.single ? "Drop a file here" : "Drop files here";
  const kinds = t.accept === PDF_EXT ? "PDF" : t.accept.includes(".pdf") ? "PDF and images" : "JPG, PNG, WebP, HEIC, TIFF and more";
  $("#dzSub").textContent = `or click to browse · ${kinds}`;

  optionsBox.innerHTML = t.options().join("");
  for (const r of optionsBox.querySelectorAll('input[type="range"]')) {
    const val = optionsBox.querySelector(`#val-${r.dataset.opt}`);
    paintRange(r);
    r.addEventListener("input", () => {
      val.textContent = r.value + val.dataset.suffix;
      paintRange(r);
    });
  }
  optionsBox.querySelectorAll(".seg").forEach((sg) => {
    sg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      sg.querySelectorAll("button").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-checked", String(x === b));
      });
    });
  });
  if (t.init) t.init(optionsBox);

  dz.classList.remove("done");
  fileList.innerHTML = "";
  state.previewSeq++;
  clearPreviewUrls();
  previewBox.classList.toggle("board-stage", !!t.board);
  previewBox.classList.toggle("studio-stage-box", !!t.studio);
  emptyState();
  $("#statsBar").classList.add("hidden");
  $("#downloadBtn").classList.add("hidden");
  $("#processBtn").disabled = true;

  recordRecent(t.id);
  syncFavBtn();
  // reflect the tool in the address bar (back button and bookmarks work)
  if (location.hash !== `#/tool/${t.id}`) {
    state.from = location.hash || "#/";
    location.hash = `#/tool/${t.id}`;
  }
  window.scrollTo(0, 0);
}

/* -------------------------------------------------- dropzone */

dz.addEventListener("click", () => fileInput.click());
dz.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => {
  e.preventDefault();
  dz.classList.add("drag");
}));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => {
  e.preventDefault();
  dz.classList.remove("drag");
}));
dz.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) addFiles(fileInput.files);
  fileInput.value = "";
});

function accepted(name) {
  return state.tool.accept.includes(name.slice(name.lastIndexOf(".")).toLowerCase());
}

function resetResult() {
  state.result = null;
  $("#downloadBtn").classList.add("hidden");
  $("#statsBar").classList.add("hidden");
}

function addFiles(list) {
  const arr = [...list].filter((f) => accepted(f.name));
  if (!arr.length) {
    toast("That file type isn't supported here", "error");
    return;
  }
  if (state.tool.single) state.files = arr.slice(0, 1);
  else state.files = [...state.files, ...arr];
  resetResult();
  if (state.board) {
    arr.forEach(boardAddSource);
    return;
  }
  renderFiles();
  updatePreview();
  $("#processBtn").disabled = state.files.length === 0;
  if (state.tool.editor === "sign") refreshSignButton();
  if (state.tool.editor === "markup") $("#processBtn").disabled = true;
  state.tool.onFiles?.(state.files)?.catch?.(() => {});
}

function renderFiles() {
  fileList.innerHTML = "";
  state.files.forEach((f, i) => {
    // board sources show their letter; ordered tools the position (the output order); others the type
    const src = sourceOf(f);
    const badge = src ? src.letter : state.tool.reorder ? i + 1 : esc((f.name.split(".").pop() || "").slice(0, 4).toUpperCase());
    const detail = !src ? "" : src.kind === "image" ? " · image"
      : src.loading ? ` · loading ${src.loaded}${src.pages ? ` of ${src.pages}` : ""}…` : ` · ${src.pages} page${src.pages === 1 ? "" : "s"}`;
    const chip = el(`<div class="file-chip${src ? " src" : ""}">
      <span class="f-badge">${badge}</span>
      <span class="f-meta">
        <span class="f-name" title="${esc(f.name)}">${esc(f.name)}</span>
        <span class="f-size">${formatBytes(f.size)}${detail}</span>
      </span>
      ${state.tool.reorder ? `
        <button type="button" class="chip-btn" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Move up">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m0 0l-5 5m5-5l5 5"/></svg>
        </button>
        <button type="button" class="chip-btn" data-act="down" ${i === state.files.length - 1 ? "disabled" : ""} aria-label="Move down">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14m0 0l5-5m-5 5l-5-5"/></svg>
        </button>` : ""}
      <button type="button" class="chip-btn danger" data-act="del" aria-label="Remove ${esc(f.name)}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`);
    if (src) chip.style.setProperty("--src", src.color);
    chip.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (src) return boardRemoveSource(f);
      state.files.splice(i, 1);
      renderFiles();
      updatePreview();
      $("#processBtn").disabled = state.files.length === 0;
      if (!state.files.length) dz.classList.remove("done");
    });
    if (state.tool.reorder) {
      chip.querySelector('[data-act="up"]').addEventListener("click", () => {
        if (i === 0) return;
        [state.files[i - 1], state.files[i]] = [state.files[i], state.files[i - 1]];
        renderFiles();
      });
      chip.querySelector('[data-act="down"]').addEventListener("click", () => {
        if (i === state.files.length - 1) return;
        [state.files[i + 1], state.files[i]] = [state.files[i], state.files[i + 1]];
        renderFiles();
      });
    }
    fileList.appendChild(chip);
  });
  dz.classList.toggle("done", state.files.length > 0);
  $("#dzTitle").textContent = !state.files.length ? (state.tool.single ? "Drop a file here" : "Drop files here")
    : state.tool.single ? "Replace file" : "Add more files";
}

/* -------------------------------------------------- preview */

/** An object URL the browser can display for any supported image (HEIC/TIFF via the engine). */
async function displayUrl(f) {
  if (isImageFile(f.name)) return previewUrl(f);
  const p = await engine.run("img-preview", [f], { max: 2400 });
  return previewUrl(new Blob([p.png], { type: "image/png" }));
}

/** Text results (OCR, PDF → Text) shown as text, with a copy button. */
async function textResult(blob, caption) {
  const box = el(`<div class="text-result">
    <div class="text-bar"><span class="text-cap"></span><button type="button" class="pill-btn">Copy text</button></div>
    <pre tabindex="0"></pre>
  </div>`);
  const text = await blob.text();
  box.querySelector(".text-cap").textContent = caption;
  box.querySelector("pre").textContent = text;
  box.querySelector("button").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(text);
      e.target.textContent = "Copied ✓";
    } catch {
      toast("Couldn't copy — select the text and press Ctrl+C", "warn");
    }
  });
  previewBox.replaceChildren(box);
}

function hint(text) {
  const d = el(`<div class="empty-hint"></div>`);
  d.textContent = text;
  previewBox.replaceChildren(d);
}

function figure(src, caption) {
  const fig = el(`<figure class="preview-fig"><img alt="preview"><figcaption></figcaption></figure>`);
  fig.querySelector("img").src = src;
  fig.querySelector("figcaption").textContent = caption;
  previewBox.replaceChildren(fig);
}

/** Drop any editor living in the preview panel. */
function closeEditors() {
  state.crop = null;
  state.regions = null;
  state.sign?.destroy();
  state.sign = null;
  state.markup?.destroy();
  state.markup = null;
}

/** Show an image (or a rendered PDF page) in a canvas editor: crop box or hide-areas boxes. */
function canvasEditor(url, token, make, tip) {
  const img = new Image();
  img.onload = () => {
    if (token !== state.previewSeq) return;
    const wrap = el(`<div id="cropWrap"><canvas id="cropCanvas"></canvas><div class="crop-tip"></div></div>`);
    wrap.querySelector(".crop-tip").textContent = tip;
    previewBox.replaceChildren(wrap);
    make(wrap.querySelector("canvas"), img.naturalWidth, img.naturalHeight, url);
  };
  img.onerror = () => token === state.previewSeq && hint("This browser can't preview the file, but it can still be processed");
  img.src = url;
}

function updatePreview() {
  const token = ++state.previewSeq;
  clearPreviewUrls();
  closeEditors();
  if (!state.files.length) {
    emptyState();
    return;
  }
  const f = state.files[0];
  const more = state.files.length > 1 ? ` (+${state.files.length - 1} more)` : "";
  const editor = state.tool.id === "img-crop" ? "crop" : state.tool.editor;

  if (editor === "crop" || editor === "regions") {
    // HEIC/TIFF can't be shown by the browser: edit on a converted preview (boxes are proportional)
    displayUrl(f).then((url) => {
      if (token !== state.previewSeq) return;
      canvasEditor(url, token, (cv, w, h, u) => {
        if (editor === "regions") {
          state.regions = new RegionEditor(cv, u, w, h);
          return;
        }
        state.crop = new CropEditor(cv, u, w, h);
        const on = optionsBox.querySelector('[data-opt="shape"] button.on');
        if (on) state.crop.setShape(on.dataset.v);
      }, editor === "regions" ? "Drag on the image to cover what you want hidden" : "Drag inside to move · drag handles to resize");
    }).catch((err) => token === state.previewSeq && hint(`${f.name} — ${err.message}`));
    return;
  }
  if (editor === "pdfcrop") {
    hint(`${f.name} — loading page…`);
    engine.run("pdf-page", [f], { page: 0, width: 1100 }).then((r) => {
      if (token !== state.previewSeq) return;
      canvasEditor(previewUrl(new Blob([r.png], { type: "image/png" })), token, (cv, w, h, url) => {
        state.crop = new CropEditor(cv, url, w, h);
      }, "Drag the box to choose what to keep");
    }).catch((err) => token === state.previewSeq && hint(`${f.name} — ${err.message}`));
    return;
  }
  if (editor === "markup") {
    state.markup = new MarkupEditor(previewBox, {
      kind: state.tool.cat === "pdf" ? "pdf" : "image", file: f,
      onChange: (n) => {
        resetResult();
        $("#processBtn").disabled = n === 0 || state.busy;
      },
    });
    $("#processBtn").disabled = true;
    return;
  }
  if (editor === "sign") {
    state.sign = new SignEditor(previewBox, f);
    state.republishSignature?.();   // a signature made before the PDF was added
    return;
  }

  if (isImageFile(f.name)) {
    figure(previewUrl(f), f.name + more);
  } else if (/\.(heic|heif|tiff?|avif)$/i.test(f.name)) {
    hint(`${f.name} — loading preview…`);
    displayUrl(f).then((url) => token === state.previewSeq && figure(url, f.name + more))
      .catch((err) => token === state.previewSeq && hint(`${f.name} — ${err.message}`));
  } else if (/\.pdf$/i.test(f.name)) {
    hint(`${f.name} — loading preview…`);
    engine.run("preview-pdf", [f]).then((r) => {
      if (token !== state.previewSeq) return;
      if (r.locked) return hint(`🔒 ${f.name} is password-protected`);
      figure(previewUrl(new Blob([r.png], { type: "image/png" })),
        `${f.name} · ${r.pages} page${r.pages === 1 ? "" : "s"}${more}`);
    }).catch((err) => token === state.previewSeq && hint(`${f.name} — ${err.message}`));
  } else {
    hint(f.name + more);
  }
}

/* ================================================================ organizer board */

// Mid-tone colours that read on both themes; one per source file (A, B, C…).
const SOURCE_COLORS = ["#3a8fc0", "#d0607e", "#2f9e83", "#d08a2e", "#6b7fe0", "#a070d0", "#4fa34f", "#c96a4a"];
const BOARD_ICONS = {
  rotl: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.3"/><path d="M3 3v5h5"/></svg>',
  rotr: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v5h-5"/></svg>',
  dup: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  del: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};
let itemSeq = 0;

function closeBoard() {
  if (!state.board) return;
  for (const s of state.board.sources) s.urls.forEach((u) => URL.revokeObjectURL(u));
  state.board = null;
}

function sourceOf(file) {
  return state.board?.sources.find((s) => s.file === file);
}

/** Add a PDF (every page) or an image (one page) to the board. */
function boardAddSource(file) {
  const b = state.board;
  const n = (b.lettered = (b.lettered || 0) + 1) - 1;
  const src = {
    file, letter: n < 26 ? String.fromCharCode(65 + n) : `Z${n - 25}`, color: SOURCE_COLORS[n % SOURCE_COLORS.length],
    kind: /\.pdf$/i.test(file.name) ? "pdf" : "image", pages: 0, loaded: 0, loading: true, urls: [], original: [],
  };
  b.sources.push(src);
  const arrive = (page, thumb) => {
    src.original.push({ page, thumb });
    src.loaded++;
    insertItem(makeItem(src, page, thumb));
  };
  b.loading++;
  boardChanged();
  // files load one at a time, so pages land in the order the files were added
  b.queue = b.queue
    .then(() => {
      if (state.board !== b || !b.sources.includes(src)) return;
      if (src.kind === "image") {
        const url = URL.createObjectURL(file);
        src.urls.push(url);
        src.pages = 1;
        arrive(-1, url);
        return;
      }
      return engine.run("pdf-thumbs", [file], { size: 240 }, (p) => {
        if (state.board !== b || !b.sources.includes(src) || !p.thumb) return;
        const url = URL.createObjectURL(new Blob([p.thumb], { type: "image/jpeg" }));
        src.urls.push(url);
        src.pages = p.total;
        arrive(p.page, url);
        boardChanged();
      });
    })
    .catch((err) => {
      if (state.board === b && b.sources.includes(src)) {
        toast(`${file.name}: ${err.message}`, "error");
        boardRemoveSource(file);
      }
    })
    .finally(() => {
      src.loading = false;
      b.loading--;
      if (state.board === b) boardChanged();
    });
}

function boardRemoveSource(file) {
  const b = state.board, src = sourceOf(file);
  if (!src) return;
  for (const it of b.items.filter((x) => x.src === src)) it.card.remove();
  b.items = b.items.filter((x) => x.src !== src);
  src.urls.forEach((u) => URL.revokeObjectURL(u));
  b.sources.splice(b.sources.indexOf(src), 1);
  state.files = state.files.filter((f) => f !== file);
  boardChanged();
}

function makeItem(src, page, thumb, rotate = 0) {
  return { key: ++itemSeq, src, page, thumb, rotate, card: null };
}

function insertItem(item, index = state.board.items.length) {
  state.board.items.splice(index, 0, item);
  const grid = ensureBoard();
  item.card = pageCard(item);
  grid.insertBefore(item.card, grid.children[index] || null);
}

function pageCard(item) {
  const card = el(`<div class="page-card" role="listitem" tabindex="0">
    <div class="page-thumb"><img alt="" draggable="false"></div>
    <div class="page-meta"><span class="page-num"></span><span class="page-tag"></span></div>
    <div class="page-actions">
      <button type="button" data-act="rotl" aria-label="Rotate left" title="Rotate left">${BOARD_ICONS.rotl}</button>
      <button type="button" data-act="rotr" aria-label="Rotate right" title="Rotate right">${BOARD_ICONS.rotr}</button>
      <button type="button" data-act="dup" aria-label="Duplicate" title="Duplicate">${BOARD_ICONS.dup}</button>
      <button type="button" data-act="del" aria-label="Remove page" title="Remove">${BOARD_ICONS.del}</button>
    </div>
  </div>`);
  card.item = item;
  card.style.setProperty("--src", item.src.color);
  card.querySelector("img").src = item.thumb;
  card.querySelector(".page-tag").textContent = item.page < 0 ? `${item.src.letter} · image` : `${item.src.letter}${item.page + 1}`;
  card.querySelector(".page-thumb img").style.transform = item.rotate ? `rotate(${item.rotate}deg)` : "";
  return card;
}

/** Animate siblings from where they were to where mutate() puts them (FLIP). */
function flip(container, mutate) {
  const before = new Map([...container.children].map((c) => [c, c.getBoundingClientRect()]));
  mutate();
  for (const c of container.children) {
    const a = before.get(c);
    if (!a) continue;
    const r = c.getBoundingClientRect();
    const dx = a.left - r.left, dy = a.top - r.top;
    if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 230, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
  }
}

function boardAction(card, act) {
  const b = state.board, item = card.item, grid = card.parentElement;
  const index = b.items.indexOf(item);
  if (act === "rotl" || act === "rotr") {
    // turn keeps accumulating so the animation never spins back the long way through 0°
    item.turn = (item.turn ?? item.rotate) + (act === "rotr" ? 90 : -90);
    item.rotate = ((item.turn % 360) + 360) % 360;
    card.querySelector(".page-thumb img").style.transform = `rotate(${item.turn}deg)`;
  } else if (act === "dup") {
    const copy = makeItem(item.src, item.page, item.thumb, item.rotate);
    flip(grid, () => insertItem(copy, index + 1));
    copy.card.classList.add("adding");
  } else if (act === "del") {
    const next = card.nextElementSibling || card.previousElementSibling;
    flip(grid, () => {
      b.items.splice(index, 1);
      card.remove();
    });
    next?.focus();
  } else if (act === "left" || act === "right") {
    const to = index + (act === "right" ? 1 : -1);
    if (to < 0 || to >= b.items.length) return;
    flip(grid, () => {
      b.items.splice(index, 1);
      b.items.splice(to, 0, item);
      grid.insertBefore(card, grid.children[to + (act === "right" ? 1 : 0)] || null);
    });
    card.focus();
  }
  boardChanged();
}

function ensureBoard() {
  let grid = previewBox.querySelector(".board");
  if (grid) return grid;
  const wrap = el(`<div class="board-wrap">
    <div class="board-bar">
      <span class="board-count"></span>
      <span class="board-tools">
        <button type="button" class="pill-btn" data-board="reverse">Reverse</button>
        <button type="button" class="pill-btn" data-board="reset">Reset</button>
      </span>
    </div>
    <div class="board" role="list" aria-label="Pages of the new PDF"></div>
  </div>`);
  previewBox.replaceChildren(wrap);
  grid = wrap.querySelector(".board");
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (btn) boardAction(btn.closest(".page-card"), btn.dataset.act);
  });
  grid.addEventListener("keydown", (e) => {
    const card = e.target.closest?.(".page-card");
    if (!card || e.target !== card) return;
    const act = e.altKey && e.key === "ArrowLeft" ? "left" : e.altKey && e.key === "ArrowRight" ? "right"
      : e.key === "Delete" || e.key === "Backspace" ? "del" : e.key === "r" ? "rotr" : e.key === "R" ? "rotl" : e.key === "d" ? "dup" : null;
    if (act) {
      e.preventDefault();
      boardAction(card, act);
    }
  });
  wrap.querySelector(".board-tools").addEventListener("click", (e) => {
    const what = e.target.closest("button")?.dataset.board;
    const b = state.board;
    if (what === "reverse") {
      b.items.reverse();
      flip(grid, () => b.items.forEach((it) => grid.appendChild(it.card)));
    } else if (what === "reset") {
      b.items = b.sources.flatMap((s) => s.original.map((o) => makeItem(s, o.page, o.thumb)));
      b.items.forEach((it) => (it.card = pageCard(it)));
      grid.replaceChildren(...b.items.map((it) => it.card));
    }
    boardChanged();
  });
  enableSorting(grid);
  return grid;
}

/** Drag-to-reorder with pointer events: mouse drags at once, touch after a long press. */
function enableSorting(grid) {
  let drag = null;

  const begin = () => {
    drag.active = true;
    const r = drag.card.getBoundingClientRect();
    drag.dx = drag.x - r.left;
    drag.dy = drag.y - r.top;
    drag.ghost = drag.card.cloneNode(true);
    drag.ghost.classList.add("page-ghost");
    drag.ghost.removeAttribute("tabindex");
    drag.ghost.style.width = `${r.width}px`;
    document.body.appendChild(drag.ghost);
    drag.card.classList.add("dragging");
    document.body.classList.add("sorting");
    if (drag.touch) navigator.vibrate?.(12);
    follow();
    requestAnimationFrame(edgeScroll);
  };

  const follow = () => {
    drag.ghost.style.transform = `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) rotate(-2.5deg) scale(1.04)`;
  };

  // hit-test against layout boxes, not animated ones, so FLIP motion can't cause jitter
  const reorder = () => {
    const g = grid.getBoundingClientRect();
    const px = drag.x - g.left, py = drag.y - g.top;
    for (const c of grid.children) {
      if (c === drag.card) continue;
      if (px < c.offsetLeft || px >= c.offsetLeft + c.offsetWidth || py < c.offsetTop || py >= c.offsetTop + c.offsetHeight) continue;
      const ref = px > c.offsetLeft + c.offsetWidth / 2 ? c.nextElementSibling : c;
      if (ref !== drag.card && ref !== drag.card.nextElementSibling) flip(grid, () => grid.insertBefore(drag.card, ref));
      return;
    }
  };

  // near the top/bottom edge, scroll — slowly at first, faster the closer the pointer gets
  const edgeScroll = () => {
    if (!drag?.active) return;
    const zone = 60, top = 70, bottom = innerHeight - (innerWidth <= 640 ? 160 : 10);
    const depth = drag.y < top + zone ? drag.y - (top + zone) : drag.y > bottom - zone ? drag.y - (bottom - zone) : 0;
    if (depth) {
      scrollBy(0, Math.max(-16, Math.min(16, Math.round((depth / zone) * 16))));
      reorder();
    }
    requestAnimationFrame(edgeScroll);
  };

  const finish = () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.active) {
      drag.ghost.remove();
      drag.card.classList.remove("dragging");
      document.body.classList.remove("sorting");
      state.board.items = [...grid.children].map((c) => c.item);
      boardChanged();
    }
    drag = null;
  };

  grid.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".page-card");
    if (!card || e.target.closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = { card, id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, active: false, touch: e.pointerType !== "mouse" };
    if (drag.touch) drag.timer = setTimeout(() => drag && !drag.active && begin(), 300);
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.active) {
      const moved = Math.hypot(drag.x - drag.x0, drag.y - drag.y0);
      if (drag.touch) {
        if (moved > 10) finish();   // the finger is scrolling, not dragging
        return;
      }
      if (moved < 5) return;
      begin();
    }
    follow();
    reorder();
  });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  // once a touch drag has started, stop the page from scrolling under the finger
  grid.addEventListener("touchmove", (e) => { if (drag?.active) e.preventDefault(); }, { passive: false });
  grid.addEventListener("contextmenu", (e) => { if (drag) e.preventDefault(); });
}

/** Re-sync numbering, counts, file chips and the Build button after any change. */
function boardChanged() {
  const b = state.board;
  if (!b) return;
  resetResult();
  if (!b.sources.length) {
    emptyState();
  } else {
    const grid = ensureBoard();
    grid.querySelectorAll(".page-num").forEach((n, i) => (n.textContent = i + 1));
    const files = b.sources.length;
    previewBox.querySelector(".board-count").textContent =
      `${b.items.length} page${b.items.length === 1 ? "" : "s"} from ${files} file${files === 1 ? "" : "s"}${b.loading ? " · loading…" : ""}`;
  }
  renderFiles();
  $("#processBtn").disabled = !b.items.length || b.loading > 0;
}

/* ================================================================ crop editor */

class CropEditor {
  constructor(canvas, url, iw, ih) {
    this.canvas = canvas;
    this.iw = iw;
    this.ih = ih;
    this.shape = "rect";
    const W = 640, H = 440;
    const scale = Math.min(W / iw, H / ih);
    this.cw = Math.max(2, Math.round(iw * scale));
    this.ch = Math.max(2, Math.round(ih * scale));
    canvas.width = this.cw;
    canvas.height = this.ch;
    this.ctx = canvas.getContext("2d");
    this.rect = { x: this.cw * 0.08, y: this.ch * 0.08, w: this.cw * 0.84, h: this.ch * 0.84 };
    this.circle = {
      x: this.cw / 2,
      y: this.ch / 2,
      r: Math.min(this.cw, this.ch) * 0.35,
    };
    this.drag = null;
    this.img = new Image();
    this.img.onload = () => this.draw();
    this.img.src = url;

    const cv = this.canvas;
    cv.addEventListener("pointerdown", (e) => {
      this.down(e);
      // keep receiving moves while dragging past the canvas edge
      if (this.drag) cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => this.move(e));
    cv.addEventListener("pointerup", () => (this.drag = null));
    cv.addEventListener("pointercancel", () => (this.drag = null));
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * this.cw) / r.width,
      y: ((e.clientY - r.top) * this.ch) / r.height,
    };
  }

  clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  setShape(shape) {
    if (shape === this.shape) return;
    this.shape = shape;
    if (shape === "circle") {
      const { x, y, w, h } = this.rect;
      this.circle = { x: x + w / 2, y: y + h / 2, r: Math.min(w, h) / 2 };
    } else {
      const { x, y, r } = this.circle;
      this.rect = { x: this.clamp(x - r, 0, this.cw - 24), y: this.clamp(y - r, 0, this.ch - 24), w: 2 * r, h: 2 * r };
      this.rect.w = this.clamp(this.rect.w, 24, this.cw - this.rect.x);
      this.rect.h = this.clamp(this.rect.h, 24, this.ch - this.rect.y);
    }
    this.draw();
  }

  value() {
    if (this.shape === "circle") {
      const { x, y, r } = this.circle;
      return {
        x: (x - r) / this.cw, y: (y - r) / this.ch,
        w: (2 * r) / this.cw, h: (2 * r) / this.ch,
      };
    }
    const { x, y, w, h } = this.rect;
    return { x: x / this.cw, y: y / this.ch, w: w / this.cw, h: h / this.ch };
  }

  /* ---------------------------------------------- draw */

  draw() {
    const c = this.ctx;
    // follow the page theme (read each frame so a theme switch repaints correctly)
    this.accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2a6b8c";
    c.clearRect(0, 0, this.cw, this.ch);
    c.drawImage(this.img, 0, 0, this.cw, this.ch);
    if (this.shape === "rect") this.drawRect();
    else this.drawCircle();
  }

  knob(x, y, r = 6) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = "#fff";
    c.fill();
    c.lineWidth = 2.5;
    c.strokeStyle = this.accent;
    c.stroke();
  }

  drawRect() {
    const c = this.ctx;
    const { x, y, w, h } = this.rect;
    c.beginPath();
    c.rect(0, 0, this.cw, this.ch);
    c.roundRect(x, y, w, h, 6);
    c.fillStyle = "rgba(17,24,35,0.58)";
    c.fill("evenodd");
    c.beginPath();
    c.roundRect(x, y, w, h, 6);
    c.strokeStyle = this.accent;
    c.lineWidth = 2.5;
    c.stroke();
    // rule-of-thirds guides
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 1;
    c.beginPath();
    for (const k of [1, 2]) {
      c.moveTo(x + (w * k) / 3, y); c.lineTo(x + (w * k) / 3, y + h);
      c.moveTo(x, y + (h * k) / 3); c.lineTo(x + w, y + (h * k) / 3);
    }
    c.stroke();
    for (const [hx, hy] of [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h],
      [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2],
    ]) this.knob(hx, hy);
  }

  drawCircle() {
    const c = this.ctx;
    const { x, y, r } = this.circle;
    c.beginPath();
    c.rect(0, 0, this.cw, this.ch);
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = "rgba(17,24,35,0.58)";
    c.fill("evenodd");
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = this.accent;
    c.lineWidth = 2.5;
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 12, y); c.lineTo(x + 12, y);
    c.moveTo(x, y - 12); c.lineTo(x, y + 12);
    c.stroke();
    this.knob(x, y - r, 7);
  }

  /* ---------------------------------------------- pointer */

  down(e) {
    const p = this.pos(e);
    if (this.shape === "rect") {
      const handle = this.hitRectHandle(p);
      if (handle) { this.drag = { t: "h", h: handle }; return; }
      const { x, y, w, h } = this.rect;
      if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) {
        this.drag = { t: "m", ox: p.x - x, oy: p.y - y };
      }
      return;
    }
    const { x, y, r } = this.circle;
    const d = Math.hypot(p.x - x, p.y - y);
    if (Math.abs(d - r) < 14) { this.drag = { t: "r" }; return; }
    if (d <= r) { this.drag = { t: "m", ox: p.x - x, oy: p.y - y }; }
  }

  hitRectHandle(p) {
    const { x, y, w, h } = this.rect;
    const hs = {
      nw: [x, y], ne: [x + w, y], sw: [x, y + h], se: [x + w, y + h],
      n: [x + w / 2, y], s: [x + w / 2, y + h], w: [x, y + h / 2], e: [x + w, y + h / 2],
    };
    for (const [k, [hx, hy]] of Object.entries(hs)) {
      if (Math.abs(p.x - hx) < 12 && Math.abs(p.y - hy) < 12) return k;
    }
    return null;
  }

  move(e) {
    if (!this.drag) return;
    const p = this.pos(e);
    const MIN = 28;
    if (this.shape === "rect") {
      const r = this.rect;
      if (this.drag.t === "m") {
        r.x = this.clamp(p.x - this.drag.ox, 0, this.cw - r.w);
        r.y = this.clamp(p.y - this.drag.oy, 0, this.ch - r.h);
      } else {
        // west/north handles move one edge and keep the opposite edge fixed
        const h = this.drag.h;
        const right = r.x + r.w, bottom = r.y + r.h;
        if (h.includes("w")) { r.x = this.clamp(p.x, 0, right - MIN); r.w = right - r.x; }
        if (h.includes("e")) r.w = this.clamp(p.x - r.x, MIN, this.cw - r.x);
        if (h.includes("n")) { r.y = this.clamp(p.y, 0, bottom - MIN); r.h = bottom - r.y; }
        if (h.includes("s")) r.h = this.clamp(p.y - r.y, MIN, this.ch - r.y);
      }
      this.draw();
      return;
    }
    const c = this.circle;
    if (this.drag.t === "m") {
      c.x = this.clamp(p.x - this.drag.ox, c.r, this.cw - c.r);
      c.y = this.clamp(p.y - this.drag.oy, c.r, this.ch - c.r);
    } else {
      const maxR = Math.min(c.x, this.cw - c.x, c.y, this.ch - c.y, Math.min(this.cw, this.ch) / 2);
      c.r = this.clamp(Math.hypot(p.x - c.x, p.y - c.y), 14, Math.max(14, maxR));
    }
    this.draw();
  }
}

/* ================================================================ submit */

function readOptions() {
  const out = {};
  optionsBox.querySelectorAll("[data-opt]").forEach((n) => {
    if (n.classList.contains("seg")) {
      const on = n.querySelector("button.on");
      if (on) out[n.dataset.opt] = on.dataset.v;
    } else if (n.type === "checkbox") {
      out[n.dataset.opt] = n.checked ? "true" : "false";
    } else if (n.tagName === "INPUT" || n.tagName === "SELECT" || n.tagName === "TEXTAREA") {
      out[n.dataset.opt] = n.value;
    }
  });
  return out;
}

/* ---------------------------------------------- running tools */

const utf8 = (s) => new TextEncoder().encode(s);
const toolStem = (name) => (name || "file").replace(/\.[^.]*$/, "") || "file";

/** An image the browser (or Tesseract) can read: HEIC/TIFF are converted first. */
async function browserImage(file) {
  if (/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name)) return file;
  const p = await engine.run("img-preview", [file], { max: 6000 });
  return new Blob([p.png], { type: "image/png" });
}

/** OCR a PDF: render each scanned page, read it, then add an invisible text layer. */
async function ocrPdf(file, o, progress) {
  const lang = o.lang || "eng";
  const stats = await engine.run("pdf-text-stats", [file]);
  const todo = [...Array(stats.pages).keys()].filter((i) => o.skip_text === "false" || stats.chars[i] < 25);
  if (!todo.length) throw new Error("Every page already has text — nothing to OCR (untick “Skip pages that already have text” to redo them)");
  const layer = [], texts = [];
  for (const [k, i] of todo.entries()) {
    progress({ done: k, total: todo.length, label: `page ${i + 1} (${k + 1} of ${todo.length})` });
    const r = await engine.run("pdf-page", [file], { page: i, dpi: 300, gray: true });
    const res = await ocr.recognize(new Blob([r.png], { type: "image/png" }), lang, (s) => progress({ label: `${s.replace(/…$/, "")} · page ${i + 1}` }));
    const W = res.width, H = res.height;
    layer.push({ page: i, lines: res.lines.map((l) => l.words.map((w) => ({ text: w.text, x: w.bbox.x0 / W, y: w.bbox.y0 / H, w: (w.bbox.x1 - w.bbox.x0) / W, h: (w.bbox.y1 - w.bbox.y0) / H }))) });
    texts.push(`--- Page ${i + 1} ---\n\n${res.text}`);
  }
  progress({ label: "adding the text layer" });
  const pdf = await engine.run("pdf-textlayer", [file], { pages: JSON.stringify(layer) });
  const txt = { name: `${toolStem(file.name)}.txt`, bytes: utf8(texts.join("\n\n") + "\n"), mime: "text/plain;charset=utf-8" };
  if (o.output === "txt") return { ...txt, orig: file.size, engine: pdf.engine };
  if (o.output === "both") {
    const z = await engine.run("zip", [new File([pdf.bytes], pdf.name), new File([txt.bytes], txt.name)]);
    return { ...z, name: `${toolStem(file.name)}_ocr.zip`, orig: file.size, engine: pdf.engine };
  }
  return pdf;
}

/** OCR one or more images into a single text file. */
async function ocrImages(files, o, progress) {
  const parts = [];
  for (const [k, f] of files.entries()) {
    progress({ done: k, total: files.length, label: files.length > 1 ? `${k + 1} of ${files.length}` : "" });
    const res = await ocr.recognize(await browserImage(f), o.lang || "eng", (s) => progress({ label: s.replace(/…$/, "") }));
    parts.push(files.length > 1 ? `--- ${f.name} ---\n\n${res.text}` : res.text);
  }
  const text = parts.join("\n\n").trim();
  if (!text) throw new Error("No text found in the image");
  return {
    name: files.length > 1 ? "text.txt" : `${toolStem(files[0].name)}.txt`, bytes: utf8(text + "\n"), mime: "text/plain;charset=utf-8",
    orig: files.reduce((n, f) => n + f.size, 0), engine: `${text.split(/\s+/).length} words`, text,
  };
}

/** Run a tool — in the engine worker, or here for OCR (Tesseract runs its own worker). */
function executeTool(t, files, opts, progress = () => {}) {
  if (t.run === "ocr-pdf") return ocrPdf(files[0], opts, progress);
  if (t.run === "ocr-image") return ocrImages(files, opts, progress);
  return engine.run(t.engineOp || t.id, files, opts, progress);
}

async function submit() {
  const t = state.tool;
  if (!state.files.length || state.busy) return;
  state.busy = true;
  $("#processBtn").disabled = true;
  $("#processLabel").textContent = engine.loaded === false ? "Loading engine…" : "Working…";
  $("#spinner").classList.remove("hidden");

  const opts = readOptions();
  if (state.crop) Object.assign(opts, state.crop.value());
  if (state.regions) opts.regions = JSON.stringify(state.regions.value());
  let files = t.single ? state.files.slice(0, 1) : state.files;
  if (state.board) {
    // send only the files still on the board; the plan indexes into that list
    const used = [...new Set(state.board.items.map((it) => it.src))];
    files = used.map((s) => s.file);
    opts.pages = JSON.stringify(state.board.items.map((it) => ({ src: used.indexOf(it.src), page: it.page, rotate: it.rotate })));
  }
  if (state.sign?.ready()) {
    files = [state.files[0], state.sign.signatureFile()];
    Object.assign(opts, state.sign.value(opts.sign_pages));
  }
  const onProgress = ({ done, total, label }) => {
    $("#processLabel").textContent = label ? `Working… ${label}` : `Working… ${done}/${total}`;
  };

  try {
    if (state.markup) {
      if (t.cat === "pdf") {
        const { edits, images } = state.markup.pdfEdits();
        files = [state.files[0], ...images];
        opts.edits = JSON.stringify(edits);
      } else {
        const blob = await state.markup.imageBlob();
        files = [state.files[0], new File([blob], "edited.png", { type: "image/png" })];
      }
    }
    const r = await executeTool(t, files, opts, onProgress);
    state.result = {
      blob: new Blob([r.bytes], { type: r.mime }), name: r.name,
      orig: r.orig ?? files.reduce((n, f) => n + f.size, 0), nw: r.bytes.byteLength,
    };
    showResult();
    toast(...resultMessage(r));
  } catch (err) {
    toast(err.message, "error");
  } finally {
    state.busy = false;
    $("#processBtn").disabled = false;
    $("#processLabel").textContent = t.verb;
    $("#spinner").classList.add("hidden");
  }
}

function resultMessage(r) {
  const e = r.engine || "";
  if (e === "batch") {
    return r.failed
      ? [`Done — ${r.processed} processed, ${r.failed} failed (see summary.txt)`, "warn"]
      : [`Done — ${r.processed} files processed`, "ok"];
  }
  const fixed = {
    "already-fits": ["Done — file is already under the target", "ok"],
    "no-reduction": ["Done — can't get smaller, returned unchanged", "warn"],
    "best-effort": ["Done — best possible size (target was unreachable)", "warn"],
    "passthrough-locked": ["This PDF is password-protected — returned unchanged", "warn"],
    "master-encrypted-passthrough": ["This PDF is password-protected — returned unchanged", "warn"],
    "master-corrupt-passthrough": ["This PDF is damaged — returned unchanged", "warn"],
  };
  if (fixed[e]) return fixed[e];
  if (e.endsWith("-over-max")) return ["Done — couldn't get under the size cap; this is the smallest at your settings", "warn"];
  // the engine string (e.g. "jpeg-q80") is kept as a small detail for the curious
  return [`Done · ${formatBytes(r.bytes.byteLength)}`, "ok", e];
}

function showResult() {
  const r = state.result;
  const bar = $("#statsBar");
  bar.classList.remove("hidden");
  const pct = r.orig && r.nw ? Math.max(0, Math.round((1 - r.nw / r.orig) * 100)) : null;
  $("#statOld").textContent = r.orig ? formatBytes(r.orig) : "";
  $("#statNew").textContent = r.nw ? formatBytes(r.nw) : formatBytes(r.blob.size);
  $("#statPct").textContent = pct !== null ? `−${pct}%` : "";
  $("#savingsFill").style.width = pct !== null ? `${pct}%` : "100%";

  const dl = $("#downloadBtn");
  dl.classList.remove("hidden");
  dl.onclick = () => {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // the crop editor and the page board stay on screen so they can be adjusted and re-run
  if (state.crop || state.board || state.regions || state.sign || state.markup) return;
  const token = ++state.previewSeq;
  clearPreviewUrls();
  const caption = `Result: ${r.name} · ${formatBytes(r.nw)}`;
  if (/\.txt$/i.test(r.name)) {
    textResult(r.blob, caption);
  } else if (isImageFile(r.name)) {
    figure(previewUrl(r.blob), caption);
  } else if (/\.pdf$/i.test(r.name)) {
    hint(caption);
    engine.run("preview-pdf", [new File([r.blob], r.name)]).then((p) => {
      if (token !== state.previewSeq || p.locked) return;
      figure(previewUrl(new Blob([p.png], { type: "image/png" })), `${caption} · ${p.pages} page${p.pages === 1 ? "" : "s"}`);
    }).catch(() => {});
  } else {
    hint(caption);
  }
}

$("#processBtn").addEventListener("click", submit);

/* ================================================================ boot */

$("#year").textContent = new Date().getFullYear();
$("#countPdf").textContent = TOOLS.filter((t) => t.cat === "pdf").length;
$("#countImg").textContent = TOOLS.filter((t) => t.cat === "image").length;
renderNavFavs();
// workflows.js loads after this file: route once every script has run
document.addEventListener("DOMContentLoaded", route);

// offline support once the app has loaded (never caches your files — see sw.js)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
