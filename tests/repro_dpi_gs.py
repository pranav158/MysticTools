import subprocess
from pathlib import Path
import pymupdf as fitz
from PIL import Image

WORK = Path(r"F:\NSA\Mystic\PDFTOOLS") / "tests" / "dpi_test"
WORK.mkdir(exist_ok=True)
GS = r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe"

def build(png):
    doc = fitz.open()
    page = doc.new_page(width=100, height=600)
    specs = [
        ("d720", 1000, 0),
        ("d288", 400, 100),
        ("d250", 347, 200),
        ("d209", 290, 300),
        ("d144", 200, 400),
    ]
    for name, px, y in specs:
        im = Image.new("L", (px, px), 128)
        if png:
            im.save(WORK / (name + ".png"), "PNG")
            page.insert_image(fitz.Rect(0, y, 100, y + 100), filename=str(WORK / (name + ".png")))
        else:
            im.save(WORK / (name + ".jpg"), "JPEG", quality=90)
            page.insert_image(fitz.Rect(0, y, 100, y + 100), filename=str(WORK / (name + ".jpg")))
    doc.save(WORK / ("src_" + ("png" if png else "jpg") + ".pdf"))
    doc.close()

def probe(src, out_name, thr, extra):
    out = WORK / out_name
    args = [GS, "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.5", "-dPDFSETTINGS=/ebook",
            "-dEmbedAllFonts=true", "-dSubsetFonts=true",
            "-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray",
            "-dDownsampleColorImages=true", f"-dColorImageResolution={thr}",
            "-dDownsampleGrayImages=true", f"-dGrayImageResolution={thr}",
            "-dDownsampleMonoImages=true", f"-dMonoImageResolution={thr}"]
    args += extra
    args += [f"-sOutputFile={out}", str(src)]
    r = subprocess.run(args, capture_output=True, timeout=90)
    print(out_name, "rc:", r.returncode)
    d = fitz.open(str(out))
    p = d[0]
    rows = []
    for xref, *_ in p.get_images(full=True):
        rects = p.get_image_rects(xref)
        if not rects:
            continue
        y = round(rects[0].y0)
        info = d.extract_image(xref)
        iw = info["width"]
        dpi = round(iw / rects[0].width * 72)
        rows.append((y, iw, dpi, info["ext"]))
    rows.sort()
    for y, iw, dpi, ext in rows:
        print(f"   y={y:3d}  {iw}x{iw}px  -> {dpi} DPI  ({ext})")
    d.close()
    print()

build(png=True)
build(png=False)

for tag, src in [("PNG src", WORK / "src_png.pdf"), ("JPG src", WORK / "src_jpg.pdf")]:
    print("=" * 60)
    print(tag)
    print("=" * 60)
    probe(src, "p1.pdf", 200, [])
    probe(src, "p2.pdf", 200, ["-dColorImageDownsampleType=/Bicubic", "-dGrayImageDownsampleType=/Bicubic"])
    probe(src, "p3.pdf", 150, [])
