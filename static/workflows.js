"use strict";
// Workflows: chain tools so one drop runs several steps — e.g. resize to
// 3.5 × 2.5 cm, then compress to 20 KB. Each step's output feeds the next;
// zips are unpacked so multi-file steps can continue. Presets are built in;
// your own workflows are saved in this browser only.

const WF_STORE = "mystic.workflows";

// A workflow-only step: combine every current PDF into one.
const MERGE_STEP = {
  id: "pdf-merge", cat: "pdf", icon: "organize", name: "Merge into one PDF", accept: [".pdf"], combine: true,
  options: () => [note("All PDFs at this point are joined in order.")],
};

const WF_PRESETS = [
  {
    id: "photo", name: "Application photo", desc: "3.5 × 2.5 cm at 200 DPI, under 20 KB",
    steps: [
      { tool: "img-sizecm", opts: { width_cm: "3.5", height_cm: "2.5", dpi: "200", keep_aspect: "true", fmt: "jpeg" } },
      { tool: "img-master", opts: { mode: "color", dpi: "200", target_kb: "20", fmt: "jpeg" } },
    ],
  },
  {
    id: "signature", name: "Signature for forms", desc: "Clean paper, 4.5 × 2 cm, under 10 KB",
    steps: [
      { tool: "img-adjust", opts: { mode: "document", brightness: "0", contrast: "10", saturation: "0", grayscale: "false" } },
      { tool: "img-sizecm", opts: { width_cm: "4.5", height_cm: "2", dpi: "200", keep_aspect: "true", fmt: "jpeg" } },
      { tool: "img-master", opts: { mode: "color", dpi: "200", target_kb: "10", fmt: "jpeg" } },
    ],
  },
  {
    id: "portal-pdf", name: "Scan → portal-ready PDF", desc: "Grayscale 200 DPI, 300 KB/page, searchable",
    steps: [
      { tool: "pdf-master", opts: { mode: "grayscale", dpi: "200", per_page_kb: "300", target_kb: "0" } },
      { tool: "pdf-ocr", opts: { lang: "eng", output: "pdf", skip_text: "false" } },
    ],
  },
  {
    id: "photos-pdf", name: "Phone photos → one PDF", desc: "Strip GPS, clean up, A4 pages, compress",
    steps: [
      { tool: "img-strip", opts: {} },
      { tool: "img-adjust", opts: { mode: "document", grayscale: "false" } },
      { tool: "pdf-from-images", opts: { page_size: "a4", orientation: "portrait", margin_mm: "0" } },
      { tool: "pdf-compress", opts: { quality: "ebook" } },
    ],
  },
  {
    id: "share-safe", name: "Share a PDF safely", desc: "Remove metadata, redact IDs, compress",
    steps: [
      { tool: "pdf-metadata", opts: { mode: "remove" } },
      { tool: "pdf-redact", opts: { terms: "", email: "true", phone: "true", aadhaar: "true", pan: "true", card: "true" } },
      { tool: "pdf-compress", opts: { quality: "ebook" } },
    ],
  },
  {
    id: "iphone", name: "iPhone photos → JPG", desc: "HEIC to JPG, location removed",
    steps: [
      { tool: "img-convert", opts: { fmt: "jpeg", quality: "90" } },
      { tool: "img-strip", opts: {} },
    ],
  },
];

/** Tools that can run unattended inside a workflow (no hands-on editor). */
function workflowTools() {
  return [...TOOLS.filter((t) => !t.editor && !t.board), MERGE_STEP];
}

function wfTool(id) {
  return id === "pdf-merge" ? MERGE_STEP : TOOLS.find((t) => t.id === id);
}

function loadMine() {
  try {
    return JSON.parse(localStorage.getItem(WF_STORE) || "[]");
  } catch {
    return [];
  }
}

function saveMine(list) {
  try {
    localStorage.setItem(WF_STORE, JSON.stringify(list));
    return true;
  } catch {
    toast("Your browser blocked saving — workflows can't be remembered here", "warn");
    return false;
  }
}

/** Set option controls in a container to saved values (the reverse of readOptions). */
function applyOptions(container, opts) {
  for (const [k, v] of Object.entries(opts || {})) {
    const n = container.querySelector(`[data-opt="${k}"]`);
    if (!n) continue;
    if (n.classList.contains("seg")) {
      n.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("on", b.dataset.v === String(v));
        b.setAttribute("aria-checked", String(b.dataset.v === String(v)));
      });
    } else if (n.type === "checkbox") {
      n.checked = String(v) === "true";
    } else {
      n.value = v;
      if (n.type === "range") {
        paintRange(n);
        const out = container.querySelector(`#val-${k}`);
        if (out) out.textContent = n.value + out.dataset.suffix;
      }
    }
  }
}

/** Options UI for one tool, wired like the tool page (segments, sliders, init hooks). */
function stepOptions(t, opts) {
  const box = el(`<div class="step-opts"></div>`);
  box.innerHTML = t.options().join("");
  box.querySelectorAll('input[type="range"]').forEach((r) => {
    const val = box.querySelector(`#val-${r.dataset.opt}`);
    paintRange(r);
    r.addEventListener("input", () => { val.textContent = r.value + val.dataset.suffix; paintRange(r); });
  });
  box.querySelectorAll(".seg").forEach((sg) => sg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    sg.querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); });
  }));
  // ids must be unique once several steps share the page
  box.querySelectorAll("[id]").forEach((n) => (n.id = `${n.id}-${Math.random().toString(36).slice(2, 7)}`));
  box.querySelectorAll("label[for]").forEach((l) => l.removeAttribute("for"));
  try { t.init?.(box); } catch { /* init hooks written for the tool page may expect page-only elements */ }
  applyOptions(box, opts);
  return box;
}

function readStep(box) {
  const o = {};
  box.querySelectorAll("[data-opt]").forEach((n) => {
    if (n.classList.contains("seg")) o[n.dataset.opt] = n.querySelector("button.on")?.dataset.v;
    else if (n.type === "checkbox") o[n.dataset.opt] = n.checked ? "true" : "false";
    else o[n.dataset.opt] = n.value;
  });
  return o;
}

/* ================================================================ unzip (to keep chaining) */

async function unzipFiles(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = [];
  let i = 0;
  while (i + 30 <= bytes.length && view.getUint32(i, true) === 0x04034b50) {
    const method = view.getUint16(i + 8, true), size = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true), extra = view.getUint16(i + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const raw = bytes.subarray(i + 30 + nameLen + extra, i + 30 + nameLen + extra + size);
    const data = method === 8
      ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer())
      : raw.slice();
    if (name !== "summary.txt") files.push(new File([data], name));
    i += 30 + nameLen + extra + size;
  }
  return files;
}

/* ================================================================ runner */

const kindOf = (f) => (/\.pdf$/i.test(f.name) ? "pdf" : /\.(docx|txt|zip)$/i.test(f.name) ? "other" : "image");

/**
 * Run steps over files. report(stepIndex, text) keeps the UI informed.
 * Returns { name, bytes, mime } — one file, or a zip when several remain.
 */
async function runWorkflow(steps, inputs, report) {
  let files = inputs;
  for (const [k, step] of steps.entries()) {
    const t = wfTool(step.tool);
    if (!t) throw new Error(`Step ${k + 1}: unknown tool`);
    const wrong = files.find((f) => !t.accept.includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase()));
    if (wrong) throw new Error(`Step ${k + 1} (${t.name}) can't take ${wrong.name} — it needs ${t.accept.includes(".pdf") && t.accept.length === 1 ? "PDFs" : "images"}`);
    const outputs = [];
    if (t.combine || t.id === "pdf-from-images") {
      report(k, `${t.name}…`);
      outputs.push(await executeTool(t, files, step.opts, (p) => report(k, `${t.name} · ${p.label || ""}`)));
    } else {
      for (const [j, f] of files.entries()) {
        report(k, `${t.name}${files.length > 1 ? ` · file ${j + 1} of ${files.length}` : ""}…`);
        outputs.push(await executeTool(t, [f], step.opts, (p) => report(k, `${t.name} · ${p.label || ""}`)));
      }
    }
    files = [];
    for (const r of outputs) {
      if (/\.zip$/i.test(r.name) && k < steps.length - 1) files.push(...(await unzipFiles(r.bytes)));
      else files.push(new File([r.bytes], r.name, { type: r.mime }));
    }
    report(k, "done");
  }
  if (files.length === 1) {
    const f = files[0];
    return { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type || "application/octet-stream" };
  }
  const z = await engine.run("zip", files);
  return { ...z, name: "workflow_results.zip" };
}

/* ================================================================ view */

const wf = { current: null, files: [], result: null };

function renderWorkflows(host) {
  const mine = loadMine();
  const all = [...WF_PRESETS.map((p) => ({ ...p, preset: true })), ...mine];
  if (wf.preselect) {
    const pick = all.find((w) => w.id === wf.preselect);
    if (pick) wf.current = JSON.parse(JSON.stringify(pick));
    wf.preselect = null;
  }
  if (!wf.current || (!wf.current.unsaved && !all.some((w) => w.id === wf.current.id))) wf.current = JSON.parse(JSON.stringify(all[0]));
  host.replaceChildren(el(`<div class="wf">
    <div class="wf-list">
      <div class="wf-list-head"><h2>Workflows</h2><button type="button" class="pill-btn" data-wf="new">+ New</button></div>
      <div class="wf-cards"></div>
    </div>
    <div class="wf-detail"></div>
  </div>`));
  const cards = host.querySelector(".wf-cards");
  for (const w of all) {
    const c = el(`<button type="button" class="wf-card${w.id === wf.current.id ? " on" : ""}">
      <span class="wf-name"></span><span class="wf-desc"></span>
      <span class="wf-chips">${w.steps.map((s) => `<span>${esc(wfTool(s.tool)?.name || s.tool)}</span>`).join('<i aria-hidden="true">→</i>')}</span>
    </button>`);
    c.querySelector(".wf-name").textContent = w.name + (w.preset ? "" : " · yours");
    c.querySelector(".wf-desc").textContent = w.desc || `${w.steps.length} steps`;
    c.addEventListener("click", () => {
      wf.current = JSON.parse(JSON.stringify(w));
      wf.result = null;
      renderWorkflows(host);
    });
    cards.appendChild(c);
  }
  host.querySelector('[data-wf="new"]').addEventListener("click", () => {
    wf.current = { id: `my-${Date.now()}`, name: "My workflow", desc: "", steps: [], unsaved: true };
    wf.result = null;
    renderWorkflows(host);
  });
  renderDetail(host.querySelector(".wf-detail"), host);
}

function renderDetail(box, host) {
  const w = wf.current;
  box.replaceChildren(el(`<div class="wf-panel">
    <div class="wf-head">
      <input class="wf-title" aria-label="Workflow name" ${w.preset ? "readonly" : ""}>
      <span class="wf-actions">
        ${w.preset ? '<button type="button" class="pill-btn" data-wf="copy">Customise</button>' : '<button type="button" class="pill-btn" data-wf="save">Save</button><button type="button" class="pill-btn danger" data-wf="delete">Delete</button>'}
      </span>
    </div>
    <ol class="wf-steps"></ol>
    ${w.preset ? "" : `<div class="wf-add"><select aria-label="Add a step"><option value="">+ Add a step…</option>${workflowTools().map((t) => `<option value="${t.id}">${t.cat === "pdf" ? "PDF" : "Image"} · ${esc(t.name)}</option>`).join("")}</select></div>`}
    <div class="wf-run">
      <div class="dropzone wf-drop" role="button" tabindex="0">
        <input type="file" hidden multiple>
        <span class="dz-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 14.5V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2.5"/></svg></span>
        <span class="dz-text"><span class="dz-title">Drop files to run this workflow</span><span class="dz-sub wf-files">or click to browse</span></span>
      </div>
      <div class="wf-go">
        <button type="button" class="btn btn-primary" data-wf="run">Run workflow</button>
        <button type="button" class="btn btn-ink hidden" data-wf="download">Save result</button>
      </div>
    </div>
  </div>`));
  const title = box.querySelector(".wf-title");
  title.value = w.name;
  title.addEventListener("input", () => (w.name = title.value));

  const list = box.querySelector(".wf-steps");
  w.steps.forEach((s, k) => {
    const t = wfTool(s.tool);
    const li = el(`<li class="wf-step">
      <div class="wf-step-head">
        <span class="wf-num">${k + 1}</span>
        <span class="wf-step-icon" data-cat="${t?.cat}">${ICONS[t?.icon] || ""}</span>
        <span class="wf-step-name"></span>
        <span class="wf-state"></span>
        <button type="button" class="chip-btn" data-step="toggle" aria-label="Show options">${ICONS.sliders.replace(/width="22" height="22"/, 'width="16" height="16"')}</button>
        ${w.preset ? "" : `<button type="button" class="chip-btn" data-step="up" aria-label="Move up" ${k === 0 ? "disabled" : ""}>↑</button><button type="button" class="chip-btn" data-step="down" aria-label="Move down" ${k === w.steps.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="chip-btn danger" data-step="remove" aria-label="Remove step">✕</button>`}
      </div>
    </li>`);
    li.querySelector(".wf-step-name").textContent = t ? t.name : s.tool;
    if (t) {
      const opts = stepOptions(t, s.opts);
      opts.classList.add("hidden");
      // read options back whenever they change, so Save / Run use them
      const sync = () => (s.opts = readStep(opts));
      opts.addEventListener("input", sync);
      opts.addEventListener("click", () => setTimeout(sync));
      li.appendChild(opts);
    }
    li.querySelector(".wf-step-head").addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.step;
      if (act === "toggle" || (!act && !e.target.closest("button"))) li.querySelector(".step-opts")?.classList.toggle("hidden");
      else if (act === "remove") { w.steps.splice(k, 1); renderDetail(box, host); }
      else if (act === "up" || act === "down") {
        const to = k + (act === "up" ? -1 : 1);
        [w.steps[k], w.steps[to]] = [w.steps[to], w.steps[k]];
        renderDetail(box, host);
      }
    });
    list.appendChild(li);
  });
  if (!w.steps.length) list.appendChild(el(`<li class="wf-empty">Add the first step below — e.g. “Size in CM”, then “Compress to Size”.</li>`));

  box.querySelector(".wf-add select")?.addEventListener("change", (e) => {
    if (!e.target.value) return;
    w.steps.push({ tool: e.target.value, opts: {} });
    const t = wfTool(e.target.value);
    renderDetail(box, host);
    // fill in the tool's defaults so the step runs as shown
    const added = box.querySelectorAll(".wf-step")[w.steps.length - 1];
    if (t && added) w.steps[w.steps.length - 1].opts = readStep(added.querySelector(".step-opts"));
  });

  box.querySelector(".wf-actions").addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.wf;
    const mine = loadMine();
    if (act === "copy") {
      wf.current = { ...JSON.parse(JSON.stringify(w)), id: `my-${Date.now()}`, name: `${w.name} (mine)`, preset: false, unsaved: true };
      renderWorkflows(host);
    } else if (act === "save") {
      if (!w.steps.length) return toast("Add at least one step first", "warn");
      const { unsaved, preset, ...clean } = w;
      const i = mine.findIndex((m) => m.id === w.id);
      if (i >= 0) mine[i] = clean; else mine.push(clean);
      if (saveMine(mine)) {
        delete w.unsaved;
        toast("Workflow saved in this browser");
        renderWorkflows(host);
      }
    } else if (act === "delete") {
      saveMine(mine.filter((m) => m.id !== w.id));
      wf.current = null;
      renderWorkflows(host);
    }
  });

  // run
  const drop = box.querySelector(".wf-drop"), input = drop.querySelector("input");
  const label = drop.querySelector(".wf-files");
  const showFiles = () => {
    label.textContent = wf.files.length ? `${wf.files.length} file${wf.files.length === 1 ? "" : "s"}: ${wf.files.map((f) => f.name).join(", ")}` : "or click to browse";
    drop.classList.toggle("done", wf.files.length > 0);
  };
  drop.addEventListener("click", () => input.click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    wf.files = [...e.dataTransfer.files];
    showFiles();
  });
  input.addEventListener("change", () => {
    wf.files = [...input.files];
    input.value = "";
    showFiles();
  });
  showFiles();
  const runBtn = box.querySelector('[data-wf="run"]'), dl = box.querySelector('[data-wf="download"]');
  runBtn.addEventListener("click", async () => {
    if (!w.steps.length) return toast("This workflow has no steps yet", "warn");
    if (!wf.files.length) return toast("Add files to run it on", "warn");
    runBtn.disabled = true;
    dl.classList.add("hidden");
    const states = list.querySelectorAll(".wf-state");
    states.forEach((s) => { s.textContent = ""; s.className = "wf-state"; });
    try {
      const r = await runWorkflow(w.steps, wf.files, (k, text) => {
        states.forEach((s, i) => s.classList.toggle("active", i === k && text !== "done"));
        states[k].textContent = text === "done" ? "✓" : text;
        if (text === "done") states[k].classList.add("ok");
        runBtn.textContent = `Running step ${k + 1} of ${w.steps.length}…`;
      });
      wf.result = r;
      dl.classList.remove("hidden");
      dl.onclick = () => {
        const url = URL.createObjectURL(new Blob([r.bytes], { type: r.mime }));
        const a = Object.assign(document.createElement("a"), { href: url, download: r.name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      };
      toast(`Done · ${r.name} · ${formatBytes(r.bytes.byteLength)}`);
      recordRecent("workflow:" + w.id);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = "Run workflow";
    }
  });
}
