"""Builds assets/outfit/: the CC0 fabric scans (Poly Haven) from which the outfit material takes its relief, its roughness and
its tint variations (src/06e-gear.js, gearScan). build.py ships them in the page base (window.BASE_ASSETS.cloths and .tintScan).

Layout shared by both images (768 x 512):
  - canvas (rough_linen, 27 cm square): a whole 512 x 512 tile at the top left, tileable in both directions;
  - knit (knitted_fleece): 14 cm of scan at 256 x 256, top right (gloves, balaclavas, collars);
  - leather (brown_leather): 20 cm of scan at 256 x 256, bottom right (palms, boots).
cloths.webp: red and green = normal (OpenGL convention, like nor_gl), blue = roughness.
tintScan.webp (384 x 256, same layout at half scale): the scan luminance, brought to a mean of 128 and a standard deviation
of 32 (the variations only, not the color).

Sources (2K jpg from dl.polyhaven.org: diff, nor_gl, rough) in assets_src/polyhaven/<nom>/ (diff.jpg, nor.jpg, rough.jpg),
folder ignored by git. Run: python3 tools/build_outfits.py (Pillow)."""
import io, json, pathlib
from PIL import Image, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent.parent
PH = ROOT / 'assets_src' / 'polyhaven'
OUT = ROOT / 'assets' / 'outfit'
# name, scan, scan size (cm), share of the scan kept (1: whole tile), cell (x, y, side) in the image
TILES = [
    ('canvasCloth', 'rough_linen', 27.07, 1.0, (0, 0, 512)),
    ('knitwear', 'knitted_fleece', 26.64, 14 / 26.64, (512, 0, 256)),
    ('leather', 'brown_leather', 40.0, 20 / 40.0, (512, 256, 256)),
]

def crop(im, part):
    if part >= 1: return im
    w = round(im.width * part); return im.crop((0, 0, w, w))

def webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()

def main():
    nrm = Image.new('RGB', (768, 512), (128, 128, 230))
    tin = Image.new('L', (768, 512), 128)
    for name, src, cm, part, (x, y, s) in TILES:
        d = PH / src
        n = crop(Image.open(d / 'nor.jpg').convert('RGB'), part).resize((s, s), Image.LANCZOS)
        r = crop(Image.open(d / 'rough.jpg').convert('L'), part).resize((s, s), Image.LANCZOS)
        c = crop(Image.open(d / 'diff.jpg').convert('L'), part).resize((s, s), Image.LANCZOS)
        R, G, _ = n.split()
        nrm.paste(Image.merge('RGB', (R, G, r)), (x, y))
        st = ImageStat.Stat(c); m, sd = st.mean[0], max(st.stddev[0], 1)
        tin.paste(c.point(lambda v: max(0, min(255, round(128 + (v - m) / sd * 32)))), (x, y))
        print(f'{name} : {src} ({cm:.0f} cm), {part * cm:.1f} cm en {s} px, mean roughness {ImageStat.Stat(r).mean[0] / 255:.2f}')
    OUT.mkdir(parents=True, exist_ok=True)
    # tint at half resolution: only variations of a few millimeters and up show on a soldier (and full
    # resolution would weigh 150 KB more)
    for f, data in (('cloths.webp', webp(nrm, 85)), ('tintScan.webp', webp(tin.resize((384, 256), Image.LANCZOS).convert('RGB'), 70))):
        (OUT / f).write_bytes(data); print(f, len(data) // 1024, 'KB')
    # credits (assets/tex/credits.json): one entry per scan, kept up to date
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if not c['key'].startswith('outfit-')]
    cr += [{'key': 'outfit-' + name, 'asset': src, 'source': 'Poly Haven', 'licence': 'CC0 1.0'} for name, src, *_ in TILES]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

main()
