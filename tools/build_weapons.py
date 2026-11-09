"""Builds assets/firearm/surface.webp: the weapon wear, drawn from CC0 ambientCG textures, which the weapon material reads in
triplanar in the weapon's frame, at real scale (src/06-weapons.js, gunSurfTexture and GUN_SURF_GLSL). build.py ships it in
the page base (window.BASE_ASSETS.grain), in place of the plaster roughness that used to serve as grain.

A 1024 x 512 grayscale image: lossy WebP subsamples color, so data stored in the
red, green and blue channels of one image bleed into each other (the scratches showed up in the haze). The game puts the
four cells back into the channels of a tileable 512 x 512 texture (11 cm of weapon):
  - fine scratches (Scratches003, 512 x 512 top left): mask, black for nothing, white for a scratch, lines thickened by one
    pixel before downscaling; green channel;
  - haze and fingerprints (SurfaceImperfections008, 256 x 256 top right, enlarged twice): mean 128, standard deviation 40;
    red channel;
  - fine mottling of a polymer (roughness of Plastic010, 256 x 256 bottom right, repeated twice in each direction): mean 128,
    standard deviation 36; blue channel;
  - wood grain (luminance of the Poly Haven european_walnut_veneer_04 veneer, 11 cm of scan, horizontal grain; 256 x 512 on the right,
    stretched twice along the grain, made tileable by blending with its copy offset by half a cell): mean 128, standard deviation
    40; alpha channel, read only by the wood materials.

Sources (1K jpg from ambientcg.com) in assets_src/ambientcg/<Name>_1K-JPG/, and the 4K jpg of the veneer color (Poly Haven) in
assets_src/polyhaven/european_walnut_veneer_04/diff4k.jpg; folders ignored by git.
Run: python3 tools/build_weapons.py (Pillow)."""
import io, json, pathlib
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent.parent
AC = ROOT / 'assets_src' / 'ambientcg'
PH = ROOT / 'assets_src' / 'polyhaven'
OUT = ROOT / 'assets' / 'firearm'
SRC = {'haze': 'SurfaceImperfections008', 'scratches': 'Scratches003', 'marbling': 'Plastic010'}
WOODGRAIN = 'european_walnut_veneer_04' # Poly Haven, 1 m of mapping at 4096 px

def gray(name, kind):
    return Image.open(AC / f'{name}_1K-JPG' / f'{name}_1K-JPG_{kind}.jpg').convert('L')

def norm(im, sd):
    st = ImageStat.Stat(im); m, s = st.mean[0], max(st.stddev[0], 1)
    return im.point(lambda v: max(0, min(255, round(128 + (v - m) / s * sd))))

def seamless(im):
    # blend with the copy offset by half a cell (its edges are the middle of the original): opaque in the center, transparent at the edges
    n = im.width; sh = ImageChops.offset(im, n // 2, n // 2)
    m = Image.new('L', (n, n)); d = ImageDraw.Draw(m)
    for i in range(n // 2): d.rectangle((i, i, n - 1 - i, n - 1 - i), fill=round(255 * min(1, i / (n * 0.3))))
    return Image.composite(im, sh, m)

def main():
    g = gray(SRC['scratches'], 'Color').filter(ImageFilter.MaxFilter(3)).resize((512, 512), Image.LANCZOS).point(lambda v: min(255, v * 2))
    r = norm(gray(SRC['haze'], 'Color').resize((256, 256), Image.LANCZOS), 40)
    b = norm(gray(SRC['marbling'], 'Roughness').resize((256, 256), Image.LANCZOS), 36)
    w = seamless(norm(Image.open(PH / WOODGRAIN / 'diff4k.jpg').convert('L').crop((0, 0, 450, 450)), 40)).resize((256, 512), Image.LANCZOS)
    im = Image.new('L', (1024, 512), 128)
    im.paste(g, (0, 0)); im.paste(r, (512, 0)); im.paste(b, (512, 256)); im.paste(w, (768, 0))
    OUT.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=70, method=6)
    (OUT / 'surface.webp').write_bytes(buf.getvalue()); print('surface.webp', len(buf.getvalue()) // 1024, 'KB')
    # credits (assets/tex/credits.json): one entry per source
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if not c['key'].startswith('weapon-')]
    cr += [{'key': 'weapon-' + k, 'asset': v, 'source': 'ambientCG', 'licence': 'CC0 1.0'} for k, v in SRC.items()]
    cr += [{'key': 'weapon-wood', 'asset': WOODGRAIN, 'source': 'Poly Haven', 'licence': 'CC0 1.0'}]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

main()
