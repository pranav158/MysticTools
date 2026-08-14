import subprocess
from pathlib import Path
import pymupdf as fitz
from PIL import Image

WORK = Path(r"F:\NSA\Mystic\PDFTOOLS") / "tests" / "dpi_test"
GS = r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe"
src = WORK / "src_png.pdf"

def probe(out_name, extra):
    out = WORK / out_name
    args = [GS, "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.5", "-dPDFSETTINGS=/ebook",
            "-dEmbedAllFonts=true", "-dSubsetFonts=true",
            "-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray",
            "-dDownsampleColorImages=true", "-dColorImageResolution=200",
            "-dDownsampleGrayImages=true", "-dGrayImageResolution=200",
            "-dDownsampleMonoImages=true", "-dMonoImageResolution=200",
            "-dAutoFilterColorImages=false", "-dColorImageFilter=/DCTEncode"]
    args += extra
    args += [f"-sOutputFile={out}", str(src)]
    r = subprocess.run(args, capture_output=True, timeout=90)
    print(out_name, "rc:", r.returncode, r.stderr.decode(errors="replace")[:200])
    d = fitz.open(str(out))
    p = d[0]
    rows = []
    for xref, *_ in p.get_images(full=True):
        rects = p.get_image_rects(xref)
        if not rects:
            continue
        y = round(rects[0].y0)
        info = d.extract_image(xref)
        dpi = round(info["width"] / rects[0].width * 72)
        rows.append((y, info["width"], dpi))
    rows.sort()
    for y, iw, dpi in rows:
        print(f"   y={y:3d}  {iw}x{iw}px  -> {dpi} DPI")
    d.close()
    print()

probe("u1.pdf", ["-dUpSampleImages=true"])
probe("u2.pdf", ["-dUpSampleImages=true", "-dColorImageUpsampleType=/Bicubic", "-dGrayImageUpsampleType=/Bicubic"])
