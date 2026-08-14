"""Generate sample files used by the endpoint test suite."""
import os
import random
import sys

from PIL import Image, ImageDraw

try:
    import pymupdf as fitz
except ImportError:
    import fitz

OUT = os.path.join(os.path.dirname(__file__), "samples")
os.makedirs(OUT, exist_ok=True)


def make_photo(path, w=1920, h=1080, q=95):
    rnd = random.Random(42)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(0, w, 4):
            r = int(90 + 120 * (x / w) + rnd.randint(-18, 18))
            g = int(60 + 90 * (y / h) + rnd.randint(-18, 18))
            b = int(180 - 80 * (x / w) + rnd.randint(-18, 18))
            for k in range(4):
                if x + k < w:
                    px[x + k, y] = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
    img.save(path, "JPEG", quality=q)
    return os.path.getsize(path)


def make_logo(path, size=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((64, 64, size - 64, size - 64), fill=(167, 139, 250, 255))
    d.polygon(
        [(size // 2, 140), (size // 2 + 90, size // 2), (size // 2, size - 140), (size // 2 - 90, size // 2)],
        fill=(255, 255, 255, 255),
    )
    img.save(path, "PNG")
    return os.path.getsize(path)


def page_background(w=1600, h=2200, seed=1):
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(0, h, 6):
        for x in range(0, w, 6):
            r = rnd.randint(20, 200)
            g = rnd.randint(20, 200)
            b = rnd.randint(20, 200)
            for dx in range(6):
                for dy in range(6):
                    if x + dx < w and y + dy < h:
                        px[x + dx, y + dy] = (r, g, b)
    return img


def make_pdf(path, pages=5, dpi=144):
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        bg = page_background(seed=100 + i)
        bg_path = os.path.join(OUT, f"_bg_{i}.jpg")
        bg.save(bg_path, "JPEG", quality=90)
        page.insert_image(fitz.Rect(0, 0, 595, 842), filename=bg_path)
        page.insert_text((60, 60), f"MysticTools sample document - page {i + 1}",
                         fontsize=16, color=(1, 0, 0))
        for k in range(20):
            page.draw_rect(fitz.Rect(60 + k * 20, 120, 100 + k * 20, 140),
                           color=(0.1, 0.2, 0.9), width=1)
        if i > 0:
            page.insert_text((60, 700), "More content on every page to inflate the size.",
                             fontsize=11)
        os.remove(bg_path)
    doc.save(path, garbage=3, deflate=True)
    doc.close()
    return os.path.getsize(path)


def make_small_pdf(path):
    doc = fitz.open()
    for i in range(2):
        page = doc.new_page(width=400, height=400)
        page.insert_text((50, 200), f"Small page {i + 1}", fontsize=20)
    doc.save(path)
    doc.close()
    return os.path.getsize(path)


def main():
    results = {}
    results["photo.jpg"] = make_photo(os.path.join(OUT, "photo.jpg"))
    results["logo.png"] = make_logo(os.path.join(OUT, "logo.png"))
    results["big.pdf"] = make_pdf(os.path.join(OUT, "big.pdf"))
    results["tiny.pdf"] = make_small_pdf(os.path.join(OUT, "tiny.pdf"))

    from PIL import Image as I
    I.open(os.path.join(OUT, "photo.jpg")).save(os.path.join(OUT, "photo.webp"), "WEBP", quality=80)

    results["photo.webp"] = os.path.getsize(os.path.join(OUT, "photo.webp"))
    for name, size in results.items():
        print(f"  {name:12s} {size:>10,} bytes")
    print(f"\n  total: {sum(results.values()):,} bytes -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
