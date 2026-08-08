import glob
import io
import os
import re
import shutil
import subprocess
import tempfile
import threading
import webbrowser
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, ImageOps
from starlette.background import BackgroundTask

try:
    import pymupdf as fitz
except ImportError:
    import fitz

BASE = Path(__file__).resolve().parent
PORT = 8765

app = FastAPI(title="MysticTools", docs_url="/api/docs", openapi_url="/api/openapi.json")


# ---------------------------------------------------------------- helpers

def find_ghostscript():
    for name in ("gswin64c", "gswin32c", "gs"):
        p = shutil.which(name)
        if p:
            return p
    try:
        cands = sorted(glob.glob(r"C:\Program Files\gs\gs*\bin\gswin64c.exe"))
        if cands:
            return cands[-1]
    except Exception:
        pass
    return None


GS = find_ghostscript()
SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def gs_available():
    return GS is not None


def clean_name(name):
    name = os.path.basename(name or "").replace("\\", "_")
    name = SAFE.sub("_", name).strip("._")
    return name or "file"


def stem(name):
    return Path(name).stem


def guess_mime(path):
    return {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
        ".gif": "image/gif", ".bmp": "image/bmp",
        ".tiff": "image/tiff", ".tif": "image/tiff",
        ".zip": "application/zip",
    }.get(Path(path).suffix.lower(), "application/octet-stream")


def save_uploads(files):
    d = tempfile.mkdtemp(prefix="mystic_")
    paths = []
    try:
        for i, f in enumerate(files):
            p = Path(d) / f"{i:03d}_{clean_name(f.filename)}"
            p.write_bytes(f.file.read())
            paths.append(p)
    except Exception:
        shutil.rmtree(d, ignore_errors=True)
        raise
    return d, paths


def cleanup_dir(d):
    shutil.rmtree(d, ignore_errors=True)


def result(path, download_name, orig_size=None, temp_dir=None):
    headers = {"X-Result-Size": str(os.path.getsize(path))}
    if orig_size is not None:
        headers["X-Original-Size"] = str(orig_size)
    bg = BackgroundTask(cleanup_dir, temp_dir) if temp_dir else None
    return FileResponse(
        str(path), media_type=guess_mime(path),
        filename=download_name, headers=headers, background=bg,
    )


def zip_files(paths, zip_name, temp_dir):
    zpath = Path(temp_dir) / zip_name
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            z.write(p, p.name)
    return zpath


def parse_pages(spec, n):
    if not spec or spec.strip().lower() in ("all", ""):
        return set(range(n))
    out = set()
    for part in str(spec).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a) - 1, int(b)))
        else:
            out.add(int(part) - 1)
    return {i for i in out if 0 <= i < n}


def flatten(im):
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        return Image.alpha_composite(bg, im).convert("RGB")
    return im.convert("RGB")


def render_pdf_raster(inp_path, out_path, dpi, threshold=None, gray=True):
    """Render every page to one image at exactly dpi and rebuild the PDF.

    Rasterising is the only way to guarantee a document's images sit at the
    requested DPI: pdfwrite never upsamples, so images below the target can't
    be raised any other way. gray=False keeps pages in colour."""
    doc = fitz.open(str(inp_path))
    nd = fitz.open()
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi, colorspace=(fitz.csGRAY if gray else fitz.csRGB),
                              alpha=False)
        mode = "L" if pix.n == 1 else ("RGB" if pix.n == 3 else "RGBA")
        im = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
        if threshold is not None:
            im = im.point(lambda p: 255 if p > threshold else 0)
        tmp = Path(out_path).with_name(f"_pg{i}.png")
        im.save(str(tmp), "PNG")
        npage = nd.new_page(width=page.rect.width, height=page.rect.height)
        npage.insert_image(npage.rect, filename=str(tmp))
        tmp.unlink()
    nd.save(str(out_path))
    nd.close()
    doc.close()


def render_pdf_bw(inp_path, out_path, dpi, threshold=None):
    render_pdf_raster(inp_path, out_path, dpi, threshold, gray=True)


def min_image_dpi(doc):
    """Lowest effective DPI of any placed image, or None when the doc has none."""
    worst = None
    for page in doc:
        for xref, *_ in page.get_images(full=True):
            rects = page.get_image_rects(xref)
            try:
                info = doc.extract_image(xref)
                w, h = info["width"], info["height"]
            except Exception:
                continue
            for r in rects:
                if r.width <= 0 or r.height <= 0:
                    continue
                d = min(w / r.width, h / r.height) * 72.0
                if d > 0:
                    worst = d if worst is None else min(worst, d)
    return worst


def with_dpi(dpi):
    """Save kwargs that keep an image's DPI tag — or none, when the source has none."""
    return {"dpi": dpi} if dpi else {}


def _fit_quality(im, target, fmt, save_kw):
    """Largest quality whose encoded size fits target; None if even the floor can't."""
    lo, hi, best = 5, 95, None
    while lo <= hi:
        mid = (lo + hi) // 2
        buf = io.BytesIO()
        im.save(buf, fmt, quality=mid, **save_kw)
        if buf.tell() <= target:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    return best


def _encode_to_target(base, target, fmt, save_kw):
    """Return (image, quality) that fits target — quality first, pixels only when required.

    Quality is lowered until it fits. Only if even the lowest quality is too big do we
    downscale pixel dimensions (DPI tag stays constant, so print size is preserved)."""
    q = _fit_quality(base, target, fmt, save_kw)
    if q is not None:
        return base, q
    w, h = base.size
    best_im, best_q, best_sz = base, 5, None
    f = 0.92
    while f >= 0.15:
        nw, nh = max(16, round(w * f)), max(16, round(h * f))
        if (nw, nh) == (w, h):
            f *= 0.92
            continue
        im = base.resize((nw, nh), Image.LANCZOS)
        q = _fit_quality(im, target, fmt, save_kw)
        if q is not None:
            return im, q
        buf = io.BytesIO()
        im.save(buf, fmt, quality=5, **save_kw)
        if best_sz is None or buf.tell() < best_sz:
            best_im, best_q, best_sz = im, 5, buf.tell()
        f *= 0.92
    return best_im, best_q


def _downscale(im, target, fmt, save_kw, make=lambda x: x):
    """Downscale (applying make() at each step) until the result fits target.

    Returns (image, downscaled). The largest fit wins; otherwise the smallest."""
    w, h = im.size
    best, best_sz = im, None
    f = 0.92
    while f >= 0.15:
        nw, nh = max(16, round(w * f)), max(16, round(h * f))
        if (nw, nh) == (w, h):
            f *= 0.92
            continue
        cand = make(im.resize((nw, nh), Image.LANCZOS))
        buf = io.BytesIO()
        cand.save(buf, fmt, **save_kw)
        sz = buf.tell()
        if sz <= target:
            return cand, True
        if best_sz is None or sz < best_sz:
            best, best_sz = cand, sz
        f *= 0.92
    return best, best is not im


# ---------------------------------------------------------------- PDF tools

QUALITY = {"screen": "/screen", "ebook": "/ebook", "printer": "/printer", "prepress": "/prepress"}


GS_ERROR_MARKERS = (b"requires a password", b"unrecoverable",
                    b"couldn't initialise file", b"couldn't get page info",
                    b"page not found", b"undefinedfilename")


def gs_result_valid(out, inp, proc):
    """True when a Ghostscript run produced a real conversion.

    Ghostscript exits 0 on encrypted/corrupt inputs while writing a one-page
    error PDF, so a zero exit alone is not success: the output must open with
    the same page count as the input and carry no fatal markers."""
    if proc.returncode != 0 or not out.exists() or os.path.getsize(out) == 0:
        return False
    merged = ((proc.stdout or b"") + b"\n" + (proc.stderr or b"")).lower()
    if any(m in merged for m in GS_ERROR_MARKERS):
        return False
    try:
        src = fitz.open(str(inp))
        n_in = src.page_count
        src.close()
        dst = fitz.open(str(out))
        n_out = dst.page_count
        dst.close()
    except Exception:
        return False
    return n_out == n_in


def gs_probe(inp, out, preset, res=None, gray=False):
    """Ghostscript one-shot recompress. res=None keeps original image DPI
    (downsampling disabled); otherwise embedded images are capped at res DPI.
    gray=True also converts the whole document to grayscale in the same pass.
    Returns output size, or None when the probe fails or times out."""
    args = [GS, "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS=/{preset}",
            "-dEmbedAllFonts=true", "-dSubsetFonts=true"]
    if gray:
        args += ["-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray"]
    if res is None:
        args += ["-dDownsampleColorImages=false", "-dDownsampleGrayImages=false",
                 "-dDownsampleMonoImages=false"]
    else:
        args += ["-dDownsampleColorImages=true", f"-dColorImageResolution={res}",
                 "-dDownsampleGrayImages=true", f"-dGrayImageResolution={res}",
                 "-dDownsampleMonoImages=true", f"-dMonoImageResolution={res}",
                 "-dAutoFilterColorImages=false", "-dColorImageFilter=/DCTEncode"]
    args += [f"-sOutputFile={out}", str(inp)]
    try:
        r = subprocess.run(args, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        return None
    if not gs_result_valid(out, inp, r):
        return None
    return os.path.getsize(out)


@app.post("/api/pdf/compress")
async def pdf_compress(file: UploadFile = File(...), quality: str = Form("ebook")):
    quality = quality.lower()
    if quality not in QUALITY:
        raise HTTPException(400, "quality must be screen|ebook|printer|prepress")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        out = Path(d) / f"{stem(inp.name)}_compressed.pdf"
        used_gs = False
        if gs_available():
            r = subprocess.run(
                [GS, "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
                 "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS={QUALITY[quality]}",
                 "-dEmbedAllFonts=true", "-dSubsetFonts=true",
                 f"-sOutputFile={out}", str(inp)],
                capture_output=True, timeout=300,
            )
            used_gs = gs_result_valid(out, inp, r)
        engine = "pymupdf"
        if not used_gs:
            try:
                doc = fitz.open(str(inp))
                doc.save(str(out), garbage=4, deflate=True)
                doc.close()
            except Exception:
                # locked or unreadable document: deliver the original, never an error page
                shutil.copyfile(inp, out)
                engine = "passthrough-unreadable"
        if engine != "passthrough-unreadable":
            if os.path.getsize(out) >= orig:
                shutil.copyfile(inp, out)
                engine = "no-reduction"
            elif used_gs:
                engine = "ghostscript"
        resp = result(out, out.name, orig, temp_dir=d)
        resp.headers["X-Engine"] = engine
        return resp
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/target-size")
async def pdf_target_size(file: UploadFile = File(...), target_kb: int = Form(100),
                          dpi: int = Form(200), dpi_mode: str = Form("preserve")):
    dpi_mode = dpi_mode.lower()
    if dpi_mode not in ("preserve", "force"):
        raise HTTPException(400, "dpi_mode must be preserve|force")
    target = max(1, target_kb) * 1024
    dpi = max(36, min(600, dpi))
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        out_name = f"{stem(inp.name)}_to_{max(1, target_kb)}kb.pdf"
        if orig <= target:
            out = Path(d) / out_name
            shutil.copyfile(inp, out)
            resp = result(out, out.name, orig, temp_dir=d)
            resp.headers["X-Engine"] = "already-fits"
            return resp
        if not gs_available():
            # graceful fallback without Ghostscript: best-effort recompress, never a 400
            out = Path(d) / out_name
            try:
                doc = fitz.open(str(inp))
                doc.save(str(out), garbage=4, deflate=True)
                doc.close()
            except Exception:
                shutil.copyfile(inp, out)
            resp = result(out, out.name, orig, temp_dir=d)
            resp.headers["X-Engine"] = "best-effort"
            return resp
        presets = ["ebook", "screen"]
        if dpi_mode == "preserve":
            # only downsample once quality alone can't reach the target; start high
            resolutions = [300, 250, 200, 180, 150, 120, 100, 90, 80, 72,
                           60, 50, 40, 35, 30, 25]
        else:
            # force mode: cap embedded images at the chosen DPI from the start
            resolutions = [dpi, 180, 150, 120, 100, 90, 80, 72, 60, 50, 40, 35, 30, 25]
        best_size, best_path, attempts = None, None, 0
        max_attempts = 16
        # 1) preserve only: quality-first, original DPI untouched
        if dpi_mode == "preserve":
            for preset in presets:
                if attempts >= max_attempts:
                    break
                attempts += 1
                out = Path(d) / f"keep_{preset}.pdf"
                size = gs_probe(inp, out, preset)
                if size is None:
                    continue
                if best_size is None or size < best_size:
                    best_size, best_path = size, out
                if size <= target:
                    resp = result(out, out_name, orig, temp_dir=d)
                    resp.headers["X-Engine"] = f"ghostscript-{preset}-original-dpi"
                    return resp
        # 2) downsample sweep (only reached when quality alone isn't enough)
        stop = False
        for preset in presets:
            for res in resolutions:
                if attempts >= max_attempts:
                    stop = True
                    break
                attempts += 1
                out = Path(d) / f"probe_{preset}_{res}.pdf"
                size = gs_probe(inp, out, preset, res)
                if size is None:
                    continue
                if best_size is None or size < best_size:
                    best_size, best_path = size, out
                if size <= target:
                    resp = result(out, out_name, orig, temp_dir=d)
                    resp.headers["X-Engine"] = f"ghostscript-{preset}-{res}dpi"
                    return resp
            if stop:
                break
        if best_path is None or best_size >= orig:
            out = Path(d) / out_name
            shutil.copyfile(inp, out)
            resp = result(out, out.name, orig, temp_dir=d)
            resp.headers["X-Engine"] = "no-reduction"
            return resp
        resp = result(best_path, out_name, orig, temp_dir=d)
        resp.headers["X-Engine"] = "best-effort"
        return resp
    except Exception:
        cleanup_dir(d)
        raise


def build_summary(report, header):
    lines = ["MysticTools batch report", "=" * 32, header, "", "input, result_bytes, engine"]
    for inp, out, engine in report:
        lines.append(f"{inp.name}, {os.path.getsize(out) if out is not None else 'ERROR'}, {engine}")
    return "\n".join(lines) + "\n"


def _pdf_master_raster(inp, out, dpi, threshold, target):
    """Render every page at exactly dpi and rebuild the PDF.

    Grayscale pages are JPEG-compressed (quality swept down) until the total
    stays at or below target; true-bw pages become 1-bit PNGs. Returns True when
    the result fits the size cap. This is the only way to guarantee an exact
    DPI: pdfwrite never upsamples and its downsample lands on non-exact steps,
    so low-DPI scans must be re-rendered."""
    doc = fitz.open(str(inp))
    pages = []
    for page in doc:
        pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY, alpha=False)
        im = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        if threshold is not None:
            im = im.point(lambda p: 255 if p > threshold else 0).convert("1")
        pages.append((im, page.rect.width, page.rect.height))
    doc.close()

    def encoded(q):
        bufs, total = [], 0
        for im, _, _ in pages:
            b = io.BytesIO()
            if threshold is not None:
                im.save(b, "PNG", optimize=True)
            else:
                im.save(b, "JPEG", quality=q, dpi=(dpi, dpi), optimize=True)
            total += b.tell()
            bufs.append(b.getvalue())
        return total, bufs

    if threshold is not None:
        total, bufs = encoded(85)
        fit = total <= target
    else:
        lo, hi, best = 1, 95, None
        while lo <= hi:
            mid = (lo + hi) // 2
            t, _ = encoded(mid)
            if t <= target:
                best, lo = mid, mid + 1
            else:
                hi = mid - 1
        q = best if best is not None else 1
        total, bufs = encoded(q)
        fit = total <= target

    nd = fitz.open()
    for (_, w, h), data in zip(pages, bufs):
        npage = nd.new_page(width=w, height=h)
        npage.insert_image(npage.rect, stream=data)
    nd.save(str(out), garbage=4, deflate=True)
    nd.close()
    return fit


def _pdf_master_one(inp, workdir, mode, dpi, threshold, per_page_kb, target_kb):
    orig = os.path.getsize(inp)
    doc = fitz.open(str(inp))
    pages = doc.page_count
    encrypted = bool(doc.needs_pass)
    corrupt = getattr(doc, "is_repaired", False) or pages == 0
    has_images = False
    if not (encrypted or corrupt):
        try:
            has_images = any(p.get_images(full=True) for p in doc)
        except Exception:
            has_images = False
    doc.close()
    if target_kb > 0:
        target = max(1, target_kb) * 1024
    else:
        target = max(1, per_page_kb) * 1024 * pages
    out_name = f"{stem(inp.name)}_master_{target // 1024}kb.pdf"
    out = Path(workdir) / out_name

    if encrypted or corrupt:
        # locked/damaged documents can't be re-encoded safely: pass the
        # original through so no file is ever lost or faked as converted
        shutil.copyfile(inp, out)
        return out, "master-encrypted-passthrough" if encrypted else "master-corrupt-passthrough"

    # Colour: keep colour, shrink to fit the size cap (no DPI re-encode).
    if mode == "color":
        if orig <= target:
            shutil.copyfile(inp, out)
            return out, "already-fits"
        if gs_available():
            best_size, best_path = None, None
            for preset in ("ebook", "screen"):
                p = Path(workdir) / f"c_{preset}.pdf"
                size = gs_probe(inp, p, preset, res=dpi, gray=False)
                if size is None:
                    continue
                if best_size is None or size < best_size:
                    best_size, best_path = size, p
                if size <= target:
                    shutil.move(str(p), str(out))
                    return out, f"master-color-{preset}-{dpi}dpi"
            if best_path is not None:
                shutil.move(str(best_path), str(out))
                return out, "master-color-over-max"
        try:
            nd = fitz.open(str(inp))
            nd.save(str(out), garbage=4, deflate=True)
            nd.close()
            return out, "master-color-pymupdf"
        except Exception:
            shutil.copyfile(inp, out)
            return out, "master-color-passthrough"

    # Grayscale / true-bw: render at the exact DPI whenever the doc carries
    # images (or always for true-bw), so no image lands below the requested DPI.
    if mode == "true-bw" or has_images:
        fit = _pdf_master_raster(inp, out, dpi, threshold if mode == "true-bw" else None, target)
        tag = "true-bw" if mode == "true-bw" else "gray"
        return out, f"master-{tag}-raster-{dpi}dpi" + ("" if fit else "-over-max")

    # Text/vector only: grayscale via Ghostscript keeps text crisp; no DPI applies.
    if gs_available():
        best_size, best_path = None, None
        for preset in ("ebook", "screen"):
            p = Path(workdir) / f"g_{preset}.pdf"
            size = gs_probe(inp, p, preset, res=dpi, gray=True)
            if size is None:
                continue
            if best_size is None or size < best_size:
                best_size, best_path = size, p
            if size <= target:
                shutil.move(str(p), str(out))
                return out, f"master-gray-{preset}-{dpi}dpi"
        if best_path is not None:
            shutil.move(str(best_path), str(out))
            return out, "master-gray-over-max"
    try:
        render_pdf_bw(inp, out, dpi, None)
        return out, "master-gray-render"
    except Exception:
        shutil.copyfile(inp, out)
        return out, "master-passthrough-unreadable"


@app.post("/api/pdf/master")
async def pdf_master(file: UploadFile = File(None), files: list[UploadFile] = File([]),
                     mode: str = Form("grayscale"), dpi: int = Form(200),
                     threshold: int = Form(128), per_page_kb: int = Form(300),
                     target_kb: int = Form(0)):
    if mode not in ("grayscale", "true-bw", "color"):
        raise HTTPException(400, "mode must be grayscale|true-bw|color")
    dpi = max(36, min(600, dpi))
    threshold = max(0, min(255, threshold))
    uploads = [file] if file is not None else list(files)
    if not uploads:
        raise HTTPException(400, "no file uploaded")
    d, paths = save_uploads(uploads)
    try:
        if len(paths) == 1:
            out, engine = _pdf_master_one(paths[0], d, mode, dpi, threshold, per_page_kb, target_kb)
            resp = result(out, out.name, os.path.getsize(paths[0]), temp_dir=d)
            resp.headers["X-Engine"] = engine
            return resp
        header = (f"options: mode={mode} dpi={dpi} threshold={threshold} "
                  f"per_page_kb={per_page_kb} target_kb={target_kb}")
        report = []
        for i, inp in enumerate(paths):
            sub = Path(d) / str(i)
            sub.mkdir(exist_ok=True)
            try:
                out, engine = _pdf_master_one(inp, sub, mode, dpi, threshold, per_page_kb, target_kb)
                report.append((inp, out, engine))
            except Exception as e:
                report.append((inp, inp, f"ERROR: {e} — original included"))
        orig_total = sum(os.path.getsize(p) for p in paths)
        zpath = Path(d) / "master_pdf_batch.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("summary.txt", build_summary(report, header))
            for inp, out, engine in report:
                if out is not None:
                    z.write(out, out.name)
        resp = result(zpath, zpath.name, orig_total, temp_dir=d)
        failed = sum(1 for _, _, engine in report if engine.startswith("ERROR"))
        resp.headers["X-Processed"] = str(len(paths) - failed)
        resp.headers["X-Failed"] = str(failed)
        resp.headers["X-Engine"] = "batch"
        return resp
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/merge")
async def pdf_merge(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "need at least 2 files")
    d, paths = save_uploads(files)
    try:
        out = Path(d) / "merged.pdf"
        merged = fitz.open()
        for p in paths:
            src = fitz.open(str(p))
            merged.insert_pdf(src)
            src.close()
        merged.save(str(out))
        merged.close()
        orig = sum(os.path.getsize(p) for p in paths)
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/split")
async def pdf_split(file: UploadFile = File(...), mode: str = Form("range"),
                    page_range: str = Form(""), every: int = Form(1)):
    if mode not in ("range", "every"):
        raise HTTPException(400, "mode must be range|every")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        doc = fitz.open(str(inp))
        n = doc.page_count
        out_name = stem(inp.name)
        if mode == "range":
            pages = parse_pages(page_range, n)
            if not pages:
                doc.close()
                raise HTTPException(400, "no valid pages in range")
            nd = fitz.open()
            for i in sorted(pages):
                nd.insert_pdf(doc, from_page=i, to_page=i)
            out = Path(d) / f"{out_name}_pages.pdf"
            nd.save(str(out))
            nd.close()
            doc.close()
            return result(out, out.name, orig, temp_dir=d)
        every = max(1, int(every))
        chunks = []
        for start in range(0, n, every):
            nd = fitz.open()
            end = min(start + every, n)
            for i in range(start, end):
                nd.insert_pdf(doc, from_page=i, to_page=i)
            cp = Path(d) / f"{out_name}_p{start + 1}-{end}.pdf"
            nd.save(str(cp))
            nd.close()
            chunks.append(cp)
        doc.close()
        z = zip_files(chunks, f"{out_name}_split.zip", d)
        return result(z, z.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/rotate")
async def pdf_rotate(file: UploadFile = File(...), angle: int = Form(90), pages: str = Form("all")):
    if angle not in (90, 180, 270):
        raise HTTPException(400, "angle must be 90|180|270")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        doc = fitz.open(str(inp))
        for i in parse_pages(pages, doc.page_count):
            page = doc[i]
            page.set_rotation((page.rotation + angle) % 360)
        out = Path(d) / f"{stem(inp.name)}_rotated.pdf"
        doc.save(str(out))
        doc.close()
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/to-images")
async def pdf_to_images(file: UploadFile = File(...), fmt: str = Form("jpg"),
                        dpi: int = Form(150), quality: int = Form(85)):
    fmt = fmt.lower()
    if fmt not in ("jpg", "jpeg", "png"):
        raise HTTPException(400, "fmt must be jpg|png")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        doc = fitz.open(str(inp))
        imgs = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=max(1, dpi))
            p = Path(d) / f"{stem(inp.name)}_page_{i + 1:03d}.{'png' if fmt == 'png' else 'jpg'}"
            if fmt == "png":
                pix.save(str(p))
            else:
                pix.save(str(p), jpg_quality=quality)
            imgs.append(p)
        doc.close()
        if len(imgs) == 1:
            return result(imgs[0], imgs[0].name, orig, temp_dir=d)
        z = zip_files(imgs, f"{stem(inp.name)}_pages.zip", d)
        return result(z, z.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/extract-images")
async def pdf_extract_images(file: UploadFile = File(...)):
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        doc = fitz.open(str(inp))
        seen, out = set(), []
        for page in doc:
            for info in page.get_images(full=True):
                xref = info[0]
                if xref in seen:
                    continue
                seen.add(xref)
                try:
                    raw = doc.extract_image(xref)
                except Exception:
                    continue
                p = Path(d) / f"{stem(inp.name)}_img_{xref}.{raw.get('ext', 'png')}"
                p.write_bytes(raw["image"])
                out.append(p)
        doc.close()
        if not out:
            raise HTTPException(400, "no images found in this PDF")
        if len(out) == 1:
            return result(out[0], out[0].name, orig, temp_dir=d)
        z = zip_files(out, f"{stem(inp.name)}_images.zip", d)
        return result(z, z.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


PAGE_SIZES = {"a4": (595.28, 841.89), "letter": (612.0, 792.0), "auto": None}


@app.post("/api/pdf/from-images")
async def pdf_from_images(files: list[UploadFile] = File(...), page_size: str = Form("a4"),
                          orientation: str = Form("portrait"), margin_mm: int = Form(0)):
    if page_size not in PAGE_SIZES:
        raise HTTPException(400, "page_size must be a4|letter|auto")
    if orientation not in ("portrait", "landscape"):
        raise HTTPException(400, "orientation must be portrait|landscape")
    d, paths = save_uploads(files)
    try:
        doc = fitz.open()
        margin = max(0, margin_mm) * 72 / 25.4
        for p in paths:
            with Image.open(str(p)) as im:
                iw, ih = im.size
            if page_size == "auto":
                w, h = iw, ih
            else:
                w, h = PAGE_SIZES[page_size]
                if (orientation == "landscape") != (w < h):
                    w, h = h, w
            page = doc.new_page(width=w, height=h)
            rect = fitz.Rect(margin, margin, max(margin + 1, w - margin), max(margin + 1, h - margin))
            page.insert_image(rect, filename=str(p), keep_proportion=True)
        out = Path(d) / "images.pdf"
        doc.save(str(out))
        doc.close()
        orig = sum(os.path.getsize(p) for p in paths)
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/pdf/encrypt")
async def pdf_encrypt(file: UploadFile = File(...), password: str = Form(""),
                      method: str = Form("aes-256")):
    if not password:
        raise HTTPException(400, "password required")
    methods = {
        "aes-256": fitz.PDF_ENCRYPT_AES_256,
        "aes-128": fitz.PDF_ENCRYPT_AES_128,
        "rc4": fitz.PDF_ENCRYPT_RC4_128,
    }
    if method not in methods:
        raise HTTPException(400, "method must be aes-256|aes-128|rc4")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        doc = fitz.open(str(inp))
        out = Path(d) / f"{stem(inp.name)}_protected.pdf"
        doc.save(str(out), encryption=methods[method], user_pw=password, owner_pw=password)
        doc.close()
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


# ---------------------------------------------------------------- image tools


@app.post("/api/pdf/bw")
async def pdf_bw(file: UploadFile = File(...), mode: str = Form("grayscale"),
                 dpi: int = Form(200), threshold: int = Form(128)):
    if mode not in ("grayscale", "true-bw"):
        raise HTTPException(400, "mode must be grayscale|true-bw")
    dpi = max(36, min(600, dpi))
    threshold = max(0, min(255, threshold))
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        out = Path(d) / f"{stem(inp.name)}_bw.pdf"
        used_gs = False
        if mode == "grayscale" and gs_available():
            r = subprocess.run(
                [GS, "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
                 "-dCompatibilityLevel=1.5", "-sColorConversionStrategy=Gray",
                 "-dProcessColorModel=/DeviceGray", "-dEmbedAllFonts=true",
                 "-dSubsetFonts=true", f"-sOutputFile={out}", str(inp)],
                capture_output=True, timeout=120,
            )
            used_gs = gs_result_valid(out, inp, r)
        engine = "ghostscript-gray" if used_gs else (
            "render-true-bw" if mode == "true-bw" else "render-gray")
        if not used_gs:
            try:
                render_pdf_bw(inp, out, dpi, threshold if mode == "true-bw" else None)
            except Exception:
                # locked or unreadable document: pass the original through untouched
                shutil.copyfile(inp, out)
                engine = "passthrough-unreadable"
        resp = result(out, out.name, orig, temp_dir=d)
        resp.headers["X-Engine"] = engine
        return resp
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/compress")
async def image_compress(file: UploadFile = File(...), quality: int = Form(80),
                         fmt: str = Form("jpeg")):
    fmt = fmt.lower()
    if fmt not in ("jpeg", "jpg", "png", "webp"):
        raise HTTPException(400, "fmt must be jpeg|png|webp")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            dpi = im.info.get("dpi")
            if fmt in ("jpeg", "jpg"):
                out = Path(d) / f"{stem(inp.name)}.jpg"
                flatten(im).save(out, "JPEG", quality=max(1, min(100, quality)),
                                 optimize=True, **with_dpi(dpi))
            elif fmt == "webp":
                out = Path(d) / f"{stem(inp.name)}.webp"
                im2 = im if im.mode in ("RGBA", "RGB", "L") else im.convert("RGBA")
                im2.save(out, "WEBP", quality=max(1, min(100, quality)), method=6,
                         **with_dpi(dpi))
            else:
                out = Path(d) / f"{stem(inp.name)}.png"
                im2 = im.quantize(colors=256) if im.mode in ("RGB", "RGBA") else im
                im2.save(out, "PNG", optimize=True, **with_dpi(dpi))
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/target-size")
async def image_target_size(file: UploadFile = File(...), target_kb: int = Form(100),
                            fmt: str = Form("jpeg"), dpi: int = Form(200),
                            dpi_mode: str = Form("preserve")):
    fmt = fmt.lower()
    dpi_mode = dpi_mode.lower()
    if fmt not in ("jpeg", "jpg", "png", "webp"):
        raise HTTPException(400, "fmt must be jpeg|webp|png")
    if dpi_mode not in ("preserve", "force"):
        raise HTTPException(400, "dpi_mode must be preserve|force")
    target = max(1, target_kb) * 1024
    dpi = max(36, min(2400, dpi))
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        out_name = f"{stem(inp.name)}_to_{max(1, target_kb)}kb.{'jpg' if fmt == 'jpeg' else fmt}"
        with Image.open(str(inp)) as im:
            src_dpi = im.info.get("dpi")
            # preserve = keep the source's own DPI (or none); force = retag to the choice
            out_dpi = (dpi, dpi) if dpi_mode == "force" else src_dpi
            if fmt in ("jpeg", "jpg"):
                base = flatten(im)
                save_kw = {"optimize": True}
                if out_dpi:
                    save_kw["dpi"] = out_dpi
                out_im, q = _encode_to_target(base, target, "JPEG", save_kw)
                out = Path(d) / out_name
                out_im.save(str(out), "JPEG", quality=q, **save_kw)
                engine = f"jpeg-q{q}" + ("-downscaled" if out_im.size != base.size else "")
            elif fmt == "webp":
                base = im if im.mode in ("RGBA", "RGB", "L") else im.convert("RGBA")
                save_kw = {"method": 6}
                if out_dpi:
                    save_kw["dpi"] = out_dpi
                out_im, q = _encode_to_target(base, target, "WEBP", save_kw)
                out = Path(d) / out_name
                out_im.save(str(out), "WEBP", quality=q, **save_kw)
                engine = f"webp-q{q}" + ("-downscaled" if out_im.size != base.size else "")
            else:
                save_kw = {"optimize": True}
                if out_dpi:
                    save_kw["dpi"] = out_dpi
                if im.mode in ("RGB", "RGBA"):
                    # palette reduction first; only downscale when even 8 colours is too big
                    best_sz, best_p = None, None
                    for colors in (256, 128, 64, 32, 16, 8):
                        p = Path(d) / f"png_{colors}.png"
                        im.quantize(colors=colors).save(str(p), "PNG", **save_kw)
                        size = os.path.getsize(p)
                        if size <= target:
                            resp = result(p, out_name, orig, temp_dir=d)
                            resp.headers["X-Engine"] = f"png-colors-{colors}"
                            return resp
                        if best_sz is None or size < best_sz:
                            best_sz, best_p = size, p
                    if best_sz >= orig:
                        out = Path(d) / out_name
                        shutil.copyfile(inp, out)
                        resp = result(out, out.name, orig, temp_dir=d)
                        resp.headers["X-Engine"] = "no-reduction"
                        return resp
                    out_im, scaled = _downscale(im, target, "PNG", save_kw,
                                                make=lambda x: x.quantize(colors=8))
                    out = Path(d) / "png_8_scaled.png"
                    out_im.save(str(out), "PNG", **save_kw)
                    engine = "png-downscaled" if scaled else "best-effort"
                else:
                    base = im if im.mode in ("L", "LA") else im.convert("RGBA")
                    p = Path(d) / "png_raw.png"
                    base.save(str(p), "PNG", **save_kw)
                    if os.path.getsize(p) <= target:
                        resp = result(p, out_name, orig, temp_dir=d)
                        resp.headers["X-Engine"] = "png-original"
                        return resp
                    out_im, scaled = _downscale(base, target, "PNG", save_kw)
                    out = Path(d) / "png_raw_scaled.png"
                    out_im.save(str(out), "PNG", **save_kw)
                    engine = "png-downscaled" if scaled else "best-effort"
        resp = result(out, out.name, orig, temp_dir=d)
        resp.headers["X-Engine"] = engine
        return resp
    except Exception:
        cleanup_dir(d)
        raise


def _image_master_one(inp, workdir, mode, dpi, threshold, target_kb, fmt):
    target = max(1, target_kb) * 1024
    out_name = f"{stem(inp.name)}_master_{max(1, target_kb)}kb.{'jpg' if fmt == 'jpeg' else fmt}"
    out = Path(workdir) / out_name
    with Image.open(str(inp)) as im:
        if mode == "color":
            base_im = im
        elif mode == "grayscale":
            base_im = ImageOps.grayscale(im)
        else:
            base_im = ImageOps.grayscale(im).point(lambda p: 255 if p > threshold else 0)
        save_kw = {"optimize": True} if fmt in ("jpeg", "png") else {"method": 6}
        save_kw["dpi"] = (dpi, dpi)
        if fmt in ("jpeg", "jpg"):
            base = flatten(base_im) if mode == "color" else base_im.convert("L")
            out_im, q = _encode_to_target(base, target, "JPEG", save_kw)
            out_im.save(str(out), "JPEG", quality=q, **save_kw)
            engine = f"master-{mode}-jpeg-q{q}" + ("-downscaled" if out_im.size != base.size else "")
        elif fmt == "webp":
            base = base_im if base_im.mode in ("RGBA", "RGB", "L") else base_im.convert("RGBA")
            out_im, q = _encode_to_target(base, target, "WEBP", save_kw)
            out_im.save(str(out), "WEBP", quality=q, **save_kw)
            engine = f"master-{mode}-webp-q{q}" + ("-downscaled" if out_im.size != base.size else "")
        else:
            if mode == "color" and base_im.mode in ("RGB", "RGBA"):
                best_sz, best_p = None, None
                for colors in (256, 128, 64, 32, 16, 8):
                    p = Path(workdir) / f"png_{colors}.png"
                    base_im.quantize(colors=colors).save(str(p), "PNG", **save_kw)
                    size = os.path.getsize(p)
                    if size <= target:
                        return p, f"master-{mode}-png-colors-{colors}"
                    if best_sz is None or size < best_sz:
                        best_sz, best_p = size, p
                if best_sz is None or best_sz >= os.path.getsize(inp):
                    shutil.copyfile(inp, out)
                    return out, "no-reduction"
                out_im, scaled = _downscale(base_im, target, "PNG", save_kw,
                                            make=lambda x: x.quantize(colors=8))
                out_im.save(str(out), "PNG", **save_kw)
                engine = "master-" + mode + ("-png-downscaled" if scaled else "-png-best-effort")
            else:
                base = base_im if base_im.mode in ("L", "LA") else base_im.convert("RGBA")
                p = Path(workdir) / "png_raw.png"
                base.save(str(p), "PNG", **save_kw)
                if os.path.getsize(p) <= target:
                    return p, f"master-{mode}-png-original"
                out_im, scaled = _downscale(base, target, "PNG", save_kw)
                out_im.save(str(out), "PNG", **save_kw)
                engine = "master-" + mode + ("-png-downscaled" if scaled else "-png-best-effort")
    return out, engine


@app.post("/api/image/master")
async def image_master(file: UploadFile = File(None), files: list[UploadFile] = File([]),
                       mode: str = Form("grayscale"), dpi: int = Form(200),
                       threshold: int = Form(128), target_kb: int = Form(20),
                       fmt: str = Form("jpeg")):
    if mode not in ("grayscale", "true-bw", "color"):
        raise HTTPException(400, "mode must be grayscale|true-bw|color")
    fmt = fmt.lower()
    if fmt not in ("jpeg", "jpg", "png", "webp"):
        raise HTTPException(400, "fmt must be jpeg|png|webp")
    dpi = max(36, min(2400, dpi))
    threshold = max(0, min(255, threshold))
    uploads = [file] if file is not None else list(files)
    if not uploads:
        raise HTTPException(400, "no file uploaded")
    d, paths = save_uploads(uploads)
    try:
        if len(paths) == 1:
            out, engine = _image_master_one(paths[0], d, mode, dpi, threshold, target_kb, fmt)
            resp = result(out, out.name, os.path.getsize(paths[0]), temp_dir=d)
            resp.headers["X-Engine"] = engine
            return resp
        header = (f"options: mode={mode} dpi={dpi} threshold={threshold} "
                  f"target_kb={target_kb} fmt={fmt}")
        report = []
        for i, inp in enumerate(paths):
            sub = Path(d) / str(i)
            sub.mkdir(exist_ok=True)
            try:
                out, engine = _image_master_one(inp, sub, mode, dpi, threshold, target_kb, fmt)
                report.append((inp, out, engine))
            except Exception as e:
                report.append((inp, inp, f"ERROR: {e} — original included"))
        orig_total = sum(os.path.getsize(p) for p in paths)
        zpath = Path(d) / "master_image_batch.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("summary.txt", build_summary(report, header))
            for inp, out, engine in report:
                if out is not None:
                    z.write(out, out.name)
        resp = result(zpath, zpath.name, orig_total, temp_dir=d)
        failed = sum(1 for _, _, engine in report if engine.startswith("ERROR"))
        resp.headers["X-Processed"] = str(len(paths) - failed)
        resp.headers["X-Failed"] = str(failed)
        resp.headers["X-Engine"] = "batch"
        return resp
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/resize")
async def image_resize(file: UploadFile = File(...), mode: str = Form("percent"),
                       value: int = Form(50), width: int = Form(0), height: int = Form(0),
                       keep_aspect: bool = Form(True)):
    if mode not in ("percent", "exact"):
        raise HTTPException(400, "mode must be percent|exact")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            w, h = im.size
            if mode == "percent":
                f = max(1, value) / 100.0
                nw, nh = max(1, round(w * f)), max(1, round(h * f))
            else:
                if width <= 0 and height <= 0:
                    raise HTTPException(400, "width or height required")
                if keep_aspect:
                    if width <= 0:
                        scale = height / h
                    elif height <= 0:
                        scale = width / w
                    else:
                        scale = min(width / w, height / h)
                    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
                else:
                    nw, nh = width or w, height or h
            im2 = im.resize((nw, nh), Image.LANCZOS)
            ext = inp.suffix.lower()
            if ext in (".jpg", ".jpeg"):
                out = Path(d) / f"{stem(inp.name)}_{nw}x{nh}.jpg"
                flatten(im2).save(out, "JPEG", quality=92, optimize=True)
            elif ext == ".webp":
                out = Path(d) / f"{stem(inp.name)}_{nw}x{nh}.webp"
                im2.save(out, "WEBP", quality=92)
            else:
                out = Path(d) / f"{stem(inp.name)}_{nw}x{nh}.png"
                im2.save(out, "PNG")
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/crop")
async def image_crop(file: UploadFile = File(...), x: float = Form(0), y: float = Form(0),
                     w: float = Form(1), h: float = Form(1), shape: str = Form("rect"),
                     fill: str = Form("transparent")):
    if shape not in ("rect", "circle"):
        raise HTTPException(400, "shape must be rect|circle")
    if fill not in ("transparent", "white", "black"):
        raise HTTPException(400, "fill must be transparent|white|black")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            W, H = im.size
            x = min(max(0.0, x), 0.999)
            y = min(max(0.0, y), 0.999)
            w = min(max(0.01, w), 1.0 - x)
            h = min(max(0.01, h), 1.0 - y)
            box = (max(0, round(x * W)), max(0, round(y * H)),
                   min(W, round((x + w) * W)), min(H, round((y + h) * H)))
            if box[2] - box[0] < 2 or box[3] - box[1] < 2:
                raise HTTPException(400, "crop region too small")
            cropped = im.crop(box)
            out_name = f"{stem(inp.name)}_crop.png"
            out_fmt = "PNG"
            ext = inp.suffix.lower()
            if shape == "circle":
                cw, ch = cropped.size
                mask = Image.new("L", (cw, ch), 0)
                ImageDraw.Draw(mask).ellipse((0, 0, cw - 1, ch - 1), fill=255)
                rgba = cropped.convert("RGBA")
                rgba.putalpha(mask)
                if fill == "transparent":
                    cropped = rgba
                else:
                    bgc = (255, 255, 255, 255) if fill == "white" else (0, 0, 0, 255)
                    bg = Image.new("RGBA", (cw, ch), bgc)
                    cropped = Image.alpha_composite(bg, rgba)
                if fill != "transparent" and ext in (".jpg", ".jpeg"):
                    out_fmt, out_name = "JPEG", f"{stem(inp.name)}_crop.jpg"
                    cropped = cropped.convert("RGB")
            else:
                if ext in (".jpg", ".jpeg"):
                    out_fmt, out_name = "JPEG", f"{stem(inp.name)}_crop.jpg"
                    cropped = flatten(cropped)
                elif ext == ".webp":
                    out_fmt, out_name = "WEBP", f"{stem(inp.name)}_crop.webp"
            out = Path(d) / out_name
            cropped.save(out, out_fmt, quality=92 if out_fmt == "JPEG" else None)
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/dpi")
async def image_dpi(file: UploadFile = File(...), dpi: int = Form(300),
                    mode: str = Form("metadata")):
    if mode not in ("metadata", "resample"):
        raise HTTPException(400, "mode must be metadata|resample")
    dpi = max(1, min(2400, dpi))
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            if mode == "metadata":
                im2 = im.copy()
            else:
                cur = im.info.get("dpi", (72, 72))
                cw = cur[0] or 72
                ch = cur[1] or 72
                im2 = im.resize(
                    (max(1, round(im.width / cw * dpi)), max(1, round(im.height / ch * dpi))),
                    Image.LANCZOS,
                )
            ext = inp.suffix.lower()
            if ext in (".jpg", ".jpeg"):
                out = Path(d) / f"{stem(inp.name)}_dpi{dpi}.jpg"
                flatten(im2).save(out, "JPEG", quality=95, dpi=(dpi, dpi))
            elif ext == ".webp":
                out = Path(d) / f"{stem(inp.name)}_dpi{dpi}.webp"
                im2.save(out, "WEBP", quality=95, dpi=(dpi, dpi))
            else:
                out = Path(d) / f"{stem(inp.name)}_dpi{dpi}.png"
                im2.save(out, "PNG", optimize=True, dpi=(dpi, dpi))
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/convert")
async def image_convert(file: UploadFile = File(...), fmt: str = Form("png"),
                        quality: int = Form(85)):
    fmt = fmt.lower()
    if fmt not in ("jpeg", "jpg", "png", "webp"):
        raise HTTPException(400, "fmt must be jpeg|png|webp")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            if fmt in ("jpeg", "jpg"):
                out = Path(d) / f"{stem(inp.name)}.jpg"
                flatten(im).save(out, "JPEG", quality=max(1, min(100, quality)), optimize=True)
            elif fmt == "webp":
                out = Path(d) / f"{stem(inp.name)}.webp"
                im2 = im if im.mode in ("RGBA", "RGB", "L") else im.convert("RGBA")
                im2.save(out, "WEBP", quality=max(1, min(100, quality)))
            else:
                out = Path(d) / f"{stem(inp.name)}.png"
                im2 = im.quantize(colors=256) if im.mode in ("RGB", "RGBA") else im
                im2.save(out, "PNG", optimize=True)
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/rotate")
async def image_rotate(file: UploadFile = File(...), angle: int = Form(90),
                       flip: str = Form("none")):
    if angle not in (0, 90, 180, 270):
        raise HTTPException(400, "angle must be 0|90|180|270")
    if flip not in ("none", "h", "v"):
        raise HTTPException(400, "flip must be none|h|v")
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            im2 = im
            if angle == 90:
                im2 = im2.transpose(Image.ROTATE_90)
            elif angle == 180:
                im2 = im2.transpose(Image.ROTATE_180)
            elif angle == 270:
                im2 = im2.transpose(Image.ROTATE_270)
            if flip == "h":
                im2 = im2.transpose(Image.FLIP_LEFT_RIGHT)
            elif flip == "v":
                im2 = im2.transpose(Image.FLIP_TOP_BOTTOM)
            ext = inp.suffix.lower()
            suffix = f"rot{angle}{flip if flip != 'none' else ''}"
            if ext in (".jpg", ".jpeg"):
                out = Path(d) / f"{stem(inp.name)}_{suffix}.jpg"
                flatten(im2).save(out, "JPEG", quality=92)
            elif ext == ".webp":
                out = Path(d) / f"{stem(inp.name)}_{suffix}.webp"
                im2.save(out, "WEBP", quality=92)
            else:
                out = Path(d) / f"{stem(inp.name)}_{suffix}.png"
                im2.save(out, "PNG")
        return result(out, out.name, orig, temp_dir=d)
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/bw")
async def image_bw(file: UploadFile = File(...), mode: str = Form("grayscale"),
                   threshold: int = Form(128), fmt: str = Form("jpeg")):
    if mode not in ("grayscale", "true-bw"):
        raise HTTPException(400, "mode must be grayscale|true-bw")
    if fmt not in ("jpeg", "jpg", "png", "webp"):
        raise HTTPException(400, "fmt must be jpeg|png|webp")
    threshold = max(0, min(255, threshold))
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            dpi = im.info.get("dpi")
            gray = ImageOps.grayscale(im)
            if mode == "true-bw":
                gray = gray.point(lambda p: 255 if p > threshold else 0)
            if fmt in ("jpeg", "jpg"):
                out = Path(d) / f"{stem(inp.name)}_bw.jpg"
                gray.save(out, "JPEG", quality=92, optimize=True, **with_dpi(dpi))
            elif fmt == "webp":
                out = Path(d) / f"{stem(inp.name)}_bw.webp"
                gray.save(out, "WEBP", quality=92, **with_dpi(dpi))
            else:
                out = Path(d) / f"{stem(inp.name)}_bw.png"
                gray.save(out, "PNG", optimize=True, **with_dpi(dpi))
        resp = result(out, out.name, orig, temp_dir=d)
        resp.headers["X-Engine"] = mode
        return resp
    except Exception:
        cleanup_dir(d)
        raise


@app.post("/api/image/size-cm")
async def image_size_cm(file: UploadFile = File(...), width_cm: float = Form(3.5),
                        height_cm: float = Form(2.5), dpi: int = Form(200),
                        keep_aspect: bool = Form(True), fmt: str = Form("jpeg")):
    if fmt not in ("jpeg", "jpg", "png", "webp"):
        raise HTTPException(400, "fmt must be jpeg|png|webp")
    if width_cm <= 0 or height_cm <= 0:
        raise HTTPException(400, "width_cm and height_cm must be positive")
    dpi = max(36, min(2400, dpi))
    d, [inp] = save_uploads([file])
    try:
        orig = os.path.getsize(inp)
        with Image.open(str(inp)) as im:
            iw, ih = im.size
            tw, th = max(1, round(width_cm / 2.54 * dpi)), max(1, round(height_cm / 2.54 * dpi))
            if keep_aspect:
                scale = min(tw / iw, th / ih)
                nw, nh = max(1, round(iw * scale)), max(1, round(ih * scale))
            else:
                nw, nh = tw, th
            im2 = im.resize((nw, nh), Image.LANCZOS)
            if fmt in ("jpeg", "jpg"):
                out = Path(d) / f"{stem(inp.name)}_{nw}x{nh}_cm.jpg"
                flatten(im2).save(out, "JPEG", quality=92, optimize=True, dpi=(dpi, dpi))
            elif fmt == "webp":
                out = Path(d) / f"{stem(inp.name)}_{nw}x{nh}_cm.webp"
                im2.save(out, "WEBP", quality=92, dpi=(dpi, dpi))
            else:
                out = Path(d) / f"{stem(inp.name)}_{nw}x{nh}_cm.png"
                im2.save(out, "PNG", optimize=True, dpi=(dpi, dpi))
        resp = result(out, out.name, orig, temp_dir=d)
        resp.headers["X-Engine"] = f"{nw}x{nh}@{dpi}dpi"
        return resp
    except Exception:
        cleanup_dir(d)
        raise


@app.get("/api/health")
async def health():
    return {"status": "ok", "brand": "MysticTools", "ghostscript": gs_available()}


# ---------------------------------------------------------------- serve SPA

app.mount("/", StaticFiles(directory=str(BASE / "static"), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    url = f"http://localhost:{PORT}"
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    print()
    print(f"  MysticTools  ->  {url}   (100% local, nothing leaves this machine)")
    print("  Press Ctrl+C to stop.")
    print()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
