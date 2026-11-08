"""Turns the raw generated artwork (_art/raw/<id>.png, from tools/art/gen.mjs) into the files the game ships.

    python3 tools/art/process.py            # everything whose raw image exists
    python3 tools/art/process.py logo ranks # some groups: logo, icons, menu, deck, ranks

Groups and outputs:
  logo   assets/logo.webp (1000x230, transparent), assets/deck/logo.png
  icons  assets/icon/*.png and favicon.ico, assets/deck/icone.png       (from emblem)
  menu   assets/menu-bg.webp and assets/menu-depth.webp, assets/apercu.jpg (from keyart, + logo for the preview)
  deck   assets/deck/capsule.jpg, hero.jpg, jaquette.jpg                  (from keyart + logo)
  ranks  assets/ranks.webp: the 11 rank insignia (rank01..rank11) in one sprite sheet of 256 px cells
  crests assets/crests.webp: victory and defeat crests of the end-of-match announcement (two 512 px cells)
  maps   assets/maps/<id>.webp: map cards repainted from their in-game screenshots (map-<id>)
Needs Pillow, numpy and OpenCV (cv2: the soldier cut-out for the depth map)."""
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RAW = os.path.join(ROOT, '_art', 'raw')
A = lambda *p: os.path.join(ROOT, 'assets', *p)


def raw(name):
    return Image.open(os.path.join(RAW, name + '.png'))


def has(*names):
    return all(os.path.exists(os.path.join(RAW, n + '.png')) for n in names)


def alpha_bbox(im, thr=24):
    a = np.array(im.getchannel('A')) > thr
    ys, xs = np.nonzero(a)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


def fit(im, w, h, pad=0.0):
    """Scale `im` (RGBA) to fit inside w x h (minus a relative margin), centered on a transparent canvas"""
    im = im.copy(); im.thumbnail((int(w * (1 - pad)), int(h * (1 - pad))), Image.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); out.paste(im, ((w - im.width) // 2, (h - im.height) // 2), im)
    return out


def cover(im, w, h, fx=0.5, fy=0.5):
    """Scale to cover w x h and crop around the focus point (fx, fy, relative)"""
    s = max(w / im.width, h / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = int(min(max(im.width * fx - w / 2, 0), im.width - w)); y = int(min(max(im.height * fy - h / 2, 0), im.height - h))
    return im.crop((x, y, x + w, y + h))


def save(im, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path, **kw)
    print(os.path.relpath(path, ROOT), im.size, os.path.getsize(path) // 1024, 'KB')


def logo_cut():
    lg = raw('logo').convert('RGBA')
    return lg.crop(alpha_bbox(lg))


def do_logo():
    lg = logo_cut()
    save(fit(lg, 1000, 230), A('logo.webp'), quality=92, method=6)
    save(fit(lg, 1000, 230), A('deck', 'logo.png'), optimize=True)


def do_icons():
    em = raw('emblem').convert('RGB')
    s = min(em.size); em = em.crop(((em.width - s) // 2, (em.height - s) // 2, (em.width + s) // 2, (em.height + s) // 2))
    sq = lambda n: em.resize((n, n), Image.LANCZOS)
    save(sq(180), A('icon', 'apple-touch-icon.png'), optimize=True)
    save(sq(64), A('icon', 'favicon-64.png'), optimize=True)
    save(sq(96), A('icon', 'favicon-96.png'), optimize=True)
    save(sq(192), A('icon', 'icon-192.png'), optimize=True)
    save(sq(512), A('icon', 'icon-512.png'), optimize=True)
    save(sq(256).convert('RGBA'), A('deck', 'icone.png'), optimize=True)
    # maskable: the launcher may cut everything outside the central 80 % circle, so the crest shrinks onto a matching backdrop
    for n in (192, 512):
        bg = em.resize((n, n), Image.LANCZOS).filter(ImageFilter.GaussianBlur(n / 10))
        bg = ImageEnhance.Brightness(bg).enhance(0.55)
        inner = em.resize((int(n * 0.78), int(n * 0.78)), Image.LANCZOS)
        bg.paste(inner, ((n - inner.width) // 2, (n - inner.height) // 2))
        save(bg, A('icon', f'maskable-{n}.png'), optimize=True)
    sq(48).save(A('icon', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('assets/icon/favicon.ico')


def soldier_mask(img):
    """Cut-out of the soldier for the depth map: GrabCut started from a box around the figure (keyart prompt: center at ~72 % width)"""
    import cv2
    a = np.array(img.convert('RGB'))[:, :, ::-1].copy(); h, w = a.shape[:2]
    rect = (int(w * 0.58), int(h * 0.11), int(w * 0.24), int(h * 0.72))
    mask = np.zeros((h, w), np.uint8); bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(a, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    m = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)  # keep the largest blob (the soldier)
    if n > 1: m = (lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    return m


def depth_map(img):
    """White = near, black = far (src/09w-fond.js reads it at half size, dilated and blurred). The soldier is the fixed plane;
    the sky is far, the rubble gets nearer toward the bottom of the frame."""
    import cv2
    w, h = img.size; y = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    lum = np.array(img.convert('L'), np.float32) / 255
    sky = 0.04 + 0.22 * np.clip((y - 0.25) / 0.45, 0, 1)
    ground_start = 0.70 + 0.04 * np.sin(np.linspace(0, 6, w))[None, :]
    ground = np.clip((y - ground_start) / 0.30, 0, 1)
    dark = np.clip((0.45 - lum) / 0.45, 0, 1)  # rubble is dark against the glowing haze
    d = np.maximum(sky, (0.45 + 0.55 * ground) * np.clip(ground * 3, 0, 1) * (0.6 + 0.4 * dark))
    m = soldier_mask(img).astype(np.float32)
    m = cv2.GaussianBlur(cv2.dilate(m, np.ones((9, 9), np.uint8)), (0, 0), 3)
    d = np.maximum(d * (1 - m), 0.82 * m)
    d = cv2.GaussianBlur(d, (0, 0), 6)
    return Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8)).resize((w // 2, h // 2), Image.LANCZOS)


def do_menu():
    k = raw('keyart').convert('RGB')
    save(k, A('menu-bg.webp'), quality=86, method=6)
    save(depth_map(k).convert('RGB'), A('menu-depth.webp'), quality=90, method=6)
    if has('logo'):
        pv = cover(k, 1200, 630, 0.6, 0.5).convert('RGBA')
        sh = Image.new('RGBA', pv.size, (0, 0, 0, 0)); g = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
        grad = np.zeros((630, 1200, 4), np.uint8); grad[..., 3] = (np.clip(1 - np.linspace(0, 1, 1200) * 1.6, 0, 1) * 170).astype(np.uint8)[None, :]
        pv = Image.alpha_composite(pv, Image.fromarray(grad))
        lg = fit(logo_cut(), 640, 160)
        pv.alpha_composite(lg, (40, 40))
        save(pv.convert('RGB'), A('apercu.jpg'), quality=88, optimize=True)


def do_deck():
    k = raw('keyart').convert('RGB'); lg = logo_cut()
    def with_logo(img, lw, lh, at):
        img = img.convert('RGBA'); img.alpha_composite(fit(lg, lw, lh), at); return img.convert('RGB')
    cap = cover(k, 920, 430, 0.62, 0.45)
    save(with_logo(cap, 560, 140, (30, 270)), A('deck', 'capsule.jpg'), quality=88)
    save(cover(k, 1920, 620, 0.55, 0.42), A('deck', 'hero.jpg'), quality=86)
    jq = cover(k, 600, 900, 0.68, 0.5)
    save(with_logo(jq, 540, 140, (30, 720)), A('deck', 'jaquette.jpg'), quality=88)


def do_ranks():
    """One sprite sheet, 11 cells of 256 px side by side (rank01 ... rank11): one file to ship, CSS picks the cell"""
    n = 11; cell = 256
    sheet = Image.new('RGBA', (cell * n, cell), (0, 0, 0, 0))
    for i in range(1, n + 1):
        k = f'rank{i:02d}'
        if not has(k): continue
        im = raw(k).convert('RGBA'); im = im.crop(alpha_bbox(im))
        sheet.alpha_composite(fit(im, cell, cell, pad=0.02), ((i - 1) * cell, 0))
    save(sheet, A('ranks.webp'), quality=88, method=6)


def do_crests():
    """End-of-match crests (victory, defeat): one sprite sheet of two 512 px cells"""
    cell = 512; sheet = Image.new('RGBA', (cell * 2, cell), (0, 0, 0, 0))
    for i, k in enumerate(('crest-victory', 'crest-defeat')):
        im = raw(k).convert('RGBA'); im = im.crop(alpha_bbox(im))
        sheet.alpha_composite(fit(im, cell, cell, pad=0.02), (i * cell, 0))
    save(sheet, A('crests.webp'), quality=88, method=6)


def do_maps():
    """Map cards: the repainted key art over the in-game screenshot it was made from (assets/maps/<id>.webp, 1920x1080)"""
    import glob
    for f in sorted(glob.glob(os.path.join(RAW, 'map-*.png'))):
        k = os.path.basename(f)[4:-4]
        save(cover(Image.open(f).convert('RGB'), 1920, 1080), A('maps', k + '.webp'), quality=84, method=6)


GROUPS = {'logo': (do_logo, ['logo']), 'icons': (do_icons, ['emblem']), 'menu': (do_menu, ['keyart']),
          'deck': (do_deck, ['keyart', 'logo']), 'ranks': (do_ranks, []), 'crests': (do_crests, ['crest-victory', 'crest-defeat']), 'maps': (do_maps, [])}
if __name__ == '__main__':
    for g in sys.argv[1:] or GROUPS:
        fn, need = GROUPS[g]
        if has(*need): fn()
        else: print(g, ': raw images missing', need)
