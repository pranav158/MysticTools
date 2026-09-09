// Engine worker: all file processing runs here, off the UI thread, entirely
// inside this browser tab. Nothing is ever sent over the network.
import * as pdf from "./pdf.js";
import * as pdfedit from "./pdfedit.js";
import * as image from "./image.js";
import * as imgedit from "./imgedit.js";
import { UserError, out } from "./util.js";
import { makeZip } from "./codec.js";

const TOOLS = {
  "pdf-master": pdf.master,
  "pdf-compress": pdf.compress,
  "pdf-target": pdf.targetSize,
  "pdf-merge": pdf.merge,
  "pdf-organize": pdf.organize,
  "pdf-thumbs": pdf.thumbs,
  "pdf-split": pdf.split,
  "pdf-rotate": pdf.rotate,
  "pdf-to-images": pdf.toImages,
  "pdf-from-images": pdf.fromImages,
  "pdf-extract-images": pdf.extractImages,
  "pdf-encrypt": pdf.encrypt,
  "pdf-bw": pdf.bw,
  "img-master": image.master,
  "img-compress": image.compress,
  "img-target": image.targetSize,
  "img-crop": image.cropTool,
  "img-resize": image.resizeTool,
  "img-dpi": image.dpiTool,
  "img-convert": image.convert,
  "img-rotate": image.rotateTool,
  "img-bw": image.bw,
  "img-sizecm": image.sizeCm,
  "preview-pdf": pdf.preview,
  "pdf-watermark": pdfedit.watermark,
  "pdf-numbers": pdfedit.pageNumbers,
  "pdf-sign": pdfedit.sign,
  "pdf-redact": pdfedit.redact,
  "pdf-crop": pdfedit.crop,
  "pdf-unlock": pdfedit.unlock,
  "pdf-repair": pdfedit.repair,
  "pdf-flatten": pdfedit.flatten,
  "pdf-metadata": pdfedit.metadata,
  "pdf-info": pdfedit.info,
  "pdf-to-text": pdfedit.toText,
  "pdf-to-word": pdfedit.toWord,
  "pdf-page": pdfedit.renderPage,
  "pdf-text": pdfedit.pageText,
  "pdf-text-stats": pdfedit.textStats,
  "pdf-edit": pdfedit.applyEdits,
  "pdf-textlayer": pdfedit.textLayer,
  "img-preview": image.previewImage,
  "img-save-edit": image.saveEdited,
  zip: async (files) => out("files.zip", await makeZip(files.map((f) => ({ name: f.name, bytes: f.bytes })))),
  "img-watermark": imgedit.watermark,
  "img-strip": imgedit.stripMetadata,
  "img-hide": imgedit.hideRegions,
  "img-adjust": imgedit.adjust,
};

/** A transferable copy: results must own their buffer exactly. */
function own(bytes) {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
}

self.onmessage = async (e) => {
  const { id, tool, files, opts } = e.data;
  // extra carries streamed data, e.g. { page, thumb } from pdf-thumbs
  const progress = (done, total, label, extra) => self.postMessage({ id, progress: { done, total, label, ...extra } });
  try {
    const fn = TOOLS[tool];
    if (!fn) throw new UserError(`Unknown tool: ${tool}`);
    const input = files.map((f) => ({ name: f.name, bytes: new Uint8Array(f.buffer) }));
    const result = await fn(input, opts || {}, progress);
    const transfer = [];
    for (const key of ["bytes", "png"]) {
      if (result[key]) {
        result[key] = own(result[key]);
        transfer.push(result[key].buffer);
      }
    }
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    const user = err instanceof UserError;
    if (!user) console.error(err);
    self.postMessage({
      id, ok: false, fatal: !user,
      error: user ? err.message : `Processing failed: ${err?.message || err}`,
    });
  }
};

self.postMessage({ ready: true });
