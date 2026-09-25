"use strict";
// Interactive editors that live in the preview panel: the signature maker and
// placer (Sign PDF) and the multi-box region editor (Blur & Hide).
// Loaded before app.js; uses its helpers (el, engine, state, $) at run time.

/* ================================================================ signature maker */

const SIG_INKS = { blue: "#1b3a8f", black: "#16191f" };

function signatureOptions() {
  return `<div class="opt sig-maker">
    <span class="opt-label">Signature</span>
    <div class="seg" id="sigMode" role="tablist" aria-label="How to make the signature">
      <button type="button" data-v="draw" class="on">Draw</button>
      <button type="button" data-v="type">Type</button>
      <button type="button" data-v="upload">Upload</button>
    </div>
    <div class="sig-pane" data-pane="draw">
      <canvas class="sig-pad" width="640" height="220" aria-label="Draw your signature here"></canvas>
      <div class="sig-tools">
        <span class="sig-inks">
          <button type="button" class="ink on" data-ink="blue" aria-label="Blue ink"></button>
          <button type="button" class="ink" data-ink="black" aria-label="Black ink"></button>
        </span>
        <button type="button" class="pill-btn" data-sig="clear">Clear</button>
      </div>
    </div>
    <div class="sig-pane hidden" data-pane="type">
      <input type="text" class="sig-text" placeholder="Type your name" maxlength="40" autocomplete="off">
      <div class="sig-typed" aria-hidden="true"></div>
    </div>
    <div class="sig-pane hidden" data-pane="upload">
      <button type="button" class="pill-btn" data-sig="pick">Choose an image…</button>
      <input type="file" accept="image/*" class="sig-file" hidden>
      <label class="toggle-row"><input type="checkbox" class="sig-whiten" checked><span class="toggle" aria-hidden="true"></span>Remove white background</label>
    </div>
  </div>
  ${seg("Place on", "sign_pages", [["this", "This page"], ["all", "Every page"]], "this")}
  ${note("Make your signature, then drag it into place on the page and resize it from its corner.")}`;
}

/** Crop a canvas to its visible (non-transparent) pixels, with a little padding. */
function trimCanvas(src) {
  const ctx = src.getContext("2d");
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function initSignatureOptions(container) {
  const maker = container.querySelector(".sig-maker");
  const pad = maker.querySelector(".sig-pad");
  const pctx = pad.getContext("2d");
  let ink = "blue", mode = "draw", strokes = [], uploaded = null;

  const publish = async () => {
    let canvas = null;
    if (mode === "draw" && strokes.length) {
      canvas = trimCanvas(pad);
    } else if (mode === "type") {
      const name = maker.querySelector(".sig-text").value.trim();
      maker.querySelector(".sig-typed").textContent = name;
      if (name) {
        await document.fonts.load("120px Caveat");
        const c = document.createElement("canvas");
        const g = c.getContext("2d");
        g.font = "600 120px Caveat, cursive";
        c.width = Math.ceil(g.measureText(name).width + 40);
        c.height = 170;
        g.font = "600 120px Caveat, cursive";
        g.fillStyle = SIG_INKS[ink];
        g.textBaseline = "middle";
        g.fillText(name, 20, 90);
        canvas = trimCanvas(c);
      }
    } else if (mode === "upload" && uploaded) {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(uploaded.width, uploaded.height));
      c.width = Math.round(uploaded.width * scale);
      c.height = Math.round(uploaded.height * scale);
      const g = c.getContext("2d");
      g.drawImage(uploaded, 0, 0, c.width, c.height);
      if (maker.querySelector(".sig-whiten").checked) {
        // paper → transparent, ink kept (a soft ramp avoids jagged edges)
        const im = g.getImageData(0, 0, c.width, c.height);
        const d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          d[i + 3] = Math.min(d[i + 3], Math.max(0, Math.min(255, ((215 - l) / 45) * 255)));
        }
        g.putImageData(im, 0, 0);
      }
      canvas = trimCanvas(c) || c;
    }
    state.sign?.setSignature(canvas);
  };

  // tabs
  const tabs = maker.querySelector("#sigMode");
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mode = b.dataset.v;
    tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    maker.querySelectorAll(".sig-pane").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== mode));
    publish();
  });

  // drawing pad: smooth strokes with quadratic curves through the midpoints
  const redraw = () => {
    pctx.clearRect(0, 0, pad.width, pad.height);
    pctx.lineCap = pctx.lineJoin = "round";
    pctx.lineWidth = 4.2;
    pctx.strokeStyle = SIG_INKS[ink];
    for (const s of strokes) {
      pctx.beginPath();
      pctx.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < s.length - 1; i++) {
        const mx = (s[i][0] + s[i + 1][0]) / 2, my = (s[i][1] + s[i + 1][1]) / 2;
        pctx.quadraticCurveTo(s[i][0], s[i][1], mx, my);
      }
      const last = s[s.length - 1];
      pctx.lineTo(last[0], last[1]);
      pctx.stroke();
    }
  };
  const at = (e) => {
    const r = pad.getBoundingClientRect();
    return [((e.clientX - r.left) * pad.width) / r.width, ((e.clientY - r.top) * pad.height) / r.height];
  };
  let drawing = false;
  pad.addEventListener("pointerdown", (e) => {
    drawing = true;
    pad.setPointerCapture(e.pointerId);
    strokes.push([at(e), at(e)]);
    redraw();
  });
  pad.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    strokes[strokes.length - 1].push(at(e));
    redraw();
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    publish();
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);

  maker.querySelector('[data-sig="clear"]').addEventListener("click", () => {
    strokes = [];
    redraw();
    publish();
  });
  maker.querySelector(".sig-inks").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    ink = b.dataset.ink;
    maker.querySelectorAll(".ink").forEach((x) => x.classList.toggle("on", x === b));
    redraw();
    publish();
  });
  maker.querySelector(".sig-text").addEventListener("input", publish);
  const file = maker.querySelector(".sig-file");
  maker.querySelector('[data-sig="pick"]').addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    if (!file.files.length) return;
    try {
      uploaded = await createImageBitmap(file.files[0]);
      publish();
    } catch {
      toast("That image couldn't be read", "error");
    }
    file.value = "";
  });
  maker.querySelector(".sig-whiten").addEventListener("change", publish);
  state.republishSignature = publish;
  redraw();
}

/* ================================================================ signature placer */

class SignEditor {
  constructor(box, file) {
    this.file = file;
    this.page = 0;
    this.pages = 1;
    this.sig = null;          // { url, aspect, blob }
    this.rect = null;         // fractions of the page: { x, y, w, h }
    this.root = el(`<div class="sign-stage">
      <div class="sign-page"><img class="sign-img" alt="PDF page" draggable="false">
        <div class="sig-box hidden" tabindex="0" aria-label="Signature — drag to move">
          <img alt="" draggable="false"><span class="sig-handle" aria-hidden="true"></span>
        </div>
      </div>
      <div class="pager">
        <button type="button" class="icon-btn" data-go="-1" aria-label="Previous page">‹</button>
        <span class="pager-label">Loading…</span>
        <button type="button" class="icon-btn" data-go="1" aria-label="Next page">›</button>
      </div>
      <p class="sign-hint">Make your signature on the left — it will appear here.</p>
    </div>`);
    box.replaceChildren(this.root);
    this.pageEl = this.root.querySelector(".sign-page");
    this.boxEl = this.root.querySelector(".sig-box");
    this.root.querySelector(".pager").addEventListener("click", (e) => {
      const go = +e.target.closest("button")?.dataset.go;
      if (go) this.show(this.page + go);
    });
    this.enableDrag();
    this.show(0);
  }

  async show(i) {
    if (i < 0 || i >= this.pages) return;
    const r = await engine.run("pdf-page", [this.file], { page: i, width: 1100 });
    if (state.sign !== this) return;
    this.page = r.page;
    this.pages = r.pages;
    const img = this.root.querySelector(".sign-img");
    if (this.pageUrl) URL.revokeObjectURL(this.pageUrl);
    this.pageUrl = URL.createObjectURL(new Blob([r.png], { type: "image/png" }));
    img.src = this.pageUrl;
    this.pageAspect = r.w / r.h;
    this.root.querySelector(".pager-label").textContent = `Page ${r.page + 1} of ${r.pages}`;
    this.root.querySelectorAll(".pager button").forEach((b) => (b.disabled = (+b.dataset.go < 0 && r.page === 0) || (+b.dataset.go > 0 && r.page === r.pages - 1)));
    this.layout();
  }

  setSignature(canvas) {
    if (this.sig?.url) URL.revokeObjectURL(this.sig.url);
    this.sig = null;
    if (!canvas) {
      this.boxEl.classList.add("hidden");
      this.root.querySelector(".sign-hint").classList.remove("hidden");
      refreshSignButton();
      return;
    }
    canvas.toBlob((blob) => {
      if (state.sign !== this) return;
      this.sig = { url: URL.createObjectURL(blob), aspect: canvas.width / canvas.height, blob };
      this.boxEl.querySelector("img").src = this.sig.url;
      if (!this.rect) {
        // first placement: lower right, a third of the page wide
        const w = 0.3, h = (w * this.pageAspect) / this.sig.aspect;
        this.rect = { x: 0.62, y: Math.min(0.8, 0.95 - h), w, h };
      } else {
        // keep the width and position, follow the new signature's shape
        this.rect.h = (this.rect.w * this.pageAspect) / this.sig.aspect;
        this.rect.y = Math.min(this.rect.y, 1 - this.rect.h);
      }
      this.boxEl.classList.remove("hidden");
      this.root.querySelector(".sign-hint").classList.add("hidden");
      this.layout();
      refreshSignButton();
    }, "image/png");
  }

  layout() {
    if (!this.rect) return;
    const s = this.boxEl.style;
    s.left = `${this.rect.x * 100}%`;
    s.top = `${this.rect.y * 100}%`;
    s.width = `${this.rect.w * 100}%`;
    s.height = `${this.rect.h * 100}%`;
  }

  enableDrag() {
    let drag = null;
    this.boxEl.addEventListener("pointerdown", (e) => {
      const r = this.pageEl.getBoundingClientRect();
      drag = { mode: e.target.closest(".sig-handle") ? "size" : "move", x: e.clientX, y: e.clientY, start: { ...this.rect }, pw: r.width, ph: r.height };
      this.boxEl.setPointerCapture(e.pointerId);
      this.boxEl.classList.add("active");
      e.preventDefault();
    });
    this.boxEl.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.x) / drag.pw, dy = (e.clientY - drag.y) / drag.ph;
      const r = this.rect, s = drag.start;
      if (drag.mode === "move") {
        r.x = Math.min(1 - r.w, Math.max(0, s.x + dx));
        r.y = Math.min(1 - r.h, Math.max(0, s.y + dy));
      } else {
        // resize from the corner, keeping the signature's proportions
        const w = Math.min(1 - s.x, Math.max(0.05, s.w + dx));
        const h = (w * this.pageAspect) / this.sig.aspect;
        if (s.y + h <= 1) { r.w = w; r.h = h; }
      }
      this.layout();
    });
    const end = () => {
      drag = null;
      this.boxEl.classList.remove("active");
    };
    this.boxEl.addEventListener("pointerup", end);
    this.boxEl.addEventListener("pointercancel", end);
    this.boxEl.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.05 : 0.01, r = this.rect;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!moves[e.key]) return;
      e.preventDefault();
      r.x = Math.min(1 - r.w, Math.max(0, r.x + moves[e.key][0]));
      r.y = Math.min(1 - r.h, Math.max(0, r.y + moves[e.key][1]));
      this.layout();
    });
  }

  ready() {
    return !!(this.sig && this.rect);
  }

  signatureFile() {
    return new File([this.sig.blob], "signature.png", { type: "image/png" });
  }

  /** Placement for the engine: page fractions plus which pages. */
  value(where) {
    return { ...this.rect, pages: where === "all" ? "all" : String(this.page + 1) };
  }

  destroy() {
    if (this.pageUrl) URL.revokeObjectURL(this.pageUrl);
    if (this.sig?.url) URL.revokeObjectURL(this.sig.url);
  }
}

function refreshSignButton() {
  if (state.tool?.editor !== "sign") return;
  $("#processBtn").disabled = !(state.files.length && state.sign?.ready());
}

/* ================================================================ region editor (Blur & Hide) */

class RegionEditor {
  constructor(canvas, url, iw, ih) {
    this.canvas = canvas;
    const W = 640, H = 440, scale = Math.min(W / iw, H / ih);
    this.cw = Math.max(2, Math.round(iw * scale));
    this.ch = Math.max(2, Math.round(ih * scale));
    canvas.width = this.cw;
    canvas.height = this.ch;
    this.ctx = canvas.getContext("2d");
    this.boxes = [];
    this.drag = null;
    this.img = new Image();
    this.img.onload = () => this.draw();
    this.img.src = url;
    // listen on the surrounding panel too: the canvas's rounded corners don't take
    // clicks, and areas right at the image edge are often what needs hiding
    this.surface = canvas.parentElement || canvas;
    this.surface.addEventListener("pointerdown", (e) => this.down(e));
    this.surface.addEventListener("pointermove", (e) => this.move(e));
    const up = () => this.up();
    this.surface.addEventListener("pointerup", up);
    this.surface.addEventListener("pointercancel", up);
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: this.clamp(((e.clientX - r.left) * this.cw) / r.width, 0, this.cw),
      y: this.clamp(((e.clientY - r.top) * this.ch) / r.height, 0, this.ch),
    };
  }

  clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  hit(p) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (Math.hypot(p.x - (b.x + b.w), p.y - b.y) < 13) return { i, part: "delete" };
      if (Math.hypot(p.x - (b.x + b.w), p.y - (b.y + b.h)) < 13) return { i, part: "size" };
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { i, part: "move" };
    }
    return null;
  }

  down(e) {
    const p = this.pos(e);
    this.surface.setPointerCapture(e.pointerId);
    const h = this.hit(p);
    if (h?.part === "delete") {
      this.boxes.splice(h.i, 1);
      this.draw();
      return;
    }
    if (h) {
      this.drag = { ...h, ox: p.x - this.boxes[h.i].x, oy: p.y - this.boxes[h.i].y };
    } else {
      this.boxes.push({ x: p.x, y: p.y, w: 0, h: 0 });
      this.drag = { i: this.boxes.length - 1, part: "new", sx: p.x, sy: p.y };
    }
  }

  move(e) {
    const p = this.pos(e);
    if (!this.drag) {
      const h = this.hit(p);
      this.surface.style.cursor = !h ? "crosshair" : h.part === "delete" ? "pointer" : h.part === "size" ? "nwse-resize" : "move";
      return;
    }
    const b = this.boxes[this.drag.i];
    if (this.drag.part === "move") {
      b.x = this.clamp(p.x - this.drag.ox, 0, this.cw - b.w);
      b.y = this.clamp(p.y - this.drag.oy, 0, this.ch - b.h);
    } else if (this.drag.part === "size") {
      b.w = this.clamp(p.x - b.x, 8, this.cw - b.x);
      b.h = this.clamp(p.y - b.y, 8, this.ch - b.y);
    } else {
      const x = this.clamp(p.x, 0, this.cw), y = this.clamp(p.y, 0, this.ch);
      b.x = Math.min(x, this.drag.sx);
      b.y = Math.min(y, this.drag.sy);
      b.w = Math.abs(x - this.drag.sx);
      b.h = Math.abs(y - this.drag.sy);
    }
    this.draw();
  }

  up() {
    if (this.drag?.part === "new") {
      const b = this.boxes[this.drag.i];
      if (b.w < 6 || b.h < 6) this.boxes.splice(this.drag.i, 1);   // a click, not a box
    }
    this.drag = null;
    this.draw();
  }

  draw() {
    const c = this.ctx;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2a6b8c";
    c.clearRect(0, 0, this.cw, this.ch);
    if (this.img.complete) c.drawImage(this.img, 0, 0, this.cw, this.ch);
    for (const b of this.boxes) {
      c.fillStyle = "rgba(17,24,35,0.5)";
      c.beginPath();
      c.roundRect(b.x, b.y, b.w, b.h, 4);
      c.fill();
      c.setLineDash([6, 4]);
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.stroke();
      c.setLineDash([]);
      // resize knob (bottom-right) and delete button (top-right)
      c.beginPath();
      c.arc(b.x + b.w, b.y + b.h, 6, 0, Math.PI * 2);
      c.fillStyle = "#fff";
      c.fill();
      c.lineWidth = 2.5;
      c.strokeStyle = accent;
      c.stroke();
      c.beginPath();
      c.arc(b.x + b.w, b.y, 9, 0, Math.PI * 2);
      c.fillStyle = "#d14a5a";
      c.fill();
      c.strokeStyle = "#fff";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(b.x + b.w - 3.5, b.y - 3.5); c.lineTo(b.x + b.w + 3.5, b.y + 3.5);
      c.moveTo(b.x + b.w + 3.5, b.y - 3.5); c.lineTo(b.x + b.w - 3.5, b.y + 3.5);
      c.stroke();
    }
    const tip = this.canvas.parentElement?.querySelector(".crop-tip");
    if (tip) tip.textContent = this.boxes.length ? `${this.boxes.length} area${this.boxes.length === 1 ? "" : "s"} to hide · drag to add more` : "Drag on the image to cover what you want hidden";
  }

  value() {
    return this.boxes.map((b) => ({ x: b.x / this.cw, y: b.y / this.ch, w: b.w / this.cw, h: b.h / this.ch }));
  }
}
