"""Turns the raw generated artwork (_art/raw/<id>.png, from tools/art/gen.mjs) into the files the game ships.

    python3 tools/art/process.py            # everything whose raw image exists
    python3 tools/art/process.py logo ranks # some groups: logo, icons, menu, deck, ranks

Groups and outputs:
  logo   assets/logo.webp (1000x230, transparent), assets/deck/logo.png
  icons  assets/icon/*.png and favicon.ico, assets/deck/icon.png       (from emblem)
  menu   assets/menu-bg.webp and assets/menu-depth.webp, assets/preview.jpg (from keyart, + logo for the preview)
  deck   assets/deck/capsule.jpg, hero.jpg, cover.jpg                  (from keyart + logo)
  ranks  assets/ranks.webp: the 11 rank insignia (rank01..rank11) in one sprite sheet of 256 px cells
  crests assets/crests.webp: victory and defeat crests of the end-of-match announcement (two 512 px cells)
  maps   assets/maps/<id>.webp: map cards repainted from their in-game screenshots (map-<id>)
  leaves assets/fx/opLeaves.webp: Selva's foliage atlas (map id outpost) (2048 x 2048, alpha) from the eight leaf-* cut-outs, cells
         in LEAF_CELLS (the same table as OPJ_LEAF in src/02ypb-outpost-jungle.js)
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
    save(sq(256).convert('RGBA'), A('deck', 'icon.png'), optimize=True)
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
    """White = near, black = far (src/09w-background.js reads it at half size, dilated and blurred). The soldier is the fixed plane;
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
        save(pv.convert('RGB'), A('preview.jpg'), quality=88, optimize=True)


def do_deck():
    k = raw('keyart').convert('RGB'); lg = logo_cut()
    def with_logo(img, lw, lh, at):
        img = img.convert('RGBA'); img.alpha_composite(fit(lg, lw, lh), at); return img.convert('RGB')
    cap = cover(k, 920, 430, 0.62, 0.45)
    save(with_logo(cap, 560, 140, (30, 270)), A('deck', 'capsule.jpg'), quality=88)
    save(cover(k, 1920, 620, 0.55, 0.42), A('deck', 'hero.jpg'), quality=86)
    jq = cover(k, 600, 900, 0.68, 0.5)
    save(with_logo(jq, 540, 140, (30, 720)), A('deck', 'cover.jpg'), quality=88)


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


# Foliage atlas cells [x, y, w, h] in px of the 2048 atlas, and how each sprite sits in its cell: base at the bottom centre (upright
# leaves and clumps), hung from the top (vine), base on the left with the rachis on the middle line (palm fronds)
LEAF_CELLS = {
    'leaf-clump-a': ((0, 0, 1024, 1024), 'base'), 'leaf-clump-b': ((1024, 0, 1024, 1024), 'base-flip'),
    'leaf-palm': ((0, 1024, 1024, 512), 'frond'), 'palm2': ((1024, 1536, 1024, 512), 'frond-flip'),
    'leaf-ear': ((1024, 1024, 512, 512), 'base'), 'leaf-fan': ((1536, 1024, 512, 512), 'base'),
    'leaf-banana': ((0, 1536, 320, 512), 'base'), 'leaf-fern': ((320, 1536, 384, 512), 'base'), 'leaf-vine': ((704, 1536, 128, 512), 'top'),
}


def straighten_frond(im):
    """A side-view palm frond (base on the left) bent back onto a straight rachis along the middle row: each column is shifted so the
    alpha-weighted centre line (a smooth quadratic fit) lands on the image's middle"""
    a = np.array(im).astype(np.float32); al = a[:, :, 3] / 255.0; h, w = al.shape
    xs = np.arange(w); ys = np.arange(h)[:, None]; m = al.sum(0)
    ok = m > 4; cy = (al * ys).sum(0)[ok] / m[ok]
    c = np.polyfit(xs[ok], cy, 2); line = np.polyval(c, xs)
    out = np.zeros_like(a)
    for x in range(w):
        d = int(round(h / 2 - line[x])); col = a[:, x]
        if d >= 0: out[d:, x] = col[:h - d]
        else: out[:h + d, x] = col[-d:]
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def bleed(im, it=6):
    """Fill the colour of transparent pixels from their opaque neighbours (no dark fringe in the mipmaps of a cut-out)"""
    import cv2
    a = np.array(im).astype(np.float32); al = a[:, :, 3] / 255.0; rgb = a[:, :, :3]
    fill = rgb.copy(); done = al > 0.85; k = 2.0  # (the semi-transparent rim takes its colour from inside the leaf: no pale halo)
    for _ in range(it):
        acc = cv2.GaussianBlur(rgb * al[:, :, None], (0, 0), k); ws = cv2.GaussianBlur(al, (0, 0), k)
        est = acc / np.maximum(ws, 1e-4)[:, :, None]; new = (~done) & (ws > 1e-3)
        fill[new] = est[new]; done = done | new; k *= 2
    return Image.fromarray(np.concatenate([np.clip(fill, 0, 255), a[:, :, 3:4]], 2).astype(np.uint8), 'RGBA')


def do_leaves():
    """Selva's foliage atlas (map id outpost): each cut-out cropped to its alpha, fitted to its cell as LEAF_CELLS says"""
    sheet = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0))
    for k, ((x, y, w, h), how) in LEAF_CELLS.items():
        im = raw('leaf-palm' if k == 'palm2' else k).convert('RGBA')
        if how.startswith('frond'):
            im = im.crop(alpha_bbox(im)); im = straighten_frond(im); im = im.crop(alpha_bbox(im, 40))
            hh = max(im.height, 1); pad = Image.new('RGBA', (im.width, hh), (0, 0, 0, 0)); pad.paste(im, (0, 0)); im = pad
            if how.endswith('flip'):
                im = im.transpose(Image.FLIP_TOP_BOTTOM); r, g, b, al = im.split()
                im = Image.merge('RGBA', (r.point(lambda v: min(255, int(v * 1.08))), g, b.point(lambda v: int(v * 0.85)), al))
            im = im.resize((w, h), Image.LANCZOS); sheet.alpha_composite(im, (x, y)); continue
        if how == 'base-flip': im = im.transpose(Image.FLIP_TOP_BOTTOM)
        im = im.crop(alpha_bbox(im)); s = min(w / im.width, h / im.height); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        ox = x + (w - im.width) // 2; oy = y if how == 'top' else y + h - im.height
        sheet.alpha_composite(im, (ox, oy))
    # toward the sheets' deep greens: hue 8 degrees from yellow toward green, 40 % less saturated, 13 % darker (the alpha untouched)
    import cv2
    a = np.array(sheet); hsv = cv2.cvtColor(np.ascontiguousarray(a[:, :, :3]), cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 0] = np.clip(hsv[:, :, 0] + 4, 0, 179); hsv[:, :, 1] *= 0.6; hsv[:, :, 2] *= 0.87
    a[:, :, :3] = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2RGB)
    sheet = Image.fromarray(a, 'RGBA')
    save(bleed(sheet), A('fx', 'opLeaves.webp'), quality=70, alpha_quality=80, method=6)


GROUPS = {'logo': (do_logo, ['logo']), 'icons': (do_icons, ['emblem']), 'menu': (do_menu, ['keyart']),
          'deck': (do_deck, ['keyart', 'logo']), 'ranks': (do_ranks, []), 'crests': (do_crests, ['crest-victory', 'crest-defeat']), 'maps': (do_maps, []),
          'leaves': (do_leaves, list(k for k in LEAF_CELLS if k.startswith('leaf-')))}
if __name__ == '__main__':
    for g in sys.argv[1:] or GROUPS:
        fn, need = GROUPS[g]
        if has(*need): fn()
        else: print(g, ': raw images missing', need)
