"""Images for the Steam shortcut (Steam Deck version, see README "Steam Deck"): taken from the menu illustration (assets/menu-bg.webp,
1916 x 821, the soldier at 72% of the width) and the logo (assets/logo.webp), written to assets/deck/ (build.py copies them to dist/deck/,
from where the installer downloads them to Steam's grid folder).
  cover.jpg  600 x 900   vertical library capsule (logo at the bottom, on the dark rocks)
  capsule.jpg   920 x 430   horizontal capsule (logo on the left, in the dark sky)
  hero.jpg      1920 x 620  banner of the game page (no logo: Steam puts its own on top)
  logo.png      1000 x 230  cut-out logo, placed by Steam on the banner
  icon.png     256 x 256   shortcut icon
Rerun after touching up the illustration or the logo: python3 tools/dev/deck_art.py (from the root, Pillow)."""
import os
from PIL import Image, ImageDraw

OUT = "assets/deck"
os.makedirs(OUT, exist_ok=True)
bg = Image.open("assets/menu-bg.webp").convert("RGB")
logo = Image.open("assets/logo.webp").convert("RGBA")
W, H = bg.size
SOLDIER = 0.72 * W  # x position of the soldier in the illustration


def shade(img, box, top_a, bottom_a):
    """Vertical dark gradient over a strip (logo legibility)"""
    x0, y0, x1, y1 = box
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        d.line([(x0, y), (x1, y)], fill=(4, 5, 4, int(top_a + (bottom_a - top_a) * t)))
    return Image.alpha_composite(img.convert("RGBA"), ov)


def put_logo(img, width, cx, cy):
    lg = logo.resize((width, round(width * logo.height / logo.width)), Image.LANCZOS)
    img.alpha_composite(lg, (round(cx - lg.width / 2), round(cy - lg.height / 2)))


def crop(aspect, cx, cy=None):
    """Largest frame with aspect ratio aspect (width / height) centered as well as possible on (cx, cy)"""
    if W / H > aspect:
        h = H; w = round(H * aspect)
    else:
        w = W; h = round(W / aspect)
    x0 = min(max(0, round(cx - w / 2)), W - w)
    y0 = min(max(0, round((cy if cy is not None else H / 2) - h / 2)), H - h)
    return bg.crop((x0, y0, x0 + w, y0 + h))


# cover: the soldier full-length, logo at the bottom
j = crop(600 / 900, SOLDIER).resize((600, 900), Image.LANCZOS)
j = shade(j, (0, 640, 600, 900), 0, 210)
put_logo(j, 500, 300, 812)
j.convert("RGB").save(f"{OUT}/cover.jpg", quality=90)

# horizontal capsule: frame pushed to the right (soldier at about 70%), logo in the dark sky on the left
c = crop(920 / 430, W).resize((920, 430), Image.LANCZOS)
c = Image.alpha_composite(c.convert("RGBA"), Image.new("RGBA", c.size, (0, 0, 0, 0)))
put_logo(c, 400, 235, 200)
c.convert("RGB").save(f"{OUT}/capsule.jpg", quality=90)

# banner: panorama, from the soldier's head to knees
h = crop(1920 / 620, W / 2, 0.52 * H).resize((1920, 620), Image.LANCZOS)
h.save(f"{OUT}/hero.jpg", quality=90)

logo.save(f"{OUT}/logo.png", optimize=True)
Image.open("assets/icon/icon-512.png").convert("RGBA").resize((256, 256), Image.LANCZOS).save(f"{OUT}/icon.png", optimize=True)
for f in sorted(os.listdir(OUT)):
    if f.endswith((".jpg", ".png")):
        print(f, Image.open(f"{OUT}/{f}").size, os.path.getsize(f"{OUT}/{f}") // 1024, "KB")
