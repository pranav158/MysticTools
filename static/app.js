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
  wand: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L15 9"/><path d="M15 4l6 6L9 22H2v-7z"/><path d="M18 2l.9 2.1L21 5l-2.1.9L18 8l-.9-2.1L15 5l2.1-.9z" fill="currentColor" stroke="none"/></svg>',
};

/* ================================================================ tool definitions */

const PDF_EXT = [".pdf"];
const IMG_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"];

const TOOLS = [
  /* ---------- PDF ---------- */
  {
    id: "pdf-master", cat: "pdf", icon: "wand", tag: "One-Click",
    name: "Master Prep PDF", verb: "Prepare",
    desc: "B/W + DPI cap + target size in one pass — ready for govt upload.",
    endpoint: "/api/pdf/master", single: false, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Color mode", "mode", [["grayscale", "Grayscale"], ["true-bw", "True B/W"], ["color", "Keep color"]], "grayscale"),
      slider("Max DPI", "dpi", 36, 600, 1, 200, " DPI"),
      slider("Threshold (B/W)", "threshold", 0, 255, 1, 128, ""),
      num("Max KB per page", "per_page_kb", 300, 5120),
      num("Max KB total (0 = per page × pages)", "target_kb", 0, 51200),
      note("Renders scans at your exact DPI (never lowered — govt portals reject anything under 200 DPI), then JPEG-compresses to stay under the size cap. DPI is exact, size is a max. Locked (password-protected) PDFs are passed through unchanged and flagged in the summary. Drop multiple PDFs for batch — one zip with a per-file summary."),
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
    id: "pdf-compress", cat: "pdf", icon: "gauge", tag: "PDF",
    name: "Compress PDF", verb: "Compress",
    desc: "Ghostscript-powered size reduction. Pick your quality vs size trade-off.",
    endpoint: "/api/pdf/compress", single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Preset", "quality", [
        ["screen", "Screen"], ["ebook", "eBook"], ["printer", "Printer"], ["prepress", "Prepress"],
      ], "ebook"),
      note("Screen = smallest, Prepress = highest quality. Lower presets shrink files more aggressively."),
    ],
  },
  {
    id: "pdf-target", cat: "pdf", icon: "target", tag: "PDF",
    name: "Compress to Size", verb: "Compress",
    desc: "Hit an exact file-size target (e.g. 10 KB) in one pass — keeps your original DPI by default.",
    endpoint: "/api/pdf/target-size", single: true, accept: PDF_EXT, reorder: false,
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
    id: "pdf-merge", cat: "pdf", icon: "merge", tag: "PDF",
    name: "Merge PDFs", verb: "Merge",
    desc: "Combine several PDFs into one. Use the arrows to set the page order.",
    endpoint: "/api/pdf/merge", single: false, accept: PDF_EXT, reorder: true,
    options: () => [note("Add two or more PDFs. The order of the list is the order of the merged document.")],
  },
  {
    id: "pdf-split", cat: "pdf", icon: "split", tag: "PDF",
    name: "Split PDF", verb: "Split",
    desc: "Pull out a page range, or break the document into chunks.",
    endpoint: "/api/pdf/split", single: true, accept: PDF_EXT, reorder: false,
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
    id: "pdf-rotate", cat: "pdf", icon: "rotate", tag: "PDF",
    name: "Rotate PDF", verb: "Rotate",
    desc: "Turn pages 90°, 180° or 270° — all pages or just the ones you pick.",
    endpoint: "/api/pdf/rotate", single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Angle", "angle", [["90", "90°"], ["180", "180°"], ["270", "270°"]], "90"),
      text("Pages (e.g. 1,3,5 or 2-4 — leave empty for all)", "pages", "", "all"),
    ],
  },
  {
    id: "pdf-to-images", cat: "pdf", icon: "docImage", tag: "PDF",
    name: "PDF → Images", verb: "Convert",
    desc: "Render every page as a JPG or PNG at your chosen DPI.",
    endpoint: "/api/pdf/to-images", single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Format", "fmt", [["jpg", "JPG"], ["png", "PNG"]], "jpg"),
      slider("Resolution", "dpi", 72, 600, 1, 150, " DPI"),
      slider("Quality (JPG)", "quality", 10, 100, 1, 85, "%"),
      note("Single-page PDFs download directly — multi-page files come as a .zip."),
    ],
  },
  {
    id: "pdf-from-images", cat: "pdf", icon: "imageDoc", tag: "PDF",
    name: "Images → PDF", verb: "Create",
    desc: "Turn your photos and scans into a neat PDF document.",
    endpoint: "/api/pdf/from-images", single: false, accept: IMG_EXT, reorder: true,
    options: () => [
      seg("Page size", "page_size", [["a4", "A4"], ["letter", "Letter"], ["auto", "Image size"]], "a4"),
      seg("Orientation", "orientation", [["portrait", "Portrait"], ["landscape", "Landscape"]], "portrait"),
      num("Margin (mm)", "margin_mm", 0, 20),
    ],
  },
  {
    id: "pdf-extract-images", cat: "pdf", icon: "images", tag: "PDF",
    name: "Extract Images", verb: "Extract",
    desc: "Pull every embedded image out of the PDF as a standalone file.",
    endpoint: "/api/pdf/extract-images", single: true, accept: PDF_EXT, reorder: false,
    options: () => [note("All unique images are exported in their original format — one file each, or a .zip.")],
  },
  {
    id: "pdf-encrypt", cat: "pdf", icon: "lock", tag: "PDF",
    name: "Protect PDF", verb: "Protect",
    desc: "Lock your document with a password using AES or RC4 encryption.",
    endpoint: "/api/pdf/encrypt", single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      text("Password", "password", "", "choose a strong password", "password"),
      seg("Method", "method", [["aes-256", "AES-256"], ["aes-128", "AES-128"], ["rc4", "RC4"]], "aes-256"),
      note("AES-256 is the strongest and most widely supported. Keep your password safe — no one can recover it."),
    ],
  },
  {
    id: "pdf-bw", cat: "pdf", icon: "bw", tag: "PDF",
    name: "Black & White PDF", verb: "Convert",
    desc: "Grayscale or hard black & white — required by many govt portals for supporting documents.",
    endpoint: "/api/pdf/bw", single: true, accept: PDF_EXT, reorder: false,
    options: () => [
      seg("Mode", "mode", [["grayscale", "Grayscale"], ["true-bw", "True B/W"]], "grayscale"),
      slider("Render DPI (B/W)", "dpi", 36, 600, 1, 200, " DPI"),
      slider("Threshold (B/W)", "threshold", 0, 255, 1, 128, ""),
      note("Grayscale keeps the text layer (best for scans). True B/W renders every pixel pure black or white — the threshold decides the cut-off point."),
    ],
    init(container) {
      const show = (mode) => {
        const vis = mode === "true-bw";
        container.querySelector('[data-opt="dpi"]').closest(".opt").style.display = vis ? "" : "none";
        container.querySelector('[data-opt="threshold"]').closest(".opt").style.display = vis ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="mode"]');
      show(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) show(b.dataset.v);
      });
    },
  },

  /* ---------- Image ---------- */
  {
    id: "img-master", cat: "image", icon: "wand", tag: "One-Click",
    name: "Master Prep Image", verb: "Prepare",
    desc: "B/W + 200 DPI + exact KB target in one pass — photo or signature ready.",
    endpoint: "/api/image/master", single: false, accept: IMG_EXT, reorder: false,
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
    id: "img-compress", cat: "image", icon: "compressImg", tag: "Image",
    name: "Compress Image", verb: "Compress",
    desc: "Shrink JPG, PNG or WebP with a quality slider and live size stats.",
    endpoint: "/api/image/compress", single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Output format", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "jpeg"),
      slider("Quality", "quality", 1, 100, 1, 80, "%"),
      note("PNG stays lossless — quality is traded for palette colors instead."),
    ],
  },
  {
    id: "img-target", cat: "image", icon: "target", tag: "Image",
    name: "Compress to Size", verb: "Compress",
    desc: "Fit the image under a target file size — keeps the original DPI unless you set a custom one.",
    endpoint: "/api/image/target-size", single: true, accept: IMG_EXT, reorder: false,
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
    id: "img-crop", cat: "image", icon: "crop", tag: "Image",
    name: "Crop Image", verb: "Crop",
    desc: "Interactive rectangle or circle crop. Circle gets a transparent or solid background.",
    endpoint: "/api/image/crop", single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Shape", "shape", [["rect", "Rectangle"], ["circle", "Circle"]], "rect"),
      seg("Circle background", "fill", [["transparent", "Transparent"], ["white", "White"], ["black", "Black"]], "transparent"),
      note("Drag the handles on the preview to size the crop. Transparent output is saved as PNG."),
    ],
    init(container) {
      const hideFill = (shape) => {
        container.querySelector('[data-opt="fill"]').closest(".opt").style.display =
          shape === "circle" ? "" : "none";
      };
      const seg = container.querySelector('[data-opt="shape"]');
      hideFill(seg.querySelector("button.on").dataset.v);
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) hideFill(b.dataset.v);
      });
    },
  },
  {
    id: "img-resize", cat: "image", icon: "resize", tag: "Image",
    name: "Resize Image", verb: "Resize",
    desc: "Scale by percentage or exact pixels, with optional aspect-ratio lock.",
    endpoint: "/api/image/resize", single: true, accept: IMG_EXT, reorder: false,
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
    id: "img-dpi", cat: "image", icon: "dpi", tag: "Image",
    name: "Change DPI", verb: "Set DPI",
    desc: "Rewrite the DPI tag for print, or physically resample the pixels to match.",
    endpoint: "/api/image/dpi", single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      slider("DPI", "dpi", 72, 2400, 1, 300, ""),
      seg("Mode", "mode", [["metadata", "Metadata only"], ["resample", "Resample pixels"]], "metadata"),
      note("Metadata only rewrites the DPI tag — file stays the same. Resample actually changes the pixel dimensions for print."),
    ],
  },
  {
    id: "img-convert", cat: "image", icon: "swap", tag: "Image",
    name: "Convert Image", verb: "Convert",
    desc: "Change format between JPG, PNG and WebP — the best format for the job.",
    endpoint: "/api/image/convert", single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Target format", "fmt", [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]], "png"),
      slider("Quality", "quality", 1, 100, 1, 85, "%"),
      note("WebP is usually the smallest at equal quality. PNG keeps transparency."),
    ],
  },
  {
    id: "img-rotate", cat: "image", icon: "flip", tag: "Image",
    name: "Rotate / Flip", verb: "Apply",
    desc: "Rotate in 90° steps and flip horizontally or vertically.",
    endpoint: "/api/image/rotate", single: true, accept: IMG_EXT, reorder: false,
    options: () => [
      seg("Angle", "angle", [["90", "90°"], ["180", "180°"], ["270", "270°"]], "90"),
      seg("Flip", "flip", [["none", "None"], ["h", "Horizontal"], ["v", "Vertical"]], "none"),
    ],
  },
  {
    id: "img-bw", cat: "image", icon: "bw", tag: "Image",
    name: "Convert to B/W", verb: "Convert",
    desc: "Grayscale or true black & white for JPEG/PNG/WebP supporting documents.",
    endpoint: "/api/image/bw", single: true, accept: IMG_EXT, reorder: false,
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
    id: "img-sizecm", cat: "image", icon: "cm", tag: "Image",
    name: "Size in CM", verb: "Resize",
    desc: "Exact physical size at a DPI — photo 3.5×2.5 cm, signature 2×4.5 cm, any spec.",
    endpoint: "/api/image/size-cm", single: true, accept: IMG_EXT, reorder: false,
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
];

/* ================================================================ state */

const state = {
  cat: "pdf",
  tool: null,
  files: [],
  crop: null,
  result: null,
  busy: false,
};

/* ================================================================ dom helpers */

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const toolView = $("#toolView");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 100 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

function toast(msg, type = "ok") {
  const t = el(`<div class="toast ${type}"><span>${msg}</span></div>`);
  $("#toasts").appendChild(t);
  setTimeout(() => {
    t.classList.add("bye");
    setTimeout(() => t.remove(), 320);
  }, 3600);
}

function cdFilename(header) {
  const m = /filename\*=UTF-8''([^;]+)/i.exec(header) || /filename="?([^";]+)"?/i.exec(header);
  return m ? decodeURIComponent(m[1]) : "download";
}

function isImageFile(name) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
}

/* ================================================================ option builders */

function seg(label, name, opts, def) {
  return `<div class="opt">
    <label class="opt-label">${label}</label>
    <div class="seg" data-opt="${name}">
      ${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === def ? "on" : ""}">${l}</button>`).join("")}
    </div>
  </div>`;
}

function slider(label, name, min, max, step, def, suffix) {
  return `<div class="opt">
    <label class="opt-label">${label}<span class="val" id="val-${name}">${def}${suffix}</span></label>
    <input type="range" data-opt="${name}" min="${min}" max="${max}" step="${step}" value="${def}">
  </div>`;
}

function num(label, name, def, max, step = 1, min = 1) {
  return `<div class="opt">
    <label class="opt-label">${label}</label>
    <input type="number" data-opt="${name}" value="${def}" min="${min}" max="${max || 99999}" step="${step}">
  </div>`;
}

function text(label, name, def, placeholder, type = "text") {
  return `<div class="opt">
    <label class="opt-label">${label}</label>
    <input type="${type}" data-opt="${name}" value="${def}" placeholder="${placeholder}">
  </div>`;
}

function check(label, name, def) {
  return `<div class="opt"><label class="checkbox-row">
    <input type="checkbox" data-opt="${name}" ${def ? "checked" : ""}> ${label}
  </label></div>`;
}

function row(html1, html2) {
  return `<div class="row">${html1}${html2}</div>`;
}

function note(html) {
  return `<div class="note">${html}</div>`;
}

/* ================================================================ tabs & grid */

function renderGrid() {
  grid.innerHTML = "";
  const list = TOOLS.filter((t) => t.cat === state.cat);
  for (const t of list) {
    const card = el(`<div class="card">
      <span class="card-tag">${t.tag}</span>
      <div class="card-icon">${ICONS[t.icon]}</div>
      <h3>${t.name}</h3>
      <p>${t.desc}</p>
    </div>`);
    card.addEventListener("click", () => openTool(t.id));
    grid.appendChild(card);
  }
}

function setCat(cat) {
  state.cat = cat;
  $("#tab-pdf").classList.toggle("on", cat === "pdf");
  $("#tab-image").classList.toggle("on", cat === "image");
  $("#grid").classList.remove("hidden");
  $("#toolView").classList.add("hidden");
  renderGrid();
}

$("#tab-pdf").addEventListener("click", () => setCat("pdf"));
$("#tab-image").addEventListener("click", () => setCat("image"));
$("#backBtn").addEventListener("click", () => {
  state.tool = null;
  state.files = [];
  state.result = null;
  $("#grid").classList.remove("hidden");
  $("#toolView").classList.add("hidden");
});

/* ================================================================ tool view */

const dz = $("#dropzone");
const fileInput = $("#fileInput");
const fileList = $("#fileList");
const optionsBox = $("#options");
const previewBox = $("#previewBox");

function openTool(id) {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) return;
  state.tool = t;
  state.files = [];
  state.result = null;
  state.crop = null;

  $("#toolIcon").innerHTML = ICONS[t.icon];
  $("#toolName").textContent = t.name;
  $("#toolDesc").textContent = t.desc;
  $("#processLabel").textContent = t.verb;
  fileInput.accept = t.accept.join(",");
  $("#dzSub").textContent = t.single ? "or click to browse (one file)" : "or click to browse (multiple files)";

  optionsBox.innerHTML = t.options().join("");
  for (const r of optionsBox.querySelectorAll('input[type="range"]')) {
    const val = optionsBox.querySelector(`#val-${r.dataset.opt}`);
    const suffix = $(`#val-${r.dataset.opt}`).textContent.replace(/^[\d.]+/, "");
    r.addEventListener("input", () => { val.textContent = r.value + suffix; });
  }
  optionsBox.querySelectorAll(".seg").forEach((sg) => {
    sg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      sg.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
    });
  });
  if (t.init) t.init(optionsBox);

  dz.classList.remove("done");
  fileList.innerHTML = "";
  previewBox.innerHTML = `<div class="empty-hint" id="previewHint">Select a file to see it here</div>`;
  $("#statsBar").classList.add("hidden");
  $("#downloadBtn").classList.add("hidden");
  $("#processBtn").disabled = true;

  $("#grid").classList.add("hidden");
  $("#toolView").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* -------------------------------------------------- dropzone */

dz.addEventListener("click", () => fileInput.click());
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

function addFiles(list) {
  const arr = [...list].filter((f) => accepted(f.name));
  if (!arr.length) {
    toast("That file type isn't supported here", "error");
    return;
  }
  if (state.tool.single) state.files = arr.slice(0, 1);
  else state.files = [...state.files, ...arr];
  state.result = null;
  $("#downloadBtn").classList.add("hidden");
  $("#statsBar").classList.add("hidden");
  renderFiles();
  updatePreview();
  $("#processBtn").disabled = state.files.length === 0;
}

function renderFiles() {
  fileList.innerHTML = "";
  state.files.forEach((f, i) => {
    const chip = el(`<div class="file-chip">
      <span class="f-idx">${state.tool.reorder ? i + 1 : ""}</span>
      <span class="f-name" title="${f.name}">${f.name}</span>
      <span class="f-size">${formatBytes(f.size)}</span>
      ${state.tool.reorder ? `
        <button class="chip-btn" data-act="up" ${i === 0 ? "disabled style='opacity:.3;cursor:default'" : ""} title="Move up">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m0 0l-5 5m5-5l5 5"/></svg>
        </button>
        <button class="chip-btn" data-act="down" ${i === state.files.length - 1 ? "disabled style='opacity:.3;cursor:default'" : ""} title="Move down">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14m0 0l5-5m-5 5l-5-5"/></svg>
        </button>` : ""}
      <button class="chip-btn danger" data-act="del" title="Remove">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`);
    chip.querySelector('[data-act="del"]').addEventListener("click", () => {
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
  if (state.files.length) dz.classList.add("done");
}

/* -------------------------------------------------- preview */

function updatePreview() {
  if (!state.files.length) {
    previewBox.innerHTML = `<div class="empty-hint">Select a file to see it here</div>`;
    return;
  }
  const f = state.files[0];

  if (state.tool.id === "img-crop") {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const wrap = el(`<div id="cropWrap"><canvas id="cropCanvas"></canvas><div class="crop-tip">Drag inside to move · drag handles to resize</div></div>`);
      previewBox.innerHTML = "";
      previewBox.appendChild(wrap);
      state.crop = new CropEditor(wrap.querySelector("canvas"), url, img.width, img.height);
    };
    img.src = url;
    return;
  }

  if (isImageFile(f.name)) {
    const url = URL.createObjectURL(f);
    previewBox.innerHTML = "";
    const imgEl = el(`<img alt="preview">`);
    imgEl.src = url;
    previewBox.appendChild(imgEl);
  } else {
    previewBox.innerHTML = `<div class="empty-hint">${f.name}<br><br>PDF pages render here after processing (PDF → Images).</div>`;
  }
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
    cv.addEventListener("pointerdown", (e) => this.down(e));
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
    c.clearRect(0, 0, this.cw, this.ch);
    c.drawImage(this.img, 0, 0, this.cw, this.ch);
    if (this.shape === "rect") this.drawRect();
    else this.drawCircle();
  }

  drawRect() {
    const c = this.ctx;
    const { x, y, w, h } = this.rect;
    c.beginPath();
    c.rect(0, 0, this.cw, this.ch);
    c.rect(x, y, w, h);
    c.fillStyle = "rgba(5,7,12,0.55)";
    c.fill("evenodd");
    c.strokeStyle = "#a78bfa";
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    const hs = [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h],
      [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2],
    ];
    for (const [hx, hy] of hs) {
      c.fillStyle = "#fff";
      c.strokeStyle = "#a78bfa";
      c.lineWidth = 1.5;
      c.fillRect(hx - 4, hy - 4, 8, 8);
      c.strokeRect(hx - 4, hy - 4, 8, 8);
    }
  }

  drawCircle() {
    const c = this.ctx;
    const { x, y, r } = this.circle;
    c.beginPath();
    c.rect(0, 0, this.cw, this.ch);
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = "rgba(5,7,12,0.55)";
    c.fill("evenodd");
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = "#a78bfa";
    c.lineWidth = 2.4;
    c.setLineDash([7, 5]);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 13, y); c.lineTo(x + 13, y);
    c.moveTo(x, y - 13); c.lineTo(x, y + 13);
    c.stroke();
    const hy = y - r;
    c.fillStyle = "#fff";
    c.strokeStyle = "#a78bfa";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, hy, 4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  /* ---------------------------------------------- pointer */

  down(e) {
    const p = this.pos(e);
    if (this.shape === "rect") {
      const h = this.hitRectHandle(p);
      if (h) { this.drag = { t: "h", h }; return; }
      const { x, y, w, hh } = this.rect;
      if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + hh) {
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
        const h = this.drag.h;
        if (h.includes("w")) r.x = this.clamp(p.x, 0, r.x + r.w - MIN);
        if (h.includes("e")) r.w = this.clamp(p.x - r.x, MIN, this.cw - r.x);
        if (h.includes("n")) r.y = this.clamp(p.y, 0, r.y + r.h - MIN);
        if (h.includes("s")) r.h = this.clamp(p.y - r.y, MIN, this.ch - r.y);
        if (h === "w") r.w = r.x + r.w > this.cw ? r.w : this.cw - r.x;
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

async function submit() {
  const t = state.tool;
  if (!state.files.length || state.busy) return;
  state.busy = true;
  $("#processBtn").disabled = true;
  $("#processLabel").textContent = "Working…";
  $("#spinner").classList.remove("hidden");

  const fd = new FormData();
  if (t.single) {
    fd.append("file", state.files[0]);
  } else {
    state.files.forEach((f) => fd.append("files", f));
  }
  const opts = readOptions();
  for (const [k, v] of Object.entries(opts)) fd.append(k, v);

  if (t.id === "img-crop" && state.crop) {
    const v = state.crop.value();
    for (const [k, val] of Object.entries(v)) fd.append(k, String(val));
    fd.set("shape", opts.shape);
    fd.set("fill", opts.fill);
  }

  try {
    const res = await fetch(t.endpoint, { method: "POST", body: fd });
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j.detail || msg;
      } catch (_) { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const orig = parseInt(res.headers.get("X-Original-Size"), 10) || null;
    const nw = parseInt(res.headers.get("X-Result-Size"), 10) || null;
    const engine = res.headers.get("X-Engine");
    state.result = { blob, name: cdFilename(res.headers.get("Content-Disposition") || ""), orig, nw };
    showResult();
    const msgs = {
      "already-fits": "Done — file is already under the target",
      "no-reduction": "Done — can't get smaller, returned unchanged",
      "best-effort": "Done — best possible size (target was unreachable)",
    };
    toast(msgs[engine] || (engine ? `Done — ${engine}` : "Done"), "ok");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    state.busy = false;
    $("#processBtn").disabled = false;
    $("#processLabel").textContent = t.verb;
    $("#spinner").classList.add("hidden");
  }
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

  if (isImageFile(r.name) && previewBox.querySelector("canvas") === null) {
    const url = URL.createObjectURL(r.blob);
    previewBox.innerHTML = "";
    const imgEl = el(`<img alt="result">`);
    imgEl.src = url;
    previewBox.appendChild(imgEl);
  } else if (!isImageFile(r.name)) {
    const hint = previewBox.querySelector(".empty-hint");
    if (hint) hint.innerHTML = `Result ready: <b>${r.name}</b><br>${formatBytes(r.nw || r.blob.size)}`;
  }
}

$("#processBtn").addEventListener("click", submit);

/* ================================================================ boot */

renderGrid();
