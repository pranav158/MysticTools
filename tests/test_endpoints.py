"""End-to-end test of every MysticTools endpoint against a running server."""
import io
import os
import sys
import zipfile

import requests
from PIL import Image

try:
    import pymupdf as fitz
except ImportError:
    import fitz

BASE = os.path.dirname(__file__)
S = os.path.join(BASE, "samples")
URL = os.environ.get("MYSTIC_URL", "http://127.0.0.1:8765")
DEADLINE_SECONDS = 280

passed, failed = [], []
import time as _time
_start = _time.time()


def deadline():
    if _time.time() - _start > DEADLINE_SECONDS:
        print(f"\n  ABORT: suite exceeded {DEADLINE_SECONDS}s watchdog")
        print(f"  {len(passed)} passed, {len(failed)} failed so far")
        sys.exit(2)


def ok(name, cond, extra=""):
    deadline()
    if cond:
        passed.append(name)
        print(f"  PASS  {name}  {extra}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}  {extra}")


def read(name):
    return open(os.path.join(S, name), "rb").read()


def post(path, files, data=None):
    deadline()
    return requests.post(URL + path, files=files, data=data, timeout=90)


def image_dpi_range(doc):
    """(min, max) effective DPI across all embedded images, or (None, None)."""
    lo, hi = None, None
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
                    lo = d if lo is None else min(lo, d)
                    hi = d if hi is None else max(hi, d)
    return lo, hi


def main():
    try:
        _main()
    finally:
        print()
        print(f"  {len(passed)} passed, {len(failed)} failed")
        if failed:
            print("  FAILED:", ", ".join(failed))
            sys.exit(1)


def _main():
    print("== health ==")
    r = requests.get(URL + "/api/health", timeout=10)
    ok("health", r.status_code == 200 and r.json()["status"] == "ok", r.json())
    ok("ghostscript detected", r.json()["ghostscript"] is True)

    print("== pdf tools ==")
    r = post("/api/pdf/compress", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"quality": "ebook"})
    ok("compress", r.status_code == 200 and r.headers["Content-Type"].startswith("application/pdf"),
       f"{r.headers.get('X-Original-Size')} -> {r.headers.get('X-Result-Size')}, engine={r.headers.get('X-Engine')}")
    ok("compress shrank", int(r.headers["X-Result-Size"]) < int(r.headers["X-Original-Size"]),
       f"saved {round(100 * (1 - int(r.headers['X-Result-Size']) / int(r.headers['X-Original-Size'])))}%")
    ok("compress used ghostscript", r.headers.get("X-Engine") == "ghostscript")

    r = post("/api/pdf/compress", {"file": ("big.pdf", read("big.pdf"), "application/pdf")}, {"quality": "screen"})
    ok("compress screen preset", r.status_code == 200)
    r = post("/api/pdf/compress", {"file": ("big.pdf", read("big.pdf"), "application/pdf")}, {"quality": "nope"})
    ok("compress rejects bad preset", r.status_code == 400)

    r = post("/api/pdf/target-size", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"target_kb": "3000", "dpi": "200"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    ok("pdf target-size fits", r.status_code == 200
       and r.headers["Content-Type"].startswith("application/pdf") and sz <= 3000 * 1024,
       f"{sz / 1024:.0f}KB / 3000KB, engine={r.headers.get('X-Engine')}")

    # preserve mode: a reachable-by-quality target must leave original DPI untouched
    r = post("/api/pdf/target-size", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"target_kb": "5000", "dpi": "200"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    ok("pdf target-size preserve keeps original dpi", r.status_code == 200 and sz <= 5000 * 1024
       and "original-dpi" in r.headers.get("X-Engine", ""),
       f"{sz / 1024:.0f}KB / 5000KB, engine={r.headers.get('X-Engine')}")

    # force mode: cap embedded images at the chosen DPI from the start
    r = post("/api/pdf/target-size", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"target_kb": "3000", "dpi": "200", "dpi_mode": "force"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    ok("pdf target-size force fits", r.status_code == 200 and sz <= 3000 * 1024,
       f"{sz / 1024:.0f}KB / 3000KB, engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/target-size", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"target_kb": "3000", "dpi": "200", "dpi_mode": "wat"})
    ok("pdf target-size rejects bad dpi_mode", r.status_code == 400)

    r = post("/api/pdf/target-size", {"file": ("tiny.pdf", read("tiny.pdf"), "application/pdf")},
             {"target_kb": "10", "dpi": "200"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    ok("pdf target-size already-fits", r.status_code == 200 and sz <= 10 * 1024
       and r.headers.get("X-Engine") == "already-fits", f"{sz} bytes, engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/merge",
             [("files", ("big.pdf", read("big.pdf"), "application/pdf")),
              ("files", ("tiny.pdf", read("tiny.pdf"), "application/pdf"))])
    merged = r.content
    ok("merge", r.status_code == 200 and fitz.open(stream=merged).page_count == 7,
       f"{fitz.open(stream=merged).page_count} pages")

    r = post("/api/pdf/split", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"mode": "range", "page_range": "2-4"})
    ok("split range", r.status_code == 200 and fitz.open(stream=r.content).page_count == 3,
       f"{fitz.open(stream=r.content).page_count} pages")

    r = post("/api/pdf/split", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"mode": "every", "every": "2"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    ok("split every N", r.status_code == 200 and len(z.namelist()) == 3,
       f"{len(z.namelist())} chunks in zip")

    r = post("/api/pdf/rotate", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"angle": "90", "pages": "1"})
    d = fitz.open(stream=r.content)
    ok("rotate", r.status_code == 200 and d[0].rotation == 90 and d[1].rotation == 0,
       f"page1.rotation={d[0].rotation}")

    r = post("/api/pdf/to-images", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"fmt": "jpg", "dpi": "150", "quality": "80"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    imgs = z.namelist()
    ok("pdf->images jpg", r.status_code == 200 and len(imgs) == 5, f"{len(imgs)} pages")
    with z.open(imgs[0]) as f:
        im = Image.open(f)
        ok("pdf->images dims at 150dpi", im.width > 1000, f"{im.width}x{im.height}")

    r = post("/api/pdf/to-images", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"fmt": "png", "dpi": "72"})
    ok("pdf->images png", r.status_code == 200 and len(zipfile.ZipFile(io.BytesIO(r.content)).namelist()) == 5)

    r = post("/api/pdf/extract-images", {"file": ("big.pdf", read("big.pdf"), "application/pdf")})
    if r.headers["Content-Type"] == "application/zip":
        n_imgs = len(zipfile.ZipFile(io.BytesIO(r.content)).namelist())
    else:
        n_imgs = 1
    ok("extract images", r.status_code == 200 and n_imgs >= 1, f"{n_imgs} images")

    r = post("/api/pdf/from-images",
             [("files", ("photo.jpg", read("photo.jpg"), "image/jpeg")),
              ("files", ("logo.png", read("logo.png"), "image/png"))],
             {"page_size": "a4", "orientation": "portrait", "margin_mm": "0"})
    ok("images->pdf", r.status_code == 200 and fitz.open(stream=r.content).page_count == 2,
       f"{fitz.open(stream=r.content).page_count} pages")

    r = post("/api/pdf/encrypt", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"password": "test123", "method": "aes-256"})
    doc = fitz.open(stream=r.content)
    ok("encrypt", r.status_code == 200 and doc.needs_pass, "needs password")
    doc.authenticate("test123")
    ok("encrypt wrong password rejected", doc.authenticate("wrong") == 0)
    ok("encrypt correct password works", doc.authenticate("test123") > 0)

    r = post("/api/pdf/bw", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"mode": "grayscale", "dpi": "200"})
    doc = fitz.open(stream=r.content)
    pix = doc[0].get_pixmap(dpi=80)
    s = pix.samples
    is_gray = all(abs(s[i] - s[i + 1]) <= 2 and abs(s[i + 1] - s[i + 2]) <= 2
                  for i in range(0, min(len(s), 6000), 3))
    ok("pdf bw grayscale", r.status_code == 200 and is_gray,
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/bw", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"mode": "true-bw", "dpi": "100", "threshold": "128"})
    doc = fitz.open(stream=r.content)
    pix = doc[0].get_pixmap(dpi=80)
    s = pix.samples[:4000]
    ok("pdf true bw", r.status_code == 200 and all(v in (0, 255) for v in s),
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/master", {"file": ("big.pdf", read("big.pdf"), "application/pdf")},
             {"mode": "grayscale", "dpi": "200", "threshold": "128", "per_page_kb": "600", "target_kb": "0"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    engine = r.headers.get("X-Engine") or ""
    doc = fitz.open(stream=r.content)
    pix = doc[0].get_pixmap(dpi=80)
    s = pix.samples
    is_gray = all(abs(s[i] - s[i + 1]) <= 2 and abs(s[i + 1] - s[i + 2]) <= 2
                  for i in range(0, min(len(s), 6000), 3))
    lo, hi = image_dpi_range(doc)
    ok("pdf master gray exact dpi", r.status_code == 200 and doc.page_count == 5 and is_gray
       and sz <= 600 * 1024 * 5 and lo is not None and abs(lo - 200) <= 1
       and engine.startswith("master-gray-raster-200dpi"),
       f"{sz / 1024:.0f}KB, dpi={lo:.1f}-{hi:.1f}, engine={engine}, gray={is_gray}")

    r = post("/api/pdf/master", {"file": ("tiny.pdf", read("tiny.pdf"), "application/pdf")},
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "10", "target_kb": "0"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    doc = fitz.open(stream=r.content)
    pix = doc[0].get_pixmap(dpi=80)
    s = pix.samples
    is_gray = all(abs(s[i] - s[i + 1]) <= 2 and abs(s[i + 1] - s[i + 2]) <= 2
                  for i in range(0, min(len(s), 6000), 3))
    ok("pdf master gray converts small file", r.status_code == 200 and sz <= 10 * 1024 * 2
       and is_gray and str(r.headers.get("X-Engine", "")).startswith("master-gray"),
       f"{sz} bytes, gray={is_gray}, engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/master", {"file": ("tiny.pdf", read("tiny.pdf"), "application/pdf")},
             {"mode": "color", "dpi": "200", "per_page_kb": "10", "target_kb": "0"})
    ok("pdf master color already-fits", r.status_code == 200 and r.headers.get("X-Engine") == "already-fits",
       f"engine={r.headers.get('X-Engine')}")

    # scan with off-spec low-DPI images must come out at exactly the requested DPI
    cin = io.BytesIO()
    _d = fitz.open()
    _p = _d.new_page(width=595, height=842)
    for px, rect in [(200, fitz.Rect(50, 50, 150, 150)),   # 144 dpi
                     (290, fitz.Rect(50, 300, 150, 400))]:  # ~209 dpi
        ib = io.BytesIO()
        Image.new("L", (px, px), 128).save(ib, "PNG")
        _p.insert_image(rect, stream=ib.getvalue())
    _d.save(cin)
    _d.close()
    r = post("/api/pdf/master", {"file": ("cin.pdf", cin.getvalue(), "application/pdf")},
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "300", "target_kb": "0"})
    doc = fitz.open(stream=r.content)
    lo, hi = image_dpi_range(doc)
    ok("pdf master cin exact 200 dpi", r.status_code == 200
       and lo is not None and abs(lo - 200) <= 1 and abs(hi - 200) <= 1,
       f"dpi={lo:.1f}-{hi:.1f}, engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/master",
             [("files", ("big.pdf", read("big.pdf"), "application/pdf")),
              ("files", ("tiny.pdf", read("tiny.pdf"), "application/pdf"))],
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "600", "target_kb": "0"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    ok("pdf master batch zip", r.status_code == 200 and "summary.txt" in names
       and len([n for n in names if n.endswith(".pdf")]) == 2
       and all("_master_" in n for n in names if n.endswith(".pdf"))
       and r.headers.get("X-Processed") == "2" and r.headers.get("X-Failed") == "0",
       f"processed={r.headers.get('X-Processed')}, failed={r.headers.get('X-Failed')}, files={names}")
    doc = fitz.open(stream=z.read([n for n in names if n.endswith(".pdf")][0]))
    ok("pdf master batch valid pdf", doc.page_count in (2, 5), f"pages={doc.page_count}")

    r = post("/api/pdf/master",
             [("files", ("tiny.pdf", read("tiny.pdf"), "application/pdf")),
              ("files", ("tiny.pdf", read("tiny.pdf"), "application/pdf"))],
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "600", "target_kb": "0"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    summary = z.read("summary.txt").decode()
    ok("pdf master batch converts small sig docs", r.status_code == 200
       and "already-fits" not in summary
       and summary.count("master-gray") == 2,
       f"summary={[l.split(',')[2] for l in summary.splitlines() if 'master-' in l]}")

    # locked PDFs must pass through unchanged — never a Ghostscript error page
    enc_buf = io.BytesIO()
    _d = fitz.open()
    _d.new_page(width=300, height=300)
    _d.save(enc_buf, encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="x", owner_pw="x")
    _d.close()
    r = post("/api/pdf/master",
             [("files", ("locked.pdf", enc_buf.getvalue(), "application/pdf")),
              ("files", ("tiny.pdf", read("tiny.pdf"), "application/pdf"))],
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "600", "target_kb": "0"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    summary = z.read("summary.txt").decode()
    ok("pdf master batch locked pdf passthrough", r.status_code == 200
       and "encrypted-passthrough" in summary and "ERROR" not in summary
       and r.headers.get("X-Failed") == "0",
       f"summary={[l for l in summary.splitlines() if 'master-' in l or 'ERROR' in l]}")
    locked_out = [n for n in z.namelist() if "locked" in n][0]
    with z.open(locked_out) as f:
        d2 = fitz.open(stream=f.read())
        ok("locked pdf passed through still encrypted", d2.needs_pass, "needs password")

    r = post("/api/pdf/bw", {"file": ("locked.pdf", enc_buf.getvalue(), "application/pdf")},
             {"mode": "grayscale", "dpi": "200"})
    d2 = fitz.open(stream=r.content)
    ok("pdf bw locked passthrough", r.status_code == 200
       and r.headers.get("X-Engine") == "passthrough-unreadable" and d2.needs_pass,
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/compress", {"file": ("locked.pdf", enc_buf.getvalue(), "application/pdf")},
             {"quality": "ebook"})
    d2 = fitz.open(stream=r.content)
    ok("compress locked passthrough", r.status_code == 200 and d2.needs_pass
       and r.headers.get("X-Engine") in ("passthrough-unreadable", "no-reduction"),
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/target-size", {"file": ("locked.pdf", enc_buf.getvalue(), "application/pdf")},
             {"target_kb": "1", "dpi": "200"})
    ok("target-size locked passthrough", r.status_code == 200
       and r.headers.get("X-Engine") in ("no-reduction", "already-fits"),
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/pdf/master",
             [("files", ("cut.pdf", read("big.pdf")[:2000], "application/pdf"))],
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "600", "target_kb": "0"})
    ok("pdf master corrupt input handled", r.status_code == 200
       and "200dpi" not in str(r.headers.get("X-Engine", "")),
       f"engine={r.headers.get('X-Engine')}")

    # images below the requested DPI must be re-rendered up to exactly that DPI
    _png = io.BytesIO()
    Image.new("L", (200, 200), 128).save(_png, "PNG")  # 200px on a 100pt page = 144 dpi
    _d = fitz.open()
    _p = _d.new_page(width=100, height=100)
    _p.insert_image(_p.rect, stream=_png.getvalue())
    _buf = io.BytesIO()
    _d.save(_buf)
    _d.close()
    r = post("/api/pdf/master", {"file": ("lowdpi.pdf", _buf.getvalue(), "application/pdf")},
             {"mode": "grayscale", "dpi": "200", "per_page_kb": "300", "target_kb": "0"})
    d2 = fitz.open(stream=r.content)
    p0 = d2[0]
    effs = []
    for xref, *_ in p0.get_images(full=True):
        rects = p0.get_image_rects(xref)
        if not rects:
            continue
        info = d2.extract_image(xref)
        effs.append(round(info["width"] / rects[0].width * 72))
    ok("pdf master upscales low dpi to requested", r.status_code == 200
       and effs and all(198 <= e <= 202 for e in effs),
       f"image dpis={effs}, engine={r.headers.get('X-Engine')}")

    print("== image tools ==")
    r = post("/api/image/compress", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"quality": "40", "fmt": "jpeg"})
    ok("img compress jpeg", r.status_code == 200 and r.headers["Content-Type"] == "image/jpeg",
       f"{r.headers.get('X-Original-Size')} -> {r.headers.get('X-Result-Size')}")
    ok("img compress shrank", int(r.headers["X-Result-Size"]) < int(r.headers["X-Original-Size"]))

    r = post("/api/image/compress", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"quality": "70", "fmt": "webp"})
    ok("img compress webp", r.status_code == 200 and r.headers["Content-Type"] == "image/webp")

    r = post("/api/image/compress", {"file": ("logo.png", read("logo.png"), "image/png")},
             {"quality": "80", "fmt": "png"})
    ok("img compress png", r.status_code == 200 and r.headers["Content-Type"] == "image/png")
    im = Image.open(io.BytesIO(r.content))
    ok("img compress png keeps alpha", im.mode == "P" and "transparency" in im.info)

    r = post("/api/image/target-size", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"target_kb": "50", "fmt": "jpeg", "dpi": "200", "dpi_mode": "force"})
    size = int(r.headers["X-Result-Size"])
    im = Image.open(io.BytesIO(r.content))
    ok("target-size force", r.status_code == 200 and size <= 50 * 1024 and size > 30 * 1024,
       f"{size / 1024:.0f}KB (target 50KB), engine={r.headers.get('X-Engine')}")
    ok("target-size force dpi tag", im.info.get("dpi", (0, 0))[0] == 200, f"dpi={im.info.get('dpi')}")

    # default (preserve) must not stamp a DPI on a file that has none
    r = post("/api/image/target-size", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"target_kb": "50", "fmt": "jpeg", "dpi": "200"})
    im = Image.open(io.BytesIO(r.content))
    ok("target-size preserve keeps missing dpi", im.info.get("dpi") is None,
       f"dpi={im.info.get('dpi')}")

    # preserve mode must keep a real source DPI (400) untouched
    _buf = io.BytesIO()
    Image.new("RGB", (256, 256), (60, 40, 120)).save(_buf, "JPEG", quality=90, dpi=(400, 400))
    r = post("/api/image/target-size", {"file": ("dpi400.jpg", _buf.getvalue(), "image/jpeg")},
             {"target_kb": "50", "fmt": "jpeg", "dpi": "200"})
    im = Image.open(io.BytesIO(r.content))
    ok("target-size preserve keeps 400 dpi", im.info.get("dpi", (0, 0))[0] == 400,
       f"dpi={im.info.get('dpi')}")

    r = post("/api/image/target-size", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"target_kb": "50", "fmt": "jpeg", "dpi_mode": "wat"})
    ok("target-size rejects bad dpi_mode", r.status_code == 400)

    r = post("/api/image/target-size", {"file": ("logo.png", read("logo.png"), "image/png")},
             {"target_kb": "1", "fmt": "png", "dpi": "200"})
    im = Image.open(io.BytesIO(r.content))
    ok("target-size png graceful", r.status_code == 200 and im.format == "PNG"
       and str(r.headers.get("X-Engine", "")).startswith(("png", "best-effort", "no-reduction")),
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/image/resize", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "percent", "value": "50"})
    im = Image.open(io.BytesIO(r.content))
    ok("resize percent", r.status_code == 200 and im.size == (960, 540), f"{im.size}")

    r = post("/api/image/resize", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "exact", "width": "800", "height": "600", "keep_aspect": "true"})
    im = Image.open(io.BytesIO(r.content))
    ok("resize exact keep-aspect", r.status_code == 200 and im.width == 800 and im.height == 450, f"{im.size}")

    r = post("/api/image/resize", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "exact", "width": "800", "height": "600", "keep_aspect": "false"})
    im = Image.open(io.BytesIO(r.content))
    ok("resize exact stretch", r.status_code == 200 and im.size == (800, 600), f"{im.size}")

    r = post("/api/image/crop", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"x": "0.1", "y": "0.1", "w": "0.5", "h": "0.4", "shape": "rect", "fill": "transparent"})
    im = Image.open(io.BytesIO(r.content))
    ok("crop rect", r.status_code == 200 and im.size == (round(1920 * 0.5), round(1080 * 0.4)),
       f"{im.size}")

    r = post("/api/image/crop", {"file": ("logo.png", read("logo.png"), "image/png")},
             {"x": "0", "y": "0", "w": "1", "h": "1", "shape": "circle", "fill": "transparent"})
    im = Image.open(io.BytesIO(r.content))
    corner = im.getpixel((0, 0))
    ok("crop circle transparent", r.status_code == 200 and im.mode == "RGBA" and corner[3] == 0,
       f"mode={im.mode}, corner alpha={corner[3]}")

    r = post("/api/image/crop", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"x": "0", "y": "0", "w": "1", "h": "1", "shape": "circle", "fill": "black"})
    im = Image.open(io.BytesIO(r.content))
    corner = im.getpixel((0, 0))
    ok("crop circle solid fill", r.status_code == 200 and corner == (0, 0, 0), f"corner={corner}")

    r = post("/api/image/dpi", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"dpi": "300", "mode": "metadata"})
    im = Image.open(io.BytesIO(r.content))
    ok("dpi metadata", r.status_code == 200 and im.info.get("dpi", (0, 0))[0] == 300 and im.size == (1920, 1080),
       f"dpi={im.info.get('dpi')}, size={im.size}")

    r = post("/api/image/dpi", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"dpi": "300", "mode": "resample"})
    im = Image.open(io.BytesIO(r.content))
    ok("dpi resample", r.status_code == 200 and im.size[0] > 1920, f"size={im.size}")

    r = post("/api/image/convert", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"fmt": "png", "quality": "90"})
    ok("convert jpg->png", r.status_code == 200 and r.headers["Content-Type"] == "image/png")

    r = post("/api/image/convert", {"file": ("logo.png", read("logo.png"), "image/png")},
             {"fmt": "webp", "quality": "70"})
    ok("convert png->webp", r.status_code == 200 and r.headers["Content-Type"] == "image/webp")
    im = Image.open(io.BytesIO(r.content))
    ok("convert keeps alpha", im.mode in ("RGBA", "LA"))

    r = post("/api/image/convert", {"file": ("photo.webp", read("photo.webp"), "image/webp")},
             {"fmt": "jpeg", "quality": "85"})
    ok("convert webp->jpg", r.status_code == 200 and r.headers["Content-Type"] == "image/jpeg")

    r = post("/api/image/rotate", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"angle": "90", "flip": "none"})
    im = Image.open(io.BytesIO(r.content))
    ok("rotate 90", r.status_code == 200 and im.size == (1080, 1920), f"{im.size}")

    r = post("/api/image/rotate", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"angle": "0", "flip": "h"})
    im = Image.open(io.BytesIO(r.content))
    ok("flip horizontal", r.status_code == 200 and im.size == (1920, 1080)
       and im.getpixel((0, 0)) != Image.open(io.BytesIO(read("photo.jpg"))).getpixel((0, 0)))

    r = post("/api/image/bw", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "grayscale", "fmt": "jpeg"})
    im = Image.open(io.BytesIO(r.content))
    px = im.getpixel((100, 100))
    ok("img bw grayscale", r.status_code == 200 and isinstance(px, int) and 0 <= px <= 255, f"px={px}")

    r = post("/api/image/bw", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "true-bw", "threshold": "200", "fmt": "jpeg"})
    im = Image.open(io.BytesIO(r.content))
    px = im.getpixel((5, 5))
    ok("img true bw", r.status_code == 200 and px in (0, 255), f"px={px}")

    r = post("/api/image/size-cm", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"width_cm": "3.5", "height_cm": "2.5", "dpi": "200", "keep_aspect": "false", "fmt": "jpeg"})
    im = Image.open(io.BytesIO(r.content))
    ok("size-cm exact (3.5x2.5cm @200dpi)", r.status_code == 200 and im.size == (276, 197)
       and im.info.get("dpi", (0, 0))[0] == 200, f"{im.size} dpi={im.info.get('dpi')}")

    r = post("/api/image/size-cm", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"width_cm": "3.5", "height_cm": "2.5", "dpi": "200", "keep_aspect": "true", "fmt": "jpeg"})
    im = Image.open(io.BytesIO(r.content))
    ok("size-cm keep aspect", r.status_code == 200 and im.size == (276, 155), f"{im.size}")

    r = post("/api/image/master", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "grayscale", "dpi": "200", "threshold": "128", "target_kb": "20", "fmt": "jpeg"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    im = Image.open(io.BytesIO(r.content))
    px = im.getpixel((50, 50))
    ok("img master gray fits", r.status_code == 200 and sz <= 20 * 1024
       and im.info.get("dpi", (0, 0))[0] == 200 and isinstance(px, int),
       f"{sz / 1024:.1f}KB, dpi={im.info.get('dpi')}, engine={r.headers.get('X-Engine')}")

    r = post("/api/image/master", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "true-bw", "dpi": "200", "threshold": "200", "target_kb": "50", "fmt": "jpeg"})
    im = Image.open(io.BytesIO(r.content))
    px = im.getpixel((5, 5))
    ok("img master true-bw", r.status_code == 200 and px in (0, 255), f"px={px}, engine={r.headers.get('X-Engine')}")

    r = post("/api/image/master", {"file": ("photo.jpg", read("photo.jpg"), "image/jpeg")},
             {"mode": "color", "dpi": "200", "target_kb": "50", "fmt": "jpeg"})
    sz = int(r.headers.get("X-Result-Size") or len(r.content))
    im = Image.open(io.BytesIO(r.content))
    px = im.getpixel((50, 50))
    ok("img master color fits", r.status_code == 200 and sz <= 50 * 1024
       and im.info.get("dpi", (0, 0))[0] == 200 and isinstance(px, tuple) and len(px) == 3,
       f"{sz / 1024:.1f}KB, engine={r.headers.get('X-Engine')}")

    r = post("/api/image/master", {"file": ("logo.png", read("logo.png"), "image/png")},
             {"mode": "color", "dpi": "200", "target_kb": "1", "fmt": "png"})
    im = Image.open(io.BytesIO(r.content))
    ok("img master png graceful", r.status_code == 200 and im.format == "PNG"
       and str(r.headers.get("X-Engine", "")).startswith("master-"),
       f"engine={r.headers.get('X-Engine')}")

    r = post("/api/image/master",
             [("files", ("photo.jpg", read("photo.jpg"), "image/jpeg")),
              ("files", ("photo.webp", read("photo.webp"), "image/webp"))],
             {"mode": "grayscale", "dpi": "200", "target_kb": "20", "fmt": "jpeg"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    ok("img master batch zip", r.status_code == 200 and "summary.txt" in names
       and len([n for n in names if n.endswith(".jpg")]) == 2
       and r.headers.get("X-Processed") == "2" and r.headers.get("X-Failed") == "0",
       f"processed={r.headers.get('X-Processed')}, failed={r.headers.get('X-Failed')}, files={names}")
    im = Image.open(io.BytesIO(z.read([n for n in names if n.endswith(".jpg")][0])))
    ok("img master batch dpi", im.info.get("dpi", (0, 0))[0] == 200, f"dpi={im.info.get('dpi')}")
    summary = z.read("summary.txt").decode()
    ok("img master batch summary", "master-" in summary and "input, result_bytes, engine" in summary,
       f"summary lines={len(summary.splitlines())}")


    r = post("/api/image/master",
             [("files", ("photo.jpg", read("photo.jpg"), "image/jpeg")),
              ("files", ("broken.jpg", b"not an image at all", "image/jpeg"))],
             {"mode": "grayscale", "dpi": "200", "target_kb": "20", "fmt": "jpeg"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    summary = z.read("summary.txt").decode()
    ok("img master batch unreadable kept", r.status_code == 200
       and r.headers.get("X-Failed") == "1"
       and any(n.endswith("broken.jpg") for n in names)
       and "ERROR" in summary and "original included" in summary,
       f"failed={r.headers.get('X-Failed')}, files={names}")


if __name__ == "__main__":
    main()
