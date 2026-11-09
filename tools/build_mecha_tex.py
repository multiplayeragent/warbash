"""Builds assets/tex/mecha/ and assets/tex/mechadark/: the mecha surfaces (13-kill streak, src/08f-mecha.js), drawn from CC0 textures.
build.py ships them like the other photo surfaces (dist/tex/<key>.<hash>.js); the game loads them at the launch of the first map and
keeps them (mechaTexLoad).

mecha (1024 px, one 1.1 m tile on the mecha): the armor plating.
  - paint: a painted tank metal (Poly Haven, green_metal_rust), desaturated and brought to the model's khaki;
  - wear: chips and scratches of worn paint (ambientCG, PaintedMetal004): its metal mask reveals the bare steel (attenuated: a
    maintained war machine, not a wreck), its normal gives the relief of the scratches, its roughness their shine; the paint darkens a
    little at the edge of the chips;
  - panel joints (grooves) and rivets (domes), like the earlier drawn texture (mechaArmorTex): in the color, the relief and
    the shine.
mechadark (512 px): the dark machinery and the steel of the actuators and cannons, a scratched painted plate (Poly Haven, blue_metal_plate),
  desaturated (the material gives the tint), roughness recentered.
rough.webp: roughness in green, metal in blue (three.js and tools/build_assets.py convention).

Sources in assets_src/ (ignored by git): polyhaven/green_metal_rust/, polyhaven/blue_metal_plate/ (2K jpg diff, nor_gl as nor.jpg,
arm), ambientcg/PaintedMetal004_1K-JPG/ (Color, NormalGL, Roughness, Metalness).
Run: python3 tools/build_mecha_tex.py (Pillow, numpy)."""
import io, json, pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
PH, AC = ROOT / 'assets_src' / 'polyhaven', ROOT / 'assets_src' / 'ambientcg'
N = 1024
KHAKI = np.array([98, 101, 78], np.float32) # average armor tint (sRGB), that of the earlier drawn texture
BARE = np.array([132, 132, 128], np.float32) # bare steel under the paint
WEAR = 0.55 # share of the wear kept

def load(p, size, mode='RGB'):
    return np.asarray(Image.open(p).convert(mode).resize((size, size), Image.LANCZOS), np.float32)

def webp(a, q):
    b = io.BytesIO(); Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8)).save(b, 'WEBP', quality=q, method=6); return b.getvalue()

def blur(a, r):
    return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255

def panels():
    """Height of the joints and rivets (0 flat, negative in a groove, positive on a rivet) and joint mask, tileable tile"""
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    h = np.zeros((N, N), np.float32); seam = np.zeros((N, N), np.float32)
    def dist(v, c): d = np.abs(v - c); return np.minimum(d, N - d)
    for c in (4, 384, 680): d = dist(x, c); g = np.exp(-(d / 5.5) ** 2); h -= g; seam = np.maximum(seam, g)
    for c in (4, 280, 600, 840): d = dist(y, c); g = np.exp(-(d / 5.5) ** 2); h -= g; seam = np.maximum(seam, g)
    for cx in (34, 414, 710):
        for cy in (34, 310, 630, 870):
            r = np.hypot(dist(x, cx), dist(y, cy)) / 9.0
            h += np.where(r < 1, np.sqrt(np.clip(1 - r * r, 0, 1)), 0) * 1.4
            seam = np.maximum(seam, 0.6 * np.exp(-((r - 1) / 0.15) ** 2)) # rivet outline
    return h, seam

def normal_from(h, k):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * k; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * k
    return -gx, gy # slope to a GL-type normal (y toward the top of the image)

def armor():
    paint = load(PH / 'green_metal_rust' / 'diff.jpg', N)
    g = paint.mean(2, keepdims=True); paint = paint * 0.65 + g * 0.35
    paint = paint * (KHAKI / paint.reshape(-1, 3).mean(0))
    w = AC / 'PaintedMetal004_1K-JPG'
    m = load(w / 'PaintedMetal004_1K-JPG_Metalness.jpg', N, 'L') / 255 * WEAR
    wc = load(w / 'PaintedMetal004_1K-JPG_Color.jpg', N).mean(2) / 255 # grain of the uncovered steel
    bare = BARE[None, None, :] * (0.8 + 0.4 * wc[..., None])
    lip = np.clip(blur(m, 3) - m, 0, 1) # edge of the chips: the paint darkens
    col = paint * (1 - 0.6 * lip[..., None])
    col = col * (1 - m[..., None]) + bare * m[..., None]
    h, seam = panels()
    col = col * (1 - 0.75 * seam[..., None]) # joints and rivet surroundings darkened
    # relief: wear scratches + joints and rivets
    wn = load(w / 'PaintedMetal004_1K-JPG_NormalGL.jpg', N) / 127.5 - 1
    nx, ny = normal_from(h, 0.9)
    vx, vy, vz = wn[..., 0] * 1.4 + nx, wn[..., 1] * 1.4 + ny, wn[..., 2]
    l = np.sqrt(vx * vx + vy * vy + vz * vz); nor = np.stack([vx / l, vy / l, vz / l], 2) * 127.5 + 127.5
    # shine: matte paint, brighter scratches, satin bare steel, matte joint bottoms
    wr = load(w / 'PaintedMetal004_1K-JPG_Roughness.jpg', N // 2, 'L') / 255
    mh = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((N // 2, N // 2), Image.LANCZOS), np.float32) / 255
    sh = np.asarray(Image.fromarray((seam * 255).astype(np.uint8)).resize((N // 2, N // 2), Image.LANCZOS), np.float32) / 255
    rough = np.clip(0.66 + (wr - 0.15) * 0.8, 0.3, 1) * (1 - mh) + 0.36 * mh
    rough = np.clip(rough + 0.2 * sh, 0, 1)
    rgh = np.stack([rough * 255, rough * 255, mh / WEAR * 255], 2) # blue: metal (uncovered steel)
    return col, nor, rgh

def dark():
    S = 512
    c = load(PH / 'blue_metal_plate' / 'diff.jpg', S).mean(2)
    c = c * (190 / c.mean()); col = np.stack([c, c, c], 2)
    nor = load(PH / 'blue_metal_plate' / 'nor.jpg', S)
    r = load(PH / 'blue_metal_plate' / 'arm.jpg', S)[..., 1] / 255
    r = np.clip(0.55 + (r - r.mean()) * 1.3, 0.2, 1)
    return col, nor, np.stack([r * 255, r * 255, np.zeros_like(r)], 2)

def main():
    total = 0
    for key, (col, nor, rgh) in (('mecha', armor()), ('mechadark', dark())):
        d = ROOT / 'assets' / 'tex' / key; d.mkdir(parents=True, exist_ok=True); sz = {}
        for kind, a, q in (('map', col, 82), ('normal', nor, 78), ('rough', rgh, 80)):
            b = webp(a, q); (d / (kind + '.webp')).write_bytes(b); sz[kind] = len(b) // 1024; total += len(b)
        print(key, sz, 'KB')
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if c['key'] not in ('mecha', 'mecha-wear', 'mechadark')]
    cr += [{'key': 'mecha', 'asset': 'green_metal_rust', 'source': 'Poly Haven', 'licence': 'CC0 1.0'},
           {'key': 'mecha-wear', 'asset': 'PaintedMetal004', 'source': 'ambientCG', 'licence': 'CC0 1.0'},
           {'key': 'mechadark', 'asset': 'blue_metal_plate', 'source': 'Poly Haven', 'licence': 'CC0 1.0'}]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('total', total // 1024, 'KB')

main()
