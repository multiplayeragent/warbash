"""Builds assets/fx/wearMap.webp: the wear layer shared by all the scenery materials, drawn from CC0 ambientCG textures. build.py
ships it as an effect texture (dist/tex/fx_wearMap.<hash>.js), loaded at map launch; the game stores it in the channels of
the scenery macro texture (texLabMacro, src/02b-texlab.js), which used to give procedural noise.

A 1536 x 512 grayscale image (lossy WebP subsamples color: data stored in the channels of a
single image would bleed into each other), three tileable 512 x 512 cells:
  - grime grain (SurfaceImperfections017): green channel, mid-scale color variation, dust, snow edge;
  - stains (SurfaceImperfections013): blue channel, halos and smudges on color and roughness, grime in corners;
  - streaks (SurfaceImperfections003): alpha channel, vertical trails on walls and a band of grime at the foot.
Each cell is brought to a mean of 128 and to the cell's target standard deviation, like the noise it replaces.

Sources (1K jpg from ambientcg.com) in assets_src/ambientcg/<Name>_1K-JPG/, folder ignored by git.
Run: python3 tools/build_wear.py (Pillow, numpy)."""
import io, json, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
AC = ROOT / 'assets_src' / 'ambientcg'
# (cell name, source, target standard deviation out of 255)
CELLS = [('grain', 'SurfaceImperfections017', 34), ('stains', 'SurfaceImperfections013', 40), ('drips', 'SurfaceImperfections003', 40)]
N = 512

def cell(name, sd):
    im = np.asarray(Image.open(AC / f'{name}_1K-JPG' / f'{name}_1K-JPG_Color.jpg').convert('L'), np.float32)
    # tileable downscale: border copied from the other side before downscaling, then cropped
    p = 32; big = np.pad(im, p, mode='wrap'); k = N / im.shape[0]
    r = np.asarray(Image.fromarray(big).resize((round(big.shape[1] * k), round(big.shape[0] * k)), Image.LANCZOS), np.float32)
    q = round(p * k); r = r[q:q + N, q:q + N]
    r = 128 + (r - r.mean()) / max(r.std(), 1) * sd
    return np.clip(np.round(r), 0, 255).astype(np.uint8)

def main():
    out = np.concatenate([cell(src, sd) for _, src, sd in CELLS], axis=1)
    d = ROOT / 'assets' / 'fx'; d.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO(); Image.fromarray(out).save(buf, 'WEBP', quality=72, method=6)
    (d / 'wearMap.webp').write_bytes(buf.getvalue()); print('wearMap.webp', len(buf.getvalue()) // 1024, 'KB')
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if not c['key'].startswith('wear-')]
    cr += [{'key': 'wear-' + k, 'asset': v, 'source': 'ambientCG', 'licence': 'CC0 1.0'} for k, v, _ in CELLS]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

main()
