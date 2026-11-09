#!/usr/bin/env python3
"""Preview image for shared links (Discord, WhatsApp, social networks): python3 tools/dev/preview.py
Composes assets/preview.jpg (1200 x 630, the preview format) from the menu background (assets/menu-bg.webp) and the logo
(assets/logo.webp): the background covers the image, a dark gradient on the left carries the logo. No text (the image does not need
translating). build.py copies it into dist/icons/ with a fingerprint and announces it in the page's og:image tags.
Rerun after touching up the background or the logo."""
import os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W, H = 1200, 630
bg = Image.open(os.path.join(ROOT, 'assets/menu-bg.webp')).convert('RGB')
s = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
x0, y0 = (bg.width - W) // 2, (bg.height - H) // 2
img = bg.crop((x0, y0, x0 + W, y0 + H))
# dark gradient from the left to the middle, so the logo reads
shade = Image.new('L', (W, H), 0); d = ImageDraw.Draw(shade)
for x in range(W):
    d.line([(x, 0), (x, H)], fill=round(215 * max(0.0, 1 - x / (W * 0.62)) ** 1.4))
img = Image.composite(Image.new('RGB', (W, H), (8, 10, 7)), img, shade)
logo = Image.open(os.path.join(ROOT, 'assets/logo.webp')).convert('RGBA')
lw = 600; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
img.paste(logo, (64, (H - logo.height) // 2 - 10), logo)
img.save(os.path.join(ROOT, 'assets/preview.jpg'), quality=86, optimize=True, progressive=True)
print('assets/preview.jpg', os.path.getsize(os.path.join(ROOT, 'assets/preview.jpg')) // 1024, 'KB')
