"""CIN-like scan: images at 288/209/144 dpi -> master dpi 200 -> all images ~200?"""
import io
import sys
from pathlib import Path
sys.path.insert(0, r"F:\NSA\Mystic\PDFTOOLS")
import requests
import pymupdf as fitz
from PIL import Image

URL = "http://127.0.0.1:8766"

doc = fitz.open()
page = doc.new_page(width=595, height=842)
specs = [
    (400, fitz.Rect(50, 50, 250, 250)),
    (290, fitz.Rect(50, 300, 150, 400)),
    (200, fitz.Rect(50, 450, 150, 550)),
]
for px, rect in specs:
    buf = io.BytesIO()
    Image.new("L", (px, px), 128).save(buf, "PNG")
    page.insert_image(rect, stream=buf.getvalue())
buf = io.BytesIO()
doc.save(buf)
doc.close()

r = requests.post(URL + "/api/pdf/master",
    files={"file": ("001_CIN.pdf", buf.getvalue(), "application/pdf")},
    data={"mode": "grayscale", "dpi": "200", "threshold": "128", "per_page_kb": "300", "target_kb": "0"},
    timeout=120)
print("status:", r.status_code, "engine:", r.headers.get("X-Engine"))
d2 = fitz.open(stream=r.content)
p0 = d2[0]
print("output size:", len(r.content), "bytes")
for xref, *_ in p0.get_images(full=True):
    rects = p0.get_image_rects(xref)
    if not rects:
        continue
    info = d2.extract_image(xref)
    w = info["width"]
    h = info["height"]
    ext = info["ext"]
    eff = w / rects[0].width * 72
    print("  image " + str(w) + "x" + str(h) + "px on " + str(round(rects[0].width)) + "x" + str(round(rects[0].height)) + "pt -> " + str(round(eff, 1)) + " DPI (" + ext + ")")
