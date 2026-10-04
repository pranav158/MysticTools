"use strict";
// The editor behind "Edit PDF" and "Edit Image": draw shapes, add text and
// pictures, highlight, white-out, blur — and click existing text to change it
// in a matching font. Objects are stored as fractions of the page/image, so
// they're resolution-independent; PDFs are written by the engine, images are
// composited here at full resolution.

const MK_TOOLS = [
  ["select", "Select & move (V)", '<path d="M5 3l14 8-6 1.5L10 19z"/>'],
  ["edittext", "Edit existing text (E)", '<path d="M4 7V5h10v2M9 5v14M7 19h4"/><path d="M15 13l4-4 2 2-4 4h-2z"/>'],
  ["text", "Add text (T)", '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
  ["rect", "Rectangle (R)", '<rect x="4" y="6" width="16" height="12" rx="2"/>'],
  ["ellipse", "Ellipse (O)", '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>'],
  ["line", "Line (L)", '<path d="M5 19L19 5"/>'],
  ["arrow", "Arrow (A)", '<path d="M5 19L19 5M10 5h9v9"/>'],
  ["pen", "Draw (P)", '<path d="M3 17c3-1 4.5-7 6.5-7s1 5 3 5 2.5-3.5 4-3.5 1.5 2 3.5 2"/>'],
  ["highlight", "Highlight (H)", '<path d="M4 20h16"/><path d="M8 15l-2 3h5l1-1"/><path d="M8.5 14.5L16 7l3 3-7.5 7.5z"/>'],
  ["whiteout", "White-out (W)", '<rect x="4" y="7" width="16" height="10" rx="2" fill="currentColor" opacity=".25"/><rect x="4" y="7" width="16" height="10" rx="2"/>'],
  ["blur", "Blur area (B)", '<circle cx="8" cy="8" r="1.4"/><circle cx="12" cy="8" r="1.4"/><circle cx="16" cy="8" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="8" cy="16" r="1.4"/><circle cx="12" cy="16" r="1.4"/><circle cx="16" cy="16" r="1.4"/>'],
  ["image", "Insert picture (I)", '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4-4 3 3 3-3 4 4"/>'],
];
const MK_KEYS = { v: "select", e: "edittext", t: "text", r: "rect", o: "ellipse", l: "line", a: "arrow", p: "pen", h: "highlight", w: "whiteout", b: "blur", i: "image" };
const MK_COLORS = ["#16191f", "#ffffff", "#d14a5a", "#e08a1e", "#f2c94c", "#2fa58a", "#2a6b8c", "#6b5bd6"];
const CSS_FONTS = {
  sans: 'Helvetica, Arial, "Segoe UI", sans-serif',
  serif: '"Times New Roman", Times, Georgia, serif',
  mono: '"Courier New", Courier, monospace',
  hand: 'Caveat, cursive',
};
const mkIcon = (paths) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

/** CSS family for a PDF font name, falling back on its serif/mono flags. */
function cssFamilyFor(font) {
  const n = (font.name || font.family || "").toLowerCase();
  if (/courier|mono|consol/.test(n) || font.mono) return CSS_FONTS.mono;
  if (/times|georgia|garamond|cambria|serif|minion|book/.test(n) && !/sans/.test(n)) return CSS_FONTS.serif;
  if (font.serif && !/sans|arial|helvet|calibri|segoe|roboto/.test(n)) return CSS_FONTS.serif;
  if (font.family && !["sans", "serif", "mono", "hand"].includes(font.family)) return `"${font.family}", ${CSS_FONTS.sans}`;
  return CSS_FONTS.sans;
}

class MarkupEditor {
  constructor(host, { kind, file, onChange }) {
    this.kind = kind;              // "pdf" | "image"
    this.file = file;
    this.onChange = onChange;
    this.page = 0;
    this.pages = 1;
    this.objects = new Map();      // page → [objects]
    this.runs = new Map();         // page → detected text runs (edit-text mode)
    this.tool = "select";
    this.sel = null;
    this.undoStack = [];
    this.redoStack = [];
    this.style = { color: "#d14a5a", width: 0.004, size: 0.03, font: "sans", bold: false, italic: false };
    this.images = [];              // inserted pictures: { blob, url, img }
    this.root = el(`<div class="studio">
      <div class="studio-bar">
        <div class="tool-row" role="toolbar" aria-label="Editing tools">${MK_TOOLS.filter(([id]) => kind === "image" || id !== "blur").map(([id, label, path]) =>
          `<button type="button" class="tool-btn" data-tool="${id}" title="${label}" aria-label="${label}">${mkIcon(path)}</button>`).join("")}</div>
        <div class="prop-row">
          <span class="swatches">${MK_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" aria-label="Colour ${c}"></button>`).join("")}<input type="color" class="swatch-custom" aria-label="Custom colour" value="#d14a5a"></span>
          <label class="mini"><span>Size</span><input type="range" class="prop-size" min="1" max="20" value="6"></label>
          <span class="font-btns">
            <select class="prop-font" aria-label="Font">
              <option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option>${kind === "image" ? '<option value="hand">Handwriting</option>' : ""}
            </select>
            <button type="button" class="tool-btn small prop-bold" aria-label="Bold"><b>B</b></button>
            <button type="button" class="tool-btn small prop-italic" aria-label="Italic"><i>I</i></button>
          </span>
          <span class="hist">
            <button type="button" class="tool-btn" data-act="undo" title="Undo (Ctrl+Z)" aria-label="Undo">${mkIcon('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>')}</button>
            <button type="button" class="tool-btn" data-act="redo" title="Redo (Ctrl+Y)" aria-label="Redo">${mkIcon('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>')}</button>
            <button type="button" class="tool-btn" data-act="delete" title="Delete selected (Del)" aria-label="Delete selected">${mkIcon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>')}</button>
          </span>
        </div>
      </div>
      <div class="studio-status" aria-live="polite"></div>
      <div class="studio-stage"><div class="sheet">
        <img class="sheet-img" alt="" draggable="false">
        <canvas class="sheet-overlay"></canvas>
        <textarea class="inline-edit hidden" spellcheck="false" aria-label="Edit text"></textarea>
      </div></div>
      ${kind === "pdf" ? `<div class="pager">
        <button type="button" class="icon-btn" data-go="-1" aria-label="Previous page">‹</button>
        <span class="pager-label">Loading…</span>
        <button type="button" class="icon-btn" data-go="1" aria-label="Next page">›</button>
      </div>` : ""}
      <input type="file" accept="image/*" class="picture-input" hidden>
    </div>`);
    host.replaceChildren(this.root);
    // colours via CSSOM: the CSP forbids inline style attributes
    this.root.querySelectorAll(".swatch").forEach((b) => (b.style.background = b.dataset.color));
    this.sheet = this.root.querySelector(".sheet");
    this.img = this.root.querySelector(".sheet-img");
    this.canvas = this.root.querySelector(".sheet-overlay");
    this.ctx = this.canvas.getContext("2d");
    this.editor = this.root.querySelector(".inline-edit");
    this.status = this.root.querySelector(".studio-status");
    this.wire();
    this.setTool("select");
    this.load(0);
  }

  /* ---------------------------------------------- loading */

  async load(i) {
    this.commitEdit();
    this.setStatus("Loading…");
    if (this.kind === "pdf") {
      const r = await engine.run("pdf-page", [this.file], { page: i, width: 1600 });
      if (this.destroyed) return;
      this.page = r.page;
      this.pages = r.pages;
      this.pageSize = [r.w, r.h];
      this.setBase(new Blob([r.png], { type: "image/png" }));
      this.root.querySelector(".pager-label").textContent = `Page ${r.page + 1} of ${r.pages}`;
      this.root.querySelectorAll(".pager button").forEach((b) => (b.disabled = (+b.dataset.go < 0 && r.page === 0) || (+b.dataset.go > 0 && r.page === r.pages - 1)));
    } else {
      // formats the browser can't show (HEIC, TIFF) come through the engine at full size
      const shown = /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(this.file.name);
      this.setBase(shown ? this.file : new Blob([(await engine.run("img-preview", [this.file], { max: 4000 })).png], { type: "image/png" }));
    }
    this.sel = null;
    this.setStatus("");
    if (this.tool === "edittext") this.detectText();
  }

  setBase(blob) {
    if (this.baseUrl) URL.revokeObjectURL(this.baseUrl);
    this.baseUrl = URL.createObjectURL(blob);
    this.img.onload = () => this.fit();
    this.img.src = this.baseUrl;
  }

  /** Size the overlay canvas to the displayed image, sharp on high-DPI screens. */
  fit() {
    const r = this.img.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = `${r.width}px`;
    this.canvas.style.height = `${r.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  get list() {
    if (!this.objects.has(this.page)) this.objects.set(this.page, []);
    return this.objects.get(this.page);
  }

  setStatus(text) {
    this.status.textContent = text;
    this.status.classList.toggle("on", !!text);
  }

  /* ---------------------------------------------- toolbar */

  wire() {
    const bar = this.root.querySelector(".studio-bar");
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.tool) this.setTool(b.dataset.tool);
      else if (b.dataset.color) this.setStyle({ color: b.dataset.color });
      else if (b.dataset.act === "undo") this.undo();
      else if (b.dataset.act === "redo") this.redo();
      else if (b.dataset.act === "delete") this.deleteSelected();
      else if (b.classList.contains("prop-bold")) this.setStyle({ bold: !this.currentStyle().bold });
      else if (b.classList.contains("prop-italic")) this.setStyle({ italic: !this.currentStyle().italic });
    });
    bar.querySelector(".swatch-custom").addEventListener("input", (e) => this.setStyle({ color: e.target.value }));
    bar.querySelector(".prop-size").addEventListener("input", (e) => {
      const v = +e.target.value;
      const o = this.sel;
      if (o && (o.type === "text" || o.type === "replace")) this.setStyle({ size: v * 0.005 });
      else this.setStyle({ width: v * 0.0007, size: v * 0.005 });
    });
    bar.querySelector(".prop-font").addEventListener("change", (e) => this.setStyle({ font: e.target.value }));
    this.root.querySelector(".pager")?.addEventListener("click", (e) => {
      const go = +e.target.closest("button")?.dataset.go;
      if (go) this.load(this.page + go);
    });
    const picture = this.root.querySelector(".picture-input");
    picture.addEventListener("change", () => {
      if (picture.files[0]) this.addPicture(picture.files[0]);
      picture.value = "";
    });

    this.canvas.addEventListener("pointerdown", (e) => this.down(e));
    this.canvas.addEventListener("pointermove", (e) => this.move(e));
    this.canvas.addEventListener("pointerup", (e) => this.up(e));
    this.canvas.addEventListener("pointercancel", (e) => this.up(e));
    this.canvas.addEventListener("dblclick", (e) => {
      const o = this.hit(this.pos(e));
      if (o && (o.type === "text" || o.type === "replace")) this.openEdit(o);
    });
    this.onKey = (e) => this.key(e);
    document.addEventListener("keydown", this.onKey);
    this.onResize = () => this.fit();
    window.addEventListener("resize", this.onResize);
    this.editor.addEventListener("input", () => this.syncEditor());
    this.editor.addEventListener("blur", () => this.commitEdit());
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        this.editor.blur();
      }
      e.stopPropagation();
    });
  }

  setTool(tool) {
    if (tool === "image") {
      this.root.querySelector(".picture-input").click();
      return;
    }
    this.commitEdit();
    this.tool = tool;
    this.root.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === tool));
    this.canvas.style.cursor = tool === "select" ? "default" : tool === "edittext" ? "text" : "crosshair";
    if (tool === "edittext") this.detectText();
    else this.setStatus("");
    this.syncProps();
    this.draw();
  }

  currentStyle() {
    return this.sel ? { ...this.style, ...this.sel } : this.style;
  }

  setStyle(patch) {
    Object.assign(this.style, patch);
    const o = this.sel;
    if (o) {
      this.snapshot();
      if (patch.color) {
        if (["text", "replace", "whiteout", "highlight"].includes(o.type)) o.color = patch.color;
        else if (["rect", "ellipse", "line", "arrow", "pen"].includes(o.type)) o.stroke = patch.color;
      }
      if (patch.width !== undefined && o.width !== undefined) o.width = patch.width;
      if (patch.size !== undefined && (o.type === "text" || o.type === "replace")) { o.size = patch.size; o.sizeChanged = true; }
      if (patch.font && (o.type === "text" || o.type === "replace")) { o.font = patch.font; o.fontOverride = true; }
      if (patch.bold !== undefined && (o.type === "text" || o.type === "replace")) { o.bold = patch.bold; o.fontOverride = true; }
      if (patch.italic !== undefined && (o.type === "text" || o.type === "replace")) { o.italic = patch.italic; o.fontOverride = true; }
      this.changed();
    }
    this.syncProps();
    this.syncEditor();
  }

  syncProps() {
    const s = this.currentStyle();
    const bar = this.root.querySelector(".studio-bar");
    const color = ["text", "replace", "whiteout", "highlight"].includes(s.type) ? s.color : s.stroke || s.color;
    bar.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("on", b.dataset.color === color));
    bar.querySelector(".prop-font").value = s.font && CSS_FONTS[s.font] ? s.font : "sans";
    bar.querySelector(".prop-bold").classList.toggle("on", !!s.bold);
    bar.querySelector(".prop-italic").classList.toggle("on", !!s.italic);
    const textual = this.tool === "text" || this.tool === "edittext" || s.type === "text" || s.type === "replace";
    bar.querySelector(".font-btns").classList.toggle("dim", !textual);
  }

  /* ---------------------------------------------- history */

  snapshot() {
    this.undoStack.push(this.serialize());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  serialize() {
    return JSON.stringify([...this.objects].map(([p, list]) => [p, list.map(({ _box, ...o }) => o)]));
  }

  restore(json) {
    this.objects = new Map(JSON.parse(json));
    this.sel = null;
    this.changed();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.serialize());
    this.restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.serialize());
    this.restore(this.redoStack.pop());
  }

  changed() {
    this.draw();
    this.onChange?.(this.count());
  }

  count() {
    let n = 0;
    for (const list of this.objects.values()) n += list.length;
    return n;
  }

  deleteSelected() {
    if (!this.sel) return;
    this.snapshot();
    this.list.splice(this.list.indexOf(this.sel), 1);
    this.sel = null;
    this.changed();
  }

  key(e) {
    if (this.destroyed || !document.body.contains(this.root)) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); this.redo(); }
    else if ((k === "delete" || k === "backspace") && this.sel) { e.preventDefault(); this.deleteSelected(); }
    else if (k === "escape") { this.sel = null; this.draw(); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && MK_KEYS[k] && (this.kind === "image" || k !== "b")) this.setTool(MK_KEYS[k]);
  }

  /* ---------------------------------------------- geometry */

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  /** Bounding box of an object in fractions (text boxes are measured when drawn). */
  box(o) {
    if (o._box) return o._box;
    if (o.type === "line" || o.type === "arrow") return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
    if (o.type === "pen") {
      const xs = o.points.map((p) => p[0]), ys = o.points.map((p) => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    return { x: o.x, y: o.y, w: o.w || 0, h: o.h || 0 };
  }

  hit(p) {
    const tx = 8 / this.W, ty = 8 / this.H;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.type === "line" || o.type === "arrow" || o.type === "pen") {
        const pts = o.type === "pen" ? o.points : [[o.x1, o.y1], [o.x2, o.y2]];
        for (let k = 1; k < pts.length; k++) if (segDist(p, pts[k - 1], pts[k], this.W, this.H) < 8) return o;
        continue;
      }
      const b = this.box(o);
      if (p.x >= b.x - tx && p.x <= b.x + b.w + tx && p.y >= b.y - ty && p.y <= b.y + b.h + ty) return o;
    }
    return null;
  }

  handleAt(p) {
    if (!this.sel) return null;
    const o = this.sel;
    const near = (x, y) => Math.hypot((p.x - x) * this.W, (p.y - y) * this.H) < 10;
    if (o.type === "line" || o.type === "arrow") {
      if (near(o.x1, o.y1)) return "p1";
      if (near(o.x2, o.y2)) return "p2";
      return null;
    }
    if (o.type === "pen") return null;
    const b = this.box(o);
    return near(b.x + b.w, b.y + b.h) ? "se" : null;
  }

  /* ---------------------------------------------- pointer */

  down(e) {
    const p = this.pos(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.commitEdit();
    if (this.tool === "edittext") {
      const existing = this.hit(p);
      if (existing?.type === "replace") return this.openEdit(existing);
      const run = (this.runs.get(this.page) || []).find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (run) this.startReplace(run);
      return;
    }
    if (this.tool === "select") {
      const handle = this.handleAt(p);
      const o = handle ? this.sel : this.hit(p);
      this.sel = o;
      this.syncProps();
      if (o) {
        this.snapshot();
        this.drag = { mode: handle || "move", start: p, orig: JSON.parse(JSON.stringify({ ...o, _box: undefined })) };
      }
      this.draw();
      return;
    }
    if (this.tool === "text") {
      this.snapshot();
      const o = { type: "text", x: p.x, y: p.y, text: "", size: this.style.size, color: this.style.color, font: this.style.font, bold: this.style.bold, italic: this.style.italic };
      this.list.push(o);
      this.sel = o;
      this.openEdit(o);
      return;
    }
    this.snapshot();
    const s = this.style;
    const base = { stroke: s.color, width: s.width };
    let o;
    if (this.tool === "line" || this.tool === "arrow") o = { type: this.tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...base };
    else if (this.tool === "pen") o = { type: "pen", points: [[p.x, p.y]], ...base };
    else if (this.tool === "whiteout") o = { type: "whiteout", x: p.x, y: p.y, w: 0, h: 0, color: s.color === "#16191f" ? "#ffffff" : s.color };
    else o = { type: this.tool, x: p.x, y: p.y, w: 0, h: 0, ...base };
    if (o.type === "highlight") {
      delete o.stroke;
      o.color = "#f2c94c";
    }
    this.list.push(o);
    this.sel = o;
    this.drag = { mode: "create", start: p };
    this.draw();
  }

  move(e) {
    const p = this.pos(e);
    if (!this.drag) {
      if (this.tool === "select") {
        const h = this.handleAt(p);
        this.canvas.style.cursor = h ? (h === "se" ? "nwse-resize" : "grab") : this.hit(p) ? "move" : "default";
      } else if (this.tool === "edittext") {
        const run = (this.runs.get(this.page) || []).find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
        if (run !== this.hover) { this.hover = run; this.draw(); }
      }
      return;
    }
    const o = this.sel, d = this.drag, dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (d.mode === "create") {
      if (o.type === "line" || o.type === "arrow") { o.x2 = p.x; o.y2 = p.y; }
      else if (o.type === "pen") o.points.push([p.x, p.y]);
      else {
        o.x = Math.min(p.x, d.start.x); o.y = Math.min(p.y, d.start.y);
        o.w = Math.abs(p.x - d.start.x); o.h = Math.abs(p.y - d.start.y);
      }
    } else if (d.mode === "move") {
      const g = d.orig;
      if (o.type === "line" || o.type === "arrow") { o.x1 = g.x1 + dx; o.y1 = g.y1 + dy; o.x2 = g.x2 + dx; o.y2 = g.y2 + dy; }
      else if (o.type === "pen") o.points = g.points.map(([x, y]) => [x + dx, y + dy]);
      else {
        o.x = g.x + dx; o.y = g.y + dy;
        if (o.type === "replace") { o.left = g.left + dx; o.baseline = g.baseline + dy; o.moved = true; }
      }
      delete o._box;
    } else if (d.mode === "p1") { o.x1 = p.x; o.y1 = p.y; }
    else if (d.mode === "p2") { o.x2 = p.x; o.y2 = p.y; }
    else if (d.mode === "se") {
      const g = d.orig;
      if (o.type === "text" || o.type === "replace") {
        const b = g._box || this.box(g);
        const k = Math.max(0.2, (b.w + dx) / Math.max(0.001, b.w));
        o.size = (g.size || 0.03) * k;
        o.sizeChanged = true;
      } else if (o.type === "image") {
        o.w = Math.max(0.02, g.w + dx);
        o.h = (o.w * this.W) / o.aspect / this.H;
      } else {
        o.w = Math.max(0.005, g.w + dx);
        o.h = Math.max(0.005, g.h + dy);
      }
      delete o._box;
    }
    this.draw();
  }

  up() {
    if (!this.drag) return;
    const o = this.sel, d = this.drag;
    this.drag = null;
    if (d.mode === "create") {
      const b = this.box(o);
      const tiny = o.type === "pen" ? o.points.length < 2 : (b.w * this.W < 4 && b.h * this.H < 4);
      if (tiny) {
        this.list.splice(this.list.indexOf(o), 1);
        this.undoStack.pop();
        this.sel = null;
      }
    }
    this.changed();
  }

  /* ---------------------------------------------- pictures */

  async addPicture(file) {
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = URL.createObjectURL(file);
      });
      const index = this.images.push({ blob: file, url: img.src, img }) - 1;
      const aspect = img.naturalWidth / img.naturalHeight;
      const w = 0.3, h = (w * this.W) / aspect / this.H;
      this.snapshot();
      const o = { type: "image", image: index, aspect, x: 0.35, y: Math.max(0, 0.5 - h / 2), w, h };
      this.list.push(o);
      this.sel = o;
      this.tool = "select";
      this.setTool("select");
      this.changed();
    } catch {
      toast("That picture couldn't be read", "error");
    }
  }

  /* ---------------------------------------------- existing text */

  async detectText() {
    if (this.runs.has(this.page)) {
      this.setStatus(this.runs.get(this.page).length ? "Click any text to change it" : "No text found on this page");
      return this.draw();
    }
    const page = this.page;
    try {
      if (this.kind === "pdf") {
        this.setStatus("Finding text…");
        const r = await engine.run("pdf-text", [this.file], { page });
        this.runs.set(page, r.runs.map((x) => ({ ...x, source: "pdf" })));
        if (!r.runs.length) {
          this.setStatus("This page has no text layer (it's a scan) — reading it with OCR…");
          await this.ocrRuns(page);
        }
      } else {
        await this.ocrRuns(page);
      }
    } catch (err) {
      this.setStatus(`Couldn't read text: ${err.message}`);
      return;
    }
    if (page !== this.page || this.destroyed) return;
    const n = this.runs.get(page).length;
    this.setStatus(n ? `${n} text area${n === 1 ? "" : "s"} found — click one to change it` : "No text found");
    this.draw();
  }

  /** OCR the displayed image into runs (one per line), with a matched font for each. */
  async ocrRuns(page) {
    // hand OCR the pixels, not the blob: URL (the CSP rightly forbids fetching it)
    const src = document.createElement("canvas");
    src.width = this.img.naturalWidth;
    src.height = this.img.naturalHeight;
    src.getContext("2d").drawImage(this.img, 0, 0);
    const res = await ocr.recognize(src, document.querySelector('[data-opt="ocr_lang"] button.on')?.dataset.v || "eng", (s) => this.setStatus(s));
    const runs = res.lines.map((l) => {
      const b = l.bbox;
      const m = matchTextStyle(src, b, l.text);
      return {
        source: "ocr", text: l.text,
        x: b.x0 / res.width, y: b.y0 / res.height, w: (b.x1 - b.x0) / res.width, h: (b.y1 - b.y0) / res.height,
        left: b.x0 / res.width, baseline: (b.y0 + m.ascent) / res.height, size: m.size / res.height,
        color: m.color, background: m.background,
        font: { family: m.family, kind: m.kind, bold: m.bold, italic: false, serif: m.kind === "serif", mono: m.kind === "mono" },
      };
    });
    this.runs.set(page, runs);
  }

  startReplace(run) {
    this.snapshot();
    const bg = run.background || this.sampleBackground(run);
    const o = {
      type: "replace", x: run.x, y: run.y, w: run.w, h: run.h, left: run.left, baseline: run.baseline,
      text: run.text, original: run.text, size: run.size, color: run.color, background: bg,
      font: run.font.kind || (run.font.mono ? "mono" : run.font.serif ? "serif" : "sans"),
      cssFamily: cssFamilyFor(run.font), bold: run.font.bold, italic: run.font.italic,
    };
    this.list.push(o);
    this.sel = o;
    this.openEdit(o);
  }

  /** The colour around a text box in the rendered page (to cover the old text in the preview). */
  sampleBackground(run) {
    const c = document.createElement("canvas");
    const w = Math.max(2, Math.round(run.w * this.img.naturalWidth)), h = Math.max(2, Math.round(run.h * this.img.naturalHeight));
    c.width = w + 4;
    c.height = h + 4;
    const g = c.getContext("2d");
    g.drawImage(this.img, run.x * this.img.naturalWidth - 2, run.y * this.img.naturalHeight - 2, w + 4, h + 4, 0, 0, w + 4, h + 4);
    const d = g.getImageData(0, 0, w + 4, h + 4).data;
    const edge = [];
    for (let x = 0; x < w + 4; x++) edge.push(x * 4, ((h + 3) * (w + 4) + x) * 4);
    const med = (arr) => arr.sort((a, b) => a - b)[arr.length >> 1];
    return "#" + [0, 1, 2].map((k) => med(edge.map((i) => d[i + k])).toString(16).padStart(2, "0")).join("");
  }

  /* ---------------------------------------------- inline text editing */

  fontCss(o, scale) {
    const family = o.type === "replace" && !o.fontOverride ? o.cssFamily : CSS_FONTS[o.font] || CSS_FONTS.sans;
    return `${o.italic ? "italic " : ""}${o.bold ? 700 : 400} ${o.size * scale}px ${family}`;
  }

  openEdit(o) {
    this.sel = o;
    this.editing = o;
    this.editor.classList.remove("hidden");
    this.editor.value = o.text;
    this.syncEditor();
    this.draw();
    requestAnimationFrame(() => {
      this.editor.focus();
      this.editor.select();
    });
  }

  syncEditor() {
    const o = this.editing;
    if (!o) return;
    const s = this.editor.style;
    s.font = this.fontCss(o, this.H);
    s.color = o.color;
    s.left = `${(o.type === "replace" ? o.left : o.x) * this.W - 4}px`;
    const top = o.type === "replace" ? o.baseline * this.H - o.size * this.H * 0.82 : o.y * this.H;
    s.top = `${top - 3}px`;
    s.lineHeight = "1.25";
    s.background = o.type === "replace" ? o.background || "#fff" : "transparent";
    const lines = this.editor.value.split("\n");
    this.ctx.font = this.fontCss(o, this.H);
    const widest = Math.max(...lines.map((l) => this.ctx.measureText(l || " ").width));
    s.width = `${Math.max(60, widest + 24)}px`;
    s.height = `${lines.length * o.size * this.H * 1.25 + 10}px`;
    o.text = this.editor.value;
    delete o._box;
    this.draw();
  }

  commitEdit() {
    const o = this.editing;
    if (!o) return;
    this.editing = null;
    this.editor.classList.add("hidden");
    o.text = this.editor.value;
    const unchanged = o.type === "replace" && o.text === o.original && !o.fontOverride && !o.moved;
    if ((o.type === "text" && !o.text.trim()) || unchanged) {
      this.list.splice(this.list.indexOf(o), 1);
      if (this.sel === o) this.sel = null;
    }
    this.changed();
  }

  /* ---------------------------------------------- drawing */

  draw() {
    if (!this.W) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    for (const o of this.list) this.paint(c, o, this.W, this.H, false);
    if (this.tool === "edittext") {
      for (const r of this.runs.get(this.page) || []) {
        if (this.list.some((o) => o.type === "replace" && Math.abs(o.x - r.x) < 1e-6 && Math.abs(o.y - r.y) < 1e-6)) continue;
        c.save();
        c.strokeStyle = r === this.hover ? "#2a6b8c" : "rgba(42,107,140,0.55)";
        c.fillStyle = r === this.hover ? "rgba(42,107,140,0.14)" : "rgba(42,107,140,0.05)";
        c.lineWidth = r === this.hover ? 1.6 : 1;
        c.setLineDash(r === this.hover ? [] : [3, 3]);
        c.beginPath();
        c.roundRect(r.x * this.W - 2, r.y * this.H - 2, r.w * this.W + 4, r.h * this.H + 4, 3);
        c.fill();
        c.stroke();
        c.restore();
      }
    }
    const o = this.sel;
    if (o && !this.editing) {
      const b = this.box(o);
      c.save();
      c.strokeStyle = "#2a6b8c";
      c.setLineDash([5, 4]);
      c.lineWidth = 1.2;
      c.strokeRect(b.x * this.W - 4, b.y * this.H - 4, b.w * this.W + 8, b.h * this.H + 8);
      c.setLineDash([]);
      const knob = (x, y) => {
        c.beginPath();
        c.arc(x, y, 5.5, 0, Math.PI * 2);
        c.fillStyle = "#fff";
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = "#2a6b8c";
        c.stroke();
      };
      if (o.type === "line" || o.type === "arrow") { knob(o.x1 * this.W, o.y1 * this.H); knob(o.x2 * this.W, o.y2 * this.H); }
      else if (o.type !== "pen") knob((b.x + b.w) * this.W + 4, (b.y + b.h) * this.H + 4);
      c.restore();
    }
  }

  /** Paint one object at W×H (screen preview or full-resolution export). */
  paint(c, o, W, H, exporting) {
    c.save();
    const lw = Math.max(1, (o.width || 0.003) * H);
    if (o.type === "rect" || o.type === "ellipse") {
      c.beginPath();
      if (o.type === "rect") c.rect(o.x * W, o.y * H, o.w * W, o.h * H);
      else c.ellipse((o.x + o.w / 2) * W, (o.y + o.h / 2) * H, (o.w / 2) * W, (o.h / 2) * H, 0, 0, Math.PI * 2);
      if (o.fill) { c.fillStyle = o.fill; c.fill(); }
      if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = lw; c.stroke(); }
    } else if (o.type === "highlight") {
      c.globalCompositeOperation = "multiply";
      c.globalAlpha = 0.4;
      c.fillStyle = o.color || "#ffe14d";
      c.fillRect(o.x * W, o.y * H, o.w * W, o.h * H);
    } else if (o.type === "whiteout") {
      c.fillStyle = o.color || "#ffffff";
      c.fillRect(o.x * W, o.y * H, o.w * W, o.h * H);
    } else if (o.type === "blur") {
      // pixelate: draw the area tiny, then scale it back up without smoothing
      const sx = o.x * W, sy = o.y * H, sw = Math.max(1, o.w * W), sh = Math.max(1, o.h * H);
      const block = Math.max(4, Math.round(Math.min(W, H) / 70));
      const tmp = document.createElement("canvas");
      tmp.width = Math.max(1, Math.round(sw / block));
      tmp.height = Math.max(1, Math.round(sh / block));
      const t = tmp.getContext("2d");
      t.drawImage(this.img, o.x * this.img.naturalWidth, o.y * this.img.naturalHeight, o.w * this.img.naturalWidth, o.h * this.img.naturalHeight, 0, 0, tmp.width, tmp.height);
      c.imageSmoothingEnabled = false;
      c.drawImage(tmp, sx, sy, sw, sh);
      if (!exporting) { c.strokeStyle = "rgba(42,107,140,.6)"; c.setLineDash([4, 3]); c.strokeRect(sx, sy, sw, sh); }
    } else if (o.type === "line" || o.type === "arrow") {
      const [x1, y1, x2, y2] = [o.x1 * W, o.y1 * H, o.x2 * W, o.y2 * H];
      c.strokeStyle = c.fillStyle = o.stroke;
      c.lineWidth = lw;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      if (o.type === "arrow") {
        const a = Math.atan2(y2 - y1, x2 - x1), len = Math.max(lw * 4, 8);
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - len * Math.cos(a - 0.45), y2 - len * Math.sin(a - 0.45));
        c.lineTo(x2 - len * Math.cos(a + 0.45), y2 - len * Math.sin(a + 0.45));
        c.closePath();
        c.fill();
      }
    } else if (o.type === "pen") {
      c.strokeStyle = o.stroke;
      c.lineWidth = lw;
      c.lineCap = c.lineJoin = "round";
      c.beginPath();
      o.points.forEach(([x, y], k) => (k ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)));
      c.stroke();
    } else if (o.type === "image") {
      const im = this.images[o.image]?.img;
      if (im) c.drawImage(im, o.x * W, o.y * H, o.w * W, o.h * H);
    } else if (o.type === "text" || o.type === "replace") {
      if (o.type === "replace") {
        // cover the old words (in the PDF they are removed for real when saving)
        c.fillStyle = o.background || "#ffffff";
        const pad = Math.max(1, o.h * H * 0.08);
        c.fillRect(o.x * W - pad, o.y * H - pad, o.w * W + pad * 2, o.h * H + pad * 2);
      }
      if (this.editing !== o || exporting) {
        c.font = this.fontCss(o, H);
        c.fillStyle = o.color;
        c.textBaseline = "alphabetic";
        const lines = String(o.text).split("\n");
        const x = (o.type === "replace" ? o.left : o.x) * W;
        const y0 = o.type === "replace" ? o.baseline * H : (o.y + o.size * 0.8) * H;
        let widest = 0;
        lines.forEach((line, k) => {
          c.fillText(line, x, y0 + k * o.size * H * 1.25);
          widest = Math.max(widest, c.measureText(line).width);
        });
        if (!exporting && W === this.W) {
          const top = o.type === "replace" ? o.y : o.y;
          o._box = { x: Math.min(o.x, x / W), y: top, w: Math.max(widest / W, o.type === "replace" ? o.w : 0), h: Math.max(o.h || 0, (lines.length * o.size * 1.25)) };
        }
      }
    }
    c.restore();
  }

  /* ---------------------------------------------- export */

  /** PDF: the edit list and inserted pictures, for the engine's "pdf-edit". */
  pdfEdits() {
    this.commitEdit();
    const edits = [];
    for (const [page, list] of this.objects) {
      for (const { _box, cssFamily, original, background, moved, sizeChanged, ...o } of list) {
        const e = { page, ...o };
        if (o.type === "text") e.font = o.font === "hand" ? "sans" : o.font;
        if (o.type === "replace") {
          e.font = o.fontOverride ? { family: o.font, bold: o.bold, italic: o.italic } : undefined;
          if (sizeChanged) e.size = o.size;
          // the engine finds the original run (and its font) by this box
          Object.assign(e, { x: o.x, y: o.y, w: o.w, h: o.h });
          if (!o.fontOverride && !sizeChanged) delete e.size;
        }
        edits.push(e);
      }
    }
    return { edits, images: this.images.map((p, k) => new File([p.blob], `picture${k}.png`, { type: p.blob.type })) };
  }

  /** Image: composite everything at full resolution and return a PNG blob. */
  async imageBlob() {
    this.commitEdit();
    const W = this.img.naturalWidth, H = this.img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.drawImage(this.img, 0, 0);
    for (const o of this.list) this.paint(g, o, W, H, true);
    return new Promise((resolve) => c.toBlob(resolve, "image/png"));
  }

  destroy() {
    this.destroyed = true;
    document.removeEventListener("keydown", this.onKey);
    window.removeEventListener("resize", this.onResize);
    if (this.baseUrl) URL.revokeObjectURL(this.baseUrl);
    for (const p of this.images) URL.revokeObjectURL(p.url);
  }
}

/** Distance in screen pixels from point p to segment a–b (all in fractions). */
function segDist(p, a, b, W, H) {
  const px = p.x * W, py = p.y * H, ax = a[0] * W, ay = a[1] * H, bx = b[0] * W, by = b[1] * H;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
